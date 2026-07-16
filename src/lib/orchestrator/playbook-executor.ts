/**
 * Workflow Playbook Executor
 *
 * Makes workflow playbooks (stored in DB) executable.
 * Converts playbook steps into a DAG and executes via the unified orchestrator.
 *
 * Features:
 * - Load playbook from database
 * - Convert steps to orchestration nodes
 * - Dependency resolution
 * - Progress tracking
 * - Error recovery
 */

import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  type AgentOrchestrationNode,
  type AgentOrchestrationPlan,
  executeOrchestrationPlan,
} from '@/lib/agents/multi-agent-orchestrator';
import {
  type UnifiedWorkflowResult,
  type WorkflowStepResult,
} from './unified-orchestrator';
import { canAfford, recordWorkflowCost } from './cost-control';

const executorLog = logger.child('orchestrator:playbook-executor');

// ─── Types ──────────────────────────────────────────────────────────

export interface PlaybookStep {
  id: string;
  agentType: string;
  name: string;
  prompt: string;
  dependsOn: string[];
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface PlaybookDefinition {
  id: string;
  name: string;
  description?: string;
  steps: PlaybookStep[];
  workspaceId: string;
  userId?: string;
  config?: {
    maxConcurrency?: number;
    maxBudgetUsd?: number;
    timeoutMs?: number;
  };
}

export interface PlaybookExecutionResult extends UnifiedWorkflowResult {
  playbookId: string;
  playbookName: string;
  stepResults: Map<string, WorkflowStepResult>;
}

// ─── Playbook Loading ───────────────────────────────────────────────

/**
 * Load a playbook from the database.
 */
export async function loadPlaybook(
  playbookId: string,
  workspaceId: string
): Promise<PlaybookDefinition | null> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return null;

