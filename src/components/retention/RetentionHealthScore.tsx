'use client';

import { useMemo } from 'react';
import {
  Heart,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface RetentionMetrics {
  activeUsers: number;
  totalUsers: number;
  weeklyActivity: number;
  monthlyActivity: number;
  avgSessionDuration: number;
  featureAdoption: number;
  supportTickets: number;
  npsScore: number;
}

interface RetentionHealthScoreProps {
  metrics: RetentionMetrics;
  className?: string;
}

export function RetentionHealthScore({ metrics, className }: RetentionHealthScoreProps) {
  const score = useMemo(() => {
    let s = 0;

    // Active user ratio (0-25 points)
    const activeRatio = metrics.totalUsers > 0 ? metrics.activeUsers / metrics.totalUsers : 0;
    s += Math.min(25, activeRatio * 25);

    // Weekly activity trend (0-25 points)
    const weeklyTrend = metrics.weeklyActivity / Math.max(1, metrics.totalUsers);
    s += Math.min(25, weeklyTrend * 25);

    // Feature adoption (0-25 points)
    s += Math.min(25, metrics.featureAdoption * 0.25);

    // NPS score (0-25 points)
    if (metrics.npsScore > 0) {
      s += Math.min(25, (metrics.npsScore / 10) * 25);
    }

    return Math.round(s);
  }, [metrics]);

  const health = useMemo(() => {
    if (score >= 80) return { label: 'Excellent', tone: 'success' as const, icon: CheckCircle2 };
    if (score >= 60) return { label: 'Good', tone: 'info' as const, icon: Heart };
    if (score >= 40) return { label: 'Needs Attention', tone: 'warning' as const, icon: AlertTriangle };
    return { label: 'Critical', tone: 'danger' as const, icon: AlertTriangle };
  }, [score]);

  const HealthIcon = health.icon;

  const factors = useMemo(() => [
    {
      label: 'Active Users',
      value: metrics.totalUsers > 0 ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0,
      target: 80,
      unit: '%',
    },
    {
      label: 'Weekly Activity',
      value: metrics.totalUsers > 0 ? Math.round((metrics.weeklyActivity / metrics.totalUsers) * 100) : 0,
      target: 70,
      unit: '%',
    },
    {
      label: 'Feature Adoption',
      value: Math.round(metrics.featureAdoption),
      target: 60,
      unit: '%',
    },
    {
      label: 'NPS Score',
      value: metrics.npsScore,
      target: 7,
      unit: '/10',
    },
  ], [metrics]);

  return (
    <Card className={className}>
      <CardHeader
        title="Retention Health"
        description="Overall workspace engagement score."
      />

      <div className="flex items-center gap-6">
        {/* Score circle */}
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-foreground/10"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${score * 2.83} 283`}
              className={cn(
                health.tone === 'success' && 'text-success',
                health.tone === 'info' && 'text-info',
                health.tone === 'warning' && 'text-warning',
                health.tone === 'danger' && 'text-danger'
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-foreground">{score}</span>
            <span className="text-xs text-foreground-muted">/100</span>
          </div>
        </div>

        {/* Health label */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <HealthIcon className={cn(
              'h-5 w-5',
              health.tone === 'success' && 'text-success',
              health.tone === 'info' && 'text-info',
              health.tone === 'warning' && 'text-warning',
              health.tone === 'danger' && 'text-danger'
            )} />
            <span className="text-lg font-bold text-foreground">{health.label}</span>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {score >= 80
              ? 'Your workspace shows excellent engagement and retention.'
              : score >= 60
                ? 'Good retention with room for improvement.'
                : score >= 40
                  ? 'Some areas need attention to improve retention.'
                  : 'Critical retention issues require immediate action.'}
          </p>
        </div>
      </div>

      {/* Factors */}
      <div className="mt-6 space-y-3">
        {factors.map((factor) => {
          const metTarget = factor.value >= factor.target;
          const ratio = Math.min(1, factor.value / factor.target);

          return (
            <div key={factor.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{factor.label}</span>
                <span className="font-bold text-foreground">
                  {factor.value}{factor.unit}
                  <span className="ml-1 text-foreground-muted">(target: {factor.target}{factor.unit})</span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    metTarget ? 'bg-success' : ratio >= 0.7 ? 'bg-warning' : 'bg-danger'
                  )}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
