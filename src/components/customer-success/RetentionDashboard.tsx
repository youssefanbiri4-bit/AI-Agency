'use client';

import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Users, Activity, Star, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetentionAnalytics } from '@/lib/data/customer-success';

interface RetentionDashboardProps {
  data: RetentionAnalytics;
  className?: string;
}

function MiniChart({ values, height = 40 }: { values: number[]; height?: number }) {
  if (values.length === 0) return null;
  const w = 200;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" />
    </svg>
  );
}

export function RetentionDashboard({ data, className }: RetentionDashboardProps) {
  const trendDirection = data.eventChangePercent >= 0 ? 'up' : 'down';
  const TrendIcon = trendDirection === 'up' ? ArrowUpRight : ArrowDownRight;
  const trendColor = trendDirection === 'up' ? 'text-success' : 'text-danger';

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={data.totalMembers}
          icon={Users}
          tone="primary"
          subtitle="Workspace members"
        />
        <StatCard
          title="Active (30d)"
          value={data.activeMembers30d}
          icon={Activity}
          tone="success"
          subtitle={`${data.activeRate}% active rate`}
        />
        <StatCard
          title="Events This Month"
          value={data.thisMonthEvents}
          icon={Calendar}
          tone="neutral"
          subtitle={`${data.eventChangePercent >= 0 ? '+' : ''}${data.eventChangePercent}% vs last month`}
        />
        <StatCard
          title="NPS Score"
          value={data.nps.nps}
          icon={Star}
          tone={data.nps.nps >= 0 ? 'success' : 'danger'}
          subtitle={`${data.nps.count} responses`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Daily Active Users"
            description="User activity over the last 30 days"
            action={
              <div className="flex items-center gap-1.5">
                <TrendIcon className={cn('h-4 w-4', trendColor)} />
                <span className={cn('text-sm font-bold', trendColor)}>
                  {data.eventChangePercent >= 0 ? '+' : ''}{data.eventChangePercent}%
                </span>
              </div>
            }
          />
          <div className="p-4">
            <MiniChart values={data.dailyActive.map((d) => d.activeUsers)} />
            <div className="mt-3 grid grid-cols-2 gap-4 text-center text-xs text-foreground-muted">
              <div>
                <p className="text-lg font-black text-foreground">{data.thisMonthEvents}</p>
                <p>This month</p>
              </div>
              <div>
                <p className="text-lg font-black text-foreground">{data.lastMonthEvents}</p>
                <p>Last month</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="NPS Trend"
            description="Net Promoter Score trend over time"
          />
          <div className="p-4">
            {data.nps.trend.length > 0 ? (
              <MiniChart values={data.nps.trend.map((t) => t.nps)} />
            ) : (
              <div className="flex h-[40px] items-center justify-center text-xs text-foreground-muted">
                No trend data available
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <Badge tone="success">{data.nps.promoters}</Badge>
                <p className="mt-1 text-foreground-muted">Promoters</p>
              </div>
              <div>
                <Badge tone="info">{data.nps.passives}</Badge>
                <p className="mt-1 text-foreground-muted">Passives</p>
              </div>
              <div>
                <Badge tone="danger">{data.nps.detractors}</Badge>
                <p className="mt-1 text-foreground-muted">Detractors</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Retention Summary"
          description="Key metrics for customer health"
        />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div className="rounded-xl bg-surface p-3 text-center">
            <p className="text-2xl font-black text-foreground">{data.activeRate}%</p>
            <p className="text-[10px] font-bold uppercase text-foreground-muted">Active Rate</p>
          </div>
          <div className="rounded-xl bg-surface p-3 text-center">
            <p className="text-2xl font-black text-foreground">{data.totalMembers - data.activeMembers30d}</p>
            <p className="text-[10px] font-bold uppercase text-foreground-muted">Inactive (30d)</p>
          </div>
          <div className="rounded-xl bg-surface p-3 text-center">
            <p className="text-2xl font-black text-foreground">{data.nps.count}</p>
            <p className="text-[10px] font-bold uppercase text-foreground-muted">NPS Responses</p>
          </div>
          <div className="rounded-xl bg-surface p-3 text-center">
            <p className="text-2xl font-black text-foreground">{data.nps.average.toFixed(1)}</p>
            <p className="text-[10px] font-bold uppercase text-foreground-muted">Avg NPS</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
