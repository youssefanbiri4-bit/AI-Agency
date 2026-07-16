'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { NpsSummary } from '@/lib/data/customer-success';

interface NpsSummaryCardProps {
  summary: NpsSummary | null;
  className?: string;
}

function npsColor(nps: number): 'success' | 'warning' | 'danger' {
  if (nps >= 50) return 'success';
  if (nps >= 0) return 'warning';
  return 'danger';
}

function npsTrendIcon(trend: { period: string; nps: number }[]) {
  if (trend.length < 2) return <Minus className="h-4 w-4 text-foreground-muted" />;
  const last = trend[trend.length - 1]?.nps ?? 0;
  const prev = trend[trend.length - 2]?.nps ?? 0;
  if (last > prev) return <TrendingUp className="h-4 w-4 text-success" />;
  if (last < prev) return <TrendingDown className="h-4 w-4 text-danger" />;
  return <Minus className="h-4 w-4 text-foreground-muted" />;
}

export function NpsSummaryCard({ summary, className }: NpsSummaryCardProps) {
  const s = summary ?? { count: 0, average: 0, promoters: 0, passives: 0, detractors: 0, nps: 0, trend: [] };

  const promoterPct = s.count > 0 ? Math.round((s.promoters / s.count) * 100) : 0;
  const passivePct = s.count > 0 ? Math.round((s.passives / s.count) * 100) : 0;
  const detractorPct = s.count > 0 ? Math.round((s.detractors / s.count) * 100) : 0;

  const barSegments = useMemo(() => [
    { label: 'Promoters', pct: promoterPct, color: 'bg-success' },
    { label: 'Passives', pct: passivePct, color: 'bg-warning' },
    { label: 'Detractors', pct: detractorPct, color: 'bg-danger' },
  ], [promoterPct, passivePct, detractorPct]);

  return (
    <Card className={className}>
      <CardHeader
        title="NPS Score"
        description="Net Promoter Score from user surveys"
        action={
          <div className="flex items-center gap-2">
            {npsTrendIcon(s.trend)}
            <Badge tone={npsColor(s.nps)}>{s.nps}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-black text-success">{s.promoters}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Promoters (9-10)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-warning">{s.passives}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Passives (7-8)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-danger">{s.detractors}</p>
          <p className="text-[10px] font-bold uppercase text-foreground-muted">Detractors (0-6)</p>
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface">
        <div className="flex h-full">
          {barSegments.map((seg) =>
            seg.pct > 0 ? (
              <div
                key={seg.label}
                className={cn('h-full transition-all duration-500', seg.color)}
                style={{ width: `${seg.pct}%` }}
                title={`${seg.label}: ${seg.pct}%`}
              />
            ) : null
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {s.count} response{s.count !== 1 ? 's' : ''}
        </span>
        <span>Avg: {s.average}/10</span>
      </div>
    </Card>
  );
}
