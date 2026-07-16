import 'server-only';

import { startSpan } from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import {
  OrchestratorError,
  OrchestratorErrorCode,
  type OrchestratorConfig,
} from './types';

const errorLogger = logger.child('orchestrator:error');

// ─── Error Classification ──────────────────────────────────────────────────────

export interface ClassifiedError {
  code: OrchestratorErrorCode;
  message: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const retryableCodes = new Set([
  OrchestratorErrorCode.TOOL_TIMEOUT,
  OrchestratorErrorCode.TOOL_EXECUTION_FAILED,
  OrchestratorErrorCode.CIRCUIT_OPEN,
  OrchestratorErrorCode.CONCURRENCY_LIMIT,
]);

const severityMap: Record<OrchestratorErrorCode, ClassifiedError['severity']> = {
  [OrchestratorErrorCode.TOOL_NOT_FOUND]: 'high',
  [OrchestratorErrorCode.TOOL_DISABLED]: 'medium',
  [OrchestratorErrorCode.TOOL_TIMEOUT]: 'medium',
  [OrchestratorErrorCode.TOOL_EXECUTION_FAILED]: 'medium',
  [OrchestratorErrorCode.INVALID_PARAMETERS]: 'low',
  [OrchestratorErrorCode.DEPENDENCY_FAILED]: 'high',
  [OrchestratorErrorCode.DEPENDENCY_NOT_FOUND]: 'high',
  [OrchestratorErrorCode.CIRCUIT_OPEN]: 'medium',
  [OrchestratorErrorCode.CONCURRENCY_LIMIT]: 'low',
  [OrchestratorErrorCode.PLAN_VALIDATION_FAILED]: 'high',
  [OrchestratorErrorCode.CYCLE_DETECTED]: 'critical',
  [OrchestratorErrorCode.INTERNAL_ERROR]: 'critical',
};

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof OrchestratorError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable ?? retryableCodes.has(error.code),
      severity: severityMap[error.code] ?? 'medium',
    };
  }

  if (error instanceof Error) {
    const isTimeout =
      error.message.toLowerCase().includes('timeout') ||
      error.name === 'TimeoutError' ||
      error.name === 'AbortError';

    if (isTimeout) {
      return {
        code: OrchestratorErrorCode.TOOL_TIMEOUT,
        message: error.message,
        retryable: true,
        severity: 'medium',
      };
    }
  }

  return {
    code: OrchestratorErrorCode.INTERNAL_ERROR,
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
    severity: 'critical',
  };
}

// ─── Retry Logic ───────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: boolean;
}

export function calculateBackoff(
  attempt: number,
  config: RetryConfig,
): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffFactor, attempt),
    config.maxDelayMs,
  );

  if (!config.jitter) return delay;

  const jitterRange = delay * 0.3;
  return Math.max(0, delay - jitterRange + Math.random() * jitterRange * 2);
}

export interface RetryResult<T> {
  ok: boolean;
  value: T | null;
  error: OrchestratorError | null;
  attempts: number;
  totalDurationMs: number;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  },
): Promise<RetryResult<T>> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1_000;

  const config: RetryConfig = {
    maxRetries,
    baseDelayMs,
    maxDelayMs: 30_000,
    backoffFactor: 2,
    jitter: true,
  };

  const startTime = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn(attempt);
      return {
        ok: true,
        value,
        error: null,
        attempts: attempt + 1,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);

      if (!classified.retryable || attempt >= maxRetries) {
        return {
          ok: false,
          value: null,
          error:
            error instanceof OrchestratorError
              ? error
              : new OrchestratorError(classified.code, classified.message, {
                  retryable: false,
                }),
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
        };
      }

      const delay = calculateBackoff(attempt, config);
      options?.onRetry?.(attempt, error, delay);

      errorLogger.warn('Retrying tool execution', {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: classified.message,
      });

      await sleep(delay);
    }
  }

  const classified = classifyError(lastError);
  return {
    ok: false,
    value: null,
    error:
      lastError instanceof OrchestratorError
        ? lastError
        : new OrchestratorError(classified.code, classified.message, {
            retryable: false,
          }),
    attempts: maxRetries + 1,
    totalDurationMs: Date.now() - startTime,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Execution Guards ──────────────────────────────────────────────────────────

export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  context?: { toolId?: string; planId?: string },
): Promise<T> {
  return startSpan(
    {
      op: 'orchestrator.timeout_guard',
      name: `timeout:${context?.toolId ?? 'unknown'}`,
      attributes: { timeoutMs },
    },
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(
                new OrchestratorError(
                  OrchestratorErrorCode.TOOL_TIMEOUT,
                  `Tool execution timed out after ${timeoutMs}ms`,
                  {
                    toolId: context?.toolId,
                    planId: context?.planId,
                    retryable: true,
                  },
                ),
              );
            });
          }),
        ]);
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
  );
}

export function createErrorResponse(
  error: unknown,
  config?: Pick<OrchestratorConfig, 'enableMetrics'>,
) {
  const classified = classifyError(error);
  const isOrchestratorError = error instanceof OrchestratorError;

  if (config?.enableMetrics !== false) {
    errorLogger.error('Orchestrator execution error', {
      code: classified.code,
      severity: classified.severity,
      message: classified.message,
      toolId: isOrchestratorError ? error.toolId : undefined,
      planId: isOrchestratorError ? error.planId : undefined,
    });
  }

  return {
    success: false,
    error: classified.message,
    code: classified.code,
    severity: classified.severity,
    retryable: classified.retryable,
  };
}