  try {
    const { data: playbook, error } = await supabase
      .from('agent_workflow_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !playbook) {
      executorLog.warn('Playbook not found', { playbookId, workspaceId });
      return null;
    }

    const steps = (playbook.steps as unknown as PlaybookStep[]) ?? [];

    return {
      id: playbook.id,
      name: playbook.name,
      description: playbook.description ?? undefined,
      steps,
      workspaceId,
      userId: playbook.user_id,
      config: (playbook.metadata as Record<string, unknown>) as PlaybookDefinition['config'],
    };
  } catch (err) {
    executorLog.error('Failed to load playbook', {
      playbookId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── Playbook Execution ─────────────────────────────────────────────

/**
 * Execute a playbook through the unified orchestrator.
 */
export async function executePlaybook(
  playbookId: string,
  workspaceId: string,
  inputData: Record<string, unknown>,
  userId?: string
): Promise<PlaybookExecutionResult> {
  const executionId = uuidv4();
  const startedAt = new Date();

  executorLog.info('Executing playbook', {
    executionId,
    playbookId,
    workspaceId,
  });

  // Load playbook
  const playbook = await loadPlaybook(playbookId, workspaceId);
  if (!playbook) {
    return {
      executionId,
      playbookId,
      playbookName: 'Unknown',
      mode: 'orchestrator',
      status: 'failed',
      steps: [],
      totalCostUsd: 0,
      totalDurationMs: 0,
      budgetRemainingUsd: 0,
      errors: ['Playbook not found'],
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      stepResults: new Map(),
    };
  }

  // Check budget
  if (playbook.config?.maxBudgetUsd) {
    const { allowed, reason } = await canAfford(workspaceId, playbook.config.maxBudgetUsd);
    if (!allowed) {
      return {
        executionId,
        playbookId,
        playbookName: playbook.name,
        mode: 'orchestrator',
        status: 'budget_exceeded',
        steps: [],
        totalCostUsd: 0,
        totalDurationMs: 0,
        budgetRemainingUsd: 0,
        errors: [reason ?? 'Budget exceeded'],
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        stepResults: new Map(),
      };
    }
  }

  // Convert playbook steps to orchestration nodes
  const nodes: AgentOrchestrationNode[] = playbook.steps.map((step) => ({
    id: step.id,
    name: step.name,
    agentType: step.agentType,
    systemPrompt: step.prompt,
    userPromptTemplate: step.dependsOn.length > 0
      ? `{outputs.${step.dependsOn[step.dependsOn.length - 1]}}`
      : JSON.stringify(inputData),
    dependsOn: step.dependsOn,
    model: step.config?.model,
    temperature: step.config?.temperature,
    maxTokens: step.config?.maxTokens,
  }));

  // Create orchestration plan
  const plan: AgentOrchestrationPlan = {
    id: executionId,
    name: playbook.name,
    nodes,
    workspaceId,
    userId,
    maxConcurrency: playbook.config?.maxConcurrency ?? 2,
  };

  // Execute
  const result = await executeOrchestrationPlan(plan);

  const durationMs = Date.now() - startedAt.getTime();

  // Record costs per step
  for (const node of result.nodes) {
    if (node.estimatedCostUsd > 0) {
      await recordWorkflowCost({
        workspaceId,
        executionId,
        operationType: 'playbook_execution',
        costUsd: node.estimatedCostUsd,
        model: node.model ?? undefined,
        tokensUsed: node.tokenCount,
        metadata: {
          playbookId,
          nodeId: node.nodeId,
          nodeName: node.name,
        },
      });
    }
  }

  // Update playbook usage count (best-effort)
  const { client: supabase } = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase
        .from('agent_workflow_playbooks')
        .update({
          usage_count: (playbook.steps.length > 0 ? 1 : 0),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', playbookId);
    } catch {
      // Error intentionally swallowed — best-effort usage counter update
    }
  }

  // Build step results map
  const stepResults = new Map<string, WorkflowStepResult>();
  for (let i = 0; i < result.nodes.length; i++) {
    const node = result.nodes[i];
    const step = playbook.steps[i];
    if (step && node) {
      stepResults.set(step.id, {
        stepIndex: i,
        agentType: step.agentType,
        status: node.status as WorkflowStepResult['status'],
        input: node.input,
        output: node.output,
        costUsd: node.estimatedCostUsd,
        durationMs: node.durationMs ?? 0,
        error: node.error ?? undefined,
      });
    }
  }

  return {
    executionId,
    playbookId,
    playbookName: playbook.name,
    mode: 'orchestrator',
    status: result.status === 'completed' ? 'completed'
      : result.status === 'partial' ? 'partial'
      : 'failed',
    steps: result.nodes.map((node, index) => ({
      stepIndex: index,
      agentType: playbook.steps[index]?.agentType ?? 'unknown',
      status: node.status as WorkflowStepResult['status'],
      input: node.input,
      output: node.output,
      costUsd: node.estimatedCostUsd,
      durationMs: node.durationMs ?? 0,
      error: node.error ?? undefined,
    })),
    totalCostUsd: result.totalEstimatedCostUsd,
    totalDurationMs: durationMs,
    budgetRemainingUsd: (playbook.config?.maxBudgetUsd ?? 100) - result.totalEstimatedCostUsd,
    errors: result.errors,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    stepResults,
  };
}

// ─── Playbook Validation ────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a playbook definition before execution.
 */
export function validatePlaybook(playbook: PlaybookDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (playbook.steps.length === 0) {
    errors.push('Playbook has no steps');
  }

  // Check for missing dependencies
  const stepIds = new Set(playbook.steps.map((s) => s.id));
  for (const step of playbook.steps) {
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) {
        errors.push(`Step "${step.name}" depends on unknown step "${dep}"`);
      }
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(stepId: string): boolean {
    if (inStack.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visited.add(stepId);
    inStack.add(stepId);

    const step = playbook.steps.find((s) => s.id === stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (hasCycle(dep)) return true;
      }
    }

    inStack.delete(stepId);
    return false;
  }

  for (const step of playbook.steps) {
    if (hasCycle(step.id)) {
      errors.push(`Circular dependency detected involving step "${step.name}"`);
      break;
    }
  }

  // Check for duplicate IDs
  const idCounts = new Map<string, number>();
  for (const step of playbook.steps) {
    idCounts.set(step.id, (idCounts.get(step.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push(`Duplicate step ID: "${id}"`);
    }
  }

  // Warnings
  if (playbook.steps.length > 10) {
    warnings.push('Playbook has more than 10 steps. Consider breaking it into smaller workflows.');
  }

  for (const step of playbook.steps) {
    if (!step.prompt || step.prompt.length < 10) {
      warnings.push(`Step "${step.name}" has a very short prompt`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
