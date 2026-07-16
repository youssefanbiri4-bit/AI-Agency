'use client';

import { useMemo } from 'react';
import {
  Users,
  Target,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface LaunchMetrics {
  signups: number;
  activations: number;
  conversionRate: number;
  revenue: number;
  activeUsers: number;
  timeToFirstAction: number;
  supportTickets: number;
  nps: number;
  day1Retention: number;
  day7Retention: number;
}

interface LaunchMetricsDashboardProps {
  metrics: LaunchMetrics;
  previousMetrics?: Partial<LaunchMetrics>;
  className?: string;
}

function MetricCard({
  label,
  value,
  previousValue,
  icon: Icon,
  format = 'number',
}: {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: 'number' | 'percent' | 'currency' | 'days';
}) {
  const change = previousValue !== undefined && previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground-muted">{label}</p>
            <p className="text-xl font-black text-foreground">
              {format === 'currency'
                ? `$${value.toLocaleString()}`
                : format === 'percent'
                  ? `${value.toFixed(1)}%`
                  : format === 'days'
                    ? `${value}d`
                    : value.toLocaleString()}
            </p>
          </div>
        </div>

        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-bold',
            change >= 0 ? 'text-success' : 'text-danger'
          )}>
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

export function LaunchMetricsDashboard({
  metrics,
  previousMetrics,
  className,
}: LaunchMetricsDashboardProps) {
  const healthScore = useMemo(() => {
    let score = 0;

    // Conversion rate (0-25)
    score += Math.min(25, metrics.conversionRate * 5);

    // Day 7 retention (0-25)
    score += Math.min(25, metrics.day7Retention * 0.25);

    // NPS (0-25)
    score += Math.min(25, metrics.nps * 0.25);

    // Revenue per user (0-25)
    const revenuePerUser = metrics.activeUsers > 0 ? metrics.revenue / metrics.activeUsers : 0;
    score += Math.min(25, revenuePerUser * 2.5);

    return Math.round(score);
  }, [metrics]);

  const health = useMemo(() => {
    if (healthScore >= 80) return { label: 'Excellent', tone: 'success' as const };
    if (healthScore >= 60) return { label: 'Good', tone: 'info' as const };
    if (healthScore >= 40) return { label: 'Needs Work', tone: 'warning' as const };
    return { label: 'Critical', tone: 'danger' as const };
  }, [healthScore]);

  return (
    <Card className={className}>
      <CardHeader
        title="Launch Metrics Dashboard"
        description="Real-time metrics from your launch performance."
        action={
          <Badge tone={health.tone}>
            Launch Health: {healthScore}/100
          </Badge>
        }
      />

      {/* Key metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Signups"
          value={metrics.signups}
          previousValue={previousMetrics?.signups}
          icon={Users}
        />
        <MetricCard
          label="Activations"
          value={metrics.activations}
          previousValue={previousMetrics?.activations}
          icon={Target}
        />
        <MetricCard
          label="Conversion Rate"
          value={metrics.conversionRate}
          previousValue={previousMetrics?.conversionRate}
          icon={TrendingUp}
          format="percent"
        />
        <MetricCard
          label="Revenue"
          value={metrics.revenue}
          previousValue={previousMetrics?.revenue}
          icon={BarChart3}
          format="currency"
        />
      </div>

      {/* Secondary metrics */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Users"
          value={metrics.activeUsers}
          previousValue={previousMetrics?.activeUsers}
          icon={Users}
        />
        <MetricCard
          label="Time to First Action"
          value={metrics.timeToFirstAction}
          previousValue={previousMetrics?.timeToFirstAction}
          icon={Clock}
          format="days"
        />
        <MetricCard
          label="Support Tickets"
          value={metrics.supportTickets}
          previousValue={previousMetrics?.supportTickets}
          icon={Zap}
        />
        <MetricCard
          label="NPS Score"
          value={metrics.nps}
          previousValue={previousMetrics?.nps}
          icon={TrendingUp}
        />
      </div>

      {/* Retention chart */}
      <div className="mt-6">
        <p className="mb-4 text-sm font-bold text-foreground">Retention Funnel</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Day 1 Retention</p>
            <p className="text-2xl font-black text-foreground">{metrics.day1Retention.toFixed(1)}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${metrics.day1Retention}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Day 7 Retention</p>
            <p className="text-2xl font-black text-foreground">{metrics.day7Retention.toFixed(1)}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${metrics.day7Retention}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Day 30 Retention</p>
            <p className="text-2xl font-black text-foreground">
              {(metrics.day7Retention * 0.6).toFixed(1)}%
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${metrics.day7Retention * 0.6}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
