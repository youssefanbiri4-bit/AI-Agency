'use client';

import { useMemo } from 'react';
import {
  TrendingUp,
  Users,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface GrowthMetrics {
  signups: number;
  activations: number;
  retention7d: number;
  retention30d: number;
  nps: number;
  conversionRate: number;
  churnRate: number;
  ltv: number;
  cac: number;
  paybackPeriod: number;
}

interface GrowthPlaybookProps {
  metrics: GrowthMetrics;
  className?: string;
}

interface MetricCardProps {
  label: string;
  value: number | string;
  previousValue?: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: 'number' | 'percent' | 'currency' | 'days';
  target?: number;
}

function MetricCard({
  label,
  value,
  previousValue,
  icon: Icon,
  format = 'number',
  target,
}: MetricCardProps) {
  const change = previousValue !== undefined && previousValue > 0
    ? ((typeof value === 'number' ? value : 0) - previousValue) / previousValue * 100
    : undefined;

  const isAboveTarget = target !== undefined && typeof value === 'number'
    ? value >= target
    : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            isAboveTarget === true ? 'bg-success/10' : isAboveTarget === false ? 'bg-warning/10' : 'bg-primary/10'
          )}>
            <Icon className={cn(
              'h-5 w-5',
              isAboveTarget === true ? 'text-success' : isAboveTarget === false ? 'text-warning' : 'text-primary'
            )} />
          </div>
          <div>
            <p className="text-sm text-foreground-muted">{label}</p>
            <p className="text-xl font-black text-foreground">
              {format === 'currency'
                ? `$${typeof value === 'number' ? value.toLocaleString() : value}`
                : format === 'percent'
                  ? `${typeof value === 'number' ? value.toFixed(1) : value}%`
                  : format === 'days'
                    ? `${value}d`
                    : typeof value === 'number'
                      ? value.toLocaleString()
                      : value}
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

      {target !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground-muted">Target: {target}</span>
            {isAboveTarget !== undefined && (
              <span className={cn(
                'font-bold',
                isAboveTarget ? 'text-success' : 'text-warning'
              )}>
                {isAboveTarget ? 'On track' : 'Needs improvement'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GrowthPlaybook({ metrics, className }: GrowthPlaybookProps) {
  const healthScore = useMemo(() => {
    let score = 0;

    // Activation rate (0-25)
    const activationRate = metrics.signups > 0 ? (metrics.activations / metrics.signups) * 100 : 0;
    score += Math.min(25, activationRate * 0.25);

    // 7-day retention (0-25)
    score += Math.min(25, metrics.retention7d * 0.25);

    // 30-day retention (0-25)
    score += Math.min(25, metrics.retention30d * 0.25);

    // LTV:CAC ratio (0-25)
    const ltvCacRatio = metrics.cac > 0 ? metrics.ltv / metrics.cac : 0;
    score += Math.min(25, ltvCacRatio * 5);

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
        title="Growth Playbook"
        description="Key metrics and targets for post-launch growth."
        action={
          <Badge tone={health.tone}>
            Health: {healthScore}/100
          </Badge>
        }
      />

      {/* Key metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Signups"
          value={metrics.signups}
          icon={Users}
          format="number"
        />
        <MetricCard
          label="Activations"
          value={metrics.activations}
          previousValue={Math.round(metrics.signups * 0.6)}
          icon={CheckCircle2}
          format="number"
          target={Math.round(metrics.signups * 0.7)}
        />
        <MetricCard
          label="Conversion Rate"
          value={metrics.conversionRate}
          icon={Target}
          format="percent"
          target={5}
        />
        <MetricCard
          label="7-Day Retention"
          value={metrics.retention7d}
          icon={TrendingUp}
          format="percent"
          target={40}
        />
        <MetricCard
          label="30-Day Retention"
          value={metrics.retention30d}
          icon={BarChart3}
          format="percent"
          target={25}
        />
        <MetricCard
          label="NPS Score"
          value={metrics.nps}
          icon={TrendingUp}
          format="number"
          target={50}
        />
      </div>

      {/* Unit economics */}
      <div className="mt-6">
        <p className="mb-4 text-sm font-bold text-foreground">Unit Economics</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Customer LTV</p>
            <p className="text-lg font-bold text-foreground">${metrics.ltv.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Customer Acquisition Cost</p>
            <p className="text-lg font-bold text-foreground">${metrics.cac.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">Payback Period</p>
            <p className={cn(
              'text-lg font-bold',
              metrics.paybackPeriod <= 6 ? 'text-success' : metrics.paybackPeriod <= 12 ? 'text-warning' : 'text-danger'
            )}>
              {metrics.paybackPeriod} months
            </p>
          </div>
        </div>
      </div>

      {/* Health score breakdown */}
      <div className="mt-6">
        <p className="mb-4 text-sm font-bold text-foreground">Health Score Breakdown</p>
        <div className="space-y-3">
          {[
            { label: 'Activation Rate', value: metrics.signups > 0 ? (metrics.activations / metrics.signups) * 100 : 0, target: 70 },
            { label: '7-Day Retention', value: metrics.retention7d, target: 40 },
            { label: '30-Day Retention', value: metrics.retention30d, target: 25 },
            { label: 'LTV:CAC Ratio', value: metrics.cac > 0 ? (metrics.ltv / metrics.cac) * 100 : 0, target: 300 },
          ].map((item) => {
            const ratio = Math.min(100, (item.value / item.target) * 100);
            const isAboveTarget = item.value >= item.target;

            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <span className={cn(
                    'font-bold',
                    isAboveTarget ? 'text-success' : 'text-warning'
                  )}>
                    {item.label === 'LTV:CAC Ratio' ? `${(item.value / 100).toFixed(1)}x` : `${item.value.toFixed(1)}%`}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isAboveTarget ? 'bg-success' : 'bg-warning'
                    )}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
