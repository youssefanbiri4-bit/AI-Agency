import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  Rocket,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ClientReportButton } from '@/components/reports/ClientReportButton';
import { cn } from '@/lib/utils';
import { getPercent, readinessBadgeStatuses, formatReportAgentPrompt, safeDashboardHref } from './utils';
import { CopyOperationalReportButton } from './OperationalReportClient';
import type { MetricCard, ProviderStatusRow } from './types';
import type { AgentTemplate } from '@/lib/agent-library/templates';

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

// ---------------------------------------------------------------------------
// ReportsHeroSection — top hero header with search, date filter, action buttons
// ---------------------------------------------------------------------------

export function ReportsHeroSection({
  reportText,
}: {
  reportText: string;
}) {
  return (
    <section className="rounded-[28px] border border-black/7 bg-white/88 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">
            Operational Reports
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-normal text-[#5D6B6B] sm:text-5xl">
            Reports
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
            Track publishing readiness, content performance, provider status, and workflow activity.
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,240px)_150px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <Input disabled placeholder="Search reports" className="ps-10 disabled:bg-white/70" />
          </div>
          <Select disabled aria-label="Date range" defaultValue="all" className="disabled:bg-white/70">
            <option value="all">All time</option>
          </Select>
          <div className="flex flex-wrap gap-2">
            <CopyOperationalReportButton reportText={reportText} label="Copy Operational Report" />
            <Link href="/dashboard/recovery" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              View Recovery Center
            </Link>
            <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              System Health
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// AIReportAgentCard — single AI report agent template card
// ---------------------------------------------------------------------------

export function AIReportAgentCard({
  template,
}: {
  template: AgentTemplate;
}) {
  const taskDescription = `Create a draft-only internal report using the ${template.name}. Keep it read-only, analysis-only, and review-first.`;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/7 bg-[#F1F7F7]/64 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-[#5D6B6B]">{template.name}</p>
          <p className="mt-2 line-clamp-4 text-xs font-semibold leading-5 text-black/58">{template.description}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#F7CBCA] shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
        <span className="rounded-full border border-[#D5E5E5] bg-white px-2.5 py-1 text-[#5D6B6B]">Draft only</span>
        <span className="rounded-full border border-[#D5E5E5] bg-white px-2.5 py-1 text-[#5D6B6B]">Read only</span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link href={`/dashboard/alex?template=${template.id}`} className={buttonStyles({ variant: 'primary', size: 'sm' })}>
          <Bot className="h-4 w-4" />
          Use with Alex
        </Link>
        <CopyOperationalReportButton reportText={formatReportAgentPrompt(template)} label="Copy Prompt" />
        <Link
          href={`/dashboard/create-task?title=${encodeURIComponent(template.name)}&description=${encodeURIComponent(taskDescription)}`}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <ClipboardList className="h-4 w-4" />
          Create Report Task
        </Link>
        <Link href={`/dashboard/knowledge-base?query=${encodeURIComponent(template.name)}`} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
          <Database className="h-4 w-4" />
          Knowledge Base
        </Link>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// SetupChecklistItem — production setup checklist card
// ---------------------------------------------------------------------------

export function SetupChecklistItem({
  label,
  status,
  action,
}: {
  label: string;
  status: string;
  action: string;
}) {
  return (
    <div className="rounded-2xl border border-black/7 bg-background/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-black text-[#5D6B6B]">{label}</p>
        <StatusBadge
          status={status === 'present' ? 'ready' : status === 'missing' ? 'setup_required' : 'approval_pending'}
          type="system"
          size="sm"
        />
      </div>
      <p className="mt-2 text-sm leading-6 text-black/58">{action}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GuardrailItem — reporting safety guardrail card
// ---------------------------------------------------------------------------

export function GuardrailItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-black/7 bg-background/60 p-4">
      <p className="font-black text-[#5D6B6B]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyPublishAttemptsState — empty state when no content or attempts
// ---------------------------------------------------------------------------

export function EmptyPublishAttemptsState() {
  return (
    <ReportsCard title="No publish attempts yet">
      <div className="rounded-2xl border border-dashed border-black/12 bg-white p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-[#F7CBCA]" />
        <h2 className="mt-4 text-xl font-black text-[#5D6B6B]">No publish attempts yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/58">
          Create or schedule content from Content & Ads Studio to start tracking operational activity.
        </p>
      </div>
    </ReportsCard>
  );
}

// ---------------------------------------------------------------------------
// PublishingStatusOverviewSection — 8 ProgressRows for content status counts
// ---------------------------------------------------------------------------

export function PublishingStatusOverviewSection({
  contentStatusCounts,
  totalItems,
  manualOnlyCount,
}: {
  contentStatusCounts: Record<string, number>;
  totalItems: number;
  manualOnlyCount: number;
}) {
  return (
    <div className="space-y-5">
      <ProgressRow label="Draft" value={contentStatusCounts.draft} total={totalItems} />
      <ProgressRow label="Ready" value={contentStatusCounts.ready} total={totalItems} tone="dark" />
      <ProgressRow label="Scheduled" value={contentStatusCounts.scheduled} total={totalItems} tone="peach" />
      <ProgressRow label="Published" value={contentStatusCounts.published} total={totalItems} tone="dark" />
      <ProgressRow label="Failed" value={contentStatusCounts.failed} total={totalItems} tone="coral" />
      <ProgressRow label="Setup required" value={contentStatusCounts.setup_required} total={totalItems} tone="coral" />
      <ProgressRow label="Approval pending" value={contentStatusCounts.approval_pending} total={totalItems} tone="peach" />
      <ProgressRow label="Manual only" value={manualOnlyCount} total={totalItems} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentByPlatformSection — ProgressRows for platform distribution
// ---------------------------------------------------------------------------

export function ContentByPlatformSection({
  platformCounts,
  totalItems,
}: {
  platformCounts: Array<[string, string, number]>;
  totalItems: number;
}) {
  return (
    <div className="space-y-4">
      {platformCounts.map(([key, label, count]) => (
        <ProgressRow key={key} label={label} value={count} total={totalItems} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreativeAssetsSummarySection — asset metrics grid with badges
// ---------------------------------------------------------------------------

export function CreativeAssetsSummarySection({
  totalAssets,
  linkedAssets,
  imageAssets,
  videoAssets,
  missingMediaAssets,
}: {
  totalAssets: number;
  linkedAssets: number;
  imageAssets: number;
  videoAssets: number;
  missingMediaAssets: number;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallMetric label="Total assets" value={totalAssets} />
        <SmallMetric label="Linked assets" value={linkedAssets} />
        <SmallMetric label="Unlinked assets" value={totalAssets - linkedAssets} />
        <SmallMetric label="Image assets" value={imageAssets} />
        <SmallMetric label="Video assets" value={videoAssets} />
        <SmallMetric label="Missing media URL" value={missingMediaAssets} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-black/58">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5">
          <ImageIcon className="h-4 w-4" /> Images
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5">
          <Video className="h-4 w-4" /> Videos
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ProjectsSummarySection — project metrics grid with link
// ---------------------------------------------------------------------------

export function ProjectsSummarySection({
  totalProjects,
  activeProjects,
  deployedProjects,
  readyToDeployProjects,
}: {
  totalProjects: number;
  activeProjects: number;
  deployedProjects: number;
  readyToDeployProjects: number;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallMetric label="Total projects" value={totalProjects} />
        <SmallMetric label="Active projects" value={activeProjects} />
        <SmallMetric label="Deployed projects" value={deployedProjects} />
        <SmallMetric label="Ready to deploy" value={readyToDeployProjects} />
      </div>
      <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
        <FolderKanban className="h-4 w-4" />
        Open Projects
      </Link>
    </>
  );
}

// ---------------------------------------------------------------------------
// ReleasesSummarySection — release metrics grid with link
// ---------------------------------------------------------------------------

export function ReleasesSummarySection({
  totalReleases,
  deployedReleases,
  failedReleases,
  readyToDeployReleases,
  latestDeployUrl,
}: {
  totalReleases: number;
  deployedReleases: number;
  failedReleases: number;
  readyToDeployReleases: number;
  latestDeployUrl: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallMetric label="Total releases" value={totalReleases} />
        <SmallMetric label="Deployed releases" value={deployedReleases} />
        <SmallMetric label="Failed releases" value={failedReleases} />
        <SmallMetric label="Ready to deploy" value={readyToDeployReleases} />
        <SmallMetric label="Latest deploy URL" value={latestDeployUrl} />
      </div>
      <Link href="/dashboard/releases" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
        <Rocket className="h-4 w-4" />
        Open Releases
      </Link>
    </>
  );
}

// ---------------------------------------------------------------------------
// SchedulerSummarySection — scheduler execution status grid
// ---------------------------------------------------------------------------

export function SchedulerSummarySection({
  pendingCount,
  succeededCount,
  failedCount,
  setupRequiredCount,
  approvalPendingCount,
  processingCount,
  schedulerLine,
}: {
  pendingCount: number;
  succeededCount: number;
  failedCount: number;
  setupRequiredCount: number;
  approvalPendingCount: number;
  processingCount: number;
  schedulerLine: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallMetric label="Pending" value={pendingCount} />
        <SmallMetric label="Succeeded" value={succeededCount} />
        <SmallMetric label="Failed" value={failedCount} />
        <SmallMetric label="Setup required" value={setupRequiredCount} />
        <SmallMetric label="Approval pending" value={approvalPendingCount} />
        <SmallMetric label="Processing" value={processingCount} />
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-black/58">{schedulerLine}</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// ClientReadyReportsSection — client PDF download card body
// ---------------------------------------------------------------------------

export function ClientReadyReportsSection({
  taskCount,
  generatedOutputs,
  reviewCount,
  workspaceId,
  workspaceName,
}: {
  taskCount: number;
  generatedOutputs: number;
  reviewCount: number;
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm text-black/62 sm:grid-cols-3">
        <SmallMetric label="Tasks in report data" value={taskCount} />
        <SmallMetric label="Generated outputs" value={generatedOutputs} />
        <SmallMetric label="Reviews logged" value={reviewCount} />
      </div>
      <p className="text-sm leading-6 text-black/58">
        Pulls real data from tasks, reels, creative assets, and brand kit settings. No fabricated
        engagement or ad performance metrics.
      </p>
      <ClientReportButton
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        label="Download Client PDF"
        showTemplatePicker
        showPasswordField
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskReviewPipelineSection — task pipeline metrics grid
// ---------------------------------------------------------------------------

export function TaskReviewPipelineSection({
  total,
  pending,
  processing,
  needsReview,
  completed,
  failed,
  reviewCount,
  generatedReports,
  eventCount,
}: {
  total: number;
  pending: number;
  processing: number;
  needsReview: number;
  completed: number;
  failed: number;
  reviewCount: number;
  generatedReports: number;
  eventCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SmallMetric label="Total tasks" value={total} />
      <SmallMetric label="Pending" value={pending} />
      <SmallMetric label="Processing" value={processing} />
      <SmallMetric label="Needs review" value={needsReview} />
      <SmallMetric label="Completed" value={completed} />
      <SmallMetric label="Failed" value={failed} />
      <SmallMetric label="Review records" value={reviewCount} />
      <SmallMetric label="Generated reports" value={generatedReports} />
      <SmallMetric label="Task events" value={eventCount} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportingGuardrailsSection — static guardrails content with links
// ---------------------------------------------------------------------------

export function ReportingGuardrailsSection() {
  return (
    <div className="space-y-3">
      {[
        ['No fake performance metrics', 'Impressions, clicks, spend, revenue, and conversions are not shown without real provider metrics.'],
        ['No secrets exposed', 'Tokens, secrets, authorization headers, and credential fields are filtered from summaries.'],
        ['No provider actions here', 'Reports observe readiness and attempts only; publishing and scheduling flows are unchanged.'],
      ].map(([title, description]) => (
        <GuardrailItem key={title} title={title} description={description} />
      ))}
      <Link href="/dashboard/content-studio" className={buttonStyles({ variant: 'secondary' })}>
        <ClipboardList className="h-4 w-4" />
        Open Content Studio
      </Link>
      <Link href="/dashboard/recovery" className={buttonStyles({ variant: 'outline' })}>
        <AlertTriangle className="h-4 w-4" />
        View Failed Items
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SystemHealthSection — system health summary card
// ---------------------------------------------------------------------------

export function SystemHealthSection({
  score,
  label,
  providerBlockers,
  criticalBlockers,
  needsSetup,
  actions,
}: {
  score: number;
  label: string;
  providerBlockers: number;
  criticalBlockers: number;
  needsSetup: number;
  actions: Array<{ id: string; title: string; href: string }>;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SmallMetric label="System Health Score" value={`${score}%`} helper={label} />
        <SmallMetric label="Provider blockers" value={providerBlockers} />
        <SmallMetric label="Critical blockers" value={criticalBlockers} />
        <SmallMetric label="Needs setup checks" value={needsSetup} />
      </div>
      <div className="mt-4 space-y-2">
        {(actions.length > 0 ? actions.slice(0, 3) : []).map((action) => (
          <Link key={action.id} href={safeDashboardHref(action.href)} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/7 bg-background/62 p-3 hover:bg-white">
            <span className="min-w-0 whitespace-normal wrap-break-word text-sm font-black text-[#5D6B6B]">{action.title}</span>
            <Gauge className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
          </Link>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// RecentOperationalReports
// ---------------------------------------------------------------------------

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
