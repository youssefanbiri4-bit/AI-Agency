'use client';

import { useMemo } from 'react';
import {
  FlaskConical,
  Target,
  BarChart3,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface ExperimentVariant {
  name: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  isControl?: boolean;
  isWinner?: boolean;
}

interface Experiment {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused';
  startDate: string;
  endDate?: string;
  variants: ExperimentVariant[];
  totalExposures: number;
  totalConversions: number;
  statisticalPower: number;
}

interface ExperimentDashboardProps {
  experiments: Experiment[];
  className?: string;
}

interface ExperimentCardProps {
  experiment: Experiment;
  className?: string;
}

function VariantBar({ variant, maxExposures }: { variant: ExperimentVariant; maxExposures: number }) {
  const width = maxExposures > 0 ? (variant.exposures / maxExposures) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 text-sm text-foreground-muted">
        {variant.name}
        {variant.isControl && <span className="ml-1 text-xs">(Control)</span>}
      </div>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            variant.isWinner ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-16 text-right text-sm font-bold text-foreground">
        {variant.conversionRate.toFixed(1)}%
      </div>
    </div>
  );
}

function ExperimentCard({ experiment, className }: ExperimentCardProps) {
  const maxExposures = useMemo(() => {
    return Math.max(...experiment.variants.map((v) => v.exposures), 1);
  }, [experiment.variants]);

  const statusConfig = {
    running: { tone: 'success' as const, label: 'Running' },
    completed: { tone: 'info' as const, label: 'Completed' },
    paused: { tone: 'warning' as const, label: 'Paused' },
  };

  const status = statusConfig[experiment.status];
  const bestVariant = experiment.variants.reduce((best, v) =>
    v.conversionRate > best.conversionRate ? v : best
  , experiment.variants[0]);

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">{experiment.name}</p>
            <p className="text-sm text-foreground-muted">
              {experiment.totalExposures.toLocaleString()} exposures
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {experiment.statisticalPower >= 80 && (
            <Badge tone="success">Significant</Badge>
          )}
        </div>
      </div>

      {/* Variants */}
      <div className="mt-4 space-y-2">
        {experiment.variants.map((variant) => (
          <VariantBar
            key={variant.name}
            variant={variant}
            maxExposures={maxExposures}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-foreground-muted">Total conversions: </span>
            <span className="font-bold text-foreground">
              {experiment.totalConversions.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-foreground-muted">Power: </span>
            <span className={cn(
              'font-bold',
              experiment.statisticalPower >= 80 ? 'text-success' : 'text-warning'
            )}>
              {experiment.statisticalPower.toFixed(0)}%
            </span>
          </div>
        </div>

        {bestVariant && (
          <div className="flex items-center gap-2">
            <span className="text-foreground-muted">Winner: </span>
            <Badge tone="success">
              {bestVariant.name} ({bestVariant.conversionRate.toFixed(1)}%)
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

export function ExperimentDashboard({
  experiments,
  className,
}: ExperimentDashboardProps) {
  const runningExperiments = experiments.filter((e) => e.status === 'running');
  const completedExperiments = experiments.filter((e) => e.status === 'completed');

  return (
    <Card className={className}>
      <CardHeader
        title="A/B Experiments"
        description="Track and analyze your landing page experiments."
        action={
          <Badge tone="info">
            {runningExperiments.length} running
          </Badge>
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{experiments.length}</p>
              <p className="text-sm text-foreground-muted">Total Experiments</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">
                {experiments.reduce((sum, e) => sum + e.totalExposures, 0).toLocaleString()}
              </p>
              <p className="text-sm text-foreground-muted">Total Exposures</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <BarChart3 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">
                {experiments.reduce((sum, e) => sum + e.totalConversions, 0).toLocaleString()}
              </p>
              <p className="text-sm text-foreground-muted">Total Conversions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Running experiments */}
      {runningExperiments.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-sm font-bold text-foreground">Running</p>
          <div className="space-y-4">
            {runningExperiments.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </div>
      )}

      {/* Completed experiments */}
      {completedExperiments.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-bold text-foreground">Completed</p>
          <div className="space-y-4">
            {completedExperiments.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        </div>
      )}

      {experiments.length === 0 && (
        <div className="py-8 text-center">
          <FlaskConical className="mx-auto h-12 w-12 text-foreground-muted" />
          <p className="mt-4 text-sm text-foreground-muted">
            No experiments yet. Create your first A/B test to optimize conversions.
          </p>
        </div>
      )}
    </Card>
  );
}
