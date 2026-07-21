import 'server-only';

import type { AgentType, JsonValue } from '@/types';
export type { JsonValue };

// ─── Tool System Types ──────────────────────────────────────────────────────────

export type ToolCategory =
  | 'research'
  | 'content'
  | 'sales'
  | 'development'
  | 'analytics'
  | 'system'
  | 'custom';

export type ToolRiskLevel = 'read_only' | 'draft_only' | 'requires_confirmation' | 'destructive';

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'retrying';

export type ExecutionMode = 'sequential' | 'parallel' | 'conditional';

export interface ToolParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'select';
  required: boolean;
  description: string;
  default?: JsonValue;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  agentType: AgentType;
  parameters: ToolParameter[];
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  metadata?: Record<string, string>;
  /** AI engine to use for this tool. Defaults to 'openai'. Set to 'claude' to route through the Anthropic Claude API. */
  engine?: 'openai' | 'claude';
}

export interface ToolExecutionContext {
  toolId: string;
  planId: string;
  executionId: string;
  parameters: Record<string, JsonValue>;
  userId?: string;
  workspaceId: string;
  priority: number;
  timeoutMs: number;
  attempt: number;
  maxRetries: number;
  traceId: string;
}

export interface ToolCall {
  id: string;
  toolId: string;
  toolName: string;
  agentType: AgentType;
  category: ToolCategory;
  status: ToolCallStatus;
  parameters: Record<string, JsonValue>;
  output: JsonValue | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  attempt: number;
  maxRetries: number;
  retryDelayMs: number;
  traceId: string;
}

export interface ToolResult {
  success: boolean;
  output: JsonValue | null;
  error: string | null;
  toolCallId: string;
  durationMs: number;
  cached: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Orchestrator Core Types ────────────────────────────────────────────────────

export interface OrchestratorConfig {
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  baseRetryDelayMs: number;
  maxConcurrency: number;
  enableCircuitBreaker: boolean;
  enableMetrics: boolean;
  enableHistory: boolean;
  maxHistorySize: number;
}

export interface OrchestrationStep {
  id: string;
  toolId: string;
  name: string;
  description?: string;
  parameters: Record<string, JsonValue>;
  dependsOn: string[];
  executionMode: ExecutionMode;
  timeoutMs?: number;
  maxRetries?: number;
  condition?: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'exists';
    value: JsonValue;
  };
}

export interface OrchestrationPlan {
  id: string;
  name: string;
  description: string;
  steps: OrchestrationStep[];
  workspaceId: string;
  userId?: string;
  priority: number;
  tags: string[];
  createdAt: string;
  config: Partial<OrchestratorConfig>;
}

export interface OrchestrationResult {
  planId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  steps: ToolCall[];
  totalDurationMs: number;
  totalErrors: number;
  totalCached: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface ExecutionHistoryEntry {
  planId: string;
  planName: string;
  status: OrchestrationResult['status'];
  stepCount: number;
  totalDurationMs: number;
  totalErrors: number;
  startedAt: string;
  completedAt: string | null;
}

export interface OrchestratorStats {
  totalPlans: number;
  totalSteps: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRetries: number;
  avgDurationMs: number;
  cacheHitRate: number;
  recentPlans: ExecutionHistoryEntry[];
  toolUsage: Record<string, number>;
  errorRate: number;
  uptimeMs: number;
}

// ─── Error Types ────────────────────────────────────────────────────────────────

export enum OrchestratorErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_DISABLED = 'TOOL_DISABLED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  DEPENDENCY_NOT_FOUND = 'DEPENDENCY_NOT_FOUND',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  CONCURRENCY_LIMIT = 'CONCURRENCY_LIMIT',
  PLAN_VALIDATION_FAILED = 'PLAN_VALIDATION_FAILED',
  CYCLE_DETECTED = 'CYCLE_DETECTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class OrchestratorError extends Error {
  public readonly code: OrchestratorErrorCode;
  public readonly toolId?: string;
  public readonly planId?: string;
  public readonly retryable: boolean;

  constructor(
    code: OrchestratorErrorCode,
    message: string,
    options?: {
      toolId?: string;
      planId?: string;
      retryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.toolId = options?.toolId;
    this.planId = options?.planId;
    this.retryable = options?.retryable ?? false;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
