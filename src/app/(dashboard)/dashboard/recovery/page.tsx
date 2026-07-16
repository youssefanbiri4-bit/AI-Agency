import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  LifeBuoy,
  RadioTower,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import { checkOpenAITextProviderReadiness } from '@/lib/ai/text-provider';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type {
  ContentStudioPlatform,
  ContentStudioPublishAttemptRecord,
  CreativeAssetRecord,
} from '@/types/database';
import {
  RecoveryClient,
  type ProviderBlockerGroup,
  type RecoveryIssue,
  type RecoveryIssueCategory,
} from './RecoveryClient';

const issueStatuses = new Set([
  'failed',
  'setup_required',
  'approval_pending',
  'token_missing',
  'quota_limit',
  'manual_only',
  'unsupported',
  'error',
]);

function safeText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 700);
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

function providerForPlatform(platform: ContentStudioPlatform): RecoveryIssue['provider'] {
  switch (platform) {
    case 'google_ads':
      return 'Google Ads';
    case 'pinterest':
      return 'Pinterest';
    case 'linkedin':
      return 'LinkedIn';
    case 'facebook':
    case 'instagram':
      return 'Meta';
    default:
      return 'Media';
  }
}

function setupHrefForProvider(provider: RecoveryIssue['provider']) {
  if (provider === 'Media') return '/dashboard/creative-assets';
  return '/dashboard/settings#provider-setup-wizard';
}

function categoryFromStatus(status: string | null | undefined): RecoveryIssueCategory | null {
  switch (status) {
    case 'failed':
    case 'error':
      return 'failed';
    case 'setup_required':
      return 'setup_required';
    case 'approval_pending':
      return 'approval_pending';
    case 'token_missing':
      return 'token_missing';
    case 'quota_limit':
      return 'quota_limit';
    case 'manual_only':
      return 'manual_only';
    case 'unsupported':
      return 'unsupported';
    default:
      return null;
  }
}

function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readObject(asset.metadata).video)
  );
}

function isPublicUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.pathname.includes('/storage/v1/object/sign/') && !url.searchParams.has('token');
  } catch {
    return false;
  }
}

function readVideoPublicUrl(asset: CreativeAssetRecord) {
  const video = readObject(readObject(asset.metadata).video);
  return safeString(video.public_url) ?? safeString(video.public_video_url);
}

function getLinkedAssets(item: ContentStudioItemWithAssets, assetsById: Map<string, CreativeAssetRecord>) {
  return item.asset_ids.map((id) => assetsById.get(id)).filter((asset): asset is CreativeAssetRecord => Boolean(asset));
}

function latestAttemptsByItem(attempts: ContentStudioPublishAttemptRecord[]) {
  const map = new Map<string, ContentStudioPublishAttemptRecord>();

  for (const attempt of attempts) {
    if (!attempt.content_item_id) continue;
    if (!map.has(attempt.content_item_id)) {
      map.set(attempt.content_item_id, attempt);
    }
  }

  return map;
}

function issueReport(issue: Omit<RecoveryIssue, 'reportText'>) {
  return [
    `Issue: ${issue.title}`,
    `Provider: ${issue.provider}`,
    `Category: ${issue.category}`,
    `Status: ${issue.status}`,
    `Reason: ${issue.reason}`,
    `Next action: ${issue.nextAction}`,
    issue.lastAttemptAt ? `Last attempt: ${issue.lastAttemptAt}` : 'Last attempt: none logged',
    issue.missing.length > 0 ? `Missing: ${issue.missing.join(', ')}` : 'Missing: none listed',
  ].join('\n');
}

function makeIssue(input: Omit<RecoveryIssue, 'reportText'>): RecoveryIssue {
  return {
    ...input,
    reportText: issueReport(input),
  };
}

function defaultFixSteps(category: RecoveryIssueCategory, provider: RecoveryIssue['provider'], reason: string) {
  if (category === 'approval_pending') {
    return provider === 'Google Ads'
      ? ['Wait for Google Ads developer token approval.', 'Open Provider Setup to verify OAuth and customer account selection.']
      : ['Wait for platform approval or complete the provider review requirement.', 'Open Provider Setup and verify the selected account.'];
  }

  if (category === 'manual_only') {
    return ['Copy the package from the content item.', 'Publish or hand off manually outside AgentFlow AI.'];
  }

  if (category === 'unsupported') {
    return ['Open the content item and use the copy-ready package.', 'This content type is not supported for automatic publishing yet.'];
  }

  if (category === 'token_missing' || category === 'provider_connection_missing') {
    return ['Reconnect the provider in Provider Setup.', 'Confirm the workspace has the required account selected.'];
  }

  if (category === 'quota_limit') {
    return ['Add quota or credits for the AI/provider account.', 'Use the configured fallback provider if available.'];
  }

  return [reason, `Open ${provider === 'Media' ? 'Creative Assets' : 'Provider Setup'} and resolve the listed blocker.`];
}

