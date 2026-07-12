'use server';

import { checkOpenAIContentReadiness } from '@/lib/ai/openai-content';
import {
  checkOpenAITextProviderReadiness,
  getAITextProviderConfig,
} from '@/lib/ai/text-provider';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { checkCreativeAssetsStorageReadiness } from '@/lib/storage/creative-assets';
import { getGitHubReadiness } from '@/lib/github';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getGoogleAdsConnectionStatus, getMetaConnectionStatus } from '@/lib/data/ad-connections';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getPinterestPublishingReadiness } from '@/lib/ads/pinterest-publishing';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import { listProjectsForWorkspace, normalizeProjectMetadata } from '@/lib/data/projects';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  getSettingsWorkspaceContext,
  buildAITextProviderReadinessState,
  buildProvider,
  checklistProgress,
  disconnectedMetaSettings,
  disconnectedPinterestSettings,
  envCheck,
  formatEnvList,
  isEnvPresent,
  optionalEnvReview,
  providerStatusFromChecklist,
  readVercelCronStatus,
  safeErrorMessage,
  schedulerRouteFileExists,
  dashboardSchedulerButtonFileExists,
  titleCaseStatus,
  CONTENT_STUDIO_SCHEDULER_ROUTE_PATH,
  type ProviderReadinessItem,
  type ProviderReadinessState,
  type ProviderSetupCheckItem,
  type ProviderSetupStatus,
  type ProviderSetupWizardProvider,
  type ProviderSetupWizardState,
} from './_shared';
import { getMetaConnectionSettingsAction } from './meta';
import { getPinterestConnectionSettingsAction } from './pinterest';

