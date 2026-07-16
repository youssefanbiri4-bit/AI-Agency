/**
 * Server-Side Performance Timing
 *
 * Provides performance.mark/measure utilities for server components
 * to track data fetching and rendering durations.
 */

import 'server-only';

import { timing } from '@/lib/monitoring/metrics';

export interface PerformanceTrace {
  name: string;
  startTime: number;
  end(): number;
}

/**
 * Start a performance trace. Call .end() to record the duration.
 */
export function startTrace(name: string): PerformanceTrace {
  const startTime = Date.now();
  return {
    name,
    startTime,
    end(): number {
      const duration = Date.now() - startTime;
      timing(`server.${name}`, duration);
      return duration;
    },
  };
}

/**
 * Wrap an async operation with performance tracing.
 */
export async function traceAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const trace = startTrace(name);
  try {
    return await fn();
  } finally {
    trace.end();
  }
}

/**
 * Wrap a sync operation with performance tracing.
 */
export function traceSync<T>(
  name: string,
  fn: () => T
): T {
  const trace = startTrace(name);
  try {
    return fn();
  } finally {
    trace.end();
  }
}

/**
 * Batch trace multiple async operations and report combined timing.
 */
export async function traceBatch<T extends Record<string, Promise<unknown>>>(
  batchName: string,
  operations: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const trace = startTrace(batchName);
  try {
    const results = await Promise.allSettled(Object.values(operations));
    const keys = Object.keys(operations);
    const result: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      const r = results[i];
      result[keys[i]] = r.status === 'fulfilled' ? r.value : null;
    }
    return result as { [K in keyof T]: Awaited<T[K]> };
  } finally {
    trace.end();
  }
}
