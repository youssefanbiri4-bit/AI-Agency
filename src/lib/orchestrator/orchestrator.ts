import 'server-only';

import { startSpan } from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { generateTextWithOpenAI, type GenerateTextProviderInput } from '@/lib/ai/text-provider';
import { executeWithClaude, type ClaudeExecutorInput } from '@/features/agents/services/claude-executor';
import { estimateClaudeCost, recordCost } from '@/lib/usage/cost-tracking';
import { checkCircuit, recordCircuitSuccess, recordCircuitFailure } from '@/lib/circuit-breaker';

import { ToolRegistry, globalToolRegistry } from './tool-registry';
import { withRetry, withTimeout } from './error-handler';
import {
  OrchestratorError,
  OrchestratorErrorCode,
  type OrchestratorConfig,
  type OrchestrationPlan,
  type OrchestrationStep,
  type OrchestrationResult,
  type ToolCall,
  type ToolExecutionContext,
  type ToolResult,
  type ExecutionHistoryEntry,
  type OrchestratorStats,
  type JsonValue,
} from './types';

const orchLogger = logger.child('orchestrator:core');

const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultTimeoutMs: 30_000,
  defaultMaxRetries: 2,
  baseRetryDelayMs: 1_000,
  maxConcurrency: 3,
  enableCircuitBreaker: true,
  enableMetrics: true,
  enableHistory: true,
  maxHistorySize: 100,
};

export class AgentFlowOrchestrator {
  private config: OrchestratorConfig;
  private registry: ToolRegistry;
  private history: ExecutionHistoryEntry[] = [];
  private startedAt: number;
  private toolUsage: Map<string, number> = new Map();
  private totalRetries = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalSteps = 0;

  constructor(
    config?: Partial<OrchestratorConfig>,
    registry?: ToolRegistry,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = registry ?? globalToolRegistry;
    this.startedAt = Date.now();
  }

  // ─── Plan Management ─────────────────────────────────────────────────────────

  createPlan(input: {
    name: string;
    description?: string;
    steps: OrchestrationStep[];
    workspaceId: string;
    userId?: string;
    priority?: number;
    tags?: string[];
    config?: Partial<OrchestratorConfig>;
  }): OrchestrationPlan {
    const errors = this.validatePlan(input.steps);
    if (errors.length > 0) {
      throw new OrchestratorError(
        OrchestratorErrorCode.PLAN_VALIDATION_FAILED,
        `Plan validation failed: ${errors.join('; ')}`,
        { retryable: false },
      );
    }

    return {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description ?? '',
      steps: input.steps.map((step) => ({
        ...step,
        executionMode: step.executionMode ?? 'sequential',
        dependsOn: step.dependsOn ?? [],
        parameters: step.parameters ?? {},
      })),
      workspaceId: input.workspaceId,
      userId: input.userId,
      priority: input.priority ?? 0,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      config: input.config ?? {},
    };
  }

  private validatePlan(steps: OrchestrationStep[]): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();

    for (const step of steps) {
      if (ids.has(step.id)) {
        errors.push(`Duplicate step ID: "${step.id}"`);
      }
      ids.add(step.id);

      const tool = this.registry.get(step.toolId);
      if (!tool) {
        errors.push(`Step "${step.id}": tool "${step.toolId}" not found`);
      } else if (!tool.enabled) {
        errors.push(`Step "${step.id}": tool "${step.toolId}" is disabled`);
      }

      for (const depId of step.dependsOn) {
        if (!steps.find((s) => s.id === depId)) {
          errors.push(`Step "${step.id}": dependency "${depId}" not found`);
        }
      }
    }

    const cycleErrors = this.detectCycle(steps);
    errors.push(...cycleErrors);

