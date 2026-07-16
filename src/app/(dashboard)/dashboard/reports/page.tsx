import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  Database,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgentCatalog } from '@/lib/data/agents';
import { buildReportSummary, getGeneratedReports, getReportSummary } from '@/features/reports/data/reports';
import { getSystemHealthSummary } from '@/lib/data/system-health';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listTasks } from '@/features/tasks/data/tasks';
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
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import {
  OperationalReportClient,
} from './OperationalReportClient';
import type { MonthlyProviderStatus } from './MonthlyAgencyReportClient';

const MonthlyAgencyReportClient = dynamic(
  () => import('./MonthlyAgencyReportClient').then((mod) => mod.MonthlyAgencyReportClient),
  {
    loading: () => (
      <div className="rounded-2xl border border-border bg-white/90 p-5 shadow-[0_20px_54px_rgba(93,107,107,0.08)] ring-1 ring-white/70">
        <p className="text-sm font-semibold text-foreground-muted">Loading monthly report…</p>
      </div>
    ),
  }
);

const AdvancedAnalyticsClient = dynamic(
  () => import('./AdvancedAnalyticsClient').then((mod) => mod.AdvancedAnalyticsClient),
  {
    loading: () => (
      <div className="rounded-2xl border border-border bg-white/90 p-5 shadow-[0_20px_54px_rgba(93,107,107,0.08)] ring-1 ring-white/70">
        <p className="text-sm font-semibold text-foreground-muted">Loading analytics…</p>
      </div>
    ),
  }
);
import type {
  ContentStudioPublishAttemptRecord,
  ProjectRecord,
  ReleaseRecord,
} from '@/types/database';
import type { TaskReview } from '@/types';
import {
  countBy,
  readObject,
  safeString,
  isVideoAsset,
  hasAssetMediaUrl,
  isManualOnlyItem,
  mapAttemptTimeline,
  buildReportText,
  contentStatuses,
  attemptStatuses,
  buildTopMetrics,
  buildPlatformCounts,
  buildProviderStatuses,
  buildSetupChecklist,
  buildAdvancedAnalyticsData,
  reportAgentIds,
} from './utils';
import { listPublishAttempts, listWorkspaceTaskReviews, listOptionalWorkspaceRows } from './data';
import {
  ReportsCard,
  ReportsMetricCard,
  ProviderReadinessList,
  RecentOperationalReports,
  ReportsHeroSection,
  AIReportAgentCard,
  SetupChecklistItem,
  EmptyPublishAttemptsState,
  PublishingStatusOverviewSection,
  ContentByPlatformSection,
  CreativeAssetsSummarySection,
  ProjectsSummarySection,
  ReleasesSummarySection,
  SchedulerSummarySection,
  ClientReadyReportsSection,
  TaskReviewPipelineSection,
  ReportingGuardrailsSection,
  SystemHealthSection,
} from './components';

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
      ? listContentStudioItemsForWorkspace(workspaceId, supabase, { limit: 2000 })
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listCreativeAssetsForWorkspace(workspaceId, undefined, supabase, { limit: 2000 })
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listPublishAttempts(workspaceId)
      : Promise.resolve({ data: [] as ContentStudioPublishAttemptRecord[], error: null }),
    workspaceId
      ? listTasks({ workspaceId, limit: 2000 }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? listProjectsForWorkspace(workspaceId, supabase, { limit: 2000 })
      : Promise.resolve({ data: [] as ProjectRecord[], error: null, isConfigured: true }),
    workspaceId
      ? listReleasesForWorkspace(workspaceId, supabase, { limit: 2000 })
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
  } as Record<string, number>;
  const manualOnlyCount = contentItems.filter(isManualOnlyItem).length;
  const attemptStatusCounts = {
    ...Object.fromEntries(attemptStatuses.map((status) => [status, 0])),
    ...countBy(publishAttempts.map((attempt) => attempt.status)),
  } as Record<string, number>;
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

  const providerStatuses: MonthlyProviderStatus[] = buildProviderStatuses({
    openAIReadiness,
    facebookReadiness,
    instagramReadiness,
    selectedPage,
    selectedInstagram,
    selectedMetaAdAccount,
    googleProviderReadiness,
    googleAdsReadiness,
    googleConnection,
    pinterestProviderReadiness,
    pinterestReadiness,
    selectedPinterestBoard,
    schedulerReadiness,
  });

  const externalBlockers = providerStatuses
    .filter((provider) => provider.status !== 'ready' && provider.status !== 'manual_only')
    .map((provider) => `${provider.name}: ${provider.nextAction}`);
  const timelineAttempts = mapAttemptTimeline(publishAttempts, contentItems);
  const activeProviders = providerStatuses.filter((provider) => provider.status === 'ready').length;

  const setupChecklist = buildSetupChecklist({
    selectedPage,
    selectedInstagram,
    googleConnection,
    pinterestReadiness,
    selectedPinterestBoard,
    schedulerReadiness,
  });

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

  const advancedAnalyticsData = buildAdvancedAnalyticsData({
    workspaceName: workspaceResult.data?.name ?? 'Current workspace',
    contentItems,
    publishAttempts,
    tasks,
    reviews,
    projects,
    releases,
    creativeAssets,
    promptLibraryRows: promptLibraryResult.data,
    backupRows: backupRecordsResult.data,
    securityLogRows: securityAuditLogsResult.data,
    safePatchPlanRows: safePatchPlansResult.data,
    codeFixProposalRows: codeFixProposalsResult.data,
    githubIssueLinkRows: githubIssueTaskLinksResult.data,
    pullRequestReviewRows: pullRequestReviewsResult.data,
    notificationRows: notificationsResult.data,
    providerStatuses,
    systemHealth,
    schedulerConfigured: schedulerReadiness.isConfigured,
    schedulerLine,
    optionalWarnings,
  });

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

  const topMetrics = buildTopMetrics({
    contentItemsLength: contentItems.length,
    contentStatusCounts,
    projectsLength: projects.length,
    activeProviders,
  });

  const platformCounts = buildPlatformCounts(contentItems);

  const reportAgentTemplates = reportAgentIds
    .map((id) => getAgentTemplateById(id))
    .filter((template): template is AgentTemplate => Boolean(template));

  // Computed values for extracted card body components
  const systemHealthProps = systemHealth
    ? {
        score: systemHealth.score,
        label: systemHealth.label,
        providerBlockers: systemHealth.providers.filter(
          (provider) => !['ready', 'manual_only'].includes(provider.status)
        ).length,
        criticalBlockers: systemHealth.metrics.recovery.criticalBlockers,
        needsSetup: systemHealth.badges.needsSetup,
        actions: systemHealth.actions.map((a) => ({ id: a.id, title: a.title, href: a.href })),
      }
    : null;
  const projectCounts = {
    active: projects.filter((p) => p.status === 'active').length,
    deployed: projects.filter((p) => p.status === 'deployed').length,
    readyToDeploy: projects.filter((p) => p.status === 'ready_to_deploy').length,
  };
  const releaseCounts = {
    deployed: releases.filter((r) => r.status === 'deployed').length,
    failed: releases.filter((r) => r.status === 'failed').length,
    readyToDeploy: releases.filter((r) => r.status === 'ready_to_deploy').length,
    latestDeployUrl: releases.find((r) => r.deploy_url)?.deploy_url ?? 'Not added',
  };
  const schedulerCounts = {
    pending: contentItems.filter(
      (item) =>
        item.status === 'scheduled' &&
        (!item.scheduled_execution_status || item.scheduled_execution_status === 'pending')
    ).length,
    succeeded: contentItems.filter((item) => item.scheduled_execution_status === 'succeeded').length,
    failed: contentItems.filter((item) => item.scheduled_execution_status === 'failed').length,
    setupRequired: contentItems.filter((item) => item.scheduled_execution_status === 'setup_required').length,
    approvalPending: contentItems.filter((item) => item.scheduled_execution_status === 'approval_pending').length,
    processing: contentItems.filter((item) => item.scheduled_execution_status === 'processing').length,
  };

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-385 space-y-8">
        {pageError ? (
          <Notice tone="warning" title="Reports data notice">
            {pageError}
          </Notice>
        ) : null}

        <ReportsHeroSection reportText={reportText} />

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
            {reportAgentTemplates.map((template) => (
              <AIReportAgentCard key={template.id} template={template} />
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold leading-5 text-foreground-muted">
            These agents prepare summaries only. They do not publish, schedule, contact clients, change providers, or run n8n.
          </p>
        </ReportsCard>

        <AdvancedAnalyticsClient data={advancedAnalyticsData} />

        {systemHealthProps ? (
          <ReportsCard
            title="System Health Summary"
            description="Operational health score and top next actions from the System Health Center."
            action={<Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>Open System Health</Link>}
          >
            <SystemHealthSection {...systemHealthProps} />
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
            <PublishingStatusOverviewSection
              contentStatusCounts={contentStatusCounts}
              totalItems={contentItems.length}
              manualOnlyCount={manualOnlyCount}
            />
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
            <ContentByPlatformSection platformCounts={platformCounts} totalItems={contentItems.length} />
          </ReportsCard>

          <ReportsCard title="Creative Assets Summary" description="Asset usage and media readiness.">
            <CreativeAssetsSummarySection
              totalAssets={creativeAssets.length}
              linkedAssets={linkedAssets}
              imageAssets={imageAssets}
              videoAssets={videoAssets}
              missingMediaAssets={missingMediaAssets}
            />
          </ReportsCard>

          <ReportsCard title="Projects Summary" description="Internal project workspace counts.">
            <ProjectsSummarySection
              totalProjects={projects.length}
              activeProjects={projectCounts.active}
              deployedProjects={projectCounts.deployed}
              readyToDeployProjects={projectCounts.readyToDeploy}
            />
          </ReportsCard>

          <ReportsCard title="Releases Summary" description="Release tracking and deployment documentation.">
            <ReleasesSummarySection
              totalReleases={releases.length}
              deployedReleases={releaseCounts.deployed}
              failedReleases={releaseCounts.failed}
              readyToDeployReleases={releaseCounts.readyToDeploy}
              latestDeployUrl={releaseCounts.latestDeployUrl}
            />
          </ReportsCard>

          <ReportsCard
            title="Scheduler Summary"
            description="Execution status from scheduled Content Studio records."
            action={<StatusBadge status={schedulerReadiness.isConfigured ? 'ready' : 'setup_required'} type="system" size="sm" />}
          >
            <SchedulerSummarySection
              pendingCount={schedulerCounts.pending}
              succeededCount={schedulerCounts.succeeded}
              failedCount={schedulerCounts.failed}
              setupRequiredCount={schedulerCounts.setupRequired}
              approvalPendingCount={schedulerCounts.approvalPending}
              processingCount={schedulerCounts.processing}
              schedulerLine={schedulerLine}
            />
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
          <ClientReadyReportsSection
            taskCount={tasks.length}
            generatedOutputs={generatedReportsResult.data.reports.length}
            reviewCount={reportResult.data.reviewCount}
            workspaceId={workspaceId || ''}
            workspaceName={workspaceResult.data?.name || 'Client'}
          />
        </ReportsCard>

        <ReportsCard
          title="Production Setup Checklist"
          description="Environment and provider setup are reported as present, missing, needs review, or approval pending. Values are never shown."
          action={<Database className="h-5 w-5 text-[#F7CBCA]" />}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {setupChecklist.map((item) => (
              <SetupChecklistItem key={item.label} label={item.label} status={item.status} action={item.action} />
            ))}
          </div>
        </ReportsCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportsCard
            title="Task & Review Pipeline"
            description="Workflow activity from real task and review records."
            action={<Activity className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <TaskReviewPipelineSection
              total={reportResult.data.taskStats.total}
              pending={reportResult.data.taskStats.pending}
              processing={reportResult.data.taskStats.processing}
              needsReview={reportResult.data.taskStats.needsReview}
              completed={reportResult.data.taskStats.completed}
              failed={reportResult.data.taskStats.failed}
              reviewCount={reportResult.data.reviewCount}
              generatedReports={generatedReportsResult.data.reports.length}
              eventCount={reportResult.data.eventCount}
            />
          </ReportsCard>

          <ReportsCard
            title="Reporting Guardrails"
            description="This dashboard is operational reporting, not inferred ad performance."
            action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
          >
            <ReportingGuardrailsSection />
          </ReportsCard>
        </div>

        {contentItems.length === 0 && publishAttempts.length === 0 ? (
          <EmptyPublishAttemptsState />
        ) : null}
      </div>
    </div>
  );
}
