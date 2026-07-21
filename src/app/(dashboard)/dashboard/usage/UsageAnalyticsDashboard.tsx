'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, AlertOctagon,
  Download, BarChart3, Users, Clock, Shield, RefreshCw,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import type {
  ConsumptionTrend,
  MemberUsageAnalytics,
  UsageAlert,
  UsageForecast,
  DailyConsumption,
  UsageAnalyticsSummary,
} from '@/lib/usage/analytics';

const TREND_COLORS: Record<string, string> = {
  ai_generations: 'bg-violet-500',
  tasks: 'bg-blue-500',
  creative_assets: 'bg-teal-500',
  content_items: 'bg-amber-500',
  content_publishes: 'bg-orange-500',
  reels_publishes: 'bg-pink-500',
};

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-foreground-muted" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    healthy: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
    exceeded: 'bg-red-200 text-red-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function TrendCard({ trend }: { trend: ConsumptionTrend }) {
  return (
    <Card padded={false}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${TREND_COLORS[trend.quotaType] ?? 'bg-gray-400'}`} />
            <h3 className="text-sm font-bold text-foreground">{trend.label}</h3>
          </div>
          <StatusBadge status={trend.status} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-foreground-muted">This Month</p>
            <p className="text-lg font-black tabular-nums">{trend.currentPeriod}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Last Month</p>
            <p className="text-lg font-black tabular-nums">{trend.previousPeriod}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-foreground-muted">Change</p>
            <div className="flex items-center justify-end gap-1">
              <TrendIcon direction={trend.direction} />
              <span className="text-lg font-black tabular-nums">
                {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {trend.dailyAverage}/day avg
          </span>
          <span>Projected: {trend.projectedMonthEnd} by month end</span>
        </div>
      </div>
    </Card>
  );
}

function MemberAnalyticsTable({ members }: { members: MemberUsageAnalytics[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter((m) => {
      const name = (m.fullName ?? m.email ?? '').toLowerCase();
      return name.includes(q) || (m.email ?? '').toLowerCase().includes(q) || m.role.includes(q);
    });
  }, [members, search]);

  return (
    <Card>
      <CardHeader
        title="Per-Member Usage Analytics"
        description="Individual team member consumption with trend analysis and alerts"
      />
      <div className="p-4 pt-0 space-y-3">
        <div className="relative max-w-xs">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white pl-3 pr-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                <th className="pb-2 pr-3">Member</th>
                <th className="pb-2 pr-3 text-right tabular-nums">Total</th>
                <th className="pb-2 pr-3 text-right tabular-nums">Daily Avg</th>
                <th className="pb-2 pr-3 text-right tabular-nums">% of Total</th>
                <th className="pb-2 pr-3 text-center">Trend</th>
                <th className="pb-2 text-center">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">
                    No members found.
                  </td>
                </tr>
              ) : filtered.map((member) => (
                <tr key={member.userId} className="border-b border-divider last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-foreground">{member.fullName ?? member.email ?? 'Unknown'}</p>
                    {member.fullName && member.email && (
                      <p className="text-xs text-foreground-muted">{member.email}</p>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums">
                    {member.totalUsage}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums">
                    {member.avgDailyUsage}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-sm tabular-nums">
                    {member.usagePercentOfTotal}%
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    {member.trend === 'increasing' && <TrendingUp className="h-4 w-4 text-amber-500 inline" />}
                    {member.trend === 'decreasing' && <TrendingDown className="h-4 w-4 text-emerald-500 inline" />}
                    {member.trend === 'stable' && <Minus className="h-4 w-4 text-foreground-muted inline" />}
                  </td>
                  <td className="py-2.5 text-center">
                    {member.alerts.length > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        {member.alerts.some((a) => a.severity === 'critical') ? (
                          <AlertOctagon className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-bold">{member.alerts.length}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-foreground-muted">OK</span>
                    )}
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

function ForecastSection({ forecasts }: { forecasts: UsageForecast[] }) {
  return (
    <Card>
      <CardHeader
        title="Usage Forecasts"
        description="Projected consumption based on current daily rate. Higher confidence with more days elapsed."
      />
      <div className="p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forecasts.map((f) => {
            const usagePercent = f.limit !== null ? Math.round((f.currentUsage / f.limit) * 100) : 0;
            const isWarning = usagePercent >= 80;
            const isCritical = usagePercent >= 95;

            return (
              <div
                key={f.quotaType}
                className={`rounded-lg border p-4 ${
                  isCritical ? 'border-red-300 bg-red-50' :
                  isWarning ? 'border-amber-300 bg-amber-50' :
                  'border-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold">{f.label}</h4>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    f.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                    f.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {f.confidence} confidence
                  </span>
                </div>

                {f.limit !== null ? (
                  <>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-foreground-muted mb-1">
                        <span>{f.currentUsage} / {f.limit}</span>
                        <span>{usagePercent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-black/10 overflow-hidden">
                        <div
                          className={`h-1.5 rounded ${
                            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-foreground-muted space-y-0.5">
                      <p>{f.dailyRate}/day average</p>
                      {f.daysUntilLimit !== null && f.daysUntilLimit > 0 ? (
                        <p className={isCritical ? 'text-red-600 font-bold' : ''}>
                          Limit in ~{f.daysUntilLimit} days ({f.projectedDate})
                        </p>
                      ) : f.daysUntilLimit === 0 ? (
                        <p className="text-red-600 font-bold">Limit reached</p>
                      ) : (
                        <p>No consumption yet</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-foreground-muted">Unlimited (Agency plan)</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function AlertsPanel({ alerts }: { alerts: UsageAlert[] }) {
  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  return (
    <Card>
      <CardHeader
        title={`Active Alerts (${alerts.length})`}
        description="Quota warnings and limit exceeded notifications"
        action={
          critical.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
              <AlertOctagon className="h-3 w-3" />
              {critical.length} Critical
            </span>
          )
        }
      />
      <div className="p-4 pt-0 space-y-2">
        {critical.map((alert, i) => (
          <div key={`c-${i}`} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertOctagon className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-800">{alert.message}</p>
              {alert.current !== undefined && alert.limit !== undefined && (
                <p className="text-xs text-red-600">
                  {alert.current} / {alert.limit} ({alert.percentUsed}%)
                </p>
              )}
            </div>
          </div>
        ))}
        {warnings.map((alert, i) => (
          <div key={`w-${i}`} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">{alert.message}</p>
              {alert.current !== undefined && alert.limit !== undefined && (
                <p className="text-xs text-amber-600">
                  {alert.current} / {alert.limit} ({alert.percentUsed}%)
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HealthCorrelation({
  score,
  status,
  usageDuringDegradation,
}: {
  score: number | null;
  status: string | null;
  usageDuringDegradation: number;
}) {
  if (score === null) return null;

  return (
    <Card>
      <CardHeader
        title="Health & Usage Correlation"
        description="Platform health score correlated with usage patterns"
      />
      <div className="p-4 pt-0">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-3xl font-black ${
              score >= 90 ? 'text-emerald-600' :
              score >= 70 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {score}
            </div>
            <p className="text-xs text-foreground-muted">Health Score</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-bold capitalize">{status}</span>
            </div>
            {usageDuringDegradation > 0 && (
              <p className="text-xs text-amber-600">
                {usageDuringDegradation} operations during degraded health
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function UsageAnalyticsDashboard({ data }: { data: UsageAnalyticsSummary }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    window.location.reload();
  };

  const handleExport = () => {
    window.open('/api/usage/analytics/export', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Analytics
          </h2>
          <p className="text-sm text-foreground-muted">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums">{data.totalConsumption.thisMonth}</p>
            <p className="text-xs text-foreground-muted">This Month</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon
                direction={data.totalConsumption.changePercent > 5 ? 'up' : data.totalConsumption.changePercent < -5 ? 'down' : 'flat'}
              />
              <span className="text-sm font-bold">
                {data.totalConsumption.changePercent > 0 ? '+' : ''}{data.totalConsumption.changePercent}%
              </span>
            </div>
          </div>
        </Card>
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums">{data.totalConsumption.lastMonth}</p>
            <p className="text-xs text-foreground-muted">Last Month</p>
          </div>
        </Card>
        <Card padded={false}>
          <div className="p-4 text-center">
            <p className="text-3xl font-black tabular-nums flex items-center justify-center gap-2">
              <Users className="h-6 w-6" />
              {data.memberAnalytics.length}
            </p>
            <p className="text-xs text-foreground-muted">Active Members</p>
          </div>
        </Card>
      </div>

      <AlertsPanel alerts={data.alerts} />

      <div className="grid gap-6 lg:grid-cols-2">
        {data.trends.map((trend) => (
          <TrendCard key={trend.quotaType} trend={trend} />
        ))}
      </div>

      <ForecastSection forecasts={data.forecasts} />

      <HealthCorrelation
        score={data.healthCorrelation.healthScore}
        status={data.healthCorrelation.healthStatus}
        usageDuringDegradation={data.healthCorrelation.usageDuringDegradation}
      />

      <MemberAnalyticsTable members={data.memberAnalytics} />
    </div>
  );
}
