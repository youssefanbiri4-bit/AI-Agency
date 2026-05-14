'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clipboard,
  Download,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import type {
  ContentStudioPlatform,
  ContentStudioPublishAttemptRecord,
  ContentStudioStatus,
  CreativeAssetRecord,
} from '@/types/database';
import type { Task, TaskReview } from '@/types';

type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

export interface MonthlyProviderStatus {
  name: string;
  status: ReadinessState;
  missing: string[];
  nextAction: string;
}

interface MonthlyAgencyReportClientProps {
  contentItems: Array<{
    id: string;
    title: string;
    platform: ContentStudioPlatform;
    content_type: string;
    status: ContentStudioStatus;
    provider_status: string | null;
    provider_error: string | null;
    schedule_at: string | null;
    published_at: string | null;
    scheduled_execution_status: string | null;
    scheduled_execution_error: string | null;
    scheduled_execution_finished_at: string | null;
    asset_ids: string[];
    created_at: string;
    updated_at: string;
  }>;
  attempts: ContentStudioPublishAttemptRecord[];
  creativeAssets: CreativeAssetRecord[];
  tasks: Task[];
  reviews: TaskReview[];
  providers: MonthlyProviderStatus[];
  schedulerConfigured: boolean;
  schedulerLine: string;
}

type PeriodPreset = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days' | 'custom';
type ReportType =
  | 'monthly'
  | 'weekly'
  | 'provider_setup'
  | 'campaign_activity'
  | 'recovery_issues';

const platformLabels: Record<ContentStudioPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
};

const readinessBadgeStatuses: Record<ReadinessState, Parameters<typeof StatusBadge>[0]['status']> = {
  ready: 'ready',
  setup_required: 'setup_required',
  approval_pending: 'approval_pending',
  quota_limit: 'quota_limit',
  token_missing: 'token_missing',
  manual_only: 'manual_only',
  unsupported: 'unsupported',
  error: 'error',
};

const contentStatuses: ContentStudioStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'failed',
  'setup_required',
  'approval_pending',
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(period: PeriodPreset, customStart: string, customEnd: string) {
  const now = new Date();

  if (period === 'last_7_days') {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);
    return { start, end: endOfDay(now), label: 'Last 7 days' };
  }

  if (period === 'last_30_days') {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    return { start, end: endOfDay(now), label: 'Last 30 days' };
  }

  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }

  if (period === 'custom') {
    const start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : startOfDay(now);
    const end = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : endOfDay(now);
    return {
      start,
      end,
      label: `${toDateInput(start)} to ${toDateInput(end)}`,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start,
    end: endOfDay(now),
    label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function isInRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= end.getTime();
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasAssetMediaUrl(asset: CreativeAssetRecord) {
  const metadata = readObject(asset.metadata);
  const video = readObject(metadata.video);
  return Boolean(asset.image_url || asset.storage_path || video.public_url || video.storage_path);
}

function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readObject(asset.metadata).video)
  );
}

function isManualOnlyItem(item: MonthlyAgencyReportClientProps['contentItems'][number]) {
  return item.content_type === 'linkedin_post_planner' || item.provider_status === 'manual_only';
}

