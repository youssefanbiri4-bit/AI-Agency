'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Download, FileText, RefreshCw,
  Users, AlertTriangle, Activity, Gauge,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import type {
  InsightsSummary,
  ChurnRiskScore,
  TeamPerformanceMember,
  DailyUsagePoint,
  UsageForecastPoint,
} from '@/lib/analytics/insights';

const SEGMENT_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  watch: { label: 'Watch', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  at_risk: { label: 'At Risk', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  churn_risk: { label: 'Churn Risk', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
};

function TrendIcon({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  if (dir === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (dir === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-foreground-muted" />;
}

// ─── Usage chart ─────────────────────────────────────────────────────────────

function UsageChart({ daily, forecast }: { daily: DailyUsagePoint[]; forecast: UsageForecastPoint[] }) {
  const points = useMemo(() => [...daily, ...forecast], [daily, forecast]);
  const maxTotal = Math.max(...points.map((p) => 'total' in p ? (p as DailyUsagePoint).total : (p as UsageForecastPoint).predicted), 1);

  return (
    <Card>
      <CardHeader
        title="Usage Trends & 14-Day Forecast"
        description="Least-squares projection with confidence band"
      />
      <div className="p-4 pt-0">
        <div className="flex items-end gap-px h-40 overflow-hidden">
          {points.map((p, i) => {
            const total = 'total' in p ? (p as DailyUsagePoint).total : (p as UsageForecastPoint).predicted;
            const isForecast = 'predicted' in p;
            const heightPct = Math.max((total / maxTotal) * 100, 2);
            return (
              <div
                key={`${(p as DailyUsagePoint).date}-${i}`}
                className="flex-1 min-w-0 group relative"
                style={{ height: `${heightPct}%` }}
              >
                <div
                  className={`w-full h-full rounded-t-sm transition-colors ${
                    isForecast ? 'bg-red-400/70 hover:bg-red-400' : 'bg-violet-500/80 hover:bg-violet-500'
                  }`}
                />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-surface-elevated border border-border rounded-lg px-3 py-2 shadow-lg text-xs whitespace-nowrap">
                  <p className="font-bold">{(p as DailyUsagePoint).date}</p>
                  <p className="text-foreground-muted">{total} {isForecast ? '(forecast)' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 text-xs text-foreground-muted mt-2">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-violet-500/80" /> Actual</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-400/70" /> Forecast</span>
        </div>
      </div>
    </Card>
  );
}

// ─── Churn panel ─────────────────────────────────────────────────────────────

function ChurnPanel({ scores, averageRisk, segments }: {
  scores: ChurnRiskScore[];
  averageRisk: number;
  segments: Record<string, number>;
}) {
  const [query, setQuery] = useState('');
  const [seg, setSeg] = useState<string>('all');

  const filtered = useMemo(() => {
    return scores.filter((s) => {
      if (seg !== 'all' && s.segment !== seg) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (s.fullName ?? s.email ?? '').toLowerCase().includes(q) || s.role.includes(q);
    });
  }, [scores, query, seg]);

  return (
    <Card>
      <CardHeader
        title="Churn Risk Scores"
        description={`Average risk ${averageRisk}/100 · heuristic recency + usage-decay model`}
      />
      <div className="p-4 pt-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              placeholder="Search members..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-white pl-3 pr-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
            />
          </div>
          <select
            value={seg}
            onChange={(e) => setSeg(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          >
            <option value="all">All segments</option>
            {Object.entries(SEGMENT_STYLES).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({segments[k] ?? 0})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(SEGMENT_STYLES).map(([k, v]) => (
            <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${v.badge}`}>
              <span className={`h-2 w-2 rounded-full ${v.dot}`} />
              {v.label}: {segments[k] ?? 0}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                <th className="pb-2 pr-3">Member</th>
                <th className="pb-2 pr-3 text-right">Risk</th>
                <th className="pb-2 pr-3 text-center">Segment</th>
                <th className="pb-2 pr-3 text-right">Idle</th>
                <th className="pb-2">Signals</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-foreground-muted">No members match.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.userId} className="border-b border-divider last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-foreground">{s.fullName ?? s.email ?? 'Unknown'}</p>
                    {s.fullName && s.email && <p className="text-xs text-foreground-muted">{s.email}</p>}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums">{s.riskScore}</td>
                  <td className="py-2.5 pr-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${SEGMENT_STYLES[s.segment].badge}`}>
                      <span className={`h-2 w-2 rounded-full ${SEGMENT_STYLES[s.segment].dot}`} />
                      {SEGMENT_STYLES[s.segment].label}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums">{s.daysSinceLastActivity ?? '—'}</td>
                  <td className="py-2.5 text-xs text-foreground-muted">
                    {s.signals.length > 0 ? s.signals.join(' · ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ─── Team performance ────────────────────────────────────────────────────────

function TeamPanel({ members }: { members: TeamPerformanceMember[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter((m) =>
      (m.fullName ?? m.email ?? '').toLowerCase().includes(q) ||
      (m.department ?? '').toLowerCase().includes(q) ||
      m.role.includes(q)
    );
  }, [members, query]);

  return (
    <Card>
      <CardHeader
        title="Team Performance"
        description="Task throughput, completion rate, and average cycle time per member"
      />
      <div className="p-4 pt-0 space-y-3">
        <div className="relative max-w-xs">
          <input
            type="text"
            placeholder="Search members or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white pl-3 pr-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                <th className="pb-2 pr-3">Member</th>
                <th className="pb-2 pr-3 text-right">Total</th>
                <th className="pb-2 pr-3 text-right">Done</th>
                <th className="pb-2 pr-3 text-right">Failed</th>
                <th className="pb-2 pr-3 text-right">Rate</th>
                <th className="pb-2 text-right">Cycle (h)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">No members found.</td></tr>
              ) : filtered.map((m) => {
                const rateColor = m.completionRate >= 80 ? 'text-emerald-600' : m.completionRate >= 50 ? 'text-amber-600' : 'text-red-600';
                return (
                  <tr key={m.userId} className="border-b border-divider last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-bold text-foreground">{m.fullName ?? m.email ?? 'Unknown'}</p>
                      <p className="text-xs text-foreground-muted">{m.department ?? '—'} · {m.role}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums">{m.totalTasks}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums">{m.completedTasks}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums">{m.failedTasks}</td>
                    <td className={`py-2.5 pr-3 text-right font-mono font-bold tabular-nums ${rateColor}`}>{m.completionRate}%</td>
                    <td className="py-2.5 text-right font-mono text-sm tabular-nums">{m.avgCycleHours ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ─── Department breakdown ────────────────────────────────────────────────────

function DepartmentPanel({ byDepartment }: { byDepartment: InsightsSummary['team']['byDepartment'] }) {
  if (byDepartment.length === 0) return null;
  const maxTotal = Math.max(...byDepartment.map((d) => d.totalTasks), 1);

  return (
    <Card>
      <CardHeader title="Department Breakdown" description="Task volume and completion rate by department" />
      <div className="p-4 pt-0 space-y-3">
        {byDepartment.map((d) => (
          <div key={d.department}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-bold capitalize">{d.department.replace(/_/g, ' ')}</span>
              <span className="text-foreground-muted">{d.completedTasks}/{d.totalTasks} · {d.completionRate}%</span>
            </div>
            <div className="h-2 w-full rounded bg-black/10 overflow-hidden">
              <div
                className="h-2 rounded bg-teal-500"
                style={{ width: `${(d.totalTasks / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Root dashboard ──────────────────────────────────────────────────────────

export function InsightsDashboard({ data }: { data: InsightsSummary }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  const usageChangeColor = data.usage.changePercent > 0 ? 'text-emerald-600' : data.usage.changePercent < 0 ? 'text-red-600' : 'text-foreground-muted';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Analytics &amp; Insights
          </h2>
          <p className="text-sm text-foreground-muted">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleRefresh} className={buttonStyles({ variant: 'outline', size: 'sm' })} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/analytics/insights/export', '_blank')}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/analytics/insights/export-pdf', '_blank')}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums">{data.usage.totalLast30}</p>
            <p className="text-xs text-foreground-muted">Usage (30d)</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon dir={data.usage.trendDirection} />
              <span className={`text-sm font-bold ${usageChangeColor}`}>
                {data.usage.changePercent > 0 ? '+' : ''}{data.usage.changePercent}%
              </span>
            </div>
          </div>
        </Card>
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums flex items-center justify-center gap-2"><Activity className="h-6 w-6" />{data.usage.fitQuality}</p>
            <p className="text-xs text-foreground-muted">Forecast R²</p>
          </div>
        </Card>
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums flex items-center justify-center gap-2"><AlertTriangle className="h-6 w-6 text-amber-500" />{data.churn.segments.churn_risk + data.churn.segments.at_risk}</p>
            <p className="text-xs text-foreground-muted">At/Churn Risk</p>
          </div>
        </Card>
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums flex items-center justify-center gap-2"><Users className="h-6 w-6" />{data.team.totals.completionRate}%</p>
            <p className="text-xs text-foreground-muted">Team Completion</p>
          </div>
        </Card>
      </div>

      <UsageChart daily={data.usage.daily} forecast={data.usage.forecast} />

      <ChurnPanel scores={data.churn.scores} averageRisk={data.churn.averageRisk} segments={data.churn.segments} />

      <TeamPanel members={data.team.members} />

      <DepartmentPanel byDepartment={data.team.byDepartment} />
    </div>
  );
}
