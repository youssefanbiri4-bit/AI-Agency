'use client';

import React, { useEffect, useMemo, useState } from 'react';

type OperationalSummaryResponse = {
  ok: true;
  data: {
    system: {
      status: 'ok';
      timestamp: string;
      provider: { n8n: string };
      storage: string;
      database: string;
      callbackHealth: {
        windowHours: number;
        avgCallbackLatencyMs: number | null;
        callbackOutcomes: Record<
          'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed',
          number
        >;
      };
    };
    taskExecution: {
      taskCounts: {
        pending: number;
        processing: number;
        failed: number;
        completed: number;
        needs_review: number;
      };
      staleTasksCount: number;
      staleProcessingThresholdMs: number | undefined;
    };
  };
};

type OperationalExecutionResponse = {
  ok: true;
  data: {
    taskCounts: {
      pending: number;
      processing: number;
      failed: number;
      completed: number;
      needs_review: number;
    };
    staleProcessingThresholdMs: number;
    results: Array<{
      taskId: string;
      status: string;
      priority: string | null;
      agentType: string | null;
      n8nExecutionId: string | null;
      createdAt: string | null;
      updatedAt: string | null;
      completedAt: string | null;
      retryCount: number;
      failureReason: string | null;
      isStuck: boolean;
    }>;
    stuckWorkflows: string[];
    pagination: { page: number; pageSize: number; returned: number };
  };
};

type OperationalProviderResponse = {
  ok: true;
  data: {
    callbackWindowHours: number;
    n8n: {
      failedCount: number;
      duplicateCount: number;
      processedCount: number;
      avgCallbackLatencyMs: number | null;
    };
    providerReadiness: Array<{
      provider: string;
      readiness_state: string;
      message: string | null;
      missing: string[];
      last_checked_at: string | null;
      expires_at: string | null;
    }>;
  };
};

type OperationalAlertsResponse = {
  ok: true;
  data: {
    windowHours: number;
    alerts: Array<{
      id: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      details: string;
    }>;
  };
};

function severityColor(sev: 'critical' | 'high' | 'medium' | 'low') {
  switch (sev) {
    case 'critical':
      return 'text-red-600';
    case 'high':
      return 'text-orange-600';
    case 'medium':
      return 'text-yellow-600';
    default:
      return 'text-slate-600';
  }
}

