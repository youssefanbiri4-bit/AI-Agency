/**
 * Multi-Agent Orchestrator
 *
 * Chains multiple AI agents together in a directed acyclic graph (DAG),
 * where each agent's output can be mapped as input to subsequent agents.
 *
 * Features:
 * - DAG-based agent workflow execution with dependency resolution
 * - Input/output mapping between chained agents
 * - Parallel execution of independent agents
 * - Circuit breaker + concurrency limiting per step
 * - Result aggregation across all agents
 * - Cost tracking + performance monitoring per agent in chain
 */

import 'server-only';

import { startSpan } from '@sentry/nextjs';
import { generateTextWithOpenAI, type GenerateTextProviderInput } from '@/lib/ai/text-provider';
import { executeWithClaude, type ClaudeExecutorInput } from '@/features/agents/services/claude-executor';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { getAIPerformanceMonitor } from '@/lib/monitoring/ai-performance';
import { estimateOpenAICost, estimateClaudeCost, recordCost } from '@/lib/usage/cost-tracking';

const orchestratorLog = logger.child('agents:orchestrator');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentOrchestrationNode {
  /** Unique ID for this agent node in the workflow */
  id: string;
  /** Human-readable name */
  name: string;
  /** The agent type (maps to agent catalog) */
  agentType: string;
  /** System prompt for this agent */
  systemPrompt: string;
  /** User prompt template — can reference {outputs.previousNodeId} */
  userPromptTemplate: string;
  /** IDs of nodes that must complete before this one runs */
  dependsOn: string[];
  /** Max tokens for this generation */
  maxTokens?: number;
  /** Temperature for this generation */
  temperature?: number;
  /** Model override */
  model?: string;
  /** Tags for analytics grouping */
  tags?: string[];
  /** AI engine to use for this node. Defaults to 'openai'. Set to 'claude' to route through the Anthropic Claude API. */
  engine?: 'openai' | 'claude';
}

export interface AgentOrchestrationPlan {
  /** Unique workflow execution ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** All nodes in the DAG */
  nodes: AgentOrchestrationNode[];
  /** Workspace ID for cost tracking */
  workspaceId: string;
  /** User ID for audit */
  userId?: string | null;
  /** Global tags for the workflow */
  tags?: string[];
  /** Max concurrency (default: 2) */
  maxConcurrency?: number;
}

export interface AgentNodeResult {
  nodeId: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input: string;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  model: string | null;
  estimatedCostUsd: number;
  tokenCount: number;
  cached: boolean;
}

export interface AgentOrchestrationResult {
  planId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  nodes: AgentNodeResult[];
  totalDurationMs: number;
  totalEstimatedCostUsd: number;
  totalTokenCount: number;
  cachedCount: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

// ─── Core Orchestrator ───────────────────────────────────────────────────────

/**
 * Resolve the execution order for a DAG of nodes using topological sort.
 * Throws if a cycle is detected.
 */
function resolveExecutionOrder(nodes: AgentOrchestrationNode[]): AgentOrchestrationNode[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!nodeMap.has(dep)) {
        throw new Error(
          `Node "${node.id}" depends on "${dep}" which does not exist in the plan.`
        );
      }
      adjList.get(dep)?.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  // Topological sort
  const levels: AgentOrchestrationNode[][] = [];
  const queue: string[] = [];

  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let processed = 0;

  while (queue.length > 0) {
    const currentLevel: AgentOrchestrationNode[] = [];
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) currentLevel.push(node);
      processed++;

      for (const neighbor of adjList.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (currentLevel.length > 0) levels.push(currentLevel);
  }

  if (processed !== nodes.length) {
    throw new Error('Cycle detected in agent workflow DAG. Cannot resolve execution order.');
  }

  return levels;
}

/**
 * Render a user prompt template by resolving {outputs.nodeId} references
 * with the actual outputs from completed nodes.
 */
function renderPromptTemplate(
  template: string,
  outputs: Map<string, AgentNodeResult>
): string {
  return template.replace(/\{outputs\.([a-zA-Z0-9_-]+)\}/g, (match, nodeId) => {
    const nodeResult = outputs.get(nodeId);
    if (!nodeResult?.output) {
      return match; // Keep unreplaced if no output yet
    }
    return nodeResult.output;
  });
}

