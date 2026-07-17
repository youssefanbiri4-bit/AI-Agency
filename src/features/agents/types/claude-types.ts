/**
 * Claude Executor Types
 *
 * Strict TypeScript interfaces for the Claude Executor service.
 * These types define the contract between the orchestrator and the Claude
 * reasoning engine. No `any` types — everything is fully typed.
 */

// ─── Message Types ──────────────────────────────────────────────────

/** A single message in the conversation history sent to Claude. */
export interface ClaudeMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** The text content of the message */
  content: string;
}

// ─── Raw Anthropic API Types ────────────────────────────────────────

/** Content block returned by the Anthropic Messages API. */
export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

/** Usage metadata returned by the Anthropic Messages API. */
export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Full response shape from POST /v1/messages. */
export interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

// ─── Executor Input ─────────────────────────────────────────────────

/**
 * Input contract for `executeWithClaude()`.
 *
 * The orchestrator constructs this object and passes it to the executor.
 * The executor handles all API formatting, headers, and error wrapping.
 */
export interface ClaudeExecutorInput {
  /** The agent identifier (e.g. 'code-review-agent', 'market_research') */
  agentId: string;

  /**
   * The full task context — a string describing what the agent needs to
   * reason about and produce. Typically includes user input, task metadata,
   * and any relevant constraints.
   */
  taskContext: string;

  /**
   * Prior conversation messages for multi-turn interactions.
   * For single-turn tasks, pass an empty array.
   */
  history: ClaudeMessage[];

  /**
   * Optional system prompt override. If omitted, a default system prompt
   * is constructed from the agentId.
   */
  systemPrompt?: string;

  /**
   * Optional max tokens to generate. Defaults to 4096.
   */
  maxTokens?: number;

  /**
   * Optional temperature (0.0 – 1.0). Defaults to 0.7.
   */
  temperature?: number;
}

// ─── Executor Output ────────────────────────────────────────────────

/**
 * Standardized output from `executeWithClaude()`.
 *
 * The orchestrator consumes this object to route results, update task
 * status, and feed downstream steps.
 */
export interface ClaudeExecutorOutput {
  /** Whether the execution succeeded */
  success: boolean;

  /**
   * Claude's raw reasoning text — the full natural language output.
   * Useful for debugging, logging, and human review.
   */
  reasoning: string;

  /**
   * A structured action identifier that tells the orchestrator what to
   * do next. Examples: 'complete', 'handoff', 'needs_review', 'error'.
   */
  action: string;

  /**
   * Optional structured payload for machine-readable results.
   * The shape depends on the agent type and task context.
   * Kept as `unknown` to stay generic — callers narrow as needed.
   */
  payload?: unknown;

  /** Error message if success is false */
  error?: string;

  /** Token usage metadata from the API call */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };

  /** Model identifier used for the call */
  model?: string;
}

// ─── Executor Configuration ─────────────────────────────────────────

/**
 * Configuration for the Claude Executor service.
 * All fields are optional with sensible defaults.
 */
export interface ClaudeExecutorConfig {
  /** Anthropic API key override. Falls back to process.env.ANTHROPIC_API_KEY */
  apiKey?: string;

  /** API endpoint override. Defaults to https://api.anthropic.com/v1/messages */
  endpoint?: string;

  /** API version header. Defaults to '2023-06-01' */
  apiVersion?: string;

  /** Model identifier. Defaults to 'claude-3-5-sonnet-20241022' */
  model?: string;

  /** Request timeout in milliseconds. Defaults to 60_000 */
  timeoutMs?: number;

  /** Default max tokens if not provided per-request. Defaults to 4096 */
  defaultMaxTokens?: number;

  /** Default temperature if not provided per-request. Defaults to 0.7 */
  defaultTemperature?: number;
}