function formatMs(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg shadow p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? <p className="text-sm text-black/60 mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OperationalDashboardClient() {
  const [summary, setSummary] = useState<OperationalSummaryResponse | null>(null);
  const [execution, setExecution] = useState<OperationalExecutionResponse | null>(null);
  const [provider, setProvider] = useState<OperationalProviderResponse | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlertsResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [execPage, setExecPage] = useState(1);
  const [execPageSize] = useState(25);

  const canRefresh = useMemo(() => !loading, [loading]);

  async function fetchAll(opts?: { page?: number }) {
    const page = opts?.page ?? execPage;
    setLoading(true);
    setError(null);

    try {
      const [s, e, p, a] = await Promise.all([
        fetch('/api/dashboard/operational/summary', { cache: 'no-store' }).then((r) =>
          r.json().catch(() => null)
        ),
        fetch(
          `/api/dashboard/operational/execution?page=${page}&pageSize=${execPageSize}`,
          { cache: 'no-store' }
        ).then((r) => r.json().catch(() => null)),
        fetch('/api/dashboard/operational/provider', { cache: 'no-store' }).then((r) =>
          r.json().catch(() => null)
        ),
        fetch('/api/dashboard/operational/alerts?windowHours=24', { cache: 'no-store' }).then(
          (r) => r.json().catch(() => null)
        ),
      ]);

      if (!s?.ok || !e?.ok || !p?.ok || !a?.ok) {
        throw new Error('Failed to load one or more operational endpoints.');
      }

      setSummary(s);
      setExecution(e);
      setProvider(p);
      setAlerts(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchAll({ page: 1 });
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchAll({ page: execPage });
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execPage]);

  const staleCount = summary?.data.taskExecution.staleTasksCount ?? 0;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#5D6B6B]">Founder Operational Command Center</h1>
          <p className="text-sm text-black/60 mt-1">
            Internal visibility only: system health, execution reliability, provider monitoring, and operational alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canRefresh}
            onClick={() => void fetchAll()}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/5 disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Panel title="System Health Overview" subtitle="Derived from internal health signals + callback outcomes">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Status</span>
              <span className="text-sm font-semibold">{summary?.data.system.status ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Callback window</span>
              <span className="text-sm font-semibold">
                {summary?.data.system.callbackHealth.windowHours ?? 'N/A'}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Avg callback latency</span>
              <span className="text-sm font-semibold">
                {formatMs(summary?.data.system.callbackHealth.avgCallbackLatencyMs ?? null)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Stale tasks</span>
              <span className="text-sm font-semibold text-orange-600">{staleCount}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Task Execution Reliability" subtitle="Counts across statuses (workspace-scoped)">
          <div className="space-y-2">
            {execution?.data.taskCounts ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-black/60">Pending</span>
                  <span className="text-sm font-semibold">{execution.data.taskCounts.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-black/60">Processing</span>
                  <span className="text-sm font-semibold">{execution.data.taskCounts.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-black/60">Needs Review</span>
                  <span className="text-sm font-semibold text-yellow-600">
                    {execution.data.taskCounts.needs_review}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-black/60">Failed</span>
                  <span className="text-sm font-semibold text-red-600">{execution.data.taskCounts.failed}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-black/60">Loading…</p>
            )}
          </div>
        </Panel>

        <Panel title="Provider Monitoring (n8n)" subtitle="Callback outcomes + derived latency">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Processed</span>
              <span className="text-sm font-semibold">{provider?.data.n8n.processedCount ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Failures</span>
              <span className="text-sm font-semibold text-red-600">{provider?.data.n8n.failedCount ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Duplicates</span>
              <span className="text-sm font-semibold text-orange-600">
                {provider?.data.n8n.duplicateCount ?? 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-black/60">Avg latency</span>
              <span className="text-sm font-semibold">{formatMs(provider?.data.n8n.avgCallbackLatencyMs ?? null)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Operational Alerts" subtitle="Heuristic thresholds (last 24h)">
          <div className="space-y-2">
            {alerts?.data.alerts?.length ? (
              alerts.data.alerts.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className={`font-semibold ${severityColor(a.severity)}`}>{a.title}</div>
                    <div className="text-xs text-black/50 mt-1">{a.details}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-black/60">Loading…</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Panel title="Execution Visibility (Paged)" subtitle="Pending / processing / failed / completed. Retry & failure reasons are derived server-side.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/50">
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Retries</th>
                  <th className="py-2 pr-3">Failure reason</th>
                </tr>
              </thead>
              <tbody>
                {(execution?.data.results ?? []).map((t) => (
                  <tr key={t.taskId} className="border-t border-black/5">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs">{t.taskId.slice(0, 8)}…</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          t.status === 'failed'
                            ? 'font-semibold text-red-600'
                            : t.isStuck
                              ? 'font-semibold text-orange-600'
                              : t.status === 'needs_review'
                                ? 'font-semibold text-yellow-600'
                                : 'font-semibold text-black/70'
                        }
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{t.priority ?? '—'}</td>
                    <td className="py-2 pr-3">{t.agentType ?? '—'}</td>
                    <td className="py-2 pr-3">{t.retryCount}</td>
                    <td className="py-2 pr-3">
                      {t.failureReason ? <span className="text-black/70">{t.failureReason}</span> : <span className="text-black/40">—</span>}
                    </td>
                  </tr>
                ))}
                {!execution?.data.results?.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-black/50">
                      Loading…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-black/60">
              Page {execution?.data.pagination.page ?? execPage} (size {execPageSize})
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold hover:bg-black/5 disabled:opacity-60"
                disabled={execPage <= 1}
                onClick={() => setExecPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Prev
              </button>
              <button
                className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold hover:bg-black/5 disabled:opacity-60"
                disabled={(execution?.data.results?.length ?? 0) < execPageSize}
                onClick={() => setExecPage((p) => p + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Provider Readiness Snapshot" subtitle="Workspace-scoped provider readiness cache (read-only).">
          <div className="space-y-2">
            {(provider?.data.providerReadiness ?? []).map((p) => (
              <div key={p.provider} className="border border-black/5 rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.provider}</div>
                    <div className="text-xs text-black/50 mt-1">
                      State: <span className="font-mono">{p.readiness_state}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-black/50">Missing: {p.missing?.length ?? 0}</div>
                  </div>
                </div>
                {p.message ? <div className="text-xs text-black/60 mt-2">{p.message}</div> : null}
                {p.missing?.length ? (
                  <div className="text-xs text-orange-700 mt-2">
                    Missing: {p.missing.join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
            {provider?.data.providerReadiness?.length ? null : <p className="text-sm text-black/60">Loading…</p>}
          </div>
        </Panel>
      </div>

      <Panel title="Operational Logs (Future)" subtitle="Log viewer endpoint is implemented. UI can be extended here with filtering & pagination.">
        <div className="text-sm text-black/60">
          Current UI keeps request volume low. Add a log viewer panel that calls:
          <span className="font-mono text-xs block mt-1">/api/dashboard/operational/logs</span>
        </div>
      </Panel>
    </div>
  );
}
