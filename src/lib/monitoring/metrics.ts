export type MetricLabels = Record<string, unknown> | undefined;

function safeLabels(labels?: Record<string, unknown>): Record<string, unknown> {
  if (!labels) return {};
  // Avoid throwing: metrics must never break business logic.
  return labels;
}

function emitMetric(name: string, value: number, labels?: Record<string, unknown>) {
  try {
    // Machine-readable JSON log (shipped to log drain on Vercel).
    console.log(
      JSON.stringify({
        type: 'metric',
        name,
        labels: safeLabels(labels),
        value,
      })
    );
  } catch {
    // noop: metrics must never break business logic
  }
  recordMetric(name, value, labels);
}

export function increment(metricName: string, labels?: Record<string, unknown>) {
  emitMetric(metricName, 1, labels);
}

export function timing(metricName: string, ms: number, labels?: Record<string, unknown>) {
  emitMetric(metricName, ms, labels);
}

// ─── In-memory Prometheus-style registry (W20-T2) ───────────────────────────
// Aggregates metrics for the current instance so /api/metrics can expose a
// scrape endpoint. These are per-instance only (serverless statelessness);
// for fleet-wide aggregation, ship the JSON metric logs to a log drain /
// Prometheus remote-write. This never blocks business logic.

type MetricKind = 'counter' | 'gauge' | 'histogram';

interface MetricSeries {
  kind: MetricKind;
  help: string;
  // key = sorted label string (or ''), value = cumulative/last value
  values: Map<string, number>;
  labelKeys: string[];
}

const registry = new Map<string, MetricSeries>();

function labelKey(labels?: Record<string, unknown>): { key: string; keys: string[] } {
  if (!labels) return { key: '', keys: [] };
  const keys = Object.keys(labels).sort();
  const parts = keys.map((k) => `${k}="${String(labels[k]).replace(/"/g, '\\"')}"`);
  return { key: parts.join(','), keys };
}

function recordMetric(name: string, value: number, labels?: Record<string, unknown>) {
  try {
    const { key, keys } = labelKey(labels);
    let series = registry.get(name);
    if (!series) {
      series = { kind: 'counter', help: name, values: new Map(), labelKeys: keys };
      registry.set(name, series);
    }
    const prev = series.values.get(key) ?? 0;
    series.values.set(key, prev + value);
  } catch {
    // noop
  }
}

/** Force a metric to a gauge value (overwrites). Used for latency/health gauges. */
export function setGauge(name: string, value: number, labels?: Record<string, unknown>) {
  try {
    const { key, keys } = labelKey(labels);
    let series = registry.get(name);
    if (!series) {
      series = { kind: 'gauge', help: name, values: new Map(), labelKeys: keys };
      registry.set(name, series);
    } else {
      series.kind = 'gauge';
    }
    series.values.set(key, value);
  } catch {
    // noop
  }
}

function prometheusType(kind: MetricKind): string {
  return kind === 'counter' ? 'counter' : kind === 'gauge' ? 'gauge' : 'histogram';
}

/**
 * Render all aggregated metrics in Prometheus text exposition format.
 */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  for (const [name, series] of registry) {
    lines.push(`# HELP ${name} ${series.help}`);
    lines.push(`# TYPE ${name} ${prometheusType(series.kind)}`);
    for (const [labelStr, value] of series.values) {
      const suffix = labelStr ? `{${labelStr}}` : '';
      lines.push(`${name}${suffix} ${value}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** W20-T2: exposed for /api/metrics. Clears per-instance state after scrape. */
export function collectAndResetMetrics(): string {
  const out = renderPrometheusMetrics();
  registry.clear();
  return out;
}
