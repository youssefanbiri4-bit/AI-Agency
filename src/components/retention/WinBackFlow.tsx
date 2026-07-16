'use client';

import { useState, useCallback } from 'react';
import {
  Heart,
  AlertTriangle,
  TrendingDown,
  Users,
  Clock,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/utils';

interface ChurnSignal {
  type: 'scheduled_cancellation' | 'usage_declining' | 'low_engagement' | 'payment_failed';
  severity: 'low' | 'medium' | 'high';
  message: string;
  detectedAt: string;
}

interface WinBackFlowProps {
  signals: ChurnSignal[];
  onTriggerWinBack: (signalType: string) => Promise<void>;
  isProcessing?: boolean;
}

const SIGNAL_CONFIG: Record<ChurnSignal['type'], {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}> = {
  scheduled_cancellation: {
    icon: Clock,
    label: 'Scheduled Cancellation',
    description: 'User has initiated a cancellation request.',
  },
  usage_declining: {
    icon: TrendingDown,
    label: 'Declining Usage',
    description: 'Team activity has dropped significantly.',
  },
  low_engagement: {
    icon: Users,
    label: 'Low Engagement',
    description: 'Most team members are inactive.',
  },
  payment_failed: {
    icon: AlertTriangle,
    label: 'Payment Issue',
    description: 'Recent payment could not be processed.',
  },
};

const SEVERITY_CONFIG: Record<ChurnSignal['severity'], {
  tone: 'danger' | 'warning' | 'info';
  badge: 'danger' | 'warning' | 'info';
}> = {
  high: { tone: 'danger', badge: 'danger' },
  medium: { tone: 'warning', badge: 'warning' },
  low: { tone: 'info', badge: 'info' },
};

export function WinBackFlow({
  signals,
  onTriggerWinBack,
  isProcessing = false,
}: WinBackFlowProps) {
  const [processedSignals, setProcessedSignals] = useState<Set<string>>(new Set());

  const handleWinBack = useCallback(async (signalType: string) => {
    setProcessedSignals((prev) => new Set(prev).add(signalType));
    await onTriggerWinBack(signalType);
  }, [onTriggerWinBack]);

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Retention Health"
          description="Your workspace shows healthy engagement patterns."
        />
        <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
          <Heart className="h-5 w-5 text-success" />
          <p className="text-sm text-foreground">All signals are positive. No intervention needed.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Win-back Flow"
        description="Active churn signals requiring attention."
        action={
          <Badge tone="warning">
            {signals.length} signal{signals.length !== 1 ? 's' : ''} active
          </Badge>
        }
      />

      <div className="space-y-3">
        {signals.map((signal, idx) => {
          const config = SIGNAL_CONFIG[signal.type];
          const severity = SEVERITY_CONFIG[signal.severity];
          const Icon = config.icon;
          const isProcessed = processedSignals.has(signal.type);

          return (
            <div
              key={`${signal.type}-${idx}`}
              className={cn(
                'flex items-start gap-4 rounded-lg border p-4 transition-all',
                severity.tone === 'danger' && 'border-danger/20 bg-danger/5',
                severity.tone === 'warning' && 'border-warning/20 bg-warning/5',
                severity.tone === 'info' && 'border-info/20 bg-info/5',
                isProcessed && 'opacity-50'
              )}
            >
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                severity.tone === 'danger' && 'bg-danger/10 text-danger',
                severity.tone === 'warning' && 'bg-warning/10 text-warning',
                severity.tone === 'info' && 'bg-info/10 text-info'
              )}>
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground">{config.label}</p>
                  <Badge tone={severity.badge}>{signal.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-foreground-muted">{signal.message}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  Detected: {new Date(signal.detectedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isProcessed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWinBack(signal.type)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Send Win-back
                  </Button>
                ) : (
                  <Badge tone="success">Sent</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Notice tone="info">
          Win-back actions send personalized outreach to re-engage users and address their specific concerns.
        </Notice>
      </div>
    </Card>
  );
}