/**
 * Collect all referenced output dependencies from a prompt template.
 */
function extractTemplateDependencies(template: string): string[] {
  const deps: string[] = [];
  const regex = /\{outputs\.([a-zA-Z0-9_-]+)\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    deps.push(match[1]);
  }
  return [...new Set(deps)];
}

/**
 * Execute a single agent node.
 */
async function executeNode(
  node: AgentOrchestrationNode,
  outputs: Map<string, AgentNodeResult>,
  workspaceId: string,
  userId?: string | null,
): Promise<AgentNodeResult> {
  const startTime = Date.now();
  const result: AgentNodeResult = {
    nodeId: node.id,
    name: node.name,
    status: 'running',
    input: '',
    output: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    model: node.model ?? null,
    estimatedCostUsd: 0,
    tokenCount: 0,
    cached: false,
  };

  try {
    // Check if all dependencies are resolved
    const unresolvedDeps = node.dependsOn.filter((depId) => {
      const dep = outputs.get(depId);
      return !dep || dep.status !== 'success';
    });

    if (unresolvedDeps.length > 0) {
      result.status = 'skipped';
      result.error = `Skipped: dependencies unresolved: ${unresolvedDeps.join(', ')}`;
      result.completedAt = new Date().toISOString();
      result.durationMs = 0;
      return result;
    }

    // Render the prompt template with outputs from previous nodes
    const renderedPrompt = renderPromptTemplate(node.userPromptTemplate, outputs);
    result.input = renderedPrompt;

    // Check for missing template references
    const templateDeps = extractTemplateDependencies(node.userPromptTemplate);
    const missingDeps = templateDeps.filter((depId) => !outputs.has(depId));
    if (missingDeps.length > 0) {
      orchestratorLog.warn('Node has unresolved template dependencies', {
        nodeId: node.id,
        missingDeps,
      });
    }

    // Route to the appropriate AI engine
    const useClaude = node.engine === 'claude';

    if (useClaude) {
      // ── Claude execution path ──
      const claudeInput: ClaudeExecutorInput = {
        agentId: node.agentType,
        taskContext: renderedPrompt,
        history: [],
        systemPrompt: node.systemPrompt,
        maxTokens: node.maxTokens,
        temperature: node.temperature,
      };

      const claudeResult = await executeWithClaude(claudeInput);

      if (claudeResult.success) {
        result.status = 'success';
        result.output = claudeResult.reasoning;
        result.model = claudeResult.model ?? 'claude';
        result.cached = false;

        // Estimate cost via shared Claude cost helper
        const inputTokens = claudeResult.usage?.inputTokens ?? 0;
        const outputTokens = claudeResult.usage?.outputTokens ?? 0;
        result.estimatedCostUsd = estimateClaudeCost(inputTokens, outputTokens);
        result.tokenCount = inputTokens + outputTokens;

        // Record cost for tracking
        await recordCost({
          workspaceId,
          operationType: 'text_generation',
          model: claudeResult.model ?? undefined,
          metadata: {
            agent_type: node.agentType,
            node_id: node.id,
            workflow_name: 'multi-agent',
            engine: 'claude',
          },
        }).catch(() => {});

        increment('agents.orchestrator.node_success', {
          agentType: node.agentType,
          cached: 'false',
          engine: 'claude',
        });
      } else {
        result.status = 'failed';
        result.error = claudeResult.error ?? 'Claude execution failed';
        increment('agents.orchestrator.node_failed', { agentType: node.agentType, engine: 'claude' });
      }
    } else {
      // ── OpenAI execution path (default) ──
      const providerInput: GenerateTextProviderInput = {
        kind: `multi-agent:${node.agentType}`,
        systemPrompt: node.systemPrompt,
        userPrompt: renderedPrompt,
        maxTokens: node.maxTokens ?? 1024,
        temperature: node.temperature ?? 0.7,
      };

      const generationResult = await generateTextWithOpenAI(providerInput);

      if (generationResult.ok) {
        result.status = 'success';
        result.output = generationResult.text;
        result.model = generationResult.model;
        result.cached = generationResult.finishReason === 'cache_hit';

        // Estimate cost
        const cost = estimateOpenAICost(result.model ?? undefined);
        result.estimatedCostUsd = cost;

        // Record cost for tracking
        await recordCost({
          workspaceId,
          operationType: 'text_generation',
          model: result.model ?? undefined,
          metadata: {
            agent_type: node.agentType,
            node_id: node.id,
            workflow_name: 'multi-agent',
          },
        }).catch(() => {});

        increment('agents.orchestrator.node_success', {
          agentType: node.agentType,
          cached: String(result.cached),
        });
      } else {
        result.status = 'failed';
        result.error = generationResult.error;
        increment('agents.orchestrator.node_failed', { agentType: node.agentType });
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : String(error);
    orchestratorLog.error('Agent node execution failed', {
      nodeId: node.id,
      error: result.error,
    });
    increment('agents.orchestrator.node_error', { agentType: node.agentType });
  }

  result.completedAt = new Date().toISOString();
  result.durationMs = Date.now() - startTime;

  timing('agents.orchestrator.node_duration', result.durationMs, {
    agentType: node.agentType,
    status: result.status,
  });

  return result;
}

/**
 * Execute a complete multi-agent orchestration plan.
 * Resolves the DAG and executes nodes level by level (parallel within level).
 */
export async function executeOrchestrationPlan(
  plan: AgentOrchestrationPlan
): Promise<AgentOrchestrationResult> {
  const startedAt = new Date().toISOString();
  const overallStart = Date.now();
  const monitor = getAIPerformanceMonitor();
  const operationId = `orchestration_${plan.id}_${Date.now()}`;

  monitor.startOperation(operationId, {
    operation: 'multi_agent_orchestration',
    model: 'multi',
    provider: 'orchestrator',
    cached: false,
  });

  orchestratorLog.info('Starting multi-agent orchestration', {
    planId: plan.id,
    name: plan.name,
    nodeCount: plan.nodes.length,
  });

  increment('agents.orchestrator.started', {
    nodeCount: String(plan.nodes.length),
  });

  let levels: AgentOrchestrationNode[][];
  try {
    levels = await startSpan(
      {
        op: 'agents.orchestrator.dag_resolve',
        name: `DAG resolve: ${plan.name}`,
        attributes: {
          'agent.orchestration': plan.id,
          'agent.node_count': plan.nodes.length,
        },
      },
      async () => resolveExecutionOrder(plan.nodes)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    orchestratorLog.error('Failed to resolve execution order', { planId: plan.id, error: message });

    monitor.recordError(operationId, 'dag_resolution_failed');
    monitor.endOperation(operationId, false);

    return {
      planId: plan.id,
      name: plan.name,
      status: 'failed',
      nodes: plan.nodes.map((n) => ({
        nodeId: n.id,
        name: n.name,
        status: 'skipped' as const,
        input: '',
        output: null,
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
        model: null,
        estimatedCostUsd: 0,
        tokenCount: 0,
        cached: false,
      })),
      totalDurationMs: 0,
      totalEstimatedCostUsd: 0,
      totalTokenCount: 0,
      cachedCount: 0,
      errors: [message],
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  // Track outputs from completed nodes
  const outputs = new Map<string, AgentNodeResult>();
  const allResults: AgentNodeResult[] = [];
  const errors: string[] = [];
  const maxConcurrency = plan.maxConcurrency ?? 2;

  // Execute level by level (parallel within each level)
  for (const level of levels) {
    // Limit concurrency within each level
    const concurrencyLimit = Math.min(maxConcurrency, level.length);

    // Process nodes in batches
    for (let i = 0; i < level.length; i += concurrencyLimit) {
      const batch = level.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.all(
        batch.map((node) => executeNode(node, outputs, plan.workspaceId, plan.userId))
      );

      for (const nodeResult of batchResults) {
        outputs.set(nodeResult.nodeId, nodeResult);
        allResults.push(nodeResult);

        if (nodeResult.status === 'failed') {
          errors.push(`Node "${nodeResult.name}" (${nodeResult.nodeId}): ${nodeResult.error}`);
        }
      }
    }
  }

  // Determine overall status
  const totalNodes = allResults.length;
  const successCount = allResults.filter((r) => r.status === 'success').length;
  const failedCount = allResults.filter((r) => r.status === 'failed').length;
  const skippedCount = allResults.filter((r) => r.status === 'skipped').length;

  let status: AgentOrchestrationResult['status'] = 'completed';
  if (failedCount === totalNodes) status = 'failed';
  else if (failedCount > 0) status = 'partial';

  const totalDuration = Date.now() - overallStart;
  const totalCost = allResults.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  const totalTokens = allResults.reduce((sum, r) => sum + r.tokenCount, 0);
  const cachedCount = allResults.filter((r) => r.cached).length;

  monitor.endOperation(operationId, failedCount === 0);

  orchestratorLog.info('Multi-agent orchestration completed', {
    planId: plan.id,
    status,
    totalNodes,
    successCount,
    failedCount,
    skippedCount,
    totalDurationMs: totalDuration,
    totalCost,
  });

  increment('agents.orchestrator.completed', { status });
  timing('agents.orchestrator.total_duration', totalDuration, { status });

  return {
    planId: plan.id,
    name: plan.name,
    status,
    nodes: allResults,
    totalDurationMs: totalDuration,
    totalEstimatedCostUsd: totalCost,
    totalTokenCount: totalTokens,
    cachedCount,
    errors,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Create an orchestration plan from a list of agent nodes.
 * Validates the DAG and sets up the execution context.
 */
export function createOrchestrationPlan(input: {
  name: string;
  nodes: AgentOrchestrationNode[];
  workspaceId: string;
  userId?: string | null;
  tags?: string[];
  maxConcurrency?: number;
}): AgentOrchestrationPlan {
  // Validate: no duplicate IDs
  const ids = new Set<string>();
  for (const node of input.nodes) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate node ID: "${node.id}". Each agent must have a unique ID.`);
    }
    ids.add(node.id);
  }

  // Validate: dependencies reference valid nodes
  for (const node of input.nodes) {
    for (const dep of node.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(
          `Node "${node.id}" depends on "${dep}" which is not in the plan.`
        );
      }
    }
  }

  // Resolve order to catch cycles early
  resolveExecutionOrder(input.nodes);

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    nodes: input.nodes,
    workspaceId: input.workspaceId,
    userId: input.userId,
    tags: input.tags,
    maxConcurrency: input.maxConcurrency ?? 2,
  };
}

/**
 * Generate a human-readable report from an orchestration result.
 */
export function formatOrchestrationResult(result: AgentOrchestrationResult): string {
  const lines: string[] = [
    `# Multi-Agent Orchestration: ${result.name}`,
    '',
    `**Status:** ${result.status}`,
    `**Duration:** ${(result.totalDurationMs / 1000).toFixed(1)}s`,
    `**Estimated Cost:** $${result.totalEstimatedCostUsd.toFixed(4)}`,
    `**Total Tokens:** ${result.totalTokenCount.toLocaleString()}`,
    `**Cache Hits:** ${result.cachedCount}/${result.nodes.length}`,
    '',
    '## Node Results',
    '',
  ];

  for (const node of result.nodes) {
    const statusEmoji =
      node.status === 'success' ? '✅' :
      node.status === 'failed' ? '❌' :
      node.status === 'skipped' ? '⏭️' : '⏳';

    lines.push(`### ${statusEmoji} ${node.name} (${node.nodeId})`);
    lines.push(`- **Status:** ${node.status}`);
    lines.push(`- **Duration:** ${node.durationMs ? `${(node.durationMs / 1000).toFixed(1)}s` : 'N/A'}`);
    lines.push(`- **Model:** ${node.model ?? 'N/A'}`);
    lines.push(`- **Cost:** $${node.estimatedCostUsd.toFixed(4)}`);
    lines.push(`- **Cached:** ${node.cached ? 'Yes' : 'No'}`);

    if (node.error) {
      lines.push(`- **Error:** ${node.error}`);
    }

    if (node.output) {
      const preview = node.output.length > 200
        ? node.output.slice(0, 200) + '...'
        : node.output;
      lines.push(`- **Output Preview:** ${preview}`);
    }

    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const err of result.errors) {
      lines.push(`- ❌ ${err}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
