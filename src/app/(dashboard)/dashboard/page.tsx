import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookMarked,
  Bot,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  DatabaseBackup,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  PenSquare,
  Plus,
  RadioTower,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  SearchCode,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  getSupabaseAdmin,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { getDashboardData } from '@/lib/data/dashboard';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { listContentStudioItemsForWorkspace } from '@/lib/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { getMetaConnectionStatus, getGoogleAdsConnectionStatus } from '@/lib/data/ad-connections';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import {
  checkNvidiaTextProviderReadiness,
  checkOpenAITextProviderReadiness,
} from '@/lib/ai/text-provider';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatDateTime, formatTimeAgo } from '@/lib/utils';
import { DashboardSchedulerButton } from './DashboardSchedulerButton';
import { WavingRobot } from '@/components/dashboard/WavingRobot';
import type { ContentStudioItemWithAssets } from '@/lib/data/content-studio';
import type {
  ContentStudioPublishAttemptRecord,
  ContentStudioStatus,
  CreativeAssetRecord,
  ProjectRecord,
  ReleaseRecord,
} from '@/types/database';
import type { Task } from '@/types';

type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

interface ProviderRow {
  name: string;
  status: ReadinessState;
  nextAction: string;
}

interface TodayAction {
  id: string;
  title: string;
  reason: string;
  href: string;
  status: Parameters<typeof StatusBadge>[0]['status'];
  cta: string;
}

const contentStatuses: ContentStudioStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'failed',
  'setup_required',
  'approval_pending',
];

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

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function buildProjectSnapshot(projects: ProjectRecord[]) {
  return {
    total: projects.length,
    active: projects.filter((project) => project.status === 'active').length,
    readyToDeploy: projects.filter((project) => project.status === 'ready_to_deploy').length,
    deployed: projects.filter((project) => project.status === 'deployed').length,
    latest: projects[0] ?? null,
  };
}

function buildReleaseSnapshot(releases: ReleaseRecord[]) {
  return {
    total: releases.length,
    deployed: releases.filter((release) => release.status === 'deployed').length,
    failed: releases.filter((release) => release.status === 'failed').length,
    readyToDeploy: releases.filter((release) => release.status === 'ready_to_deploy').length,
    latest: releases[0] ?? null,
  };
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

function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(asset.metadata?.video)
  );
}

function isManualOnlyItem(item: ContentStudioItemWithAssets) {
  return item.content_type === 'linkedin_post_planner' || item.provider_status === 'manual_only';
}

function isDueSoon(value: string | null) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();
  return timestamp <= now + 24 * 60 * 60 * 1000;
}

function formatActionType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function hasMediaUrl(asset: CreativeAssetRecord) {
  const metadata = readObject(asset.metadata);
  const video = readObject(metadata.video);
  return Boolean(asset.image_url || asset.storage_path || safeString(video.public_url));
}

async function listRecentPublishAttempts(workspaceId: string) {
  const { client, error } = getSupabaseAdmin();

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
    .limit(6);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: selectError?.message ?? null,
  };
}

function CommandCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_20px_54px_rgba(93,107,107,0.08)] ring-1 ring-white/70',
        className
      )}
    >
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-[#5D6B6B]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-black/58">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ManagerStat({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'berry',
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: typeof FileText;
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
    <div className="rounded-2xl border border-black/7 bg-white p-5 shadow-[0_16px_42px_rgba(93,107,107,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
          <p className="mt-3 text-3xl font-black text-[#5D6B6B]">{value}</p>
        </div>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-black/55">{helper}</p>
    </div>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-black/70">{label}</span>
        <span className="font-mono text-sm font-black text-[#5D6B6B]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F7F7] ring-1 ring-black/5">
        <div className="h-full rounded-full bg-[#F7CBCA]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/68 p-4">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value}</p>
    </div>
  );
}