function buildItemIssues({
  items,
  attempts,
  assets,
}: {
  items: ContentStudioItemWithAssets[];
  attempts: ContentStudioPublishAttemptRecord[];
  assets: CreativeAssetRecord[];
}) {
  const issues: RecoveryIssue[] = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const attemptsByItem = latestAttemptsByItem(attempts);

  for (const item of items) {
    const latestAttempt = attemptsByItem.get(item.id) ?? null;
    const provider = providerForPlatform(item.platform);
    const contentHref = `/dashboard/content-studio?item=${item.id}`;
    const statusCategory = categoryFromStatus(item.status) ?? categoryFromStatus(item.provider_status);

    if (statusCategory) {
      const reason = safeText(
        item.provider_error ?? latestAttempt?.error_message,
        `Item is ${statusCategory.replace(/_/g, ' ')}.`
      );
      issues.push(makeIssue({
        id: `item-${item.id}-${statusCategory}`,
        itemId: item.id,
        title: item.title,
        platform: item.platform,
        provider,
        contentType: item.content_type,
        status: item.status,
        category: statusCategory,
        reason,
        lastAttemptAt: latestAttempt?.created_at ?? item.last_provider_action_at,
        lastAttemptStatus: latestAttempt?.status ?? item.provider_status,
        nextAction:
          statusCategory === 'manual_only'
            ? 'Open the item and use the copy-ready manual workflow.'
            : statusCategory === 'approval_pending'
              ? 'Open Provider Setup and verify approval/account state.'
              : 'Open the content item or provider setup to resolve the blocker.',
        fixSteps: defaultFixSteps(statusCategory, provider, reason),
        missing: latestAttempt?.status ? [latestAttempt.status] : item.provider_status ? [item.provider_status] : [],
        retryable: statusCategory === 'failed' && provider !== 'LinkedIn',
        contentHref,
        setupHref: setupHrefForProvider(provider),
        creativeHref: null,
      }));
    }

    const schedulerFailed = item.scheduled_execution_status === 'failed' || Boolean(item.scheduled_execution_error);
    const schedulerBlocked =
      item.status === 'scheduled' &&
      (item.provider_status === 'setup_required' ||
        item.provider_status === 'approval_pending' ||
        item.provider_status === 'token_missing');

    if (schedulerFailed || schedulerBlocked) {
      const reason = safeText(
        item.scheduled_execution_error ?? item.provider_error,
        schedulerFailed ? 'Scheduled execution failed.' : 'Scheduled item is blocked by provider readiness.'
      );
      issues.push(makeIssue({
        id: `scheduler-${item.id}`,
        itemId: item.id,
        title: item.title,
        platform: item.platform,
        provider: 'Scheduler',
        contentType: item.content_type,
        status: item.scheduled_execution_status ?? item.status,
        category: 'scheduler_failed',
        reason,
        lastAttemptAt: item.scheduled_execution_finished_at ?? item.scheduled_execution_started_at ?? latestAttempt?.created_at ?? null,
        lastAttemptStatus: item.scheduled_execution_status,
        nextAction: 'Open the item, fix provider readiness, then use existing scheduler controls.',
        fixSteps: ['Review the item schedule and provider readiness.', 'Open Provider Setup for missing account/token/approval blockers.', 'Run Scheduler Now from existing admin controls after setup is ready.'],
        missing: [item.provider_status ?? 'scheduler'],
        retryable: false,
        contentHref,
        setupHref: '/dashboard/settings#provider-setup-wizard',
        creativeHref: null,
      }));
    }

    const linkedAssets = getLinkedAssets(item, assetsById);
    const requiresImage = item.content_type === 'instagram_post' || item.content_type === 'pinterest_pin';
    const requiresVideo = item.content_type === 'instagram_reel';

    if ((requiresImage || requiresVideo) && linkedAssets.length === 0) {
      issues.push(makeIssue({
        id: `asset-missing-${item.id}`,
        itemId: item.id,
        title: item.title,
        platform: item.platform,
        provider: 'Media',
        contentType: item.content_type,
        status: item.status,
        category: 'asset_missing',
        reason: requiresVideo ? 'A linked public video asset is required.' : 'A linked public image asset is required.',
        lastAttemptAt: latestAttempt?.created_at ?? null,
        lastAttemptStatus: latestAttempt?.status ?? null,
        nextAction: requiresVideo ? 'Link a public video asset to this Reel.' : 'Link a public image asset to this item.',
        fixSteps: ['Open the content item.', 'Link a suitable Creative Asset.', 'Confirm the media URL is public HTTPS before retrying from the item workflow.'],
        missing: [requiresVideo ? 'video asset' : 'image asset'],
        retryable: false,
        contentHref,
        setupHref: '/dashboard/creative-assets',
        creativeHref: '/dashboard/creative-assets',
      }));
    }

    if (requiresImage && linkedAssets.length > 0 && !linkedAssets.some((asset) => isPublicUrl(asset.image_url))) {
      issues.push(makeIssue({
        id: `public-url-missing-${item.id}`,
        itemId: item.id,
        title: item.title,
        platform: item.platform,
        provider: 'Media',
        contentType: item.content_type,
        status: item.status,
        category: 'public_url_missing',
        reason: 'Linked image assets do not have a public HTTPS URL.',
        lastAttemptAt: latestAttempt?.created_at ?? null,
        lastAttemptStatus: latestAttempt?.status ?? null,
        nextAction: 'Use a public uploaded image asset before retrying.',
        fixSteps: ['Open Creative Assets.', 'Upload or regenerate a public image asset.', 'Relink it to the content item.'],
        missing: ['public image URL'],
        retryable: false,
        contentHref,
        setupHref: '/dashboard/creative-assets',
        creativeHref: '/dashboard/creative-assets',
      }));
    }

    if (
      requiresVideo &&
      linkedAssets.length > 0 &&
      !linkedAssets.some((asset) => isVideoAsset(asset) && isPublicUrl(readVideoPublicUrl(asset)))
    ) {
      issues.push(makeIssue({
        id: `public-video-url-missing-${item.id}`,
        itemId: item.id,
        title: item.title,
        platform: item.platform,
        provider: 'Media',
        contentType: item.content_type,
        status: item.status,
        category: 'public_url_missing',
        reason: 'Linked video assets do not have a public HTTPS video URL.',
        lastAttemptAt: latestAttempt?.created_at ?? null,
        lastAttemptStatus: latestAttempt?.status ?? null,
        nextAction: 'Link a public HTTPS video asset to this Reel.',
        fixSteps: ['Open Creative Assets.', 'Upload a public video asset.', 'Relink it to the Reel before retrying.'],
        missing: ['public video URL'],
        retryable: false,
        contentHref,
        setupHref: '/dashboard/creative-assets',
        creativeHref: '/dashboard/creative-assets',
      }));
    }
  }

  for (const attempt of attempts) {
    if (!issueStatuses.has(attempt.status)) continue;
    if (attempt.content_item_id && items.some((item) => item.id === attempt.content_item_id)) continue;

    const category = categoryFromStatus(attempt.status) ?? 'failed';
    const provider =
      attempt.provider === 'google_ads'
        ? 'Google Ads'
        : attempt.provider === 'pinterest'
          ? 'Pinterest'
          : attempt.provider === 'linkedin'
            ? 'LinkedIn'
            : 'Meta';
    const reason = safeText(attempt.error_message, `Publish attempt is ${attempt.status.replace(/_/g, ' ')}.`);

    issues.push(makeIssue({
      id: `attempt-${attempt.id}`,
      itemId: attempt.content_item_id,
      title: 'Workspace-level provider attempt',
      platform: attempt.provider === 'google_ads' ? 'google_ads' : attempt.provider === 'pinterest' ? 'pinterest' : 'facebook',
      provider,
      contentType: attempt.action_type,
      status: attempt.status,
      category,
      reason,
      lastAttemptAt: attempt.created_at,
      lastAttemptStatus: attempt.status,
      nextAction: 'Open Provider Setup and review the workspace-level attempt.',
      fixSteps: defaultFixSteps(category, provider, reason),
      missing: [attempt.status],
      retryable: false,
      contentHref: null,
      setupHref: setupHrefForProvider(provider),
      creativeHref: null,
    }));
  }

  return issues;
}