export async function getProviderReadinessAction(): Promise<ProviderReadinessState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const openAITextReadiness = checkOpenAIContentReadiness();
  const aiTextProviderConfig = getAITextProviderConfig();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const metaEnvConfigured = Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_REDIRECT_URI?.trim()
  );

  if (!user) {
    return {
      items: [
        {
          key: 'openai',
          label: 'OpenAI',
          status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
          detail: openAITextReadiness.isReady
            ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation.'
            : openAITextReadiness.message,
        },
        {
          key: 'meta',
          label: 'Meta Ads / Instagram & Facebook',
          status: metaEnvConfigured ? 'Setup Required' : 'Setup Required',
          detail: metaEnvConfigured
            ? 'Meta OAuth foundation is configured, but sign in to check workspace connection status.'
            : 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
        },
        {
          key: 'google_ads',
          label: 'Google Ads',
          status: googleAdsReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: googleAdsReadiness.isConfigured
            ? 'Google Ads stays draft-only until developer token/basic access is fully approved.'
            : `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'pinterest',
          label: 'Pinterest',
          status: pinterestReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: pinterestReadiness.isConfigured
            ? 'Pinterest draft planning is available, but send remains disabled in this phase.'
            : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'linkedin_planner',
          label: 'LinkedIn Planner',
          status: 'Manual Mode',
          detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
        },
      ],
      aiTextProvider: {
        ...buildAITextProviderReadinessState({
          activeProvider: aiTextProviderConfig.activeProvider,
          openaiReady: openAITextReadiness.isReady,
          openaiMessage: openAITextReadiness.message,
        }),
      },
    };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return {
      items: [
        {
          key: 'openai',
          label: 'OpenAI',
          status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
          detail: openAITextReadiness.isReady
            ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation.'
            : openAITextReadiness.message,
        },
        {
          key: 'meta',
          label: 'Meta Ads / Instagram & Facebook',
          status: metaEnvConfigured ? 'Ready' : 'Setup Required',
          detail: metaEnvConfigured
            ? 'Meta OAuth foundation is configured server-side. Workspace connection is checked after workspace selection.'
            : 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
        },
        {
          key: 'google_ads',
          label: 'Google Ads',
          status: googleAdsReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: googleAdsReadiness.isConfigured
            ? 'Google Ads stays draft-only until developer token/basic access is fully approved.'
            : `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'pinterest',
          label: 'Pinterest',
          status: pinterestReadiness.isConfigured ? 'Draft-only' : 'Setup Required',
          detail: pinterestReadiness.isConfigured
            ? 'Pinterest draft planning is available, but send remains disabled in this phase.'
            : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
        },
        {
          key: 'linkedin_planner',
          label: 'LinkedIn Planner',
          status: 'Manual Mode',
          detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
        },
      ],
      aiTextProvider: {
        ...buildAITextProviderReadinessState({
          activeProvider: aiTextProviderConfig.activeProvider,
          openaiReady: openAITextReadiness.isReady,
          openaiMessage: openAITextReadiness.message,
        }),
      },
    };
  }

  const workspaceId = workspaceResult.data.id;
  const [metaConnectionResult, googleAdsConnectionResult, pinterestPublishingReadiness] = await Promise.all([
    getMetaConnectionStatus(workspaceId, user.id),
    getGoogleAdsConnectionStatus(workspaceId, user.id),
    getPinterestPublishingReadiness({ workspaceId, userId: user.id }),
  ]);

  const metaStatus =
    !metaEnvConfigured
      ? 'Setup Required'
      : metaConnectionResult.data.status === 'connected'
        ? 'Ready'
        : 'Setup Required';

  const metaDetail = !metaEnvConfigured
    ? 'Meta provider setup still needs META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.'
    : metaConnectionResult.data.status === 'connected'
      ? 'Meta read-only tracking is connected for this workspace.'
      : 'Meta OAuth foundation is configured, but this workspace still needs a Meta connection for tracking.';

  const googleAdsStatus =
    !googleAdsReadiness.isConfigured
      ? 'Setup Required'
      : googleAdsConnectionResult.data.status === 'connected'
        ? 'External Approval Pending'
        : 'Setup Required';

  const googleAdsDetail = !googleAdsReadiness.isConfigured
    ? `Google Ads setup still needs: ${formatEnvList(googleAdsReadiness.missingEnvironmentVariables)}.`
    : googleAdsConnectionResult.data.status === 'connected'
      ? 'Google Ads OAuth is connected, but campaign send stays disabled until developer token/basic access is approved.'
      : 'Google Ads OAuth foundation is configured, but this workspace still needs a Google Ads connection. Even after connect, campaign send stays draft-only.';

  return {
    items: [
      {
        key: 'openai',
        label: 'OpenAI',
        status: openAITextReadiness.isReady ? 'Ready' : 'Setup Required',
        detail: openAITextReadiness.isReady
          ? 'Server-side AI generation is configured. quota or quota issues can still temporarily block generation until OpenAI usage is restored.'
          : openAITextReadiness.message,
      },
      {
        key: 'meta',
        label: 'Meta Ads / Instagram & Facebook',
        status: metaStatus,
        detail: metaDetail,
      },
      {
        key: 'google_ads',
        label: 'Google Ads',
        status: googleAdsStatus,
        detail: googleAdsDetail,
      },
      {
        key: 'pinterest',
        label: 'Pinterest',
        status: pinterestPublishingReadiness.state === 'ready' ? 'Ready' : 'Setup Required',
        detail: pinterestReadiness.isConfigured
          ? pinterestPublishingReadiness.message
          : `Pinterest setup still needs: ${formatEnvList(pinterestReadiness.missingEnvironmentVariables)}.`,
      },
      {
        key: 'linkedin_planner',
        label: 'LinkedIn Planner',
        status: 'Manual Mode',
        detail: 'LinkedIn stays planner-only with copy-ready text. No OAuth or publishing API is enabled.',
      },
    ],
    aiTextProvider: {
      ...buildAITextProviderReadinessState({
        activeProvider: aiTextProviderConfig.activeProvider,
        openaiReady: openAITextReadiness.isReady,
        openaiMessage: openAITextReadiness.message,
      }),
    },
  };
}


