/**
 * Query Timing Wrapper
 *
 * Wraps any async operation (database query, API call, provider request)
 * with timing instrumentation. Emits metrics and logs duration.
 *
 * Usage:
 *   const result = await withTiming('tasks:list', () => supabase.from('tasks').select('*'), { workspaceId });
 *   const [result, duration] = await withTimingGetDuration('tasks:list', () => ...);
 */

import { logger } from '@/lib/logger';
import { timing } from '@/lib/monitoring/metrics';

const timingLog = logger.child('timing');

export interface TimingOptions {
  /** Workspace ID for scoping metrics */
  workspaceId?: string;
  /** Operation type for metrics labels */
  type?: 'db' | 'api' | 'provider' | 'internal';
  /** Log if duration exceeds this threshold (ms). Default: 1000 */
  warnThresholdMs?: number;
  /** Additional labels for metrics */
  labels?: Record<string, unknown>;
}

/**
 * Execute an async operation and emit timing metrics.
 * Returns the result of the operation.
 */
export async function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  options: TimingOptions = {}
): Promise<T> {
  const start = Date.now();
  const { workspaceId, type = 'internal', warnThresholdMs = 1000, labels } = options;

  try {
    const result = await fn();
    return result;
  } finally {
    const durationMs = Date.now() - start;

    // Emit metric for log aggregation
    timing(name, durationMs, {
      type,
      ...(workspaceId ? { workspaceId } : {}),
      ...(labels ?? {}),
    });

    // Log slow operations
    if (durationMs > warnThresholdMs) {
      timingLog.warn(`Slow operation: ${name}`, {
        durationMs,
        type,
        workspaceId,
        threshold: warnThresholdMs,
      });
    } else if (durationMs > warnThresholdMs * 0.5) {
      timingLog.debug(`Operation timing: ${name}`, {
        durationMs,
        type,
        workspaceId,
      });
    }
  }
}

/**
 * Execute an async operation and return the result alongside duration.
 * Useful when the caller needs duration for custom handling.
 */
export async function withTimingGetDuration<T>(
  name: string,
  fn: () => Promise<T>,
  options: TimingOptions = {}
): Promise<[T, number]> {
  const start = Date.now();

  const result = await withTiming(name, fn, options);
  const durationMs = Date.now() - start;

  return [result, durationMs];
}

/**
 * Higher-order function: wraps an existing function with timing.
 * Preserves the original function's signature.
 *
 * Usage:
 *   const listTasks = withTimingFn('tasks:list', originalListTasks, { type: 'db' });
 */
export function withTimingFn<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: TimingOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withTiming(name, () => fn(...args), options);
  };
}