function buildTodayActions({
  contentItems,
  tasks,
  unlinkedAssets,
}: {
  contentItems: ContentStudioItemWithAssets[];
  tasks: Task[];
  unlinkedAssets: CreativeAssetRecord[];
}) {
  const actions: TodayAction[] = [];

  for (const item of contentItems.filter((candidate) => candidate.status === 'ready').slice(0, 3)) {
    actions.push({
      id: `ready-${item.id}`,
      title: item.title,
      reason: 'Content is ready for the next publish or draft action.',
      href: `/dashboard/content-studio?item=${item.id}`,
      status: 'ready',
      cta: 'Open item',
    });
  }

  for (const item of contentItems.filter((candidate) => candidate.status === 'scheduled' && isDueSoon(candidate.schedule_at)).slice(0, 3)) {
    actions.push({
      id: `scheduled-${item.id}`,
      title: item.title,
      reason: item.schedule_at ? `Scheduled for ${formatDateTime(item.schedule_at)}` : 'Scheduled item needs timing review.',
      href: `/dashboard/content-studio?item=${item.id}`,
      status: 'scheduled',
      cta: 'Review schedule',
    });
  }

  for (const item of contentItems.filter((candidate) => ['failed', 'setup_required', 'approval_pending'].includes(candidate.status)).slice(0, 4)) {
    actions.push({
      id: `blocked-${item.id}`,
      title: item.title,
      reason: item.provider_error || `Item is ${item.status.replace(/_/g, ' ')}.`,
      href: `/dashboard/content-studio?item=${item.id}`,
      status: item.status,
      cta: 'Fix item',
    });
  }

  for (const task of tasks.filter((candidate) => candidate.status === 'needs_review').slice(0, 4)) {
    actions.push({
      id: `review-${task.id}`,
      title: task.title,
      reason: 'Task needs manager review before it can move forward.',
      href: `/dashboard/tasks/${task.id}`,
      status: 'needs_review',
      cta: 'Review task',
    });
  }

  for (const asset of unlinkedAssets.slice(0, 2)) {
    actions.push({
      id: `asset-${asset.id}`,
      title: asset.title,
      reason: hasMediaUrl(asset) ? 'Creative asset is not linked to any content item.' : 'Creative asset is missing a usable media URL.',
      href: `/dashboard/creative-assets/${asset.id}`,
      status: hasMediaUrl(asset) ? 'manual_only' : 'setup_required',
      cta: 'Open asset',
    });
  }

  return actions.slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? '';

  const [
    dashboardResult,
    contentItemsResult,
    creativeAssetsResult,
    attemptsResult,
    projectsResult,
    releasesResult,
    membershipResult,
    metaConnectionResult,
    googleAdsConnectionResult,
  ] = await Promise.all([
    getDashboardData(workspaceId, supabase),
    workspaceId ? listContentStudioItemsForWorkspace(workspaceId, supabase) : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId ? listCreativeAssetsForWorkspace(workspaceId, undefined, supabase) : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId ? listRecentPublishAttempts(workspaceId) : Promise.resolve({ data: [] as ContentStudioPublishAttemptRecord[], error: null }),
    workspaceId ? listProjectsForWorkspace(workspaceId, supabase) : Promise.resolve({ data: [] as ProjectRecord[], error: null, isConfigured: true }),
    workspaceId ? listReleasesForWorkspace(workspaceId, supabase) : Promise.resolve({ data: [] as ReleaseRecord[], error: null, isConfigured: true }),
    workspaceId ? getCurrentWorkspaceMembership(supabase, workspaceId, userId) : Promise.resolve({ data: null, error: null, isConfigured: true }),
    workspaceId && userId ? getMetaConnectionStatus(workspaceId, userId) : Promise.resolve({ data: null, error: null, isConfigured: true }),
    workspaceId && userId ? getGoogleAdsConnectionStatus(workspaceId, userId) : Promise.resolve({ data: null, error: null, isConfigured: true }),
  ]);

  const { tasks, events, taskStats } = dashboardResult.data;
  const contentItems = contentItemsResult.data;
  const creativeAssets = creativeAssetsResult.data;
  const publishAttempts = attemptsResult.data;
  const projects = projectsResult.data;
  const releases = releasesResult.data;
  const projectSnapshot = buildProjectSnapshot(projects);
  const releaseSnapshot = buildReleaseSnapshot(releases);
  const contentStatusCounts = {
    ...Object.fromEntries(contentStatuses.map((status) => [status, 0])),
    ...countBy(contentItems.map((item) => item.status)),
  } as Record<ContentStudioStatus, number>;
  const manualOnlyCount = contentItems.filter(isManualOnlyItem).length;
  const assetIdsInUse = new Set(contentItems.flatMap((item) => item.asset_ids));
  const unlinkedAssets = creativeAssets.filter((asset) => !assetIdsInUse.has(asset.id));
  const failedOrSetup =
    contentStatusCounts.failed + contentStatusCounts.setup_required + contentStatusCounts.approval_pending;
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const openAIReadiness = checkOpenAITextProviderReadiness();
  const nvidiaReadiness = checkNvidiaTextProviderReadiness();
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
  const providerRows: ProviderRow[] = [
    {
      name: 'OpenAI',
      status: getReadinessState(openAIReadiness),
      nextAction: openAIReadiness.isReady ? openAIReadiness.message : 'Add API key and confirm quota/quota.',
    },
    {
      name: 'NVIDIA',
      status: getReadinessState(nvidiaReadiness),
      nextAction: nvidiaReadiness.isReady ? nvidiaReadiness.message : 'Add NVIDIA_API_KEY if fallback generation is required.',
    },
    {
      name: 'Meta / Instagram / Facebook',
      status: getReadinessState(facebookReadiness ?? instagramReadiness ?? {}),
      nextAction:
        selectedPage || selectedInstagram || selectedMetaAdAccount
          ? 'Review selected Page, Instagram account, scopes, and Ad Account.'
          : 'Connect Meta and select publishing targets.',
    },
    {
      name: 'Google Ads',
      status: getReadinessState(googleProviderReadiness ?? googleAdsReadiness),
      nextAction:
        googleAdsReadiness.isConfigured && googleConnection?.status === 'connected'
          ? 'Confirm customer ID and developer token approval before paused drafts.'
          : 'Complete OAuth, customer ID, and developer token setup.',
    },
    {
      name: 'Pinterest',
      status: getReadinessState(pinterestProviderReadiness ?? pinterestReadiness),
      nextAction: selectedPinterestBoard ? 'Board selected. Verify OAuth remains connected.' : 'Connect Pinterest and select a board.',
    },
    {
      name: 'LinkedIn',
      status: 'manual_only',
      nextAction: 'Manual-only copy workflow until real LinkedIn OAuth/publishing is implemented.',
    },
    {
      name: 'Scheduler',
      status: schedulerReadiness.isConfigured ? 'ready' : 'setup_required',
      nextAction: schedulerReadiness.message,
    },
  ];
  const activeProviders = providerRows.filter((provider) => provider.status === 'ready').length;
  const systemHealth =
    workspaceId && userId
      ? await getSystemHealthSummary({ supabase, workspaceId, userId })
      : null;
  const todayActions = buildTodayActions({ contentItems, tasks, unlinkedAssets });
  const canRunScheduler =
    membershipResult.data?.role === 'owner' || membershipResult.data?.role === 'admin';
  const recentContent = contentItems.slice(0, 4);
  const recentTasks = tasks.slice(0, 4);
  const recentEvents = events.slice(0, 3);
  const pageError =
    workspaceResult.error ||
    dashboardResult.error ||
    contentItemsResult.error ||
    creativeAssetsResult.error ||
    attemptsResult.error ||
    projectsResult.error ||
    releasesResult.error ||
    membershipResult.error ||
    metaConnectionResult.error ||
    googleAdsConnectionResult.error;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-8">
        {pageError ? (
          <Notice tone="warning" title="Command Center data notice">
            {pageError}
          </Notice>
        ) : null}

        <section className="rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-center">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
                <Sparkles className="h-3.5 w-3.5" />
                Manager workspace
              </div>
              <h1 className="text-3xl font-black leading-tight tracking-normal text-[#5D6B6B] sm:text-4xl xl:text-5xl">
                Agency Command Center
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
                Manage today&apos;s tasks, content, campaigns, provider setup, and publishing readiness from one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
                  <Plus className="h-5 w-5" />
                  Create Task
                </Link>
                <Link href="/dashboard/content-studio" className={buttonStyles({ size: 'lg', variant: 'secondary' })}>
                  <PenSquare className="h-5 w-5" />
                  Content Studio
                </Link>
                <Link href="/dashboard/system-health" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                  <Gauge className="h-5 w-5" />
                  System Health
                </Link>
                <Link href="/dashboard/alex" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                  <Bot className="h-5 w-5" />
                  Open Alex
                </Link>
                <Link href="/dashboard/backups" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                  <DatabaseBackup className="h-5 w-5" />
                  Open Backup Center
                </Link>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-black/7 bg-[#F1F7F7]/72 p-4">
              <WavingRobot />
              <div className="mt-3 grid gap-2">
                <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', className: 'w-full justify-start' })}>
                  <FolderKanban className="h-4 w-4" />
                  Open Projects
                </Link>
                <DashboardSchedulerButton canRunScheduler={canRunScheduler} />
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-black text-[#5D6B6B]">Today&apos;s Priorities</h2>
            <p className="mt-1 text-sm leading-6 text-black/58">
              The highest-signal counts for blockers, review work, ready content, and provider readiness.
            </p>
          </div>
        <div className="dashboard-stat-grid">
          <ManagerStat label="Total Tasks" value={taskStats.total} helper="Real workspace tasks" icon={FileText} />
          <ManagerStat label="Needs Review" value={taskStats.needsReview} helper="Manager review queue" icon={AlertCircle} tone="coral" />
          <ManagerStat label="Ready Content" value={contentStatusCounts.ready} helper="Ready content items" icon={CheckCircle2} tone="dark" />
          <ManagerStat label="Scheduled Content" value={contentStatusCounts.scheduled} helper="Planned publishing items" icon={CalendarClock} tone="peach" />
          <Link href="/dashboard/recovery" className="block min-w-0">
            <ManagerStat label="Failed / Setup Required" value={failedOrSetup} helper="Open Recovery Center" icon={LifeBuoy} tone="coral" />
          </Link>
          <ManagerStat label="Active Providers" value={activeProviders} helper="Ready provider services" icon={RadioTower} />
        </div>
        </div>

        {systemHealth ? (
          <CommandCard
            title="System Health Snapshot"
            description="Read-only operational diagnostics across providers, storage, scheduling, releases, and blockers."
            action={<Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open System Health</Link>}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SmallMetric label="Health score" value={`${systemHealth.score}%`} />
              <SmallMetric label="Critical blockers" value={systemHealth.metrics.recovery.criticalBlockers} />
              <SmallMetric label="Provider issues" value={systemHealth.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status)).length} />
              <SmallMetric label="Needs setup" value={systemHealth.badges.needsSetup} />
            </div>
          </CommandCard>
        ) : null}

        <CommandCard
          title="Work Shortcuts"
          description="Core manager workspaces grouped for quick navigation."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                  ['Open Alex', '/dashboard/alex', Bot],
                  ['Content Studio', '/dashboard/content-studio', PenSquare],
                  ['Creative Assets', '/dashboard/creative-assets', ImageIcon],
                  ['Projects', '/dashboard/projects', FolderKanban],
                  ['Plan Safe Patch', '/dashboard/safe-patch-planner', SearchCode],
                  ['Open Backup Center', '/dashboard/backups', DatabaseBackup],
                  ['Prompt Library', '/dashboard/prompt-library', ClipboardList],
                  ['Reports', '/dashboard/reports', BarChart3],
                  ['System Health', '/dashboard/system-health', Gauge],
                  ['Security Center', '/dashboard/security', LockKeyhole],
                  ['Docs', '/dashboard/docs', BookMarked],
                  ['Settings', '/dashboard/settings', Settings],
                ].map(([label, href, Icon]) => (
              <Link
                key={label as string}
                href={href as string}
                className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full justify-start' })}
              >
                <Icon className="h-5 w-5" />
                {label as string}
              </Link>
            ))}
          </div>
        </CommandCard>

        <CommandCard
          title="Projects Snapshot"
          description="Internal project organization from real workspace project records."
          action={<Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Projects</Link>}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SmallMetric label="Active projects" value={projectSnapshot.active} />
            <SmallMetric label="Ready to deploy" value={projectSnapshot.readyToDeploy} />
            <SmallMetric label="Deployed" value={projectSnapshot.deployed} />
            <SmallMetric label="Total projects" value={projectSnapshot.total} />
          </div>
          {projectSnapshot.latest ? (
            <Link href={`/dashboard/projects/${projectSnapshot.latest.id}`} className="mt-4 block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest project</p>
              <p className="mt-1 font-black text-[#5D6B6B]">{projectSnapshot.latest.name}</p>
              <p className="mt-1 text-sm leading-6 text-black/58">
                {projectSnapshot.latest.status.replace(/_/g, ' ')} / {formatTimeAgo(projectSnapshot.latest.updated_at)}
              </p>
            </Link>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">
              No project records yet.
            </p>
          )}
        </CommandCard>

        <CommandCard
          title="Releases Snapshot"
          description="Release tracking from real workspace release records."
          action={<Link href="/dashboard/releases" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Releases</Link>}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SmallMetric label="Ready to deploy" value={releaseSnapshot.readyToDeploy} />
            <SmallMetric label="Deployed releases" value={releaseSnapshot.deployed} />
            <SmallMetric label="Failed releases" value={releaseSnapshot.failed} />
            <SmallMetric label="Total releases" value={releaseSnapshot.total} />
          </div>
          {releaseSnapshot.latest ? (
            <Link href={`/dashboard/releases/${releaseSnapshot.latest.id}`} className="mt-4 block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest release</p>
              <p className="mt-1 font-black text-[#5D6B6B]">{releaseSnapshot.latest.title}</p>
              <p className="mt-1 text-sm leading-6 text-black/58">{releaseSnapshot.latest.status.replace(/_/g, ' ')} / {formatTimeAgo(releaseSnapshot.latest.updated_at)}</p>
            </Link>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">No release records yet.</p>
          )}
        </CommandCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <CommandCard
            title="Today's Actions"
            description="Prioritized from real ready content, due schedules, blockers, reviews, and asset linking gaps."
            action={<ClipboardList className="h-5 w-5 text-[#F7CBCA]" />}
          >
            {todayActions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="Create a new campaign or review provider setup when you are ready for the next move."
                action={
                  <Link href="/dashboard/content-studio" className={buttonStyles({ variant: 'secondary' })}>
                    Open Content Studio
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {todayActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 transition-colors hover:bg-white lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-black text-[#5D6B6B]">{action.title}</p>
                        <StatusBadge status={action.status} type="system" size="sm" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-black/58">{action.reason}</p>
                    </div>
                    <Link href={action.href} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                      {action.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CommandCard>

          <CommandCard
            title="Provider Setup Snapshot"
            description="No secret values are shown. Use Settings to fix provider setup gaps."
            action={<ShieldCheck className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <div className="space-y-3">
              {providerRows.map((provider) => (
                <div key={provider.name} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[#5D6B6B]">{provider.name}</p>
                      <p className="mt-1 text-sm leading-6 text-black/58">{provider.nextAction}</p>
                    </div>
                    <StatusBadge status={readinessBadgeStatuses[provider.status]} type="system" size="sm" />
                  </div>
                  <Link href="/dashboard/settings#provider-setup-wizard" className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'mt-3' })}>
                    {provider.status === 'ready' || provider.status === 'manual_only' ? 'Open Settings' : 'Fix Now'}
                  </Link>
                </div>
              ))}
            </div>
          </CommandCard>
        </div>

        <CommandCard
          title="Content & Campaign Snapshot"
          description="Operational state from Content Studio records. Manual-only is tracked from provider status and LinkedIn planners."
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/content-studio" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Content Studio</Link>
              <Link href="/dashboard/calendar" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Calendar</Link>
              <Link href="/dashboard/campaigns" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Campaigns</Link>
              <Link href="/dashboard/reports" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Reports</Link>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <ProgressRow label="Draft" value={contentStatusCounts.draft} total={contentItems.length} />
              <ProgressRow label="Ready" value={contentStatusCounts.ready} total={contentItems.length} />
              <ProgressRow label="Scheduled" value={contentStatusCounts.scheduled} total={contentItems.length} />
              <ProgressRow label="Published" value={contentStatusCounts.published} total={contentItems.length} />
              <ProgressRow label="Failed" value={contentStatusCounts.failed} total={contentItems.length} />
              <ProgressRow label="Setup Required" value={contentStatusCounts.setup_required} total={contentItems.length} />
              <ProgressRow label="Approval Pending" value={contentStatusCounts.approval_pending} total={contentItems.length} />
              <ProgressRow label="Manual Only" value={manualOnlyCount} total={contentItems.length} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Creative Assets" value={creativeAssets.length} />
              <SmallMetric label="Unlinked Assets" value={unlinkedAssets.length} />
              <SmallMetric label="Image Assets" value={creativeAssets.filter((asset) => !isVideoAsset(asset)).length} />
              <SmallMetric label="Video Assets" value={creativeAssets.filter(isVideoAsset).length} />
            </div>
          </div>
        </CommandCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <CommandCard title="Recent Activity / Attempts" description="Latest tasks, content items, publish attempts, and scheduler-related attempts when available.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest Tasks</p>
                {recentTasks.length === 0 ? (
                  <p className="text-sm text-black/55">No tasks yet.</p>
                ) : recentTasks.map((task) => (
                  <Link key={task.id} href={`/dashboard/tasks/${task.id}`} className="block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-bold leading-5 text-[#5D6B6B]">{task.title}</p>
                      <StatusBadge status={task.status} type="task" size="sm" />
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">{formatTimeAgo(task.updated_at)}</p>
                  </Link>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest Content</p>
                {recentContent.length === 0 ? (
                  <p className="text-sm text-black/55">No content items yet.</p>
                ) : recentContent.map((item) => (
                  <Link key={item.id} href={`/dashboard/content-studio?item=${item.id}`} className="block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-bold leading-5 text-[#5D6B6B]">{item.title}</p>
                      <StatusBadge status={item.status} type="task" size="sm" />
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">{formatTimeAgo(item.updated_at)}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest Task Events</p>
              {recentEvents.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">
                  No task events recorded yet.
                </p>
              ) : recentEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-black/7 bg-white p-4">
                  <p className="font-bold text-[#5D6B6B]">{event.message}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">
                    {event.event_type} / {formatTimeAgo(event.created_at)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Publish & Scheduler Attempts</p>
              {publishAttempts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">
                  No publish attempts yet. Provider actions and scheduled attempts will appear after they run.
                </p>
              ) : publishAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-[#5D6B6B]">{formatActionType(attempt.action_type)}</p>
                      <p className="mt-1 text-sm text-black/58">{attempt.provider} / {formatDateTime(attempt.created_at)}</p>
                    </div>
                    <StatusBadge status={attempt.status} type="system" size="sm" />
                  </div>
                  {attempt.error_message ? <p className="mt-2 text-sm leading-6 text-black/58">{attempt.error_message}</p> : null}
                </div>
              ))}
            </div>
          </CommandCard>

          <CommandCard title="Manager Shortcuts" description="Jump straight to the workspace that needs your attention.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Open Alex', '/dashboard/alex', Bot],
                ['Instagram Studio', '/dashboard/content-studio?tab=instagram', Megaphone],
                ['Projects', '/dashboard/projects', FolderKanban],
                ['Plan Software Project', '/dashboard/software-planner', Sparkles],
                ['Releases', '/dashboard/releases', Rocket],
                ['Prompt Library', '/dashboard/prompt-library', ClipboardList],
                ['Plan Campaign', '/dashboard/content-studio#one-click-campaign-planner', Sparkles],
                ['Facebook Studio', '/dashboard/content-studio?tab=facebook', Megaphone],
                ['Google Ads Studio', '/dashboard/content-studio?tab=google_ads', BarChart3],
                ['Content Calendar', '/dashboard/calendar', CalendarDays],
                ['Recovery Center', '/dashboard/recovery', LifeBuoy],
                ['Backup Center', '/dashboard/backups', DatabaseBackup],
                ['Monthly Report', '/dashboard/reports#monthly-agency-report', FileText],
                ['Pinterest Studio', '/dashboard/content-studio?tab=pinterest', ImageIcon],
                ['LinkedIn Planner', '/dashboard/content-studio?tab=linkedin', ClipboardList],
                ['Creative Assets', '/dashboard/creative-assets', ImageIcon],
                ['Reports', '/dashboard/reports', Layers3],
                ['Docs', '/dashboard/docs', BookMarked],
                ['Provider Setup', '/dashboard/settings#provider-setup-wizard', ShieldCheck],
                ['Brand Kit', '/dashboard/settings#brand-kit', Sparkles],
                ['Settings', '/dashboard/settings', Settings],
              ].map(([label, href, Icon]) => (
                <Link key={label as string} href={href as string} className={buttonStyles({ variant: 'outline', className: 'justify-start' })}>
                  <Icon className="h-4 w-4" />
                  {label as string}
                </Link>
              ))}
            </div>
          </CommandCard>
        </div>
      </div>
    </div>
  );
}
