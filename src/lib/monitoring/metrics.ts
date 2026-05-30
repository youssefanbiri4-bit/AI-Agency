export type MetricLabels = Record<string, unknown> | undefined;

function safeLabels(labels?: Record<string, unknown>): Record<string, unknown> {
  if (!labels) return {};
  // Avoid throwing: metrics must never break business logic.
  // (We don't deep-serialize; console.log JSON.stringify will handle primitives.)
  return labels;
}

function emitMetric(name: string, value: number, labels?: Record<string, unknown>) {
  try {
    // Machine-readable JSON log
    // Example:
    // { "type":"metric", "name":"worker_job_success", "labels":{}, "value":1 }
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
}

export function increment(metricName: string, labels?: Record<string, unknown>) {
  emitMetric(metricName, 1, labels);
}

export function timing(metricName: string, ms: number, labels?: Record<string, unknown>) {
  // ms may be float; emit as-is
  emitMetric(metricName, ms, labels);
}
