/**
 * Claude Executor Service
 *
 * Isolated module that sends agent contexts to the Anthropic Claude API,
 * parses the response, and returns a standardized object to the Orchestrator.
 *
 * Design constraints:
 * - Framework-agnostic (no Next.js imports)
 * - Server-side only (import 'server-only')
 * - Zero new npm dependencies (uses native fetch)
 * - TypeScript strict mode (no `any` types)
 */

import 'server-only';

import { logger } from '@/lib/logger';
import type {
  ClaudeExecutorInput,
  ClaudeExecutorOutput,
  ClaudeExecutorConfig,
  AnthropicMessagesResponse,
  ClaudeMessage,
} from '../types/claude-types';

// Re-export types so consumers can import from this module
export type {
  ClaudeExecutorInput,
  ClaudeExecutorOutput,
  ClaudeExecutorConfig,
} from '../types/claude-types';

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Logger ─────────────────────────────────────────────────────────

const executorLog = logger.child('claude-executor');

// ─── Default System Prompts per Agent Category ──────────────────────

/**
 * Maps agent IDs to sensible default system prompts.
 * Callers can override with `systemPrompt` in the input.
 */
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  // Development & Engineering
  'code-review-agent':
    'You are an expert code reviewer. Analyze the provided code for quality, readability, maintainability, security issues, and potential bugs. Respond with structured JSON containing your findings.',
  'bug-fix-agent':
    'You are an expert bug fixer. Analyze the error, logs, and context to propose a safe fix plan. Respond with structured JSON containing root cause analysis and fix steps.',
  'architecture-agent':
    'You are a software architect. Plan system architecture, data flow, and implementation phases. Respond with structured JSON containing your architecture decisions.',
  'testing-agent':
    'You are a QA engineer. Create comprehensive test plans, identify edge cases, and define acceptance criteria. Respond with structured JSON.',
  'documentation-agent':
    'You are a technical writer. Create clear, comprehensive documentation including guides, API docs, and release notes. Respond with structured JSON.',
  'deployment-agent':
    'You are a deployment specialist. Prepare deployment plans with environment checklists, smoke tests, and rollback procedures. Respond with structured JSON.',
  'security-review-agent':
    'You are a security expert. Review code and infrastructure for vulnerabilities, secret exposure, and security best practices. Respond with structured JSON.',
  'database-agent':
    'You are a database architect. Design and review schemas, migrations, RLS policies, indexes, and data models. Respond with structured JSON.',
  'ui-ux-review-agent':
    'You are a UI/UX expert. Review interface design, accessibility, responsive behavior, and user flows. Respond with structured JSON.',
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Resolve the API key from config or environment.
 * Throws a controlled error if missing.
 */
function resolveApiKey(config?: ClaudeExecutorConfig): string {
  const key = config?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Provide it via config or the ANTHROPIC_API_KEY environment variable.',
    );
  }
  return key;
}

/**
 * Build the default system prompt from an agent ID.
 */
function buildDefaultSystemPrompt(agentId: string): string {
  const known = AGENT_SYSTEM_PROMPTS[agentId];
  if (known) return known;
  return `You are the "${agentId}" agent. Analyze the task context provided and produce a structured response. Use JSON for machine-readable output.`;
}



// ─── Core Execution Function ────────────────────────────────────────

