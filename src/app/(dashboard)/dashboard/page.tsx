import Link from 'next/link';
import { Suspense } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { getDashboardData, type DashboardData } from '@/lib/data/dashboard';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import {
  listLatestNotifications,
  countUnreadNotifications,
} from '@/lib/data/notifications';
import type { NotificationRecord } from '@/types/database';
import { getMetaConnectionStatus, getGoogleAdsConnectionStatus } from '@/lib/data/ad-connections';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import { checkOpenAITextProviderReadiness } from '@/lib/ai/text-provider';
import { buttonStyles } from '@/components/ui/Button';
import { ExpandablePanel } from '@/components/ui/ExpandablePanel';
import { formatTimeAgo } from '@/lib/utils';
import { Notice } from '@/components/ui/Notice';
import { EmptyState } from '@/components/ui/EmptyState';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { getServerTranslator } from '@/i18n/server';
import { type DataResult } from '@/lib/data/types';
import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type {
  ContentStudioPublishAttemptRecord,
  CreativeAssetRecord,
  ProjectRecord,
  ReleaseRecord,
} from '@/types/database';

import {
  type ReadinessState,
  type ProviderRow,
  type UsageWidgetData,
  DASHBOARD_PROVIDER_TIMEOUT_MS,
  traceWorkspace,
  withDashboardTimeout,
  timeoutMessage,
  settledDataResult,
  dashboardFallbackResult,
  buildEmptyDashboardData,
  buildProjectSnapshot,
  buildReleaseSnapshot,
  contentStatuses,
  getMetaEnvironmentMissing,
  getMetaProviderState,
  getGoogleAdsProviderState,
  getPinterestProviderState,
  fallbackProviderReadiness,
  getReadinessState,
  countBy,
  readObject,
  safeString,
  isVideoAsset,
  isManualOnlyItem,
  buildTodayActions,
  listRecentPublishAttempts,
  getUsageWidgetData,
} from './utils';
import {
  CommandCard,
  ProgressRow,
  SmallMetric,
  DashboardContentFallback,
  HeroSection,
  UsageWidget,
  OpsCard,
  WorkShortcutsGrid,
  ManagerShortcutsGrid,
  ProviderRowsSection,
  ProjectSnapshotCard,
  ReleaseSnapshotCard,
  TodayActionCard,
  LatestTaskCard,
  LatestContentCard,
  LatestPublishAttemptCard,
  HealthScoreCard,
} from './components';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardContentFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  traceWorkspace('route render start');
  traceWorkspace('before createSupabaseServerClient');
  const supabase = await createSupabaseServerClient({
    fetchTimeoutMs: DASHBOARD_PROVIDER_TIMEOUT_MS,
  });
  traceWorkspace('after createSupabaseServerClient');
  const authResult = await withDashboardTimeout(
    'dashboard auth',
    supabase.auth.getUser(),
    DASHBOARD_PROVIDER_TIMEOUT_MS
  ).catch((error: unknown) => {
    traceWorkspace('auth timeout', { error: error instanceof Error ? error.message : String(error) });
    return {
      data: { user: null },
      error,
    };
  });
  const user = authResult.data.user;
  traceWorkspace('auth resolved', { hasUser: Boolean(user), userId: user?.id ?? null });

  traceWorkspace('before active workspace cookie');
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  traceWorkspace('after active workspace cookie', { activeWorkspaceId });
  const workspaceResult = await withDashboardTimeout(
    'workspace context',
    getCurrentUserWorkspace(supabase, activeWorkspaceId)
  ).catch(() => dashboardFallbackResult(null, timeoutMessage('workspace context')));
  traceWorkspace('workspace resolved', {
    workspaceId: workspaceResult.data?.id ?? null,
    error: workspaceResult.error,
  });

  const workspaceId = workspaceResult.data?.id;
  const userId = user?.id ?? '';
  const emptyDashboardData = buildEmptyDashboardData();

  traceWorkspace('before dashboard section batch');
  const dashboardSections = await Promise.allSettled([
    withDashboardTimeout(
      'dashboard data',
      getDashboardData(workspaceId, supabase)
    ),
    withDashboardTimeout(
      'content catalog',
      workspaceId
        ? listContentStudioItemsForWorkspace(workspaceId, supabase, { limit: 24 })
        : Promise.resolve(dashboardFallbackResult([] as ContentStudioItemWithAssets[]))
    ),
    withDashboardTimeout(
      'creative assets',
      workspaceId
        ? listCreativeAssetsForWorkspace(workspaceId, undefined, supabase, { limit: 24, includeSignedUrls: false })
        : Promise.resolve(dashboardFallbackResult([] as CreativeAssetRecord[]))
    ),
    withDashboardTimeout(
      'publish attempts',
      workspaceId
        ? listRecentPublishAttempts(workspaceId).then((result) => ({
            ...result,
            isConfigured: true,
          }))
        : Promise.resolve(dashboardFallbackResult([] as ContentStudioPublishAttemptRecord[]))
    ),
    withDashboardTimeout(
      'projects',
      workspaceId
        ? listProjectsForWorkspace(workspaceId, supabase, { limit: 12 })
        : Promise.resolve(dashboardFallbackResult([] as ProjectRecord[]))
    ),
    withDashboardTimeout(
      'releases',
      workspaceId
        ? listReleasesForWorkspace(workspaceId, supabase, { limit: 12 })
        : Promise.resolve(dashboardFallbackResult([] as ReleaseRecord[]))
    ),
    withDashboardTimeout(
      'membership',
      workspaceId ? getCurrentWorkspaceMembership(supabase, workspaceId, userId) : Promise.resolve(dashboardFallbackResult(null))
    ),
    withDashboardTimeout(
      'meta connection status',
      workspaceId && userId
        ? getMetaConnectionStatus(workspaceId, userId)
        : Promise.resolve(dashboardFallbackResult<Awaited<ReturnType<typeof getMetaConnectionStatus>>['data'] | null>(null))
    ),
    withDashboardTimeout(
      'google ads connection status',
      workspaceId && userId
        ? getGoogleAdsConnectionStatus(workspaceId, userId)
        : Promise.resolve(dashboardFallbackResult<Awaited<ReturnType<typeof getGoogleAdsConnectionStatus>>['data'] | null>(null))
    ),
    withDashboardTimeout(
      'usage widget data',
      workspaceId
        ? getUsageWidgetData(workspaceId).then((data) => dashboardFallbackResult(data))
        : Promise.resolve(dashboardFallbackResult<UsageWidgetData>({ plan: 'Internal Free Tier', quotas: [] }))
    ),
    withDashboardTimeout(
      'notifications preview',
      workspaceId && userId
        ? listLatestNotifications({ workspaceId, userId, limit: 3 }, supabase).then((r) => dashboardFallbackResult(r.data))
        : Promise.resolve(dashboardFallbackResult<NotificationRecord[]>([]))
    ),
    withDashboardTimeout(
      'unread notifications count',
      workspaceId && userId
        ? countUnreadNotifications({ workspaceId, userId }, supabase).then((r) => dashboardFallbackResult(r.data))
        : Promise.resolve(dashboardFallbackResult<number>(0))
    ),
  ]);
  traceWorkspace('after dashboard section batch');

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
    usageWidgetResult,
    notificationsPreviewResult,
    unreadCountResult,
  ] = [
    settledDataResult(dashboardSections[0] as PromiseSettledResult<DataResult<DashboardData>>, emptyDashboardData, 'dashboard data'),
    settledDataResult(dashboardSections[1] as PromiseSettledResult<DataResult<ContentStudioItemWithAssets[]>>, [] as ContentStudioItemWithAssets[], 'content catalog'),
    settledDataResult(dashboardSections[2] as PromiseSettledResult<DataResult<CreativeAssetRecord[]>>, [] as CreativeAssetRecord[], 'creative assets'),
    settledDataResult(dashboardSections[3] as PromiseSettledResult<DataResult<ContentStudioPublishAttemptRecord[]>>, [] as ContentStudioPublishAttemptRecord[], 'publish attempts'),
    settledDataResult(dashboardSections[4] as PromiseSettledResult<DataResult<ProjectRecord[]>>, [] as ProjectRecord[], 'projects'),
    settledDataResult(dashboardSections[5] as PromiseSettledResult<DataResult<ReleaseRecord[]>>, [] as ReleaseRecord[], 'releases'),
    settledDataResult(dashboardSections[6] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getCurrentWorkspaceMembership>>['data']>>, null, 'membership'),
    settledDataResult(dashboardSections[7] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getMetaConnectionStatus>>['data'] | null>>, null, 'meta connection status'),
    settledDataResult(dashboardSections[8] as PromiseSettledResult<DataResult<Awaited<ReturnType<typeof getGoogleAdsConnectionStatus>>['data'] | null>>, null, 'google ads connection status'),
    settledDataResult(dashboardSections[9] as PromiseSettledResult<DataResult<UsageWidgetData>>, { plan: 'Internal Free Tier', quotas: [] } as UsageWidgetData, 'usage widget data'),
    settledDataResult(dashboardSections[10] as PromiseSettledResult<DataResult<NotificationRecord[]>>, [] as NotificationRecord[], 'notifications preview'),
    settledDataResult(dashboardSections[11] as PromiseSettledResult<DataResult<number>>, 0, 'unread notifications count'),
  ];

  traceWorkspace('dashboard data loaded', {
    hasWorkspace: Boolean(workspaceId),
    dashboardError: dashboardResult.error,
    contentError: contentItemsResult.error,
    creativeAssetsError: creativeAssetsResult.error,
  });

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
  } as Record<string, number>;
  const manualOnlyCount = contentItems.filter(isManualOnlyItem).length;
  const assetIdsInUse = new Set(contentItems.flatMap((item) => item.asset_ids));
  const unlinkedAssets = creativeAssets.filter((asset) => !assetIdsInUse.has(asset.id));
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const openAIReadiness = checkOpenAITextProviderReadiness();
  traceWorkspace('provider readiness snapshot uses local DB/env only');
  const metaMetadata = readObject(metaConnectionResult.data?.metadata);
  const selectedPage = safeString(metaMetadata.selected_facebook_page_name);
  const selectedInstagram = safeString(metaMetadata.selected_instagram_business_account_name);
  const selectedMetaAdAccount = safeString(metaMetadata.selected_meta_ad_account_name);
  const selectedPinterestBoard = null;
  const googleConnection = googleAdsConnectionResult.data;
  const metaEnvironmentMissing = getMetaEnvironmentMissing();
  const facebookReadiness = workspaceId && userId
    ? {
        state: getMetaProviderState({
          missingEnvironment: metaEnvironmentMissing,
          status: metaConnectionResult.data?.status,
          requiredSelection: selectedPage,
        }),
      }
    : fallbackProviderReadiness();
  const instagramReadiness = workspaceId && userId
    ? {
        state: getMetaProviderState({
          missingEnvironment: metaEnvironmentMissing,
          status: metaConnectionResult.data?.status,
          requiredSelection: selectedInstagram,
        }),
      }
    : fallbackProviderReadiness();
  const googleProviderReadiness = workspaceId && userId
    ? {
        state: getGoogleAdsProviderState({
          isConfigured: googleAdsReadiness.isConfigured,
          status: googleConnection?.status,
        }),
      }
    : fallbackProviderReadiness();
  const pinterestProviderReadiness = {
    state: getPinterestProviderState(),
  };
  const providerRows: ProviderRow[] = [
    {
      name: 'OpenAI',
      status: getReadinessState(openAIReadiness),
      nextAction: openAIReadiness.isReady ? openAIReadiness.message : 'Add API key and confirm quota/quota.',
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
      nextAction: selectedPinterestBoard ? 'Board selected. Verify OAuth remains connected.' : 'Open Settings to verify Pinterest OAuth and selected board.',
    },
    {
      name: 'LinkedIn',
      status: 'manual_only' as ReadinessState,
      nextAction: 'Manual-only copy workflow until real LinkedIn OAuth/publishing is implemented.',
    },
    {
      name: 'Scheduler',
      status: schedulerReadiness.isConfigured ? 'ready' : ('setup_required' as ReadinessState),
      nextAction: schedulerReadiness.message,
    },
  ];
  const activeProviders = providerRows.filter((provider) => provider.status === 'ready').length;
  const todayActions = buildTodayActions({ contentItems, tasks, unlinkedAssets });
  const usageData = usageWidgetResult.data as UsageWidgetData;
  const notificationsPreview = notificationsPreviewResult.data as NotificationRecord[];
  const unreadCount = unreadCountResult.data as number;
  const t = getServerTranslator('en');
  const role = membershipResult.data?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const canRunScheduler = isAdmin;
  const recentContent = contentItems.slice(0, 4);
  const recentTasks = tasks.slice(0, 4);
  const recentEvents = events.slice(0, 3);
  const myTasks = tasks.filter((task) => task.user_id === userId).slice(0, 5);
  const myDrafts = contentItems
    .filter((item) => item.status === 'draft' && item.created_by === userId)
    .slice(0, 5);
  const awaitingReview = tasks.filter((task) => task.status === 'needs_review').slice(0, 5);
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
    googleAdsConnectionResult.error ||
    usageWidgetResult.error ||
    notificationsPreviewResult.error ||
    unreadCountResult.error;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-10">
        {pageError ? (
          <Notice tone="warning" title="Command Center data notice">
            {pageError}
          </Notice>
        ) : null}

        <HeroSection canRunScheduler={canRunScheduler} t={t} />

        <OnboardingChecklist
          hasTasks={tasks.length > 0}
          hasProjects={projects.length > 0}
          hasContent={contentItems.length > 0}
          hasProviders={activeProviders > 0}
        />

        <HealthScoreCard
          providerStatus={{ active: activeProviders, total: providerRows.length }}
          schedulerHealthy={schedulerReadiness.isConfigured}
          reviewQueue={taskStats.needsReview}
          readyContent={contentStatusCounts.ready ?? 0}
          t={t}
        />

        {/* My Work — personalized zone: my tasks, my drafts, items awaiting my review */}
        <CommandCard title={t('page.dashboard.myWork', 'My Work')} description={t('page.dashboard.myWorkDescription', 'Personalized tasks, drafts, and items waiting on your review.')}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5D6B6B]">{t('page.dashboard.myTasks', 'My Tasks')}</h3>
                <Link href="/dashboard/tasks" className="text-xs font-bold text-[#F7CBCA] hover:underline">{t('page.dashboard.seeAll', 'See all')} →</Link>
              </div>
              {myTasks.length > 0 ? (
                <div className="space-y-2">
                  {myTasks.map((task) => (
                    <LatestTaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">{t('page.dashboard.myTasksEmpty', 'You have no tasks yet.')}</p>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5D6B6B]">{t('page.dashboard.myDrafts', 'My Drafts')}</h3>
                <Link href="/dashboard/content-studio" className="text-xs font-bold text-[#F7CBCA] hover:underline">{t('page.dashboard.seeAll', 'See all')} →</Link>
              </div>
              {myDrafts.length > 0 ? (
                <div className="space-y-2">
                  {myDrafts.map((item) => (
                    <LatestContentCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">{t('page.dashboard.myDraftsEmpty', 'No drafts created by you.')}</p>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5D6B6B]">{t('page.dashboard.awaitingMyReview', 'Awaiting My Review')}</h3>
                <Link href="/dashboard/tasks?status=needs_review" className="text-xs font-bold text-[#F7CBCA] hover:underline">{t('page.dashboard.seeAll', 'See all')} →</Link>
              </div>
              {awaitingReview.length > 0 ? (
                <div className="space-y-2">
                  {awaitingReview.map((task) => (
                    <LatestTaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">{t('page.dashboard.awaitingMyReviewEmpty', 'Nothing is waiting on your review.')}</p>
              )}
            </div>
          </div>
        </CommandCard>

        <UsageWidget usageWidgetData={usageData} />

        <OpsCard
          unreadCount={unreadCount}
          recentNotifications={notificationsPreview}
          isAdmin={isAdmin}
        />

        <CommandCard
          title="System Health Snapshot"
          description="Detailed diagnostics run from the dedicated health page so dashboard rendering stays responsive."
          action={<Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open System Health</Link>}
        >
          <Notice tone="info" title="Detailed checks are manual">
            Open System Health or Production Readiness for the strict operational scan.
          </Notice>
        </CommandCard>

        <CommandCard
          title="Work Shortcuts"
          description="Core manager workspaces grouped for quick navigation."
        >
          <WorkShortcutsGrid />
        </CommandCard>

        <ExpandablePanel
          title={t('page.dashboard.projectsSnapshot', 'Projects Snapshot')}
          description="Internal project organization from real workspace project records."
          defaultOpen={false}
          storageKey="cc-panel-projects"
          action={<Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Projects</Link>}
        >
          <ProjectSnapshotCard projectSnapshot={projectSnapshot} />
        </ExpandablePanel>

        <ExpandablePanel
          title={t('page.dashboard.releasesSnapshot', 'Releases Snapshot')}
          description="Release tracking from real workspace release records."
          defaultOpen={false}
          storageKey="cc-panel-releases"
          action={<Link href="/dashboard/releases" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open Releases</Link>}
        >
          <ReleaseSnapshotCard releaseSnapshot={releaseSnapshot} />
        </ExpandablePanel>

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
              <div className="space-y-2">
                {todayActions.map((action) => (
                  <TodayActionCard key={action.id} action={action} />
                ))}
              </div>
            )}
          </CommandCard>

          <CommandCard
            title="Provider Setup Snapshot"
            description="No secret values are shown. Use Settings to fix provider setup gaps."
            action={<ShieldCheck className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <ProviderRowsSection providerRows={providerRows} />
          </CommandCard>
        </div>

        <ExpandablePanel
          title={t('page.dashboard.contentCampaignSnapshot', 'Content & Campaign Snapshot')}
          description="Operational state from Content Studio records. Manual-only is tracked from provider status and LinkedIn planners."
          defaultOpen={false}
          storageKey="cc-panel-content"
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
              <ProgressRow label="Draft" value={contentStatusCounts.draft ?? 0} total={contentItems.length} />
              <ProgressRow label="Ready" value={contentStatusCounts.ready ?? 0} total={contentItems.length} />
              <ProgressRow label="Scheduled" value={contentStatusCounts.scheduled ?? 0} total={contentItems.length} />
              <ProgressRow label="Published" value={contentStatusCounts.published ?? 0} total={contentItems.length} />
              <ProgressRow label="Failed" value={contentStatusCounts.failed ?? 0} total={contentItems.length} />
              <ProgressRow label="Setup Required" value={contentStatusCounts.setup_required ?? 0} total={contentItems.length} />
              <ProgressRow label="Approval Pending" value={contentStatusCounts.approval_pending ?? 0} total={contentItems.length} />
              <ProgressRow label="Manual Only" value={manualOnlyCount} total={contentItems.length} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallMetric label="Creative Assets" value={creativeAssets.length} />
              <SmallMetric label="Unlinked Assets" value={unlinkedAssets.length} />
              <SmallMetric label="Image Assets" value={creativeAssets.filter((asset) => !isVideoAsset(asset)).length} />
              <SmallMetric label="Video Assets" value={creativeAssets.filter(isVideoAsset).length} />
            </div>
          </div>
        </ExpandablePanel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <CommandCard title="Recent Activity / Attempts" description="Latest tasks, content items, publish attempts, and scheduler-related attempts when available.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest Tasks</p>
                {recentTasks.length === 0 ? (
                  <p className="text-sm text-black/55">No tasks yet.</p>
                ) : recentTasks.map((task) => (
                  <LatestTaskCard key={task.id} task={task} />
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest Content</p>
                {recentContent.length === 0 ? (
                  <p className="text-sm text-black/55">No content items yet.</p>
                ) : recentContent.map((item) => (
                  <LatestContentCard key={item.id} item={item} />
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2">
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
            <div className="mt-6 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Publish & Scheduler Attempts</p>
              {publishAttempts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">
                  No publish attempts yet. Provider actions and scheduled attempts will appear after they run.
                </p>
              ) : publishAttempts.map((attempt) => (
                <LatestPublishAttemptCard key={attempt.id} attempt={attempt} />
              ))}
            </div>
          </CommandCard>

          <CommandCard title="Manager Shortcuts" description="Jump straight to the workspace that needs your attention.">
            <ManagerShortcutsGrid />
          </CommandCard>
        </div>
      </div>
    </div>
  );
}
