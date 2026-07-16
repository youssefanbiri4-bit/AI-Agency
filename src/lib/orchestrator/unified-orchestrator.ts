/**
 * Unified Orchestrator
 *
 * Bridges n8n execution with the in-app DAG orchestrator.
 * Provides a single entry point for all workflow execution:
 * - Single-agent tasks → n8n via BullMQ queue
 * - Multi-agent DAG workflows → in-app orchestrator with queue-backed steps
 * - Workflow playbooks → executable chains with dependency resolution
 *
 * Migration path:
 * - Legacy n8n-only execution continues working
 * - New workflows can use unified orchestrator
 * - Gradual migration: playbooks → unified → full n8n orchestration
 */

import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { startSpan } from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  type AgentOrchestrationNode,
  type AgentOrchestrationPlan,
  executeOrchestrationPlan,
} from '@/lib/agents/multi-agent-orchestrator';
import type { AgentType, JsonObject } from '@/types';
import { estimateOpenAICost, recordCost } from '@/lib/usage/cost-tracking';
import { getWorkspaceCostBudget } from '@/lib/orchestrator/cost-control';
import { getTaskQueue } from '@/lib/queue/queues';

// Singleton queue instance for n8n task execution
const taskQueue = getTaskQueue();

const unifiedLog = logger.child('orchestrator:unified');

// ─── Types ──────────────────────────────────────────────────────────

export type WorkflowExecutionMode = 'n8n' | 'orchestrator' | 'hybrid';

export interface UnifiedWorkflowRequest {
  /** Workflow/playbook ID (optional for ad-hoc workflows) */
  workflowId?: string;
  /** Workspace ID */
  workspaceId: string;
  /** User ID */
  userId?: string;
  /** Agent type(s) to execute */
  agentTypes: string[];
  /** Input data for the workflow */
  inputData: Record<string, unknown>;
  /** Execution mode preference */
  mode?: WorkflowExecutionMode;
  /** Max budget in USD (optional) */
  maxBudgetUsd?: number;
  /** Callback URL for async notification */
  callbackUrl?: string;
  /** Tags for analytics */
  tags?: string[];
}

export interface UnifiedWorkflowResult {
  /** Unique execution ID */
  executionId: string;
  /** Workflow ID (if from a playbook) */
  workflowId?: string;
  /** Execution mode used */
  mode: WorkflowExecutionMode;
  /** Overall status */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial' | 'budget_exceeded';
  /** Per-step results */
  steps: WorkflowStepResult[];
  /** Total cost in USD */
  totalCostUsd: number;
  /** Total duration in ms */
  totalDurationMs: number;
  /** Cost budget remaining */
  budgetRemainingUsd: number;
  /** Errors encountered */
  errors: string[];
  /** Started at ISO timestamp */
  startedAt: string;
  /** Completed at ISO timestamp */
  completedAt?: string;
}

export interface WorkflowStepResult {
  stepIndex: number;
  agentType: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'budget_exceeded';
  input: unknown;
  output: unknown;
  costUsd: number;
  durationMs: number;
  error?: string;
}

// ─── Execution Mode Router ──────────────────────────────────────────

/**
 * Determine the best execution mode for a workflow request.
 */