/**
 * Execute a task with the Claude API.
 *
 * This is the single entry point for all Claude-based agent reasoning.
 * The orchestrator calls this function with a fully-formed
 * `ClaudeExecutorInput` and receives a standardized
 * `ClaudeExecutorOutput`.
 *
 * @example
 * ```ts
 * const result = await executeWithClaude({
 *   agentId: 'code-review-agent',
 *   taskContext: 'Review this PR diff for security issues:\n```ts\n...\n```',
 *   history: [],
 *   systemPrompt: undefined, // uses default for this agent
 * });
 *
 * if (result.success) {
 *   console.log(result.reasoning);
 *   console.log(result.action); // 'complete' | 'needs_review' | etc.
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function executeWithClaude(
  input: ClaudeExecutorInput,
  config?: ClaudeExecutorConfig,
): Promise<ClaudeExecutorOutput> {
  const startedAt = Date.now();

  executorLog.info('Executing with Claude', {
    agentId: input.agentId,
    historyLength: input.history.length,
    maxTokens: input.maxTokens ?? config?.defaultMaxTokens ?? DEFAULT_MAX_TOKENS,
  });

  // ── Resolve configuration ──
  const apiKey = resolveApiKey(config);
  const endpoint = config?.endpoint ?? DEFAULT_ENDPOINT;
  const apiVersion = config?.apiVersion ?? DEFAULT_API_VERSION;
  const model = config?.model ?? DEFAULT_MODEL;
  const maxTokens = input.maxTokens ?? config?.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = input.temperature ?? config?.defaultTemperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // ── Build system prompt ──
  const systemPrompt = input.systemPrompt ?? buildDefaultSystemPrompt(input.agentId);

  // ── Build messages array ──
  // Claude API requires at least one user message. History is prepended,
  // then the current task context is the final user message.
  const messages: ClaudeMessage[] = [
    ...input.history,
    { role: 'user', content: input.taskContext },
  ];

  // ── Build request body ──
  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages,
  };

  // ── Execute with timeout ──
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': apiVersion,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // ── Handle HTTP errors ──
    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = '(could not read error body)';
      }

      const statusCode = response.status;
      const retryable = statusCode === 429 || statusCode >= 500;

      executorLog.error('Claude API returned error', {
        agentId: input.agentId,
        statusCode,
        retryable,
        body: errorBody.slice(0, 500),
      });

      return {
        success: false,
        reasoning: '',
        action: 'error',
        error: `Claude API error ${statusCode}: ${errorBody.slice(0, 200)}`,
        model,
      };
    }

    // ── Parse successful response ──
    let parsed: AnthropicMessagesResponse;
    try {
      parsed = (await response.json()) as AnthropicMessagesResponse;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      executorLog.error('Failed to parse Claude response', { agentId: input.agentId, error: msg });
      return {
        success: false,
        reasoning: '',
        action: 'error',
        error: `Response parse error: ${msg}`,
        model,
      };
    }

    // ── Extract text content ──
    const textBlocks = parsed.content.filter((block) => block.type === 'text');
    const reasoning = textBlocks.map((block) => block.text).join('\n');

    // ── Try to extract JSON action from Claude's response ──
    let action = 'complete';
    let payload: unknown;

    // Try fenced JSON block first
    const fencedMatch = reasoning.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (fencedMatch?.[1]) {
      try {
        const parsedJson = JSON.parse(fencedMatch[1]) as Record<string, unknown>;
        if (typeof parsedJson.action === 'string') {
          action = parsedJson.action;
        }
        payload = parsedJson;
      } catch {
        // Not valid JSON in fenced block — fall through
      }
    }

    // Fallback: try parsing entire response as JSON (Claude sometimes returns bare JSON)
    if (payload === undefined) {
      try {
        const parsedJson = JSON.parse(reasoning) as Record<string, unknown>;
        if (typeof parsedJson.action === 'string') {
          action = parsedJson.action;
        }
        payload = parsedJson;
      } catch {
        // Not JSON — plain text reasoning, action stays 'complete'
      }
    }

    const durationMs = Date.now() - startedAt;

    executorLog.info('Claude execution completed', {
      agentId: input.agentId,
      model,
      inputTokens: parsed.usage?.input_tokens,
      outputTokens: parsed.usage?.output_tokens,
      durationMs,
      action,
    });

    return {
      success: true,
      reasoning,
      action,
      payload,
      usage: parsed.usage
        ? {
            inputTokens: parsed.usage.input_tokens,
            outputTokens: parsed.usage.output_tokens,
          }
        : undefined,
      model: parsed.model,
    };
  } catch (err: unknown) {
    // ── Handle AbortError (timeout) ──
    if (err instanceof DOMException && err.name === 'AbortError') {
      executorLog.error('Claude execution timed out', {
        agentId: input.agentId,
        timeoutMs,
      });
      return {
        success: false,
        reasoning: '',
        action: 'error',
        error: `Request timed out after ${timeoutMs}ms`,
        model,
      };
    }

    // ── Handle other errors ──
    const msg = err instanceof Error ? err.message : String(err);
    executorLog.error('Claude execution failed', {
      agentId: input.agentId,
      error: msg,
    });
    return {
      success: false,
      reasoning: '',
      action: 'error',
      error: msg,
      model,
    };
  }
}

// ─── Utility: Health Check ──────────────────────────────────────────

/**
 * Verify that the Claude API is reachable and the API key is valid.
 * Returns true if the API responds with a 200-level status.
 */
export async function checkClaudeHealth(
  config?: ClaudeExecutorConfig,
): Promise<{ healthy: boolean; error?: string }> {
  try {
    const apiKey = resolveApiKey(config);
    const endpoint = config?.endpoint ?? DEFAULT_ENDPOINT;
    const apiVersion = config?.apiVersion ?? DEFAULT_API_VERSION;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': apiVersion,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config?.model ?? DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (response.ok) {
      return { healthy: true };
    }
    return {
      healthy: false,
      error: `API returned status ${response.status}`,
    };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
