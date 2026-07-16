import { startSpan } from '@sentry/nextjs';
import { withTiming, type TimingOptions } from '@/lib/data/with-timing';

export interface QueryTimingOptions {
  workspaceId?: string;
  type?: TimingOptions['type'];
  warnThresholdMs?: number;
  labels?: Record<string, unknown>;
  /** Alias for labels — forwarded to both metrics and the Sentry span. */
  attributes?: Record<string, unknown>;
  /** Sentry span operation name (default: 'db.query'). */
  op?: string;
}

/**
 * Wrap a database/query operation with:
 *  - existing timing metrics + slow-query logging (via withTiming)
 *  - a Sentry span (op: 'db.query') so the query shows up in Performance
 *    traces, plus a `db.query.<name>` measurement on the active transaction.
 *
 * Failures are never thrown — this wrapper only adds observability.
 */
export async function withQueryTiming<T>(
  name: string,
  queryFn: () => Promise<T>,
  options: QueryTimingOptions = {}
): Promise<T> {
  const labels = options.labels ?? options.attributes ?? {};
  const type = options.type ?? 'db';

  return withTiming(
    name,
    async () => {
      return startSpan(
        { op: options.op ?? 'db.query', name, attributes: toSpanAttributes(labels) },
        async () => queryFn()
      );
    },
    {
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      type,
      ...(options.warnThresholdMs ? { warnThresholdMs: options.warnThresholdMs } : {}),
      labels,
    }
  );
}

function toSpanAttributes(labels: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}