function buildProviderReadinessIssues(input: {
  facebookState?: string;
  instagramState?: string;
  googleState?: string;
  pinterestState?: string;
  schedulerConfigured: boolean;
  schedulerMessage: string;
  openAIStatus: string;
  openAIMessage: string;
}) {
  const issues: RecoveryIssue[] = [];
  const providerRows: Array<{
    id: string;
    provider: RecoveryIssue['provider'];
    platform: RecoveryIssue['platform'];
    state: string | undefined;
    message: string;
  }> = [
    { id: 'meta-facebook', provider: 'Meta', platform: 'facebook', state: input.facebookState, message: 'Facebook provider setup is incomplete.' },
    { id: 'meta-instagram', provider: 'Meta', platform: 'instagram', state: input.instagramState, message: 'Instagram provider setup is incomplete.' },
    { id: 'google-ads', provider: 'Google Ads', platform: 'google_ads', state: input.googleState, message: 'Google Ads provider setup is incomplete.' },
    { id: 'pinterest', provider: 'Pinterest', platform: 'pinterest', state: input.pinterestState, message: 'Pinterest provider setup is incomplete.' },
  ];

  for (const row of providerRows) {
    const category = categoryFromStatus(row.state);
    if (!category) continue;
    issues.push(makeIssue({
      id: `provider-${row.id}-${category}`,
      itemId: null,
      title: `${row.provider} setup blocker`,
      platform: row.platform,
      provider: row.provider,
      contentType: 'provider_setup',
      status: row.state ?? category,
      category: category === 'setup_required' ? 'provider_connection_missing' : category,
      reason: row.message,
      lastAttemptAt: null,
      lastAttemptStatus: row.state ?? null,
      nextAction: 'Open Provider Setup and complete the missing connection or account selection.',
      fixSteps: ['Open Provider Setup.', 'Connect the provider and select the required account/page/board/customer.', 'Return to the content item and retry from the existing workflow.'],
      missing: [row.state ?? category],
      retryable: false,
      contentHref: null,
      setupHref: '/dashboard/settings#provider-setup-wizard',
      creativeHref: null,
    }));
  }

  if (!input.schedulerConfigured) {
    issues.push(makeIssue({
      id: 'scheduler-setup-required',
      itemId: null,
      title: 'Scheduler setup required',
      platform: 'scheduler',
      provider: 'Scheduler',
      contentType: 'scheduler',
      status: 'setup_required',
      category: 'setup_required',
      reason: input.schedulerMessage,
      lastAttemptAt: null,
      lastAttemptStatus: 'setup_required',
      nextAction: 'Configure scheduler environment and Vercel Cron.',
      fixSteps: ['Open Provider Setup or deployment settings.', 'Confirm CRON_SECRET and Vercel Cron are configured.', 'Use existing scheduler controls after redeploy.'],
      missing: ['scheduler configuration'],
      retryable: false,
      contentHref: null,
      setupHref: '/dashboard/settings#provider-setup-wizard',
      creativeHref: null,
    }));
  }

  for (const ai of [
    { id: 'openai' as const, provider: 'OpenAI' as const, status: input.openAIStatus, message: input.openAIMessage },
  ]) {
    const category = categoryFromStatus(ai.status) ?? (ai.status === 'credits_required' ? 'quota_limit' : null);
    if (!category) continue;
    issues.push(makeIssue({
      id: `ai-${ai.id}-${category}`,
      itemId: null,
      title: `${ai.provider} AI generation blocker`,
      platform: ai.id,
      provider: ai.provider,
      contentType: 'ai_generation',
      status: ai.status,
      category,
      reason: ai.message,
      lastAttemptAt: null,
      lastAttemptStatus: ai.status,
      nextAction: 'Check OPENAI_API_KEY, OpenAI billing, quota, and model access.',
      fixSteps: defaultFixSteps(category, ai.provider, ai.message),
      missing: [ai.status],
      retryable: false,
      contentHref: null,
      setupHref: '/dashboard/settings#provider-setup-wizard',
      creativeHref: null,
    }));
  }

  return issues;
}

