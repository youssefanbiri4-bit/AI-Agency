'use client';

import { useMemo } from 'react';
import { AlertTriangle, Shield, TrendingDown, UserX, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import type { ChurnRiskSummary } from '@/lib/data/customer-success';

interface ChurnRiskCardProps {
  risk: ChurnRiskSummary | null;
  onRunAnalysis?: () => void;
  onWinBack?: (alertId?: string) => void;
  analyzing?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; tone: 'danger' | 'warning' | 'info'; bg: string }> = {
  critical: { icon: XCircle, tone: 'danger', bg: 'bg-danger/5 border-danger/20' },
  warning: { icon: AlertTriangle, tone: 'warning', bg: 'bg-warning/5 border-warning/20' },
  info: { icon: Shield, tone: 'info', bg: 'bg-info/5 border-info/20' },
};

const SIGNAL_ICONS: Record<string, typeof AlertTriangle> = {
  cancel_scheduled: UserX,
  inactivity: UserX,
  low_nps: TrendingDown,
};

function riskColor(level: string): 'danger' | 'warning' | 'success' | 'info' {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  return 'success';
}

export function ChurnRiskCard({ risk, onRunAnalysis, onWinBack, analyzing, className }: ChurnRiskCardProps) {
  const r = useMemo(() => risk ?? { riskScore: 0, level: 'low' as const, signals: [], openAlerts: 0, cancelScheduled: 0 }, [risk]);

  const signalGroups = useMemo(() => {
    const groups = new Map<string, typeof r.signals>();
    for (const s of r.signals) {
      const key = s.severity;
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return groups;
  }, [r]);

  return (
    <Card className={className}>
      <CardHeader
        title="Churn Risk"
        description="Automated signals indicating potential customer churn"
        action={
          <div className="flex items-center gap-2">
            <Badge tone={riskColor(r.level)}>{r.level} ({r.riskScore}/100)</Badge>
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={analyzing}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              {analyzing ? 'Analyzing...' : 'Run analysis'}
            </button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface p-3 text-center">
          <p className="text-xl font-black text-danger">{r.openAlerts}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Open alerts</p>
        </div>
        <div className="rounded-xl bg-surface p-3 text-center">
          <p className="text-xl font-black text-warning">{r.cancelScheduled}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Cancel scheduled</p>
        </div>
        <div className="rounded-xl bg-surface p-3 text-center">
          <p className="text-xl font-black text-foreground">{r.signals.length}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Total signals</p>
        </div>
      </div>

      {r.signals.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-success/5 p-3 text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          No churn signals detected. Workspace looks healthy.
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(signalGroups.entries()).map(([severity, signals]) => {
            const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
            return signals.map((s) => {
              const SignalIcon = SIGNAL_ICONS[s.signalType] ?? AlertTriangle;
              return (
                <div key={s.signalType + s.title} className={cn('flex items-start gap-3 rounded-xl border p-3', config.bg)}>
                  <SignalIcon className={cn('mt-0.5 h-4 w-4 shrink-0', `text-${config.tone}`)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{s.title}</p>
                    <p className="mt-0.5 text-xs text-foreground-muted">{s.message}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone={config.tone}>{s.severity}</Badge>
                    {onWinBack && (
                      <button type="button" onClick={() => onWinBack()} className={buttonStyles({ variant: 'soft', size: 'sm' })}>
                        Win-back
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      )}
    </Card>
  );
}