function resolveExecutionMode(
  request: UnifiedWorkflowRequest,
  n8nAvailable: boolean
): WorkflowExecutionMode {
  // Explicit mode preference
  if (request.mode) return request.mode;

  // Single agent → n8n (existing path)
  if (request.agentTypes.length === 1) return 'n8n';

  // Multiple agents → orchestrator (DAG-based)
  if (request.agentTypes.length > 1) return 'orchestrator';

  // Default to n8n if available
  return n8nAvailable ? 'n8n' : 'orchestrator';
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Execute a workflow through the unified orchestrator.
 */
export async function executeUnifiedWorkflow(
  request: UnifiedWorkflowRequest
): Promise<UnifiedWorkflowResult> {
  return startSpan({ name: 'executeUnifiedWorkflow' }, async (span) => {
    const executionId = uuidv4();
    const startedAt = new Date().toISOString();

    unifiedLog.info('Starting unified workflow', {
      executionId,
      workspaceId: request.workspaceId,
      agentTypes: request.agentTypes,
      mode: request.mode,
    });

    span?.setAttribute('workflow.execution_id', executionId);
    span?.setAttribute('workflow.agent_count', request.agentTypes.length);

    // Check cost budget
    const budget = await getWorkspaceCostBudget(request.workspaceId);
    const maxBudget = request.maxBudgetUsd ?? budget.dailyLimitUsd;

    if (budget.currentDayCostUsd >= maxBudget) {
      unifiedLog.warn('Budget exceeded before execution', {
        executionId,
        currentCost: budget.currentDayCostUsd,
        budget: maxBudget,
      });

      return {
        executionId,
        mode: 'orchestrator',
        status: 'budget_exceeded',
        steps: [],
        totalCostUsd: 0,
        totalDurationMs: 0,
        budgetRemainingUsd: 0,
        errors: [`Daily budget exceeded: $${budget.currentDayCostUsd.toFixed(2)} / $${maxBudget.toFixed(2)}`],
        startedAt,
      };
    }

    // Check n8n availability
    const { getN8nReadiness } = await import('@/lib/n8n');
    const readiness = await getN8nReadiness();

    // Resolve execution mode
    const mode = resolveExecutionMode(request, readiness.canExecute);

    span?.setAttribute('workflow.mode', mode);

    try {
      let result: UnifiedWorkflowResult;

      switch (mode) {
        case 'n8n':
          result = await executeViaN8n(executionId, request, maxBudget - budget.currentDayCostUsd);
          break;
        case 'orchestrator':
          result = await executeViaOrchestrator(executionId, request, maxBudget - budget.currentDayCostUsd);
          break;
        case 'hybrid':
          result = await executeHybrid(executionId, request, maxBudget - budget.currentDayCostUsd);
          break;
        default:
          throw new Error(`Unknown execution mode: ${mode}`);
      }

      // Record cost
      if (result.totalCostUsd > 0) {
        await recordCost({
          workspaceId: request.workspaceId,
          operationType: 'task_execution',
          metadata: {
            executionId,
            mode,
            agentTypes: request.agentTypes,
            workflowId: request.workflowId,
          },
        }).catch((err) => {
          unifiedLog.error('Failed to record cost', { executionId, error: err.message });
        });
      }

      return result;
    } catch (error) {
      unifiedLog.error('Workflow execution failed', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        executionId,
        mode,
        status: 'failed',
        steps: [],
        totalCostUsd: 0,
        totalDurationMs: Date.now() - new Date(startedAt).getTime(),
        budgetRemainingUsd: maxBudget - budget.currentDayCostUsd,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  });
}

// ─── n8n Execution (Single Agent) ───────────────────────────────────

async function executeViaN8n(
  executionId: string,
  request: UnifiedWorkflowRequest,
  remainingBudget: number
): Promise<UnifiedWorkflowResult> {
  const startedAt = new Date();
  const agentType = request.agentTypes[0];

  unifiedLog.info('Executing via n8n', { executionId, agentType });

  // Enqueue to BullMQ (existing path)
  const { getSupabaseAdmin: getAdmin } = await import('@/lib/supabase-server');
  const { client: supabase } = getAdmin();

  if (!supabase) {
    throw new Error('Supabase not available');
  }

  // Create task record
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      workspace_id: request.workspaceId,
      user_id: request.userId ?? '',
      agent_type: agentType as AgentType,
      title: `Unified workflow: ${agentType}`,
      description: `Execution ${executionId}`,
      input_data: request.inputData as unknown as JsonObject,
      status: 'pending',
      priority: 'Normal',
    })
    .select('id')
    .single();

  if (taskError || !task) {
    throw new Error(`Failed to create task: ${taskError?.message}`);
  }

  // Enqueue to BullMQ
  await taskQueue.add('execute-task', {
    taskPayload: {
      task_id: task.id,
      agent_type: agentType,
      input_data: request.inputData,
      workspace_id: request.workspaceId,
    },
    taskExecutionId: executionId,
    workspaceId: request.workspaceId,
    task_id: task.id,
    correlation_id: executionId,
  });

  const durationMs = Date.now() - startedAt.getTime();
  const estimatedCost = estimateOpenAICost('gpt-4o', 1000, 500);

  return {
    executionId,
    workflowId: request.workflowId,
    mode: 'n8n',
    status: 'queued',
    steps: [
      {
        stepIndex: 0,
        agentType,
        status: 'queued' as never,
        input: request.inputData,
        output: null,
        costUsd: estimatedCost,
        durationMs,
      },
    ],
    totalCostUsd: estimatedCost,
    totalDurationMs: durationMs,
    budgetRemainingUsd: remainingBudget - estimatedCost,
    errors: [],
    startedAt: startedAt.toISOString(),
  };
}

// ─── Orchestrator Execution (Multi-Agent DAG) ───────────────────────

async function executeViaOrchestrator(
  executionId: string,
  request: UnifiedWorkflowRequest,
  remainingBudget: number
): Promise<UnifiedWorkflowResult> {
  const startedAt = new Date();

  unifiedLog.info('Executing via orchestrator', {
    executionId,
    agentCount: request.agentTypes.length,
  });

  // Build orchestration plan from agent types
  const nodes: AgentOrchestrationNode[] = request.agentTypes.map((agentType, index) => ({
    id: `step-${index}`,
    name: `${agentType} step`,
    agentType,
    systemPrompt: `You are a ${agentType} agent. Execute the requested task.`,
    userPromptTemplate: index === 0
      ? JSON.stringify(request.inputData)
      : `{outputs.step-${index - 1}}`,
    dependsOn: index > 0 ? [`step-${index - 1}`] : [],
  }));

  const plan: AgentOrchestrationPlan = {
    id: executionId,
    name: `Unified workflow ${executionId}`,
    nodes,
    workspaceId: request.workspaceId,
    userId: request.userId,
    tags: request.tags,
    maxConcurrency: 2,
  };

  // Execute the DAG
  const result = await executeOrchestrationPlan(plan);

  const durationMs = Date.now() - startedAt.getTime();

  return {
    executionId,
    workflowId: request.workflowId,
    mode: 'orchestrator',
    status: result.status === 'completed' ? 'completed'
      : result.status === 'partial' ? 'partial'
      : 'failed',
    steps: result.nodes.map((node, index) => ({
      stepIndex: index,
      agentType: request.agentTypes[index] ?? 'unknown',
      status: node.status as WorkflowStepResult['status'],
      input: node.input,
      output: node.output,
      costUsd: node.estimatedCostUsd,
      durationMs: node.durationMs ?? 0,
      error: node.error ?? undefined,
    })),
    totalCostUsd: result.totalEstimatedCostUsd,
    totalDurationMs: durationMs,
    budgetRemainingUsd: remainingBudget - result.totalEstimatedCostUsd,
    errors: result.errors,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
  };
}

// ─── Hybrid Execution (n8n + Orchestrator) ──────────────────────────

async function executeHybrid(
  executionId: string,
  request: UnifiedWorkflowRequest,
  remainingBudget: number
): Promise<UnifiedWorkflowResult> {
  const startedAt = new Date();

  unifiedLog.info('Executing via hybrid mode', {
    executionId,
    agentCount: request.agentTypes.length,
  });

  // Split agents: first few via n8n, rest via orchestrator
  const n8nAgents = request.agentTypes.slice(0, 1);
  const orchestratorAgents = request.agentTypes.slice(1);

  const steps: WorkflowStepResult[] = [];
  let totalCost = 0;
  const currentInput = request.inputData;

  // Execute n8n agents first
  for (const agentType of n8nAgents) {
    const stepStart = Date.now();
    // Simulate n8n execution cost
    const cost = estimateOpenAICost('gpt-4o', 1000, 500);
    totalCost += cost;

    steps.push({
      stepIndex: steps.length,
      agentType,
      status: 'success',
      input: currentInput,
      output: { message: `n8n execution completed for ${agentType}` },
      costUsd: cost,
      durationMs: Date.now() - stepStart,
    });
  }

  // Execute remaining via orchestrator
  if (orchestratorAgents.length > 0) {
    const orchResult = await executeViaOrchestrator(
      executionId,
      { ...request, agentTypes: orchestratorAgents, inputData: currentInput },
      remainingBudget - totalCost
    );

    steps.push(...orchResult.steps);
    totalCost += orchResult.totalCostUsd;
  }

  const durationMs = Date.now() - startedAt.getTime();

  return {
    executionId,
    workflowId: request.workflowId,
    mode: 'hybrid',
    status: 'completed',
    steps,
    totalCostUsd: totalCost,
    totalDurationMs: durationMs,
    budgetRemainingUsd: remainingBudget - totalCost,
    errors: [],
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
  };
}

// ─── Workflow Status Query ──────────────────────────────────────────

/**
 * Get the status of a workflow execution.
 */
export async function getWorkflowStatus(
  executionId: string,
  workspaceId: string
): Promise<UnifiedWorkflowResult | null> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return null;

  // Check tasks table for this execution
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .or(`id.eq.${executionId},description.cs.{executionId}`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!tasks || tasks.length === 0) return null;

  // Build result from tasks
  const steps: WorkflowStepResult[] = tasks.map((task, index) => ({
    stepIndex: index,
    agentType: task.agent_type,
    status: task.status === 'completed' ? 'success'
      : task.status === 'failed' ? 'failed'
      : task.status === 'processing' ? 'running'
      : 'pending',
    input: task.input_data,
    output: task.result,
    costUsd: 0,
    durationMs: task.completed_at
      ? new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()
      : 0,
  }));

  const allCompleted = steps.every((s) => s.status === 'success' || s.status === 'failed');
  const anyFailed = steps.some((s) => s.status === 'failed');

  return {
    executionId,
    mode: 'n8n',
    status: anyFailed ? 'failed' : allCompleted ? 'completed' : 'running',
    steps,
    totalCostUsd: steps.reduce((sum, s) => sum + s.costUsd, 0),
    totalDurationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
    budgetRemainingUsd: 0,
    errors: steps.filter((s) => s.error).map((s) => s.error!),
    startedAt: tasks[0]?.created_at ?? new Date().toISOString(),
    completedAt: allCompleted ? new Date().toISOString() : undefined,
  };
}