    return errors;
  }

  private detectCycle(steps: OrchestrationStep[]): string[] {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const errors: string[] = [];

    function dfs(stepId: string, stepMap: Map<string, OrchestrationStep>): boolean {
      if (inStack.has(stepId)) {
        return true;
      }
      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      inStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step) {
        for (const dep of step.dependsOn) {
          if (dfs(dep, stepMap)) {
            return true;
          }
        }
      }

      inStack.delete(stepId);
      return false;
    }

    const stepMap = new Map(steps.map((s) => [s.id, s]));

    for (const step of steps) {
      if (dfs(step.id, stepMap)) {
        errors.push(`Cycle detected involving step "${step.id}"`);
        break;
      }
    }

    return errors;
  }

  // ─── Plan Execution ──────────────────────────────────────────────────────────

  async executePlan(plan: OrchestrationPlan): Promise<OrchestrationResult> {
    return startSpan(
      {
        op: 'orchestrator.execute_plan',
        name: plan.name,
        attributes: {
          'orchestrator.plan_id': plan.id,
          'orchestrator.step_count': plan.steps.length,
        },
      },
      async () => this.executePlanInternal(plan),
    );
  }

  private async executePlanInternal(
    plan: OrchestrationPlan,
  ): Promise<OrchestrationResult> {
    const startedAt = new Date().toISOString();
    const overallStart = Date.now();

    orchLogger.info('Executing orchestration plan', {
      planId: plan.id,
      name: plan.name,
      stepCount: plan.steps.length,
    });

    if (this.config.enableMetrics) {
      increment('orchestrator.plan.started', {
        stepCount: String(plan.steps.length),
      });
    }

    const levels = this.resolveExecutionOrder(plan.steps);
    const results: ToolCall[] = [];
    const errors: string[] = [];
    let allSkipped = true;

    for (const level of levels) {
      const maxConc = this.config.maxConcurrency;
      const batchSize = Math.min(maxConc, level.length);

      for (let i = 0; i < level.length; i += batchSize) {
        const batch = level.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((step) =>
            this.executeStep(step, results, plan),
          ),
        );

        for (const result of batchResults) {
          results.push(result);
          if (result.status === 'success' || result.status === 'failed') {
            allSkipped = false;
          }
          if (result.status === 'failed') {
            errors.push(
              `Step "${result.toolName}" (${result.id}): ${result.error}`,
            );
            this.totalFailures++;
          } else if (result.status === 'success') {
            this.totalSuccesses++;
          }
          this.totalSteps++;
        }
      }
    }

    const totalDuration = Date.now() - overallStart;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    const successCount = results.filter((r) => r.status === 'success').length;

    const status = allSkipped
      ? ('failed' as const)
      : failedCount === results.length
        ? ('failed' as const)
        : failedCount > 0
          ? ('partial' as const)
          : ('completed' as const);

    if (this.config.enableMetrics) {
      timing('orchestrator.plan.duration', totalDuration, { status });
      increment('orchestrator.plan.completed', { status });
    }

    orchLogger.info('Orchestration plan completed', {
      planId: plan.id,
      status,
      totalSteps: results.length,
      successCount,
      failedCount,
      durationMs: totalDuration,
    });

    const result: OrchestrationResult = {
      planId: plan.id,
      name: plan.name,
      status,
      steps: results,
      totalDurationMs: totalDuration,
      totalErrors: errors.length,
      totalCached: results.filter((r) => r.status === 'success').length,
      errors,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    if (this.config.enableHistory) {
      this.recordHistory(result);
    }

    return result;
  }

  private resolveExecutionOrder(
    steps: OrchestrationStep[],
  ): OrchestrationStep[][] {
    const stepMap = new Map(steps.map((s) => [s.id, s]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const step of steps) {
      inDegree.set(step.id, 0);
      adjList.set(step.id, []);
    }

    for (const step of steps) {
      for (const dep of step.dependsOn) {
        adjList.get(dep)?.push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
      }
    }

    const levels: OrchestrationStep[][] = [];
    const queue: string[] = [];

    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const currentLevel: OrchestrationStep[] = [];
      const levelSize = queue.length;

      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!;
        const step = stepMap.get(nodeId);
        if (step) currentLevel.push(step);
        for (const neighbor of adjList.get(nodeId) ?? []) {
          const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) queue.push(neighbor);
        }
      }

      if (currentLevel.length > 0) levels.push(currentLevel);
    }

    return levels;
  }

  // ─── Step Execution ──────────────────────────────────────────────────────────

  private async executeStep(
    step: OrchestrationStep,
    completedSteps: ToolCall[],
    plan: OrchestrationPlan,
  ): Promise<ToolCall> {
    const startTime = Date.now();
    const toolDef = this.registry.get(step.toolId);

    const toolCall: ToolCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      toolId: step.toolId,
      toolName: toolDef?.name ?? step.toolId,
      agentType: toolDef?.agentType ?? 'report',
      category: toolDef?.category ?? 'custom',
      status: 'pending',
      parameters: step.parameters,
      output: null,
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      attempt: 0,
      maxRetries: step.maxRetries ?? this.config.defaultMaxRetries,
      retryDelayMs: this.config.baseRetryDelayMs,
      traceId: `trace_${plan.id}_${step.id}`,
    };

    try {
      const unresolvedDeps = step.dependsOn.filter((depId) => {
        const depResult = completedSteps.find((r) => r.id === depId);
        return !depResult || depResult.status !== 'success';
      });

      if (unresolvedDeps.length > 0) {
        toolCall.status = 'skipped';
        toolCall.error = `Dependencies unresolved: ${unresolvedDeps.join(', ')}`;
        toolCall.completedAt = new Date().toISOString();
        toolCall.durationMs = 0;
        return toolCall;
      }

      toolCall.status = 'running';
      toolCall.startedAt = new Date().toISOString();

      const resolvedParams = this.resolveParameters(
        step.parameters,
        completedSteps,
      );

      const validation = await this.registry.validateParameters(
        step.toolId,
        resolvedParams,
      );

      if (!validation.valid) {
        toolCall.status = 'failed';
        toolCall.error = `Parameter validation failed: ${validation.errors.join('; ')}`;
        toolCall.completedAt = new Date().toISOString();
        toolCall.durationMs = Date.now() - startTime;
        return toolCall;
      }

      const timeoutMs = step.timeoutMs ?? this.config.defaultTimeoutMs;

      if (this.config.enableCircuitBreaker) {
        const circuitCheck = checkCircuit(`tool:${step.toolId}`);
        if (!circuitCheck.allowed) {
          throw new OrchestratorError(
            OrchestratorErrorCode.CIRCUIT_OPEN,
            circuitCheck.message,
            { toolId: step.toolId, planId: plan.id, retryable: true },
          );
        }
      }

      const retryResult = await withRetry(
        async (attempt) => {
          toolCall.attempt = attempt;
          if (attempt > 0) this.totalRetries++;

          const ctx: ToolExecutionContext = {
            toolId: step.toolId,
            planId: plan.id,
            executionId: toolCall.id,
            parameters: resolvedParams,
            userId: plan.userId,
            workspaceId: plan.workspaceId,
            priority: plan.priority,
            timeoutMs,
            attempt,
            maxRetries: toolCall.maxRetries,
            traceId: toolCall.traceId,
          };

          return this.executeTool(ctx);
        },
        {
          maxRetries: toolCall.maxRetries,
          baseDelayMs: this.config.baseRetryDelayMs,
          onRetry: (attempt, error, delayMs) => {
            orchLogger.warn('Retrying step', {
              stepId: step.id,
              toolId: step.toolId,
              attempt: attempt + 1,
              delayMs,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );

      if (retryResult.ok && retryResult.value) {
        toolCall.status = 'success';
        toolCall.output = retryResult.value.output;
        toolCall.attempt = retryResult.attempts - 1;

        if (this.config.enableCircuitBreaker) {
          recordCircuitSuccess(`tool:${step.toolId}`);
        }

        this.trackToolUsage(step.toolId);
      } else {
        toolCall.status = 'failed';
        toolCall.error = retryResult.error?.message ?? 'Unknown error';
        toolCall.attempt = retryResult.attempts - 1;

        if (this.config.enableCircuitBreaker) {
          recordCircuitFailure(
            `tool:${step.toolId}`,
            retryResult.error ?? undefined,
          );
        }
      }
    } catch (error) {
      toolCall.status = 'failed';
      toolCall.error = error instanceof Error ? error.message : String(error);

      if (this.config.enableCircuitBreaker) {
        recordCircuitFailure(`tool:${step.toolId}`, error instanceof Error ? error : undefined);
      }

      orchLogger.error('Step execution failed', {
        stepId: step.id,
        toolId: step.toolId,
        error: toolCall.error,
      });
    }

    toolCall.completedAt = new Date().toISOString();
    toolCall.durationMs = Date.now() - startTime;

    if (this.config.enableMetrics) {
      timing('orchestrator.step.duration', toolCall.durationMs, {
        toolId: step.toolId,
        status: toolCall.status,
      });
      increment('orchestrator.step.completed', {
        toolId: step.toolId,
        status: toolCall.status,
      });
    }

    return toolCall;
  }

  private resolveParameters(
    params: Record<string, JsonValue>,
    completedSteps: ToolCall[],
  ): Record<string, JsonValue> {
    const resolved: Record<string, JsonValue> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(
          /\{steps\.([a-zA-Z0-9_-]+)\.output\}/g,
          (match, stepId) => {
            const step = completedSteps.find((s) => s.id === stepId);
            if (step?.output && typeof step.output === 'string') {
              return step.output;
            }
            return match;
          },
        );
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private async executeTool(
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    return startSpan(
      {
        op: 'orchestrator.execute_tool',
        name: ctx.toolId,
        attributes: {
          'orchestrator.tool_id': ctx.toolId,
          'orchestrator.plan_id': ctx.planId,
          'orchestrator.attempt': ctx.attempt,
        },
      },
      async () => {
        const toolDef = this.registry.get(ctx.toolId);
        if (!toolDef) {
          throw new OrchestratorError(
            OrchestratorErrorCode.TOOL_NOT_FOUND,
            `Tool "${ctx.toolId}" not found in registry`,
            { toolId: ctx.toolId, planId: ctx.planId, retryable: false },
          );
        }

        if (!toolDef.enabled) {
          throw new OrchestratorError(
            OrchestratorErrorCode.TOOL_DISABLED,
            `Tool "${ctx.toolId}" is disabled`,
            { toolId: ctx.toolId, planId: ctx.planId, retryable: false },
          );
        }

        const result = await withTimeout(
          () => this.callAgentTool(toolDef, ctx),
          ctx.timeoutMs,
          { toolId: ctx.toolId, planId: ctx.planId },
        );

        return result;
      },
    );
  }

  private async callAgentTool(
    toolDef: NonNullable<ReturnType<ToolRegistry['get']>>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const paramStrings: string[] = [];
    for (const [key, value] of Object.entries(ctx.parameters)) {
      paramStrings.push(`${key}: ${String(value)}`);
    }

    const renderedParams = paramStrings.join('\n');

    const systemPrompt = `You are ${toolDef.name}, a specialized AI agent.
Your role: ${toolDef.metadata?.role ?? toolDef.agentType}
Department: ${toolDef.metadata?.department ?? 'General'}

You must respond based on the provided input parameters. Be thorough, professional, and actionable.`;

    const userPrompt = `## Task
Execute your function as ${toolDef.name}.

## Input Parameters
${renderedParams}

## Instructions
- Analyze the input parameters carefully
- Apply your domain expertise
- Provide a comprehensive, structured response
- If information is missing, note what would be needed`;

    // Route to the appropriate AI engine
    const useClaude = toolDef.engine === 'claude';

    if (useClaude) {
      // ── Claude execution path ──
      const claudeInput: ClaudeExecutorInput = {
        agentId: toolDef.agentType,
        taskContext: userPrompt,
        history: [],
        systemPrompt,
        maxTokens: 2048,
        temperature: 0.7,
      };

      const claudeResult = await withTimeout(
        () => executeWithClaude(claudeInput),
        ctx.timeoutMs,
        { toolId: ctx.toolId, planId: ctx.planId },
      );

      if (!claudeResult.success) {
        throw new OrchestratorError(
          OrchestratorErrorCode.TOOL_EXECUTION_FAILED,
          claudeResult.error ?? 'Claude execution failed',
          { toolId: ctx.toolId, planId: ctx.planId, retryable: true },
        );
      }

      // Estimate cost via shared Claude cost helper
      const inputTokens = claudeResult.usage?.inputTokens ?? 0;
      const outputTokens = claudeResult.usage?.outputTokens ?? 0;
      const cost = estimateClaudeCost(inputTokens, outputTokens);

      await recordCost({
        workspaceId: ctx.workspaceId,
        operationType: 'orchestrator_tool',
        model: claudeResult.model ?? undefined,
        metadata: {
          tool_id: ctx.toolId,
          plan_id: ctx.planId,
          agent_type: toolDef.agentType,
          engine: 'claude',
        },
      }).catch(() => {});

      return {
        success: true,
        output: claudeResult.reasoning,
        error: null,
        toolCallId: ctx.executionId,
        durationMs: Date.now() - startTime,
        cached: false,
        metadata: {
          model: claudeResult.model,
          engine: 'claude',
          cost,
        },
      };
    }

    // ── OpenAI execution path (default) ──
    const providerInput: GenerateTextProviderInput = {
      kind: `orchestrator:${toolDef.agentType}`,
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    };

    const generationResult = await withTimeout(
      () => generateTextWithOpenAI(providerInput),
      ctx.timeoutMs,
      { toolId: ctx.toolId, planId: ctx.planId },
    );

    if (!generationResult.ok) {
      throw new OrchestratorError(
        OrchestratorErrorCode.TOOL_EXECUTION_FAILED,
        generationResult.error ?? 'AI generation failed',
        { toolId: ctx.toolId, planId: ctx.planId, retryable: true },
      );
    }

    await recordCost({
      workspaceId: ctx.workspaceId,
      operationType: 'orchestrator_tool',
      model: generationResult.model ?? undefined,
      metadata: {
        tool_id: ctx.toolId,
        plan_id: ctx.planId,
        agent_type: toolDef.agentType,
      },
    }).catch(() => {});

    return {
      success: true,
      output: generationResult.text,
      error: null,
      toolCallId: ctx.executionId,
      durationMs: Date.now() - startTime,
      cached: generationResult.finishReason === 'cache_hit',
      metadata: {
        model: generationResult.model,
      },
    };
  }

  // ─── History & Stats ─────────────────────────────────────────────────────────

  private recordHistory(result: OrchestrationResult): void {
    const entry: ExecutionHistoryEntry = {
      planId: result.planId,
      planName: result.name,
      status: result.status,
      stepCount: result.steps.length,
      totalDurationMs: result.totalDurationMs,
      totalErrors: result.totalErrors,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    };

    this.history.unshift(entry);

    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(0, this.config.maxHistorySize);
    }
  }

  private trackToolUsage(toolId: string): void {
    const current = this.toolUsage.get(toolId) ?? 0;
    this.toolUsage.set(toolId, current + 1);
  }

  getHistory(limit?: number): ExecutionHistoryEntry[] {
    return this.history.slice(0, limit ?? this.config.maxHistorySize);
  }

  getPlanResult(planId: string): ExecutionHistoryEntry | undefined {
    return this.history.find((h) => h.planId === planId);
  }

  getStats(): OrchestratorStats {
    const totalPlans = this.history.length;
    const totalStepsExec = this.totalSteps;
    const totalFail = this.totalFailures;
    const totalSucceed = this.totalSuccesses;

    const avgDuration =
      totalPlans > 0
        ? this.history.reduce((sum, h) => sum + h.totalDurationMs, 0) /
          totalPlans
        : 0;

    const errorRate = totalPlans > 0 ? totalFail / totalPlans : 0;

    const toolUsageObj: Record<string, number> = {};
    for (const [id, count] of this.toolUsage) {
      toolUsageObj[id] = count;
    }

    return {
      totalPlans,
      totalSteps: totalStepsExec,
      totalSuccesses: totalSucceed,
      totalFailures: totalFail,
      totalRetries: this.totalRetries,
      avgDurationMs: Math.round(avgDuration),
      cacheHitRate: 0,
      recentPlans: this.history.slice(0, 10),
      toolUsage: toolUsageObj,
      errorRate,
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  // ─── Config ──────────────────────────────────────────────────────────────────

  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };

    orchLogger.info('Orchestrator config updated', {
      updates: Object.keys(updates),
    });
  }

  getConfig(): Readonly<OrchestratorConfig> {
    return { ...this.config };
  }

  // ─── Reset ───────────────────────────────────────────────────────────────────

  reset(): void {
    this.history = [];
    this.toolUsage.clear();
    this.totalRetries = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.totalSteps = 0;
    this.startedAt = Date.now();

    orchLogger.info('Orchestrator state reset');
  }
}

export const globalOrchestrator = new AgentFlowOrchestrator();
