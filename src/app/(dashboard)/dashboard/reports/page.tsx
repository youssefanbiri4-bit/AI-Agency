import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarClock,
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
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgentCatalog } from '@/lib/data/agents';
import { buildReportSummary, getGeneratedReports, getReportSummary } from '@/lib/data/reports';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listTasks } from '@/lib/data/tasks';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { getAgentTemplateById, type AgentTemplate } from '@/lib/agent-library/templates';
import { getMetaConnectionStatus, getGoogleAdsConnectionStatus } from '@/lib/data/ad-connections';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import {
  checkOpenAITextProviderReadiness,
} from '@/lib/ai/text-provider';
import { buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatDateTime } from '@/lib/utils';
import {
  CopyOperationalReportButton,
  OperationalReportClient,
  type PublishAttemptTimelineItem,
} from './OperationalReportClient';
import { ClientReportButton } from '@/components/reports/ClientReportButton';
import {
  MonthlyAgencyReportClient,
  type MonthlyProviderStatus,
} from './MonthlyAgencyReportClient';
import {
  AdvancedAnalyticsClient,
  type AdvancedAnalyticsData,
} from './AdvancedAnalyticsClient';
import type { ContentStudioItemWithAssets } from '@/lib/data/content-studio';
import type {
  ContentStudioPlatform,
  ContentStudioPublishAttemptRecord,
  ContentStudioStatus,
  CreativeAssetRecord,
  ProjectRecord,
  ReleaseRecord,
  TaskReviewRecord,
} from '@/types/database';
import type { JsonObject, TaskReview } from '@/types';

type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

const reportAgentIds = [
  'campaign-report-agent',
  'task-performance-agent',
  'content-performance-agent',
  'provider-health-report-agent',
  'workflow-usage-report-agent',
] as const;

function formatReportAgentPrompt(template: AgentTemplate) {
  return [
    `# ${template.name}`,
    '',
    `Category: ${template.category}`,
    `Execution mode: ${template.execution_mode}`,
    `Safety level: ${template.safety_level}`,
    '',
    '## Purpose',
    template.description,
    '',
    '## Inputs',
    template.inputs.map((input) => `- ${input}`).join('\n'),
    '',
    '## Outputs',
    template.outputs.map((output) => `- ${output}`).join('\n'),
    '',
    '## Suggested Prompt',
    template.suggested_prompt,
    '',
    '## Review Checklist',
    template.review_checklist.map((item) => `- ${item}`).join('\n'),
  ].join('\n');
}

interface ProviderStatusRow {
  name: string;
  status: ReadinessState;
  missing: string[];
  nextAction: string;
}

interface MetricCard {
  label: string;
  value: number;
  helper: string;
  icon: typeof Layers3;
  accent: string;
}

type OptionalWorkspaceRow = Record<string, unknown>;

interface OptionalWorkspaceRowsResult {
  data: OptionalWorkspaceRow[];
  error: string | null;
}

interface LooseWorkspaceQuery {
  select(columns: string): LooseWorkspaceQuery;
  eq(column: string, value: string): LooseWorkspaceQuery;
  order(column: string, options: { ascending: boolean }): LooseWorkspaceQuery;
  limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

interface LooseWorkspaceClient {
  from(table: string): LooseWorkspaceQuery;
}

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

const attemptStatuses = [
  'succeeded',
  'failed',
  'setup_required',
  'approval_pending',
  'quota_limit',
  'token_missing',
  'manual_only',
  'unsupported',
  'error',
] as const;

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

function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function rowString(row: OptionalWorkspaceRow, key: string, fallback = '') {
  const value = row[key];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function rowNullableString(row: OptionalWorkspaceRow, key: string) {
  const value = row[key];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return null;
}

function rowNumber(row: OptionalWorkspaceRow, key: string, fallback = 0) {
  const value = row[key];
  return typeof value === 'number' ? value : fallback;
}

function rowBoolean(row: OptionalWorkspaceRow, key: string, fallback = false) {
  const value = row[key];
  return typeof value === 'boolean' ? value : fallback;
}

function rowStringArray(row: OptionalWorkspaceRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function safeText(value: string | null | undefined, fallback = '') {
  const text = value?.trim() || fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/("(?:access_token|refresh_token|client_secret|api_key|authorization)"\s*:\s*)"[^"]+"/gi, '$1"[redacted]"')
    .slice(0, 500);
}

function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(asset.metadata?.video)
  );
}

function hasAssetMediaUrl(asset: CreativeAssetRecord) {
  const metadata = readObject(asset.metadata);
  const video = readObject(metadata.video);

  return Boolean(
    asset.image_url ||
      asset.storage_path ||
      safeString(video.public_url) ||
      safeString(video.storage_path)
  );
}

function isManualOnlyItem(item: ContentStudioItemWithAssets) {
  return item.content_type === 'linkedin_post_planner' || item.provider_status === 'manual_only';
}

function sanitizeSummary(value: unknown, depth = 0): unknown {
  if (depth > 2) {
    return '[summary truncated]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map((entry) => sanitizeSummary(entry, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('authorization') ||
      normalized.includes('credential')
    ) {
      continue;
    }

    result[key] = sanitizeSummary(entry, depth + 1);
  }

  return result;
}