function buildProviderBlockers(issues: RecoveryIssue[]): ProviderBlockerGroup[] {
  const providers: RecoveryIssue['provider'][] = ['Meta', 'Google Ads', 'Pinterest', 'OpenAI', 'LinkedIn', 'Scheduler', 'Media'];

  return providers.map((provider) => {
    const providerIssues = issues.filter((issue) => issue.provider === provider);
    const counts = providerIssues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.category] = (acc[issue.category] ?? 0) + 1;
      return acc;
    }, {});
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No blockers';

    return {
      provider,
      count: providerIssues.length,
      mostCommonBlocker: mostCommon.replace(/_/g, ' '),
      nextAction:
        provider === 'Media'
          ? 'Open Creative Assets and fix missing public media.'
          : provider === 'Scheduler'
            ? 'Review scheduled item readiness and existing scheduler controls.'
            : provider === 'LinkedIn'
              ? 'Use manual-only copy-ready workflow.'
              : 'Open Provider Setup and resolve account/token/approval blockers.',
    };
  });
}

async function listPublishAttempts(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(150);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: error?.message ?? null,
  };
}

export default async function RecoveryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/recovery');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const workspaceId = workspaceResult.data.id;
  const [
    itemsResult,
    assetsResult,
    attemptsResult,
    facebookReadiness,
    instagramReadiness,
    googleReadiness,
    pinterestReadiness,
  ] = await Promise.all([
    listContentStudioItemsForWorkspace(workspaceId, supabase, { limit: 1000 }),
    listCreativeAssetsForWorkspace(workspaceId, undefined, supabase, { limit: 1000 }),
    listPublishAttempts(workspaceId),
    getContentStudioProviderReadiness({ workspaceId, userId: user.id, contentType: 'facebook_post' }),
    getContentStudioProviderReadiness({ workspaceId, userId: user.id, contentType: 'instagram_post' }),
    getContentStudioProviderReadiness({ workspaceId, userId: user.id, contentType: 'google_ads_campaign_draft' }),
    getContentStudioProviderReadiness({ workspaceId, userId: user.id, contentType: 'pinterest_pin' }),
  ]);
  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const openAIReadiness = checkOpenAITextProviderReadiness();
  const items = itemsResult.error ? [] : itemsResult.data;
  const assets = assetsResult.error ? [] : assetsResult.data;
  const attempts = attemptsResult.error ? [] : attemptsResult.data;
  const issues = [
    ...buildItemIssues({ items, attempts, assets }),
    ...buildProviderReadinessIssues({
      facebookState: facebookReadiness.state,
      instagramState: instagramReadiness.state,
      googleState: googleReadiness.state,
      pinterestState: pinterestReadiness.state,
      schedulerConfigured: schedulerReadiness.isConfigured,
      schedulerMessage: schedulerReadiness.message,
      openAIStatus: openAIReadiness.status,
      openAIMessage: openAIReadiness.message,
    }),
  ];
  const providerBlockers = buildProviderBlockers(issues);
  const schedulerIssues = issues.filter((issue) => issue.provider === 'Scheduler' || issue.category === 'scheduler_failed');
  const failedCount = issues.filter((issue) => issue.category === 'failed' || issue.category === 'scheduler_failed').length;
  const setupCount = issues.filter((issue) => issue.category === 'setup_required' || issue.category === 'provider_connection_missing').length;
  const approvalCount = issues.filter((issue) => issue.category === 'approval_pending').length;
  const tokenMissingCount = issues.filter((issue) => issue.category === 'token_missing').length;
  const manualOnlyCount = issues.filter((issue) => issue.category === 'manual_only').length;
  const unsupportedCount = issues.filter((issue) => issue.category === 'unsupported').length;
  const retryableCount = issues.filter((issue) => issue.retryable).length;
  const pageError = workspaceResult.error || itemsResult.error || assetsResult.error || attemptsResult.error;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Recovery Center"
        description="Find failed, blocked, setup-required, approval-pending, and manual-only items in one place."
      />

      {pageError ? (
        <Notice tone="warning" title="Recovery data notice">
          {pageError}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          ['Failed', failedCount],
          ['Setup Required', setupCount],
          ['Approval Pending', approvalCount],
          ['Token Missing', tokenMissingCount],
          ['Manual Only', manualOnlyCount],
          ['Unsupported', unsupportedCount],
          ['Scheduler Issues', schedulerIssues.length],
        ].map(([label, value]) => (
          <span key={label} className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-black/56">
            {label}: {value}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Issues" value={issues.length} icon={LifeBuoy} tone="neutral" />
        <StatCard title="Failed Items" value={failedCount} icon={AlertTriangle} tone="accent" />
        <StatCard title="Setup Required" value={setupCount} icon={Wrench} tone="brand" />
        <StatCard title="Approval Pending" value={approvalCount} icon={Clock} tone="neutral" />
        <StatCard title="Token Missing" value={tokenMissingCount} icon={ShieldAlert} tone="accent" />
        <StatCard title="Manual Only" value={manualOnlyCount} icon={LifeBuoy} tone="dark" />
        <StatCard title="Unsupported" value={unsupportedCount} icon={RadioTower} tone="neutral" />
        <StatCard title="Retryable Issues" value={retryableCount} icon={LifeBuoy} tone="brand" />
      </div>

      <RecoveryClient
        issues={issues}
        providerBlockers={providerBlockers}
        schedulerIssues={schedulerIssues}
      />
    </div>
  );
}
