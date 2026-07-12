import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  Layers3,
  RadioTower,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatDateTime } from '@/lib/utils';
import { getPercent, readinessBadgeStatuses } from './utils';
import { CopyOperationalReportButton } from './OperationalReportClient';
import type { MetricCard, ProviderStatusRow } from './types';

export function ReportsCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border border-[#5D6B6B]/8 bg-white/90 p-5 shadow-[0_22px_55px_rgba(93,107,107,0.08)] ring-1 ring-white/70',
        className
      )}
    >
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-[#5D6B6B]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-black/58">{description}</p> : null}
        </div>
        {action ? <div className="flex max-w-full shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ReportsMetricCard({ metric }: { metric: MetricCard }) {
  const Icon = metric.icon;

  return (
    <div className="min-w-0 rounded-2xl border border-black/7 bg-white p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">{metric.label}</p>
          <p className="mt-3 text-3xl font-black tracking-normal text-[#5D6B6B]">{metric.value}</p>
        </div>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', metric.accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-black/55">{metric.helper}</p>
    </div>
  );
}

export function ProgressRow({
  label,
  value,
  total,
  tone = 'berry',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'berry' | 'coral' | 'peach' | 'dark';
}) {
  const width = getPercent(value, total);
  const color =
    tone === 'coral'
      ? 'bg-[#F7CBCA]'
      : tone === 'peach'
        ? 'bg-[#E7F5DC]'
        : tone === 'dark'
          ? 'bg-[#5D6B6B]'
          : 'bg-[#F7CBCA]';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 whitespace-normal wrap-break-word text-sm font-bold text-black/70">{label}</span>
        <span className="font-mono text-sm font-black text-[#5D6B6B]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-background ring-1 ring-black/5">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function SmallMetric({ label, value, helper }: { label: string; value: number | string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-black/7 bg-background/68 p-4">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-black/50">{helper}</p> : null}
    </div>
  );
}

export function ProviderReadinessList({ providers }: { providers: ProviderStatusRow[] }) {
  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <div
          key={provider.name}
          className="grid min-w-0 gap-3 rounded-2xl border border-black/7 bg-background/55 p-4 transition-colors hover:bg-white sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] sm:items-start"
        >
          <div className="min-w-0">
            <p className="font-black text-[#5D6B6B]">{provider.name}</p>
            <p className="mt-1 text-sm leading-6 text-black/58">{provider.nextAction}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">
              {provider.missing.length > 0 ? `Missing: ${provider.missing.join(', ')}` : 'No missing setup reported'}
            </p>
          </div>
          <StatusBadge status={readinessBadgeStatuses[provider.status]} type="system" size="sm" />
        </div>
      ))}
    </div>
  );
}

export function RecentOperationalReports({
  generatedCount,
  reportText,
}: {
  generatedCount: number;
  reportText: string;
}) {
  const rows = [
    ['Provider Readiness Summary', 'Generated summary', 'Provider blockers and next actions'],
    ['Content Studio Status Report', 'Generated summary', 'Content counts by readiness state'],
    ['Scheduler Execution Report', 'Generated summary', 'Scheduled execution status counts'],
    ['Creative Assets Usage Report', 'Generated summary', 'Linked, unlinked, image, and video assets'],
    ['Task & Review Pipeline Report', generatedCount > 0 ? 'Saved task reports available' : 'Generated summary', 'Task and review workflow totals'],
  ];

  return (
    <ReportsCard
      title="Recent Operational Reports"
      description="Copy-ready summaries generated from current workspace data. Saved task reports are counted when available."
      action={
        <CopyOperationalReportButton reportText={reportText} label="Copy Operational Report" />
      }
    >
      <div className="dashboard-card-grid">
        {rows.map(([title, status, detail]) => (
          <div key={title} className="rounded-2xl border border-black/7 bg-background/60 p-4">
            <p className="font-black text-[#5D6B6B]">{title}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#F7CBCA]">{status}</p>
            <p className="mt-2 text-sm leading-6 text-black/56">{detail}</p>
          </div>
        ))}
      </div>
    </ReportsCard>
  );
}