function summarizeJson(value: JsonObject | null | undefined) {
  const sanitized = sanitizeSummary(value ?? {});
  const serialized = JSON.stringify(sanitized);
  return serialized === '{}' ? '' : serialized.slice(0, 240);
}

function mapAttemptTimeline(
  attempts: ContentStudioPublishAttemptRecord[],
  items: ContentStudioItemWithAssets[]
): PublishAttemptTimelineItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));

  return attempts.map((attempt) => {
    const item = attempt.content_item_id ? itemById.get(attempt.content_item_id) : null;
    return {
      id: attempt.id,
      createdAt: attempt.created_at,
      provider: attempt.provider,
      actionType: attempt.action_type,
      contentItemId: attempt.content_item_id,
      contentTitle: item?.title ?? 'Workspace-level attempt',
      contentType: item?.content_type ?? 'unknown',
      status: attempt.status,
      message: safeText(attempt.error_message ?? safeString(attempt.request_summary?.message), ''),
      externalId: attempt.provider_external_id,
      safeSummary: summarizeJson(attempt.provider_response_summary),
    };
  });
}

function getReadinessState(value: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean }) {
  if (value.state) {
    return value.state as ReadinessState;
  }

  if (value.status === 'configured' || value.status === 'ready' || value.isConfigured || value.isReady) {
    return 'ready';
  }

  if (value.status === 'approval_pending') return 'approval_pending';
  if (value.status === 'quota_limit') return 'quota_limit';
  return 'setup_required';
}

function setupItem(label: string, configured: boolean | null, action: string) {
  return {
    label,
    status: configured === null ? 'needs_review' : configured ? 'present' : 'missing',
    action,
  };
}

function getPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function buildReportText(input: {
  contentCounts: Record<string, number>;
  attemptCounts: Record<string, number>;
  providers: ProviderStatusRow[];
  schedulerLine: string;
  creativeAssets: {
    total: number;
    images: number;
    videos: number;
    linked: number;
    unlinked: number;
    missingMedia: number;
  };
  taskStats: ReturnType<typeof buildReportSummary>['taskStats'];
  externalBlockers: string[];
}) {
  return [
    '# AgentFlow AI Operational Report',
    '',
    '## Content Counts',
    ...Object.entries(input.contentCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Publish Attempts',
    ...Object.entries(input.attemptCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Provider Readiness',
    ...input.providers.map((provider) => `- ${provider.name}: ${provider.status} (${provider.nextAction})`),
    '',
    '## Scheduler',
    `- ${input.schedulerLine}`,
    '',
    '## Creative Assets',
    `- total: ${input.creativeAssets.total}`,
    `- images: ${input.creativeAssets.images}`,
    `- videos: ${input.creativeAssets.videos}`,
    `- linked: ${input.creativeAssets.linked}`,
    `- unlinked: ${input.creativeAssets.unlinked}`,
    `- missing media URL: ${input.creativeAssets.missingMedia}`,
    '',
    '## Tasks & Reviews',
    `- total tasks: ${input.taskStats.total}`,
    `- pending: ${input.taskStats.pending}`,
    `- processing: ${input.taskStats.processing}`,
    `- needs_review: ${input.taskStats.needsReview}`,
    `- completed: ${input.taskStats.completed}`,
    `- failed: ${input.taskStats.failed}`,
    '',
    '## External Setup Checklist',
    ...(input.externalBlockers.length > 0
      ? input.externalBlockers.map((blocker) => `- ${blocker}`)
      : ['- None detected in operational reporting.']),
  ].join('\n');
}

async function listPublishAttempts(workspaceId: string) {
  const { client, error } = await import('@/lib/supabase-server').then((module) => module.getSupabaseAdmin());

  if (!client) {
    return {
      data: [] as ContentStudioPublishAttemptRecord[],
      error: error ?? 'Supabase admin client is not configured.',
    };
  }

  const { data, error: selectError } = await client
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: selectError?.message ?? null,
  };
}

function mapTaskReviewRecord(record: TaskReviewRecord): TaskReview {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    task_id: record.task_id,
    reviewer_id: record.reviewer_id,
    rating: record.rating,
    feedback: record.feedback,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

async function listWorkspaceTaskReviews(workspaceId: string) {
  const { data, error } = await (await createSupabaseServerClient())
    .from('task_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return {
    data: (data ?? []).map(mapTaskReviewRecord),
    error: error?.message ?? null,
  };
}

async function listOptionalWorkspaceRows(
  workspaceId: string,
  table: string,
  limit = 250
): Promise<OptionalWorkspaceRowsResult> {
  const client = (await createSupabaseServerClient()) as unknown as LooseWorkspaceClient;
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    data: (data ?? []).filter(
      (row): row is OptionalWorkspaceRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    ),
    error: error?.message ?? null,
  };
}

function ReportsCard({
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

function ReportsMetricCard({ metric }: { metric: MetricCard }) {
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

function ProgressRow({
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

function SmallMetric({ label, value, helper }: { label: string; value: number | string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-black/7 bg-background/68 p-4">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-black/50">{helper}</p> : null}
    </div>
  );
}

function safeDashboardHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

function ProviderReadinessList({ providers }: { providers: ProviderStatusRow[] }) {
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

function RecentOperationalReports({
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

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? '';
  const catalogResult = await listAgentCatalog(supabase);
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const openAIReadiness = checkOpenAITextProviderReadiness();

  const [
    generatedReportsResult,
    reportResult,
    contentItemsResult,
    creativeAssetsResult,
    attemptsResult,
    tasksResult,
    projectsResult,
    releasesResult,
    reviewsResult,
    metaConnectionResult,
    googleAdsConnectionResult,
    promptLibraryResult,
    backupRecordsResult,
    securityAuditLogsResult,
    safePatchPlansResult,
    codeFixProposalsResult,
    githubIssueTaskLinksResult,
    pullRequestReviewsResult,
    notificationsResult,
  ] = await Promise.all([
    workspaceId
      ? getGeneratedReports(workspaceId, catalogResult.data.agents, supabase)
      : Promise.resolve({ data: { tasks: [], reports: [] }, error: null, isConfigured: true }),
    workspaceId
      ? getReportSummary(workspaceId, supabase)
      : Promise.resolve({ data: buildReportSummary([]), error: null, isConfigured: true }),
    workspaceId
      ? listContentStudioItemsForWorkspace(workspaceId, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listCreativeAssetsForWorkspace(workspaceId, undefined, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listPublishAttempts(workspaceId)
      : Promise.resolve({ data: [] as ContentStudioPublishAttemptRecord[], error: null }),
    workspaceId
      ? listTasks({ workspaceId }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listProjectsForWorkspace(workspaceId, supabase)
      : Promise.resolve({ data: [] as ProjectRecord[], error: null, isConfigured: true }),
    workspaceId
      ? listReleasesForWorkspace(workspaceId, supabase)
      : Promise.resolve({ data: [] as ReleaseRecord[], error: null, isConfigured: true }),
    workspaceId
      ? listWorkspaceTaskReviews(workspaceId)
      : Promise.resolve({ data: [] as TaskReview[], error: null }),
    workspaceId && userId
      ? getMetaConnectionStatus(workspaceId, userId)
      : Promise.resolve({ data: null, error: null, isConfigured: true }),
    workspaceId && userId
      ? getGoogleAdsConnectionStatus(workspaceId, userId)
      : Promise.resolve({ data: null, error: null, isConfigured: true }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'prompt_library')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'backup_records')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'security_audit_logs')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'safe_patch_plans')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'code_fix_proposals')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'github_issue_task_links')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'pull_request_reviews')
      : Promise.resolve({ data: [], error: null }),
    workspaceId
      ? listOptionalWorkspaceRows(workspaceId, 'notifications')
      : Promise.resolve({ data: [], error: null }),
  ]);

  const contentItems = contentItemsResult.data;
  const creativeAssets = creativeAssetsResult.data;
  const publishAttempts = attemptsResult.data;
  const tasks = tasksResult.data;
  const projects = projectsResult.data;
  const releases = releasesResult.data;
  const reviews = reviewsResult.data;
  const optionalWarnings = [
    ['Prompt Library', promptLibraryResult.error],
    ['Backup records', backupRecordsResult.error],
    ['Security audit logs', securityAuditLogsResult.error],
    ['Safe Patch Plans', safePatchPlansResult.error],
    ['Code Fix Proposals', codeFixProposalsResult.error],
    ['GitHub issue links', githubIssueTaskLinksResult.error],
    ['Pull Request Reviews', pullRequestReviewsResult.error],
    ['Notifications', notificationsResult.error],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, error]) => `${label}: ${error}`);
  const systemHealth =
    workspaceId && userId
      ? await getSystemHealthSummary({ supabase, workspaceId, userId })
      : null;
  const contentStatusCounts = {
    ...Object.fromEntries(contentStatuses.map((status) => [status, 0])),
    ...countBy(contentItems.map((item) => item.status)),
  } as Record<ContentStudioStatus, number>;
  const manualOnlyCount = contentItems.filter(isManualOnlyItem).length;
  const attemptStatusCounts = {
    ...Object.fromEntries(attemptStatuses.map((status) => [status, 0])),
    ...countBy(publishAttempts.map((attempt) => attempt.status)),
  } as Record<(typeof attemptStatuses)[number], number>;
  const assetIdsInUse = new Set(contentItems.flatMap((item) => item.asset_ids));
  const imageAssets = creativeAssets.filter((asset) => !isVideoAsset(asset)).length;
  const videoAssets = creativeAssets.filter(isVideoAsset).length;
  const linkedAssets = creativeAssets.filter((asset) => assetIdsInUse.has(asset.id)).length;
  const missingMediaAssets = creativeAssets.filter((asset) => !hasAssetMediaUrl(asset)).length;

  const providerReadinessEntries =
    workspaceId && userId
      ? await Promise.all([
          getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'facebook_post' }),
          getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'instagram_post' }),
          getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'google_ads_campaign_draft' }),
          getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'pinterest_pin' }),
          getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'linkedin_post_planner' }),
        ])
      : [];
  const [facebookReadiness, instagramReadiness, googleProviderReadiness, pinterestProviderReadiness] =
    providerReadinessEntries;
  const metaMetadata = readObject(metaConnectionResult.data?.metadata);
  const selectedPage = safeString(metaMetadata.selected_facebook_page_name);
  const selectedInstagram = safeString(metaMetadata.selected_instagram_business_account_name);
  const selectedMetaAdAccount = safeString(metaMetadata.selected_meta_ad_account_name);
  const selectedPinterestBoard = safeString(pinterestProviderReadiness?.details?.selectedBoardName);
  const googleConnection = googleAdsConnectionResult.data;
  const latestScheduledAttempt = publishAttempts.find((attempt) => {
    const item = contentItems.find((candidate) => candidate.id === attempt.content_item_id);
    return Boolean(item?.schedule_at || item?.scheduled_execution_finished_at);
  });
  const schedulerLine = latestScheduledAttempt
    ? `Latest scheduled attempt: ${latestScheduledAttempt.status} at ${formatDateTime(latestScheduledAttempt.created_at)}`
    : 'Last run not tracked yet';
  const providerStatuses: MonthlyProviderStatus[] = [
    {
      name: 'OpenAI',
      status: getReadinessState(openAIReadiness),
      missing: [],
      nextAction: openAIReadiness.message,
    },
    {
      name: 'Meta / Instagram / Facebook',
      status: getReadinessState(facebookReadiness ?? instagramReadiness ?? {}),
      missing: [
        ...(facebookReadiness?.missing ?? []),
        ...(instagramReadiness?.missing ?? []),
        ...(selectedPage ? [] : ['Selected Facebook Page']),
        ...(selectedInstagram ? [] : ['Selected Instagram account']),
        ...(selectedMetaAdAccount ? [] : ['Selected Meta Ad Account']),
      ],
      nextAction: selectedPage || selectedInstagram
        ? 'Review scopes, selected page, Instagram account, and Meta Ad Account.'
        : 'Connect Meta and select Facebook/Instagram publishing targets.',
    },
    {
      name: 'Google Ads',
      status: getReadinessState(googleProviderReadiness ?? googleAdsReadiness),
      missing: [
        ...googleAdsReadiness.missingEnvironmentVariables,
        ...(googleConnection?.status === 'connected' ? [] : ['Google Ads OAuth connection']),
      ],
      nextAction: googleAdsReadiness.isConfigured
        ? 'Confirm OAuth, customer ID, and developer token approval before paused drafts.'
        : 'Add Google Ads env vars and complete OAuth.',
    },
    {
      name: 'Pinterest',
      status: getReadinessState(pinterestProviderReadiness ?? pinterestReadiness),
      missing: [
        ...pinterestReadiness.missingEnvironmentVariables,
        ...(selectedPinterestBoard ? [] : ['Pinterest board selection']),
      ],
      nextAction: selectedPinterestBoard
        ? 'Pinterest board is selected; verify OAuth remains connected.'
        : 'Complete Pinterest OAuth and select a board.',
    },
    {
      name: 'LinkedIn',
      status: 'manual_only',
      missing: [],
      nextAction: 'Manual-only copy workflow. No LinkedIn publishing API is enabled.',
    },
    {
      name: 'Scheduler',
      status: schedulerReadiness.isConfigured ? 'ready' : 'setup_required',
      missing: schedulerReadiness.cronSecretConfigured ? [] : ['CRON_SECRET', 'Vercel Cron'],
      nextAction: schedulerReadiness.message,
    },
  ];
  const externalBlockers = providerStatuses
    .filter((provider) => provider.status !== 'ready' && provider.status !== 'manual_only')
    .map((provider) => `${provider.name}: ${provider.nextAction}`);
  const timelineAttempts = mapAttemptTimeline(publishAttempts, contentItems);
  const activeProviders = providerStatuses.filter((provider) => provider.status === 'ready').length;
  const setupChecklist = [
    setupItem('META_APP_ID', Boolean(process.env.META_APP_ID?.trim()), 'Required for Meta OAuth.'),
    setupItem('META_APP_SECRET', Boolean(process.env.META_APP_SECRET?.trim()), 'Required server-side for Meta OAuth.'),
    setupItem('META_REDIRECT_URI', Boolean(process.env.META_REDIRECT_URI?.trim()), 'Required for Meta OAuth callbacks.'),
    setupItem('AD_TOKEN_ENCRYPTION_KEY', Boolean(process.env.AD_TOKEN_ENCRYPTION_KEY?.trim()), 'Required for encrypted provider tokens.'),
    setupItem('Selected Facebook Page', Boolean(selectedPage), 'Select in Provider Settings.'),
    setupItem('Selected Instagram account', Boolean(selectedInstagram), 'Select in Provider Settings.'),
    setupItem('Google Ads developer token approval', null, 'Requires external approval review.'),
    setupItem('Google Ads OAuth/customer ID', googleConnection?.status === 'connected', 'Connect OAuth and select a customer ID.'),
    setupItem('Pinterest app secret', !pinterestReadiness.missingEnvironmentVariables.includes('PINTEREST_APP_SECRET'), 'Required for Pinterest OAuth.'),
    setupItem('Pinterest OAuth/board', Boolean(selectedPinterestBoard), 'Connect Pinterest and select a board.'),
    setupItem('CRON_SECRET', schedulerReadiness.cronSecretConfigured, schedulerReadiness.message),
    setupItem('Vercel Cron', null, `${schedulerReadiness.routePath} / ${schedulerReadiness.recommendedSchedule}`),
    setupItem('Supabase Storage bucket creative-assets', null, 'Verify bucket and public media URL policy.'),
  ];
  const reportText = buildReportText({
    contentCounts: {
      total: contentItems.length,
      draft: contentStatusCounts.draft,
      ready: contentStatusCounts.ready,
      scheduled: contentStatusCounts.scheduled,
      published: contentStatusCounts.published,
      failed: contentStatusCounts.failed,
      setup_required: contentStatusCounts.setup_required,
      approval_pending: contentStatusCounts.approval_pending,
      manual_only: manualOnlyCount,
    },
    attemptCounts: {
      total: publishAttempts.length,
      succeeded: attemptStatusCounts.succeeded,
      failed: attemptStatusCounts.failed,
      setup_required: attemptStatusCounts.setup_required,
      approval_pending: attemptStatusCounts.approval_pending,
      manual_only: attemptStatusCounts.manual_only,
      unsupported: attemptStatusCounts.unsupported,
    },
    providers: providerStatuses,
    schedulerLine,
    creativeAssets: {
      total: creativeAssets.length,
      images: imageAssets,
      videos: videoAssets,
      linked: linkedAssets,
      unlinked: creativeAssets.length - linkedAssets,
      missingMedia: missingMediaAssets,
    },
    taskStats: reportResult.data.taskStats,
    externalBlockers,
  });
  const advancedAnalyticsData: AdvancedAnalyticsData = {
    workspaceName: workspaceResult.data?.name ?? 'Current workspace',
    generatedAt: new Date().toISOString(),
    contentItems: contentItems.map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      content_type: item.content_type,
      status: item.status,
      provider_status: item.provider_status,
      provider_error: safeText(item.provider_error, ''),
      schedule_at: item.schedule_at,
      published_at: item.published_at,
      scheduled_execution_status: item.scheduled_execution_status,
      scheduled_execution_error: safeText(item.scheduled_execution_error, ''),
      scheduled_execution_started_at: item.scheduled_execution_started_at,
      scheduled_execution_finished_at: item.scheduled_execution_finished_at,
      scheduled_execution_attempts: item.scheduled_execution_attempts,
      asset_ids: item.asset_ids,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    publishAttempts: publishAttempts.map((attempt) => {
      const item = contentItems.find((candidate) => candidate.id === attempt.content_item_id);
      return {
        id: attempt.id,
        provider: attempt.provider,
        action_type: attempt.action_type,
        status: attempt.status,
        content_item_id: attempt.content_item_id,
        content_title: item?.title ?? 'Workspace-level attempt',
        safe_message: safeText(attempt.error_message ?? safeString(attempt.request_summary?.message), ''),
        external_id: attempt.provider_external_id,
        created_at: attempt.created_at,
        updated_at: attempt.updated_at,
      };
    }),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      agent_type: task.agent_type,
      status: task.status,
      priority: task.priority,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
    })),
    reviewsCount: reviews.length,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      github_url: project.github_url,
      production_url: project.production_url,
      updated_at: project.updated_at,
      created_at: project.created_at,
    })),
    releases: releases.map((release) => ({
      id: release.id,
      title: release.title,
      status: release.status,
      release_type: release.release_type,
      known_issues: release.known_issues,
      build_status: release.build_status,
      lint_status: release.lint_status,
      typecheck_status: release.typecheck_status,
      deploy_status: release.deploy_status,
      deploy_url: release.deploy_url,
      created_at: release.created_at,
      updated_at: release.updated_at,
    })),
    prompts: promptLibraryResult.data.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Untitled prompt'),
      category: rowString(row, 'category', 'uncategorized'),
      target_tool: rowNullableString(row, 'target_tool'),
      is_favorite: rowBoolean(row, 'is_favorite'),
      usage_count: rowNumber(row, 'usage_count'),
      last_used_at: rowNullableString(row, 'last_used_at'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    creativeAssets: creativeAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      asset_type: asset.asset_type,
      status: asset.status,
      has_media: hasAssetMediaUrl(asset),
      is_video: isVideoAsset(asset),
      is_linked: assetIdsInUse.has(asset.id) || Boolean(asset.linked_reel_id || asset.linked_task_id || asset.linked_campaign_task_id),
      created_at: asset.created_at,
      updated_at: asset.updated_at,
    })),
    providers: providerStatuses.map((provider) => ({
      name: provider.name,
      status: provider.status,
      missing: provider.missing,
      nextAction: provider.nextAction,
    })),
    backups: backupRecordsResult.data.map((row) => ({
      id: rowString(row, 'id'),
      categories: rowStringArray(row, 'categories'),
      status: rowString(row, 'status', 'created'),
      warnings: rowNullableString(row, 'warnings'),
      created_at: rowString(row, 'created_at'),
    })),
    securityLogs: securityAuditLogsResult.data.map((row) => ({
      id: rowString(row, 'id'),
      event_type: rowString(row, 'event_type', 'security_event'),
      severity: rowString(row, 'severity', 'info'),
      title: safeText(rowNullableString(row, 'message'), rowString(row, 'event_type', 'Security event')),
      created_at: rowString(row, 'created_at'),
    })),
    safePatchPlans: safePatchPlansResult.data.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Safe patch plan'),
      status: rowString(row, 'status', 'draft'),
      risk_level: rowString(row, 'risk_level', 'medium'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    codeFixProposals: codeFixProposalsResult.data.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Code fix proposal'),
      issue_type: rowString(row, 'issue_type', 'unknown'),
      severity: rowString(row, 'severity', 'medium'),
      status: rowString(row, 'status', 'draft'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    githubIssueLinks: githubIssueTaskLinksResult.data.map((row) => ({
      id: rowString(row, 'id'),
      github_issue_number: rowNumber(row, 'github_issue_number'),
      github_issue_title: rowNullableString(row, 'github_issue_title'),
      github_issue_state: rowNullableString(row, 'github_issue_state'),
      created_at: rowString(row, 'created_at'),
    })),
    pullRequestReviews: pullRequestReviewsResult.data.map((row) => ({
      id: rowString(row, 'id'),
      pr_number: rowNumber(row, 'pr_number'),
      pr_title: rowNullableString(row, 'pr_title'),
      risk_level: rowString(row, 'risk_level', 'medium'),
      recommendation: rowString(row, 'recommendation', 'needs_manual_review'),
      created_at: rowString(row, 'created_at'),
    })),
    notifications: notificationsResult.data.map((row) => ({
      id: rowString(row, 'id'),
      type: rowString(row, 'type', 'notification'),
      severity: rowString(row, 'severity', 'info'),
      title: safeText(rowNullableString(row, 'title'), 'Notification'),
      status: rowString(row, 'status', 'unread'),
      created_at: rowString(row, 'created_at'),
    })),
    systemHealth: systemHealth
      ? {
          score: systemHealth.score,
          label: systemHealth.label,
          criticalBlockers: systemHealth.metrics.recovery.criticalBlockers,
          needsSetup: systemHealth.badges.needsSetup,
          topActions: systemHealth.actions.slice(0, 3).map((action) => ({
            id: action.id,
            title: action.title,
            href: action.href,
          })),
        }
      : null,
    schedulerConfigured: schedulerReadiness.isConfigured,
    schedulerLine,
    optionalWarnings,
  };
  const pageError =
    workspaceResult.error ||
    catalogResult.error ||
    generatedReportsResult.error ||
    reportResult.error ||
    contentItemsResult.error ||
    creativeAssetsResult.error ||
    attemptsResult.error ||
    tasksResult.error ||
    projectsResult.error ||
    releasesResult.error ||
    reviewsResult.error ||
    metaConnectionResult.error ||
    googleAdsConnectionResult.error;
  const topMetrics: MetricCard[] = [
    {
      label: 'Total Content Items',
      value: contentItems.length,
      helper: 'Current workspace records',
      icon: Layers3,
      accent: 'bg-[#D5E5E5] text-[#F7CBCA]',
    },
    {
      label: 'Published',
      value: contentStatusCounts.published,
      helper: 'Provider-confirmed only',
      icon: CheckCircle2,
      accent: 'bg-[#5D6B6B] text-[#D5E5E5]',
    },
    {
      label: 'Scheduled',
      value: contentStatusCounts.scheduled,
      helper: 'Pending execution windows',
      icon: CalendarClock,
      accent: 'bg-[#E7F5DC]/28 text-[#8A4300]',
    },
    {
      label: 'Failed / Setup Required',
      value: contentStatusCounts.failed + contentStatusCounts.setup_required,
      helper: 'Needs operator review',
      icon: AlertTriangle,
      accent: 'bg-[#F7CBCA]/14 text-[#B51F30]',
    },
    {
      label: 'Total Projects',
      value: projects.length,
      helper: 'Internal project records',
      icon: FolderKanban,
      accent: 'bg-[#D5E5E5] text-[#F7CBCA]',
    },
    {
      label: 'Active Providers',
      value: activeProviders,
      helper: 'Ready operational services',
      icon: RadioTower,
      accent: 'bg-[#F7CBCA]/10 text-[#F7CBCA]',
    },
  ];
  const platformCounts: Array<[ContentStudioPlatform, string, number]> = [
    ['instagram', 'Instagram', contentItems.filter((item) => item.platform === 'instagram').length],
    ['facebook', 'Facebook', contentItems.filter((item) => item.platform === 'facebook').length],
    ['google_ads', 'Google Ads', contentItems.filter((item) => item.platform === 'google_ads').length],
    ['pinterest', 'Pinterest', contentItems.filter((item) => item.platform === 'pinterest').length],
    ['linkedin', 'LinkedIn', contentItems.filter((item) => item.platform === 'linkedin').length],
  ];
  const reportAgentTemplates = reportAgentIds
    .map((id) => getAgentTemplateById(id))
    .filter((template): template is AgentTemplate => Boolean(template));

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-385 space-y-8">
        {pageError ? (
          <Notice tone="warning" title="Reports data notice">
            {pageError}
          </Notice>
        ) : null}

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

        <div className="dashboard-stat-grid">
          {topMetrics.map((metric) => (
            <ReportsMetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        <ReportsCard
          title="AI Report Agents"
          description="Read-only report templates for summarizing activity, blockers, and safe next actions before you decide what to do."
          action={<Link href="/dashboard/agent-library?category=Reports%20%26%20Analytics" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Agent Library</Link>}
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
            {reportAgentTemplates.map((template) => {
              const taskDescription = `Create a draft-only internal report using the ${template.name}. Keep it read-only, analysis-only, and review-first.`;

              return (
                <article key={template.id} className="flex min-w-0 flex-col rounded-2xl border border-black/7 bg-[#F1F7F7]/64 p-4">
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
            })}
          </div>
          <p className="mt-4 text-xs font-semibold leading-5 text-black/50">
            These agents prepare summaries only. They do not publish, schedule, contact clients, change providers, or run n8n.
          </p>
        </ReportsCard>

        <AdvancedAnalyticsClient data={advancedAnalyticsData} />

        {systemHealth ? (
          <ReportsCard
            title="System Health Summary"
            description="Operational health score and top next actions from the System Health Center."
            action={<Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open System Health</Link>}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SmallMetric label="System Health Score" value={`${systemHealth.score}%`} helper={systemHealth.label} />
              <SmallMetric label="Provider blockers" value={systemHealth.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status)).length} />
              <SmallMetric label="Critical blockers" value={systemHealth.metrics.recovery.criticalBlockers} />
              <SmallMetric label="Needs setup checks" value={systemHealth.badges.needsSetup} />
            </div>
            <div className="mt-4 space-y-2">
              {(systemHealth.actions.length > 0 ? systemHealth.actions.slice(0, 3) : []).map((action) => (
                <Link key={action.id} href={safeDashboardHref(action.href)} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/7 bg-background/62 p-3 hover:bg-white">
                  <span className="min-w-0 whitespace-normal wrap-break-word text-sm font-black text-[#5D6B6B]">{action.title}</span>
                  <Gauge className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
                </Link>
              ))}
            </div>
          </ReportsCard>
        ) : null}

        <MonthlyAgencyReportClient
          contentItems={contentItems.map((item) => ({
            id: item.id,
            title: item.title,
            platform: item.platform,
            content_type: item.content_type,
            status: item.status,
            provider_status: item.provider_status,
            provider_error: item.provider_error,
            schedule_at: item.schedule_at,
            published_at: item.published_at,
            scheduled_execution_status: item.scheduled_execution_status,
            scheduled_execution_error: item.scheduled_execution_error,
            scheduled_execution_finished_at: item.scheduled_execution_finished_at,
            asset_ids: item.asset_ids,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }))}
          attempts={publishAttempts}
          creativeAssets={creativeAssets}
          tasks={tasks}
          reviews={reviews}
          providers={providerStatuses}
          schedulerConfigured={schedulerReadiness.isConfigured}
          schedulerLine={schedulerLine}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportsCard
            title="Publishing Status Overview"
            description="Visual summary of real Content Studio item states."
            action={<BarChart3 className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <div className="space-y-5">
              <ProgressRow label="Draft" value={contentStatusCounts.draft} total={contentItems.length} />
              <ProgressRow label="Ready" value={contentStatusCounts.ready} total={contentItems.length} tone="dark" />
              <ProgressRow label="Scheduled" value={contentStatusCounts.scheduled} total={contentItems.length} tone="peach" />
              <ProgressRow label="Published" value={contentStatusCounts.published} total={contentItems.length} tone="dark" />
              <ProgressRow label="Failed" value={contentStatusCounts.failed} total={contentItems.length} tone="coral" />
              <ProgressRow label="Setup required" value={contentStatusCounts.setup_required} total={contentItems.length} tone="coral" />
              <ProgressRow label="Approval pending" value={contentStatusCounts.approval_pending} total={contentItems.length} tone="peach" />
              <ProgressRow label="Manual only" value={manualOnlyCount} total={contentItems.length} />
            </div>
          </ReportsCard>

          <ReportsCard
            title="Provider Readiness"
            description="Current provider status and next safe action. No credentials are displayed."
            action={<ShieldCheck className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <ProviderReadinessList providers={providerStatuses} />
          </ReportsCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <ReportsCard title="Content by Platform" description="Counts by target workspace platform.">
            <div className="space-y-4">
              {platformCounts.map(([key, label, count]) => (
                <ProgressRow key={key} label={label} value={count} total={contentItems.length} />
              ))}
            </div>
          </ReportsCard>

          <ReportsCard title="Creative Assets Summary" description="Asset usage and media readiness.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Total assets" value={creativeAssets.length} />
              <SmallMetric label="Linked assets" value={linkedAssets} />
              <SmallMetric label="Unlinked assets" value={creativeAssets.length - linkedAssets} />
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
          </ReportsCard>

          <ReportsCard title="Projects Summary" description="Internal project workspace counts.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Total projects" value={projects.length} />
              <SmallMetric label="Active projects" value={projects.filter((project) => project.status === 'active').length} />
              <SmallMetric label="Deployed projects" value={projects.filter((project) => project.status === 'deployed').length} />
              <SmallMetric label="Ready to deploy" value={projects.filter((project) => project.status === 'ready_to_deploy').length} />
            </div>
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
              <FolderKanban className="h-4 w-4" />
              Open Projects
            </Link>
          </ReportsCard>

          <ReportsCard title="Releases Summary" description="Release tracking and deployment documentation.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Total releases" value={releases.length} />
              <SmallMetric label="Deployed releases" value={releases.filter((release) => release.status === 'deployed').length} />
              <SmallMetric label="Failed releases" value={releases.filter((release) => release.status === 'failed').length} />
              <SmallMetric label="Ready to deploy" value={releases.filter((release) => release.status === 'ready_to_deploy').length} />
              <SmallMetric label="Latest deploy URL" value={releases.find((release) => release.deploy_url)?.deploy_url ?? 'Not added'} />
            </div>
            <Link href="/dashboard/releases" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
              <Rocket className="h-4 w-4" />
              Open Releases
            </Link>
          </ReportsCard>

          <ReportsCard
            title="Scheduler Summary"
            description="Execution status from scheduled Content Studio records."
            action={<StatusBadge status={schedulerReadiness.isConfigured ? 'ready' : 'setup_required'} type="system" size="sm" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Pending" value={contentItems.filter((item) => item.status === 'scheduled' && (!item.scheduled_execution_status || item.scheduled_execution_status === 'pending')).length} />
              <SmallMetric label="Succeeded" value={contentItems.filter((item) => item.scheduled_execution_status === 'succeeded').length} />
              <SmallMetric label="Failed" value={contentItems.filter((item) => item.scheduled_execution_status === 'failed').length} />
              <SmallMetric label="Setup required" value={contentItems.filter((item) => item.scheduled_execution_status === 'setup_required').length} />
              <SmallMetric label="Approval pending" value={contentItems.filter((item) => item.scheduled_execution_status === 'approval_pending').length} />
              <SmallMetric label="Processing" value={contentItems.filter((item) => item.scheduled_execution_status === 'processing').length} />
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-black/58">{schedulerLine}</p>
          </ReportsCard>
        </div>

        <OperationalReportClient attempts={timelineAttempts} reportText={reportText} />

        <RecentOperationalReports
          generatedCount={generatedReportsResult.data.reports.length}
          reportText={reportText}
        />

        <ReportsCard
          title="Client-Ready Reports"
          description="Server-generated PDF with cover page, table of contents, branding, and real workspace metrics."
          action={null}
        >
          <div className="space-y-4">
            <div className="grid gap-3 text-sm text-black/62 sm:grid-cols-3">
              <SmallMetric label="Tasks in report data" value={tasks.length} />
              <SmallMetric label="Generated outputs" value={generatedReportsResult.data.reports.length} />
              <SmallMetric label="Reviews logged" value={reportResult.data.reviewCount} />
            </div>
            <p className="text-sm leading-6 text-black/58">
              Pulls real data from tasks, reels, creative assets, and brand kit settings. No fabricated
              engagement or ad performance metrics.
            </p>
            <ClientReportButton
              workspaceId={workspaceId || ''}
              workspaceName={workspaceResult.data?.name || 'Client'}
              label="Download Client PDF"
              showTemplatePicker
              showPasswordField
            />
          </div>
        </ReportsCard>

        <ReportsCard
          title="Production Setup Checklist"
          description="Environment and provider setup are reported as present, missing, needs review, or approval pending. Values are never shown."
          action={<Database className="h-5 w-5 text-[#F7CBCA]" />}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {setupChecklist.map((item) => (
              <div key={item.label} className="rounded-2xl border border-black/7 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-[#5D6B6B]">{item.label}</p>
                  <StatusBadge
                    status={item.status === 'present' ? 'ready' : item.status === 'missing' ? 'setup_required' : 'approval_pending'}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-black/58">{item.action}</p>
              </div>
            ))}
          </div>
        </ReportsCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportsCard
            title="Task & Review Pipeline"
            description="Workflow activity from real task and review records."
            action={<Activity className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <SmallMetric label="Total tasks" value={reportResult.data.taskStats.total} />
              <SmallMetric label="Pending" value={reportResult.data.taskStats.pending} />
              <SmallMetric label="Processing" value={reportResult.data.taskStats.processing} />
              <SmallMetric label="Needs review" value={reportResult.data.taskStats.needsReview} />
              <SmallMetric label="Completed" value={reportResult.data.taskStats.completed} />
              <SmallMetric label="Failed" value={reportResult.data.taskStats.failed} />
              <SmallMetric label="Review records" value={reportResult.data.reviewCount} />
              <SmallMetric label="Generated reports" value={generatedReportsResult.data.reports.length} />
              <SmallMetric label="Task events" value={reportResult.data.eventCount} />
            </div>
          </ReportsCard>

          <ReportsCard
            title="Reporting Guardrails"
            description="This dashboard is operational reporting, not inferred ad performance."
            action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <div className="space-y-3">
              {[
                ['No fake performance metrics', 'Impressions, clicks, spend, revenue, and conversions are not shown without real provider metrics.'],
                ['No secrets exposed', 'Tokens, secrets, authorization headers, and credential fields are filtered from summaries.'],
                ['No provider actions here', 'Reports observe readiness and attempts only; publishing and scheduling flows are unchanged.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-black/7 bg-background/60 p-4">
                  <p className="font-black text-[#5D6B6B]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>
                </div>
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
          </ReportsCard>
        </div>

        {contentItems.length === 0 && publishAttempts.length === 0 ? (
          <ReportsCard title="No publish attempts yet">
            <div className="rounded-2xl border border-dashed border-black/12 bg-white p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-[#F7CBCA]" />
              <h2 className="mt-4 text-xl font-black text-[#5D6B6B]">No publish attempts yet</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/58">
                Create or schedule content from Content & Ads Studio to start tracking operational activity.
              </p>
            </div>
          </ReportsCard>
        ) : null}
      </div>
    </div>
  );
}