export async function getProviderSetupWizardAction(): Promise<ProviderSetupWizardState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      generatedAt: new Date().toISOString(),
      summary: {
        ready: 0,
        missingSetup: 0,
        approvalPending: 0,
        manualOnly: 0,
        criticalBlockers: 0,
        total: 0,
      },
      nextBestAction: {
        title: 'Sign in to review provider setup.',
        detail: context.error ?? 'Provider setup could not be loaded.',
        providerKey: null,
        href: null,
      },
      providers: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const workspaceId = context.workspace.id;
  const userId = context.user.id;

  const [
    metaSettings,
    pinterestSettings,
    googleConnectionResult,
    storageReadiness,
    routeExists,
    vercelCronStatus,
    recentAttemptsResult,
    projectsResult,
  ] = await Promise.all([
    getMetaConnectionSettingsAction(),
    getPinterestConnectionSettingsAction(),
    getGoogleAdsConnectionStatus(workspaceId, userId),
    checkCreativeAssetsStorageReadiness(supabase, workspaceId),
    schedulerRouteFileExists(),
    readVercelCronStatus(),
    supabase
      .from('content_studio_publish_attempts')
      .select('provider, status, error_message, updated_at')
      .eq('workspace_id', workspaceId)
      .not('error_message', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(30),
    listProjectsForWorkspace(workspaceId, supabase),
  ]);

  const recentAttempts = recentAttemptsResult.data ?? [];
  const lastErrorForProvider = (
    provider: 'meta' | 'google_ads' | 'pinterest' | 'linkedin'
  ) =>
    safeErrorMessage(
      recentAttempts.find((attempt: { provider: string; status: string; error_message: string | null; updated_at: string }) => attempt.provider === provider)?.error_message ?? null
    );

  const openAITextReadiness = checkOpenAITextProviderReadiness();
  const openAIImageReadiness = checkOpenAIImageReadiness();
  const googleConfig = getGoogleAdsConfigReadiness();
  const pinterestConfig = getPinterestConfigReadiness();
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const githubReadiness = getGitHubReadiness();
  const githubLinkedProjects = projectsResult.data.filter((project: { github_url?: string | null; metadata?: unknown }) => {
    const metadata = normalizeProjectMetadata(project.metadata);
    return Boolean(project.github_url || (metadata.github.owner && metadata.github.repo));
  }).length;

  const openAIChecklist: ProviderSetupCheckItem[] = [
    envCheck('OPENAI_API_KEY', 'OPENAI_API_KEY'),
    {
      label: 'Text generation',
      status: openAITextReadiness.isReady ? 'present' : 'missing',
      explanation: openAITextReadiness.message,
      nextAction: openAITextReadiness.isReady
        ? 'No action needed.'
        : 'Add OPENAI_API_KEY in Vercel and redeploy.',
    },
    {
      label: 'Image generation',
      status: openAIImageReadiness.isReady ? 'present' : 'missing',
      explanation: openAIImageReadiness.message,
      nextAction: openAIImageReadiness.isReady
        ? 'No action needed.'
        : 'Add OPENAI_API_KEY and confirm image generation access.',
    },
    {
      label: 'quota / quota',
      status: 'needs_review',
      explanation: 'quota and quota are only known after provider responses report a limit issue.',
      nextAction: 'Review OpenAI quota and usage limits if generation fails.',
    },
  ];

  const metaEnvChecks: ProviderSetupCheckItem[] = [
    envCheck('META_APP_ID', 'META_APP_ID'),
    envCheck('META_APP_SECRET', 'META_APP_SECRET'),
    envCheck('META_REDIRECT_URI', 'META_REDIRECT_URI'),
    optionalEnvReview(
      'META_GRAPH_API_VERSION',
      'META_GRAPH_API_VERSION',
      'META_GRAPH_API_VERSION is not set. The app uses its default Graph API version.'
    ),
    envCheck('AD_TOKEN_ENCRYPTION_KEY', 'AD_TOKEN_ENCRYPTION_KEY'),
  ];
  const metaConnectionReady = metaSettings.status === 'connected';
  const metaChecklist: ProviderSetupCheckItem[] = [
    ...metaEnvChecks,
    {
      label: 'Meta OAuth connection',
      status: metaConnectionReady ? 'present' : 'missing',
      explanation: metaConnectionReady
        ? 'Meta OAuth connection is active for this workspace.'
        : 'Meta OAuth connection is missing, expired, revoked, or unavailable.',
      nextAction: metaConnectionReady
        ? 'No action needed.'
        : 'Connect or reconnect Meta from Settings.',
    },
    {
      label: 'Granted organic scopes',
      status: metaSettings.missingOrganicScopes.length === 0 ? 'present' : 'missing',
      explanation:
        metaSettings.missingOrganicScopes.length === 0
          ? 'Required Facebook Page and Instagram organic publishing scopes are present.'
          : `Missing scopes: ${metaSettings.missingOrganicScopes.join(', ')}.`,
      nextAction:
        metaSettings.missingOrganicScopes.length === 0
          ? 'No action needed.'
          : 'Request required Meta permissions and reconnect the account.',
    },
    {
      label: 'Selected Facebook Page',
      status: metaSettings.selectedFacebookPageId ? 'present' : 'missing',
      explanation: metaSettings.selectedFacebookPageName
        ? `Selected page: ${metaSettings.selectedFacebookPageName}.`
        : 'No Facebook Page is selected for organic posts.',
      nextAction: metaSettings.selectedFacebookPageId
        ? 'No action needed.'
        : 'Select a Facebook Page in the Meta connection card.',
    },
    {
      label: 'Selected Instagram Business Account',
      status: metaSettings.selectedInstagramBusinessAccountId ? 'present' : 'missing',
      explanation: metaSettings.selectedInstagramUsername
        ? `Selected Instagram account: @${metaSettings.selectedInstagramUsername}.`
        : 'No Instagram Business Account is selected for organic posts and Reels.',
      nextAction: metaSettings.selectedInstagramBusinessAccountId
        ? 'No action needed.'
        : 'Select an Instagram Business Account in the Meta connection card.',
    },
    {
      label: 'Selected Meta Ad Account',
      status: metaSettings.selectedMetaAdAccountId ? 'present' : 'needs_review',
      explanation: metaSettings.selectedMetaAdAccountName
        ? `Selected ad account: ${metaSettings.selectedMetaAdAccountName}.`
        : 'Only required when paused Meta paid ad draft support is used.',
      nextAction: metaSettings.selectedMetaAdAccountId
        ? 'No action needed.'
        : 'Select a Meta Ad Account before using paid ad drafts.',
    },
    {
      label: 'ads_management permission',
      status: metaSettings.grantedScopes.includes('ads_management') ? 'present' : 'needs_review',
      explanation: metaSettings.grantedScopes.includes('ads_management')
        ? 'ads_management scope is present for paused paid ad draft flows.'
        : 'Only required for paused Meta paid ad draft creation; organic publishing does not need it.',
      nextAction: metaSettings.grantedScopes.includes('ads_management')
        ? 'No action needed.'
        : 'Request ads_management only if paused paid ad drafts are intentionally enabled.',
    },
  ];
  const metaStatus = !metaConnectionReady
    ? 'token_missing'
    : metaSettings.missingOrganicScopes.length > 0
      ? 'permission_missing'
      : providerStatusFromChecklist(metaChecklist);

  const googleConnection = googleConnectionResult.data;
  const googleEnvChecks = [
    envCheck('GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_ID'),
    envCheck('GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_CLIENT_SECRET'),
    envCheck('GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN'),
    envCheck('GOOGLE_ADS_REDIRECT_URI', 'GOOGLE_ADS_REDIRECT_URI'),
    optionalEnvReview(
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
      'No login customer ID is configured. Some manager-account setups require it.'
    ),
    optionalEnvReview(
      'GOOGLE_ADS_API_VERSION',
      'GOOGLE_ADS_API_VERSION',
      'GOOGLE_ADS_API_VERSION is not set. The app uses its default Google Ads API version.'
    ),
  ];
  const googleChecklist: ProviderSetupCheckItem[] = [
    ...googleEnvChecks,
    {
      label: 'OAuth connection',
      status: googleConnection.status === 'connected' ? 'present' : 'missing',
      explanation:
        googleConnection.status === 'connected'
          ? 'Google Ads OAuth connection is active for this workspace.'
          : 'Google Ads OAuth connection is missing or unavailable.',
      nextAction:
        googleConnection.status === 'connected'
          ? 'No action needed.'
          : 'Connect Google Ads OAuth from Campaigns.',
    },
    {
      label: 'Refresh token',
      status: googleConnection.status === 'connected' ? 'present' : 'missing',
      explanation:
        googleConnection.status === 'connected'
          ? 'Refresh token is stored encrypted server-side. The value is not shown.'
          : 'A Google Ads refresh token is required for provider calls.',
      nextAction:
        googleConnection.status === 'connected'
          ? 'No action needed.'
          : 'Reconnect Google Ads OAuth.',
    },
    {
      label: 'Customer ID',
      status: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID') ? 'present' : 'needs_review',
      explanation: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID')
        ? 'A login customer ID is configured server-side. The value is not shown.'
        : 'Customer IDs are item/customer specific. Review Campaigns before creating drafts.',
      nextAction: isEnvPresent('GOOGLE_ADS_LOGIN_CUSTOMER_ID')
        ? 'No action needed.'
        : 'Open Campaigns, verify accessible customers, and set item customer metadata when needed.',
    },
    {
      label: 'Developer token / API approval',
      status: googleConfig.isConfigured ? 'approval_pending' : 'missing',
      explanation: googleConfig.isConfigured
        ? 'Developer token presence is detected, but external API approval cannot be confirmed from env alone.'
        : `Missing Google Ads env vars: ${formatEnvList(googleConfig.missingEnvironmentVariables)}.`,
      nextAction: googleConfig.isConfigured
        ? 'Wait for Google Ads developer token/basic access approval if draft creation is blocked.'
        : 'Add missing Google Ads environment variables and redeploy.',
    },
  ];
  const googleStatus = !googleConfig.isConfigured
    ? 'setup_required'
    : googleConnection.status !== 'connected'
      ? 'token_missing'
      : 'approval_pending';

  const pinterestConnectionReady = pinterestSettings.status === 'connected';
  const pinterestChecklist: ProviderSetupCheckItem[] = [
    envCheck(
      'PINTEREST_APP_ID or PINTEREST_CLIENT_ID',
      isEnvPresent('PINTEREST_APP_ID') ? 'PINTEREST_APP_ID' : 'PINTEREST_CLIENT_ID'
    ),
    envCheck('PINTEREST_APP_SECRET', 'PINTEREST_APP_SECRET'),
    envCheck('PINTEREST_REDIRECT_URI', 'PINTEREST_REDIRECT_URI'),
    {
      label: 'Pinterest OAuth connection',
      status: pinterestConnectionReady ? 'present' : 'missing',
      explanation: pinterestConnectionReady
        ? 'Pinterest OAuth connection is active for this workspace.'
        : 'Pinterest OAuth connection is missing, expired, revoked, or unavailable.',
      nextAction: pinterestConnectionReady
        ? 'No action needed.'
        : 'Connect or reconnect Pinterest from Settings.',
    },
    {
      label: 'Access token validity',
      status: pinterestSettings.tokenStatus === 'valid' ? 'present' : 'missing',
      explanation: `Pinterest token status: ${pinterestSettings.tokenStatus.replace(/_/g, ' ')}.`,
      nextAction:
        pinterestSettings.tokenStatus === 'valid'
          ? 'No action needed.'
          : 'Reconnect Pinterest OAuth.',
    },
    {
      label: 'Selected board',
      status: pinterestSettings.selectedBoardId ? 'present' : 'missing',
      explanation: pinterestSettings.selectedBoardName
        ? `Selected board: ${pinterestSettings.selectedBoardName}.`
        : 'No Pinterest board is selected for Pin publishing.',
      nextAction: pinterestSettings.selectedBoardId
        ? 'No action needed.'
        : 'Select a Pinterest board in the Pinterest connection card.',
    },
    {
      label: 'Pin publishing scopes',
      status: pinterestSettings.missingScopes.length === 0 ? 'present' : 'missing',
      explanation:
        pinterestSettings.missingScopes.length === 0
          ? 'Pinterest scopes are present for the connected account.'
          : `Missing scopes: ${pinterestSettings.missingScopes.join(', ')}.`,
      nextAction:
        pinterestSettings.missingScopes.length === 0
          ? 'No action needed.'
          : 'Reconnect Pinterest after requesting required scopes.',
    },
  ];
  const pinterestStatus = !pinterestConfig.isConfigured
    ? 'setup_required'
    : !pinterestConnectionReady
      ? 'token_missing'
      : !pinterestSettings.selectedBoardId
        ? 'board_missing'
        : providerStatusFromChecklist(pinterestChecklist);

  const linkedinChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'LinkedIn publishing mode',
      status: 'manual_only',
      explanation: 'LinkedIn is currently copy-ready/manual planner only.',
      nextAction: 'Use Copy LinkedIn Package from Content Studio.',
    },
    {
      label: 'Future OAuth integration',
      status: 'manual_only',
      explanation: 'No LinkedIn OAuth or publishing API flow is enabled in this phase.',
      nextAction: 'Plan a future LinkedIn OAuth implementation if needed.',
    },
  ];

  const githubChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'GITHUB_TOKEN',
      status: githubReadiness.tokenPresent ? 'present' : 'missing',
      explanation: githubReadiness.tokenPresent
        ? 'GITHUB_TOKEN is present server-side. The value is not shown.'
        : 'GITHUB_TOKEN is missing. Live repository data will not load.',
      nextAction: githubReadiness.tokenPresent
        ? 'No action needed.'
        : 'Add a fine-grained read-only GITHUB_TOKEN in Vercel and redeploy.',
    },
    {
      label: 'Read-only access',
      status: githubReadiness.tokenPresent ? 'needs_review' : 'missing',
      explanation: githubReadiness.tokenPresent
        ? 'Confirm the GitHub token is fine-grained and read-only for repository metadata, issues, pull requests, and commits.'
        : 'A read-only token is recommended before enabling live GitHub repository views.',
      nextAction: 'Use the least privileged GitHub token possible.',
    },
    {
      label: 'Linked project repositories',
      status: githubLinkedProjects > 0 ? 'present' : 'needs_review',
      explanation:
        githubLinkedProjects > 0
          ? `${githubLinkedProjects} project(s) have GitHub repository metadata.`
          : 'No projects have GitHub repository metadata yet.',
      nextAction:
        githubLinkedProjects > 0
          ? 'Open a project to view read-only repository data.'
          : 'Add a GitHub repository URL to a project.',
    },
  ];

  const schedulerChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'CRON_SECRET',
      status: schedulerReadiness.cronSecretConfigured ? 'present' : 'missing',
      explanation: schedulerReadiness.message,
      nextAction: schedulerReadiness.cronSecretConfigured
        ? 'No action needed.'
        : 'Add CRON_SECRET in Vercel and redeploy.',
    },
    {
      label: CONTENT_STUDIO_SCHEDULER_ROUTE_PATH,
      status: routeExists ? 'present' : 'missing',
      explanation: routeExists
        ? 'Scheduler cron route exists in the app router.'
        : 'Scheduler cron route file was not found.',
      nextAction: routeExists
        ? 'No action needed.'
        : 'Restore the scheduler cron route before enabling Vercel Cron.',
    },
    {
      label: 'vercel.json cron',
      status: vercelCronStatus.exists ? 'present' : 'missing',
      explanation: vercelCronStatus.exists
        ? `Vercel Cron is configured with schedule ${vercelCronStatus.schedule}.`
        : 'Vercel Cron entry was not found.',
      nextAction: vercelCronStatus.exists
        ? 'No action needed.'
        : 'Add the content studio scheduler cron to vercel.json.',
    },
    {
      label: 'Hobby daily schedule',
      status: vercelCronStatus.dailyHobbySchedule ? 'present' : 'needs_review',
      explanation: vercelCronStatus.dailyHobbySchedule
        ? 'Schedule matches 0 9 * * * for Vercel Hobby daily cron.'
        : 'Schedule does not match the requested daily Hobby plan schedule.',
      nextAction: vercelCronStatus.dailyHobbySchedule
        ? 'No action needed.'
        : 'Review whether this project should use 0 9 * * *.',
    },
    {
      label: 'Manual admin scheduler control',
      status: (await dashboardSchedulerButtonFileExists())
        ? 'present'
        : 'needs_review',
      explanation: 'Manager Command Center exposes the existing manual scheduler route for admins.',
      nextAction: 'Use Run Scheduler Now from the dashboard when available.',
    },
    {
      label: 'Recent scheduler attempts',
      status: 'needs_review',
      explanation: 'Recent scheduler runs are summarized through publish attempts and item execution status.',
      nextAction: 'Open Reports for execution summaries after scheduled content runs.',
    },
  ];

  const storageChecklist: ProviderSetupCheckItem[] = [
    {
      label: 'creative-assets bucket',
      status: storageReadiness.isConfigured ? 'present' : 'missing',
      explanation: storageReadiness.message,
      nextAction: storageReadiness.isConfigured
        ? 'No action needed.'
        : 'Create the creative-assets bucket and apply storage policies.',
    },
    {
      label: 'Image upload readiness',
      status: storageReadiness.isConfigured ? 'present' : 'needs_review',
      explanation: storageReadiness.isConfigured
        ? 'Storage bucket is reachable from the current workspace session.'
        : 'Upload readiness cannot be verified until the bucket is reachable.',
      nextAction: storageReadiness.isConfigured
        ? 'Upload a test image from Creative Assets if needed.'
        : 'Create bucket and policies, then test an upload.',
    },
    {
      label: 'Video upload readiness',
      status: storageReadiness.isConfigured ? 'needs_review' : 'missing',
      explanation:
        'Video support depends on upload size, storage policy, and public media URL readiness.',
      nextAction: 'Upload a test Reel video and verify it has a public HTTPS URL.',
    },
    {
      label: 'Public media URL readiness',
      status: storageReadiness.isConfigured ? 'needs_review' : 'missing',
      explanation:
        'Provider publishing requires public HTTPS media URLs. This wizard does not expose URLs.',
      nextAction: 'Use Creative Assets to verify public URL generation for selected assets.',
    },
  ];

  const providers: ProviderSetupWizardProvider[] = [
    buildProvider({
      key: 'openai',
      name: 'OpenAI',
      description: 'OpenAI-only text and image generation readiness.',
      status: openAITextReadiness.isReady ? 'ready' : 'setup_required',
      checklist: openAIChecklist,
      safeLastError: null,
      primaryActionLabel: openAITextReadiness.isReady ? 'View Details' : 'Fix Env',
      primaryActionHref: null,
    }),
    buildProvider({
      key: 'meta',
      name: 'Meta / Instagram / Facebook',
      description: 'Organic publishing targets and paused paid draft prerequisites.',
      status: metaStatus,
      checklist: metaChecklist,
      safeLastError: safeErrorMessage(metaSettings.error) ?? lastErrorForProvider('meta'),
      primaryActionLabel: metaConnectionReady ? 'View Details' : 'Connect Meta',
      primaryActionHref: metaConnectionReady ? null : '/api/ads/meta/connect?returnTo=settings',
    }),
    buildProvider({
      key: 'google_ads',
      name: 'Google Ads',
      description: 'OAuth, customer access, and paused campaign draft approval status.',
      status: googleStatus,
      checklist: googleChecklist,
      safeLastError: googleConnectionResult.error ?? lastErrorForProvider('google_ads'),
      primaryActionLabel:
        googleConnection.status === 'connected' ? 'View Details' : 'Connect Google Ads',
      primaryActionHref:
        googleConnection.status === 'connected'
          ? null
          : '/api/ads/google/connect?returnTo=campaigns',
    }),
    buildProvider({
      key: 'pinterest',
      name: 'Pinterest',
      description: 'Organic Pin publishing setup and selected board readiness.',
      status: pinterestStatus,
      checklist: pinterestChecklist,
      safeLastError: safeErrorMessage(pinterestSettings.error) ?? lastErrorForProvider('pinterest'),
      primaryActionLabel: pinterestConnectionReady ? 'View Details' : 'Connect Pinterest',
      primaryActionHref: pinterestConnectionReady
        ? null
        : '/api/ads/pinterest/connect?returnTo=settings',
    }),
    buildProvider({
      key: 'linkedin',
      name: 'LinkedIn',
      description: 'Manual planner and copy-ready workflow.',
      status: 'manual_only',
      checklist: linkedinChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open LinkedIn Planner',
      primaryActionHref: '/dashboard/content-studio?tab=linkedin',
    }),
    buildProvider({
      key: 'github',
      name: 'GitHub Integration',
      description: 'Read-only repository visibility for projects, releases, issues, commits, and pull requests.',
      status: githubReadiness.tokenPresent ? 'ready' : 'setup_required',
      checklist: githubChecklist,
      safeLastError: projectsResult.error,
      primaryActionLabel: githubLinkedProjects > 0 ? 'Open Projects' : 'Link Repository',
      primaryActionHref: '/dashboard/projects',
    }),
    buildProvider({
      key: 'scheduler',
      name: 'Scheduler',
      description: 'Secure cron and manual scheduler readiness.',
      status: providerStatusFromChecklist(schedulerChecklist),
      checklist: schedulerChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open Reports',
      primaryActionHref: '/dashboard/reports',
    }),
    buildProvider({
      key: 'supabase_storage',
      name: 'Supabase Storage',
      description: 'Creative Assets bucket and public media URL readiness.',
      status: providerStatusFromChecklist(storageChecklist),
      checklist: storageChecklist,
      safeLastError: null,
      primaryActionLabel: 'Open Creative Assets',
      primaryActionHref: '/dashboard/creative-assets',
    }),
  ];

  const summary = {
    ready: providers.filter((provider) => provider.status === 'ready').length,
    missingSetup: providers.filter((provider) =>
      ['setup_required', 'token_missing', 'permission_missing', 'customer_id_missing', 'board_missing', 'error'].includes(
        provider.status
      )
    ).length,
    approvalPending: providers.filter((provider) => provider.status === 'approval_pending').length,
    manualOnly: providers.filter((provider) => provider.status === 'manual_only').length,
    criticalBlockers: providers.filter((provider) =>
      ['setup_required', 'token_missing', 'permission_missing', 'error'].includes(provider.status)
    ).length,
    total: providers.length,
  };

  const blockerPriority: ProviderSetupStatus[] = [
    'error',
    'setup_required',
    'token_missing',
    'permission_missing',
    'board_missing',
    'customer_id_missing',
    'approval_pending',
    'quota_limit',
    'credits_required',
    'needs_review',
  ];
  const nextProvider =
    blockerPriority
      .map((status) => providers.find((provider) => provider.status === status))
      .find((provider): provider is ProviderSetupWizardProvider => Boolean(provider)) ?? null;
  const nextMissingCheck = nextProvider?.checklist.find((item) =>
    ['missing', 'approval_pending', 'needs_review', 'error'].includes(item.status)
  );

  return {
    error: null,
    generatedAt: new Date().toISOString(),
    summary,
    nextBestAction: nextProvider
      ? {
          title: nextMissingCheck?.nextAction ?? `Review ${nextProvider.name}.`,
          detail: nextMissingCheck?.explanation ?? nextProvider.description,
          providerKey: nextProvider.key,
          href: nextProvider.primaryActionHref,
        }
      : {
          title: 'Provider setup is in good shape.',
          detail: 'Review any needs-review items before high-volume production use.',
          providerKey: null,
          href: null,
        },
    providers,
  };
}