function safeText(value: string | null | undefined, fallback = 'No message recorded.') {
  const text = value?.trim() || fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/("(?:access_token|refresh_token|client_secret|api_key|authorization)"\s*:\s*)"[^"]+"/gi, '$1"[redacted]"')
    .slice(0, 500);
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function mostCommon(values: string[]) {
  if (values.length === 0) return null;
  const counts = countBy(values);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function MetricCard({
  label,
  value,
  helper,
  tone = 'berry',
}: {
  label: string;
  value: number | string;
  helper: string;
  tone?: 'berry' | 'coral' | 'peach' | 'dark';
}) {
  const accent =
    tone === 'coral'
      ? 'bg-[#F7CBCA]/14 text-[#B51F30]'
      : tone === 'peach'
        ? 'bg-[#E7F5DC]/28 text-[#8A4300]'
        : tone === 'dark'
          ? 'bg-[#5D6B6B] text-[#D5E5E5]'
          : 'bg-[#D5E5E5] text-[#F7CBCA]';

  return (
    <div className="rounded-2xl border border-black/7 bg-white p-4 shadow-[0_14px_34px_rgba(93,107,107,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
          <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value}</p>
        </div>
        <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', accent)} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-black/52">{helper}</p>
    </div>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4">
      <p className="font-black text-[#5D6B6B]">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function buildReportText(input: {
  periodLabel: string;
  reportTypeLabel: string;
  metrics: Record<string, number>;
  platformRows: Array<{
    label: string;
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
    blocker: string;
    nextAction: string;
  }>;
  providers: MonthlyProviderStatus[];
  attempts: ContentStudioPublishAttemptRecord[];
  scheduler: Record<string, number | string>;
  assets: Record<string, number>;
  tasks: Record<string, number>;
  recovery: Record<string, number>;
  nextActions: string[];
}) {
  return [
    '# AgentFlow AI Monthly Agency Report',
    '',
    `Report type: ${input.reportTypeLabel}`,
    `Reporting period: ${input.periodLabel}`,
    '',
    '## Executive summary',
    `- Content items created: ${input.metrics.contentCreated}`,
    `- Published items: ${input.metrics.published}`,
    `- Scheduled items: ${input.metrics.scheduled}`,
    `- Failed/setup required items: ${input.metrics.failed + input.metrics.setupRequired}`,
    `- Creative assets created: ${input.metrics.creativeAssetsCreated}`,
    `- Tasks completed: ${input.metrics.tasksCompleted}`,
    '',
    '## Content activity',
    `- Draft: ${input.metrics.draft}`,
    `- Ready: ${input.metrics.ready}`,
    `- Scheduled: ${input.metrics.scheduled}`,
    `- Published: ${input.metrics.published}`,
    `- Failed: ${input.metrics.failed}`,
    `- Setup required: ${input.metrics.setupRequired}`,
    `- Approval pending: ${input.metrics.approvalPending}`,
    `- Manual only: ${input.metrics.manualOnly}`,
    '',
    '## Platform breakdown',
    ...input.platformRows.map((row) =>
      `- ${row.label}: ${row.total} total, ${row.published} published, ${row.scheduled} scheduled, ${row.draft} draft, ${row.failed} failed. Blocker: ${row.blocker}. Next: ${row.nextAction}`
    ),
    '',
    '## Provider readiness',
    ...input.providers.map((provider) =>
      `- ${provider.name}: ${provider.status}. Missing: ${provider.missing.length > 0 ? provider.missing.join(', ') : 'none reported'}. Next: ${provider.nextAction}`
    ),
    '',
    '## Publishing attempts',
    `- Total attempts: ${input.metrics.publishAttempts}`,
    `- Successful attempts: ${input.metrics.successfulAttempts}`,
    `- Failed attempts: ${input.metrics.failedAttempts}`,
    ...input.attempts.slice(0, 8).map((attempt) =>
      `- ${formatDateTime(attempt.created_at)} / ${attempt.provider} / ${attempt.action_type} / ${attempt.status}: ${safeText(attempt.error_message, attempt.provider_external_id ? `External ID: ${attempt.provider_external_id}` : 'No message recorded.')}`
    ),
    '',
    '## Scheduler summary',
    ...Object.entries(input.scheduler).map(([key, value]) => `- ${statusLabel(key)}: ${value}`),
    '',
    '## Creative assets summary',
    ...Object.entries(input.assets).map(([key, value]) => `- ${statusLabel(key)}: ${value}`),
    '',
    '## Tasks and reviews',
    ...Object.entries(input.tasks).map(([key, value]) => `- ${statusLabel(key)}: ${value}`),
    '',
    '## Recovery issues',
    ...Object.entries(input.recovery).map(([key, value]) => `- ${statusLabel(key)}: ${value}`),
    '',
    '## Next recommended actions',
    ...(input.nextActions.length > 0 ? input.nextActions.map((action) => `- ${action}`) : ['- No critical blockers found.']),
    '',
    '## Safety notes',
    '- No secrets included.',
    '- Paid ad drafts are paused only.',
    '- Manual-only providers require manual publishing.',
    '- Provider setup may block real publishing.',
  ].join('\n');
}

export function MonthlyAgencyReportClient({
  contentItems,
  attempts,
  creativeAssets,
  tasks,
  reviews,
  providers,
  schedulerConfigured,
  schedulerLine,
}: MonthlyAgencyReportClientProps) {
  const toast = useToast();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [customStart, setCustomStart] = useState(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(toDateInput(now));

  const report = useMemo(() => {
    const range = getPeriodRange(period, customStart, customEnd);
    const periodItems = contentItems.filter((item) => isInRange(item.created_at, range.start, range.end));
    const periodAttempts = attempts.filter((attempt) => isInRange(attempt.created_at, range.start, range.end));
    const periodAssets = creativeAssets.filter((asset) => isInRange(asset.created_at, range.start, range.end));
    const periodTasks = tasks.filter((task) => isInRange(task.created_at, range.start, range.end));
    const periodReviews = reviews.filter((review) => isInRange(review.created_at, range.start, range.end));
    const linkedAssetIds = new Set(periodItems.flatMap((item) => item.asset_ids));
    const contentStatusCounts = {
      ...Object.fromEntries(contentStatuses.map((status) => [status, 0])),
      ...countBy(periodItems.map((item) => item.status)),
    } as Record<ContentStudioStatus, number>;
    const successfulAttempts = periodAttempts.filter((attempt) => attempt.status === 'succeeded').length;
    const failedAttempts = periodAttempts.filter((attempt) => attempt.status === 'failed' || attempt.status === 'error').length;
    const manualOnly = periodItems.filter(isManualOnlyItem).length;
    const scheduler = {
      pending: contentItems.filter((item) => item.status === 'scheduled' && (!item.scheduled_execution_status || item.scheduled_execution_status === 'pending')).length,
      succeeded: contentItems.filter((item) => item.scheduled_execution_status === 'succeeded').length,
      failed: contentItems.filter((item) => item.scheduled_execution_status === 'failed').length,
      setup_required: contentItems.filter((item) => item.scheduled_execution_status === 'setup_required').length,
      approval_pending: contentItems.filter((item) => item.scheduled_execution_status === 'approval_pending').length,
      manual_only: contentItems.filter((item) => item.status === 'scheduled' && isManualOnlyItem(item)).length,
      last_run: schedulerLine,
    };
    const assets = {
      total_created: periodAssets.length,
      image_assets: periodAssets.filter((asset) => !isVideoAsset(asset)).length,
      video_assets: periodAssets.filter(isVideoAsset).length,
      linked_assets: periodAssets.filter((asset) => linkedAssetIds.has(asset.id)).length,
      unlinked_assets: periodAssets.filter((asset) => !linkedAssetIds.has(asset.id)).length,
      missing_media_url: periodAssets.filter((asset) => !hasAssetMediaUrl(asset)).length,
    };
    const taskStatusCounts = countBy(periodTasks.map((task) => task.status));
    const taskMetrics = {
      tasks_created: periodTasks.length,
      pending_tasks: taskStatusCounts.pending ?? 0,
      processing_tasks: taskStatusCounts.processing ?? 0,
      needs_review_tasks: taskStatusCounts.needs_review ?? 0,
      completed_tasks: taskStatusCounts.completed ?? 0,
      failed_tasks: taskStatusCounts.failed ?? 0,
      review_records: periodReviews.length,
      approvals: periodReviews.filter((review) => review.rating >= 4).length,
      requested_changes: periodReviews.filter((review) => review.rating <= 2 || /change|revision|revise/i.test(review.feedback)).length,
    };
    const recovery = {
      failed_items: contentStatusCounts.failed + periodItems.filter((item) => item.scheduled_execution_status === 'failed').length,
      setup_required: contentStatusCounts.setup_required,
      approval_pending: contentStatusCounts.approval_pending,
      token_missing: periodItems.filter((item) => item.provider_status === 'token_missing').length + periodAttempts.filter((attempt) => attempt.status === 'token_missing').length,
      manual_only: manualOnly,
      unsupported: periodItems.filter((item) => item.provider_status === 'unsupported').length + periodAttempts.filter((attempt) => attempt.status === 'unsupported').length,
      scheduler_issues: contentItems.filter((item) => item.scheduled_execution_status === 'failed' || item.scheduled_execution_error).length,
    };
    const platformRows = (Object.keys(platformLabels) as ContentStudioPlatform[]).map((platform) => {
      const platformItems = periodItems.filter((item) => item.platform === platform);
      const blocker = mostCommon(platformItems.map((item) => item.provider_status || item.status).filter((value) =>
        ['failed', 'setup_required', 'approval_pending', 'token_missing', 'unsupported', 'manual_only'].includes(value)
      ));

      return {
        platform,
        label: platformLabels[platform],
        total: platformItems.length,
        draft: platformItems.filter((item) => item.status === 'draft').length,
        scheduled: platformItems.filter((item) => item.status === 'scheduled').length,
        published: platformItems.filter((item) => item.status === 'published').length,
        failed: platformItems.filter((item) => item.status === 'failed').length,
        blocker: blocker ? statusLabel(blocker) : 'none',
        nextAction: blocker
          ? 'Open Recovery Center or Provider Setup for this platform.'
          : platformItems.length > 0
            ? 'Continue preparing and scheduling platform content.'
            : 'Create the first planned content item for this platform.',
      };
    });
    const nextActions = [
      ...providers
        .filter((provider) => provider.status !== 'ready' && provider.status !== 'manual_only')
        .map((provider) => provider.nextAction),
      ...(recovery.scheduler_issues > 0 ? ['Review failed scheduled item and run Scheduler Now from existing admin controls when setup is ready.'] : []),
      ...(assets.missing_media_url > 0 ? ['Link public media URLs to creative assets that are missing usable media.'] : []),
      ...(recovery.failed_items > 0 ? ['Open Recovery Center and inspect the failed content items.'] : []),
      ...(providers.some((provider) => provider.name === 'LinkedIn') ? ['Use manual publishing for LinkedIn copy-ready packages.'] : []),
    ];
    const dedupedActions = Array.from(new Set(nextActions)).slice(0, 8);
    const reportTypeLabel =
      reportType === 'weekly'
        ? 'Weekly Operations Report'
        : reportType === 'provider_setup'
          ? 'Provider Setup Report'
          : reportType === 'campaign_activity'
            ? 'Campaign Activity Report'
            : reportType === 'recovery_issues'
              ? 'Recovery Issues Report'
              : 'Monthly Agency Report';
    const metrics = {
      contentCreated: periodItems.length,
      draft: contentStatusCounts.draft,
      ready: contentStatusCounts.ready,
      scheduled: contentStatusCounts.scheduled,
      published: contentStatusCounts.published,
      failed: contentStatusCounts.failed,
      setupRequired: contentStatusCounts.setup_required,
      approvalPending: contentStatusCounts.approval_pending,
      manualOnly,
      publishAttempts: periodAttempts.length,
      successfulAttempts,
      failedAttempts,
      creativeAssetsCreated: periodAssets.length,
      linkedCreativeAssets: assets.linked_assets,
      tasksCreated: periodTasks.length,
      tasksCompleted: taskMetrics.completed_tasks,
      tasksNeedingReview: taskMetrics.needs_review_tasks,
    };

    return {
      range,
      periodItems,
      periodAttempts,
      periodAssets,
      periodTasks,
      periodReviews,
      metrics,
      scheduler,
      assets,
      taskMetrics,
      recovery,
      platformRows,
      nextActions: dedupedActions,
      reportTypeLabel,
      reportText: buildReportText({
        periodLabel: range.label,
        reportTypeLabel,
        metrics,
        platformRows,
        providers,
        attempts: periodAttempts,
        scheduler,
        assets,
        tasks: taskMetrics,
        recovery,
        nextActions: dedupedActions,
      }),
    };
  }, [attempts, contentItems, creativeAssets, customEnd, customStart, period, providers, reportType, reviews, schedulerLine, tasks]);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  }

  function downloadMarkdown() {
    const blob = new Blob([report.reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentflow-ai-${period}-agency-report.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Markdown report downloaded.');
  }

  const metricCards = [
    ['Content created', report.metrics.contentCreated, 'Created inside selected period', 'berry'],
    ['Draft items', report.metrics.draft, 'Still in draft state', 'berry'],
    ['Ready items', report.metrics.ready, 'Ready for next safe step', 'dark'],
    ['Scheduled items', report.metrics.scheduled, 'Planned content items', 'peach'],
    ['Published items', report.metrics.published, 'Provider-confirmed records', 'dark'],
    ['Failed items', report.metrics.failed, 'Needs operator attention', 'coral'],
    ['Setup required', report.metrics.setupRequired, 'Provider/setup blockers', 'coral'],
    ['Approval pending', report.metrics.approvalPending, 'External approval needed', 'peach'],
    ['Manual only', report.metrics.manualOnly, 'Copy-ready workflows', 'berry'],
    ['Publish attempts', report.metrics.publishAttempts, 'Logged attempts in period', 'berry'],
    ['Successful attempts', report.metrics.successfulAttempts, 'Succeeded attempt logs', 'dark'],
    ['Failed attempts', report.metrics.failedAttempts, 'Failed/error attempt logs', 'coral'],
    ['Creative assets', report.metrics.creativeAssetsCreated, 'Assets created in period', 'peach'],
    ['Linked assets', report.metrics.linkedCreativeAssets, 'Used by selected-period content', 'dark'],
    ['Tasks created', report.metrics.tasksCreated, 'Task records created', 'berry'],
    ['Tasks completed', report.metrics.tasksCompleted, 'Completed tasks in period', 'dark'],
    ['Needs review', report.metrics.tasksNeedingReview, 'Tasks awaiting review', 'peach'],
  ] as const;

  return (
    <section id="monthly-agency-report" className="space-y-6">
      <div className="rounded-[28px] border border-black/7 bg-white/90 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">Monthly Agency Report</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-[#5D6B6B]">Exportable Operational Report</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
              Generate a clean agency report from real workspace records for content, providers, scheduler, creative assets, tasks, reviews, and recovery issues.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void copyText('Monthly report', report.reportText)}>
              <Clipboard className="h-4 w-4" />
              Copy Monthly Report
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyText('Provider setup summary', providers.map((provider) => `${provider.name}: ${provider.status}. ${provider.nextAction}`).join('\n'))}>
              <ShieldCheck className="h-4 w-4" />
              Copy Provider Setup Summary
            </Button>
            <Button type="button" variant="outline" onClick={() => void copyText('Next actions', report.nextActions.length > 0 ? report.nextActions.join('\n') : 'No critical blockers found.')}>
              <Sparkles className="h-4 w-4" />
              Copy Next Actions
            </Button>
            <Button type="button" variant="secondary" onClick={downloadMarkdown}>
              <Download className="h-4 w-4" />
              Download Markdown Report
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[180px_230px_minmax(0,1fr)]">
          <Select value={period} onChange={(event) => setPeriod(event.target.value as PeriodPreset)} aria-label="Report period">
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </Select>
          <Select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} aria-label="Report type">
            <option value="monthly">Monthly Agency Report</option>
            <option value="weekly">Weekly Operations Report</option>
            <option value="provider_setup">Provider Setup Report</option>
            <option value="campaign_activity">Campaign Activity Report</option>
            <option value="recovery_issues">Recovery Issues Report</option>
          </Select>
          {period === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Custom start date" />
              <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Custom end date" />
            </div>
          ) : (
            <div className="flex items-center rounded-lg border border-black/8 bg-[#F1F7F7]/70 px-3.5 py-2.5 text-sm font-bold text-black/58">
              Reporting period: {report.range.label}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-stat-grid">
        {metricCards.map(([label, value, helper, tone]) => (
          <MetricCard key={label} label={label} value={value} helper={helper} tone={tone} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <MiniCard title="Platform Breakdown">
          <div className="space-y-3">
            {report.platformRows.map((row) => (
              <div key={row.platform} className="rounded-xl border border-black/7 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-[#5D6B6B]">{row.label}</p>
                    <p className="mt-1 text-sm leading-6 text-black/56">
                      {row.total} content item{row.total === 1 ? '' : 's'} · blocker: {row.blocker}
                    </p>
                  </div>
                  <StatusBadge status={row.failed > 0 ? 'failed' : row.scheduled > 0 ? 'scheduled' : row.published > 0 ? 'published' : 'draft'} type="system" size="sm" />
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold leading-5 text-black/52 sm:[grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))]">
                  <span>Draft {row.draft}</span>
                  <span>Scheduled {row.scheduled}</span>
                  <span>Published {row.published}</span>
                  <span>Failed {row.failed}</span>
                  <span>{row.nextAction}</span>
                </div>
              </div>
            ))}
          </div>
        </MiniCard>

        <MiniCard title="Provider Readiness Summary">
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.name} className="rounded-xl border border-black/7 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-[#5D6B6B]">{provider.name}</p>
                  <StatusBadge status={readinessBadgeStatuses[provider.status]} type="system" size="sm" />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/58">{provider.nextAction}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-black/42">
                  {provider.missing.length > 0 ? `Missing: ${provider.missing.join(', ')}` : 'No missing setup reported'}
                </p>
              </div>
            ))}
          </div>
        </MiniCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <MiniCard title="Publishing Attempts Summary">
          {report.periodAttempts.length === 0 ? (
            <EmptyState icon={FileText} title="No attempts in this period" description="Publish and draft attempts will appear here once logged." />
          ) : (
            <div className="space-y-3">
              {report.periodAttempts.slice(0, 6).map((attempt) => (
                <div key={attempt.id} className="rounded-xl border border-black/7 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-[#5D6B6B]">{attempt.provider}</p>
                    <StatusBadge status={attempt.status as Parameters<typeof StatusBadge>[0]['status']} type="system" size="sm" />
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-black/42">{attempt.action_type}</p>
                  <p className="mt-2 text-sm leading-6 text-black/58">{safeText(attempt.error_message, attempt.provider_external_id ? `External ID: ${attempt.provider_external_id}` : 'No message recorded.')}</p>
                  <p className="mt-2 text-xs font-semibold text-black/42">{formatDateTime(attempt.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </MiniCard>

        <MiniCard title="Scheduler Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Pending" value={report.scheduler.pending} helper="Scheduled and waiting" />
            <MetricCard label="Succeeded" value={report.scheduler.succeeded} helper="Execution completed" tone="dark" />
            <MetricCard label="Failed" value={report.scheduler.failed} helper="Needs review" tone="coral" />
            <MetricCard label="Setup required" value={report.scheduler.setup_required} helper="Blocked by setup" tone="coral" />
            <MetricCard label="Approval pending" value={report.scheduler.approval_pending} helper="Awaiting approval" tone="peach" />
            <MetricCard label="Manual only" value={report.scheduler.manual_only} helper="Copy workflow" />
          </div>
          <p className="mt-4 rounded-xl border border-black/7 bg-white p-3 text-sm font-semibold leading-6 text-black/58">
            {schedulerConfigured ? report.scheduler.last_run : 'Scheduler setup required. Last run not tracked yet.'}
          </p>
        </MiniCard>

        <MiniCard title="Recovery Issues Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Failed" value={report.recovery.failed_items} helper="Items or scheduler failures" tone="coral" />
            <MetricCard label="Setup required" value={report.recovery.setup_required} helper="Setup blockers" tone="coral" />
            <MetricCard label="Approval pending" value={report.recovery.approval_pending} helper="External approval" tone="peach" />
            <MetricCard label="Token missing" value={report.recovery.token_missing} helper="Provider token state" tone="coral" />
            <MetricCard label="Manual only" value={report.recovery.manual_only} helper="Copy-ready items" />
            <MetricCard label="Unsupported" value={report.recovery.unsupported} helper="No automation support" />
          </div>
          <Link href="/dashboard/recovery" className={cn(buttonStyles({ variant: 'outline' }), 'mt-4')}>
            <AlertTriangle className="h-4 w-4" />
            Open Recovery Center
          </Link>
        </MiniCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MiniCard title="Creative Assets Summary">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Assets created" value={report.assets.total_created} helper="Created in period" tone="peach" />
            <MetricCard label="Image assets" value={report.assets.image_assets} helper="Image/graphic assets" />
            <MetricCard label="Video assets" value={report.assets.video_assets} helper="Video/reel assets" />
            <MetricCard label="Linked assets" value={report.assets.linked_assets} helper="Used in period content" tone="dark" />
            <MetricCard label="Unlinked assets" value={report.assets.unlinked_assets} helper="Not linked yet" />
            <MetricCard label="Missing media URL" value={report.assets.missing_media_url} helper="Needs asset review" tone="coral" />
          </div>
        </MiniCard>

        <MiniCard title="Tasks & Reviews Summary">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Tasks created" value={report.taskMetrics.tasks_created} helper="Created in period" />
            <MetricCard label="Pending" value={report.taskMetrics.pending_tasks} helper="Waiting to run" />
            <MetricCard label="Processing" value={report.taskMetrics.processing_tasks} helper="Currently active" tone="peach" />
            <MetricCard label="Needs review" value={report.taskMetrics.needs_review_tasks} helper="Manager review" tone="peach" />
            <MetricCard label="Completed" value={report.taskMetrics.completed_tasks} helper="Finished tasks" tone="dark" />
            <MetricCard label="Reviews" value={report.taskMetrics.review_records} helper="Review records" />
            <MetricCard label="Approvals" value={report.taskMetrics.approvals} helper="High-rated reviews" tone="dark" />
            <MetricCard label="Requested changes" value={report.taskMetrics.requested_changes} helper="Low rating or revision text" tone="coral" />
            <MetricCard label="Failed tasks" value={report.taskMetrics.failed_tasks} helper="Task failures" tone="coral" />
          </div>
        </MiniCard>
      </div>

      <MiniCard title="Next Recommended Actions">
        {report.nextActions.length === 0 ? (
          <div className="rounded-xl border border-black/7 bg-white p-4 text-sm font-bold text-black/58">
            No critical blockers found.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {report.nextActions.map((action) => (
              <div key={action} className="rounded-xl border border-black/7 bg-white p-4 text-sm font-bold leading-6 text-black/64">
                {action}
              </div>
            ))}
          </div>
        )}
      </MiniCard>
    </section>
  );
}
