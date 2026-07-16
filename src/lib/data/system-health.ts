import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
  getSupabaseAdmin,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { listContentStudioItemsForWorkspace } from '@/features/content-studio/data/content-studio';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { listTasks } from '@/features/tasks/data/tasks';
import { listProjectsForWorkspace } from '@/lib/data/projects';
import { listReleasesForWorkspace } from '@/lib/data/releases';
import { getMetaConnectionStatus, getGoogleAdsConnectionStatus } from '@/lib/data/ad-connections';
import { getGoogleAdsConfigReadiness } from '@/lib/ads/google-ads';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { getContentStudioSchedulerReadiness } from '@/lib/content-studio/scheduler';
import {
  checkOpenAITextProviderReadiness,
  getAITextProviderConfig,
} from '@/lib/ai/text-provider';
import { getGitHubReadiness } from '@/lib/github';
import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type {
  ContentStudioPublishAttemptRecord,
  ContentStudioStatus,
  CreativeAssetRecord,
  Database,
} from '@/types/database';
import type { TaskStatus } from '@/types';

export type HealthStatus =
  | 'ready'
  | 'setup_required'
  | 'needs_review'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

export type EnvPresenceStatus = 'present' | 'missing' | 'optional' | 'needs_review';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface HealthCheckRow {
  area: string;
  check: string;
  status: HealthStatus;
  details: string;
  nextAction: string;
}

export interface ProviderHealth {
  name: string;
  status: HealthStatus;
  details: string[];
  missing: string[];
  href: string;
  cta: string;
}

export interface HealthAction {
  id: string;
  priority: IssuePriority;
  title: string;
  reason: string;
  relatedArea: string;
  href: string;
  cta: string;
}

export interface EnvCheck {
  name: string;
  status: EnvPresenceStatus;
  note: string;
}

export interface SystemHealthSummary {
  score: number;
  label: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';
  topBlockers: string[];
  badges: Record<'healthy' | 'needsSetup' | 'approvalPending' | 'errors' | 'manualOnly', number>;
  checks: HealthCheckRow[];
  providers: ProviderHealth[];
  envChecks: EnvCheck[];
  actions: HealthAction[];
  reportText: string;
  dataNotice: string | null;
  metrics: {
    content: Record<'total' | 'ready' | 'scheduled' | 'published' | 'failed' | 'setup_required' | 'approval_pending' | 'manual_only', number>;
    attempts: Record<'total' | 'succeeded' | 'failed' | 'setup_required' | 'approval_pending' | 'manual_only' | 'unsupported', number>;
    tasks: Record<'pending' | 'processing' | 'needs_review' | 'completed' | 'failed', number>;
    projects: Record<'active' | 'ready_to_deploy' | 'deployed' | 'needs_review', number> & { total: number };
    releases: Record<'failed' | 'ready_to_deploy' | 'deployed', number> & { total: number; latest: string };
    recovery: Record<'totalIssues' | 'criticalBlockers' | 'retryableIssues', number>;
    assets: Record<'total' | 'missingMedia' | 'linked' | 'unlinked', number>;
  };
}

type HealthInput = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
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

const taskStatuses: TaskStatus[] = ['draft', 'pending', 'processing', 'needs_review', 'completed', 'failed', 'cancelled'];

const readinessStatuses: HealthStatus[] = [
  'ready',
  'setup_required',
  'needs_review',
  'approval_pending',
  'quota_limit',
  'token_missing',
  'manual_only',
  'unsupported',
  'error',
];

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
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function safeMessage(value: unknown, fallback = 'No additional detail available.') {
  const text = safeString(value) ?? fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/("(?:access_token|refresh_token|client_secret|api_key|authorization)"\s*:\s*)"[^"]+"/gi, '$1"[redacted]"')
    .slice(0, 360);
}

function getEnvStatus(name: string, optional = false): EnvPresenceStatus {
  return process.env[name]?.trim() ? 'present' : optional ? 'optional' : 'missing';
}

function getPinterestIdStatus(): EnvPresenceStatus {
  return process.env.PINTEREST_APP_ID?.trim() || process.env.PINTEREST_CLIENT_ID?.trim()
    ? 'present'
    : 'missing';
}

function envCheck(name: string, note: string, optional = false): EnvCheck {
  return {
    name,
    status: getEnvStatus(name, optional),
    note,
  };
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

function getReadinessState(value: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean } | null | undefined): HealthStatus {
  if (!value) return 'needs_review';
  if (value.state && readinessStatuses.includes(value.state as HealthStatus)) return value.state as HealthStatus;
  if (value.status === 'configured' || value.status === 'ready' || value.isConfigured || value.isReady) return 'ready';
  if (value.status === 'approval_pending') return 'approval_pending';
  if (value.status === 'quota_limit') return 'quota_limit';
  if (value.status === 'error') return 'error';
  return 'setup_required';
}

async function listPublishAttempts(workspaceId: string) {
  const { client, error } = getSupabaseAdmin();
  if (!client) return { data: [] as ContentStudioPublishAttemptRecord[], error };

  const { data, error: selectError } = await client
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(250);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: selectError?.message ?? null,
  };
}

async function tableAccessible(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  table: string
) {
  const client = supabase as unknown as {
    from: (name: string) => {
      select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  return error?.message ?? null;
}

async function getStorageBucketStatus() {
  const { client, error } = getSupabaseAdmin();
  if (!client) {
    return { status: 'needs_review' as HealthStatus, details: error ?? 'Supabase admin client is unavailable.' };
  }

  const { data, error: bucketError } = await client.storage.getBucket('creative-assets');

  if (bucketError) {
    return { status: 'setup_required' as HealthStatus, details: bucketError.message };
  }

  return {
    status: data ? ('ready' as HealthStatus) : ('setup_required' as HealthStatus),
    details: data ? 'creative-assets bucket is available.' : 'creative-assets bucket was not found.',
  };
}

function cronRouteExists() {
  return existsSync(join(process.cwd(), 'src/app/api/cron/content-studio-scheduler/route.ts'));
}

function vercelCronExists() {
  try {
    const vercelConfig = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: Array<{ path?: string; schedule?: string }>;
    };
    return Boolean(vercelConfig.crons?.some((cron) => cron.path === '/api/cron/content-studio-scheduler'));
  } catch {
    return false;
  }
}

function addCheck(
  checks: HealthCheckRow[],
  area: string,
  check: string,
  status: HealthStatus,
  details: string,
  nextAction: string
) {
  checks.push({ area, check, status, details: safeMessage(details), nextAction });
}

function addAction(
  actions: HealthAction[],
  input: Omit<HealthAction, 'id'>
) {
  actions.push({
    id: `${input.relatedArea}-${input.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    ...input,
  });
}

function rankActions(actions: HealthAction[]) {
  const rank: Record<IssuePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title))
    .slice(0, 12);
}

function calculateScore(checks: HealthCheckRow[]) {
  const scorable = checks.filter((check) => check.status !== 'manual_only' && check.status !== 'unsupported');
  if (scorable.length === 0) return 0;

  const points = scorable.reduce((total, check) => {
    if (check.status === 'ready') return total + 1;
    if (check.status === 'approval_pending' || check.status === 'needs_review') return total + 0.35;
    return total;
  }, 0);

  return Math.round((points / scorable.length) * 100);
}

function scoreLabel(score: number): SystemHealthSummary['label'] {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

function buildReportText(summary: Omit<SystemHealthSummary, 'reportText'>) {
  return [
    '# AgentFlow AI System Health Report',
    '',
    `Overall score: ${summary.score}% (${summary.label})`,
    '',
    '## Provider Statuses',
    ...summary.providers.map((provider) => `- ${provider.name}: ${provider.status} - ${provider.details.join(' ')}`),
    '',
    '## Missing Setup / Top Blockers',
    ...(summary.topBlockers.length > 0 ? summary.topBlockers.map((blocker) => `- ${blocker}`) : ['- None detected.']),
    '',
    '## Content Summary',
    ...Object.entries(summary.metrics.content).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Publishing Attempts',
    ...Object.entries(summary.metrics.attempts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Tasks / Projects / Releases',
    ...Object.entries(summary.metrics.tasks).map(([key, value]) => `- tasks.${key}: ${value}`),
    ...Object.entries(summary.metrics.projects).map(([key, value]) => `- projects.${key}: ${value}`),
    ...Object.entries(summary.metrics.releases).map(([key, value]) => `- releases.${key}: ${value}`),
    '',
    '## Next Actions',
    ...(summary.actions.length > 0
      ? summary.actions.map((action) => `- ${action.priority}: ${action.title} (${action.reason})`)
      : ['- No ranked actions detected.']),
    '',
    '## Safety Notes',
    '- No secret values, API keys, tokens, or refresh tokens are included.',
    '- Diagnostics are read-only and scoped to the active workspace.',
    '- Provider publishing logic, scheduler core logic, task execution, callbacks, webhooks, n8n, and ads_management are not changed by this report.',
  ].join('\n');
}

export async function getSystemHealthSummary({
  supabase,
  workspaceId,
  userId,
}: HealthInput): Promise<SystemHealthSummary> {
  const checks: HealthCheckRow[] = [];
  const actions: HealthAction[] = [];
  const dataNotices: string[] = [];

  const [
    membershipResult,
    contentItemsResult,
    creativeAssetsResult,
    attemptsResult,
    tasksResult,
    projectsResult,
    releasesResult,
    metaConnectionResult,
    googleAdsConnectionResult,
    storageBucket,
  ] = await Promise.all([
    getCurrentWorkspaceMembership(supabase, workspaceId, userId),
    listContentStudioItemsForWorkspace(workspaceId, supabase),
    listCreativeAssetsForWorkspace(workspaceId, undefined, supabase),
    listPublishAttempts(workspaceId),
    listTasks({ workspaceId }, supabase),
    listProjectsForWorkspace(workspaceId, supabase),
    listReleasesForWorkspace(workspaceId, supabase),
    getMetaConnectionStatus(workspaceId, userId),
    getGoogleAdsConnectionStatus(workspaceId, userId),
    getStorageBucketStatus(),
  ]);

  for (const error of [
    membershipResult.error,
    contentItemsResult.error,
    creativeAssetsResult.error,
    attemptsResult.error,
    tasksResult.error,
    projectsResult.error,
    releasesResult.error,
    metaConnectionResult.error,
    googleAdsConnectionResult.error,
  ]) {
    if (error) dataNotices.push(error);
  }

  const contentItems = contentItemsResult.data;
  const creativeAssets = creativeAssetsResult.data;
  const publishAttempts = attemptsResult.data;
  const tasks = tasksResult.data;
  const projects = projectsResult.data;
  const releases = releasesResult.data;

  addCheck(checks, 'Authentication & Workspace', 'User authenticated', userId ? 'ready' : 'error', userId ? 'Authenticated user is available.' : 'No authenticated user found.', 'Sign in again.');
  addCheck(checks, 'Authentication & Workspace', 'Active workspace exists', workspaceId ? 'ready' : 'setup_required', workspaceId ? 'Active workspace is selected.' : 'No active workspace found.', 'Create or select a workspace.');
  addCheck(
    checks,
    'Authentication & Workspace',
    'Workspace membership valid',
    membershipResult.data ? 'ready' : 'setup_required',
    membershipResult.data ? `Membership role: ${membershipResult.data.role}.` : 'Workspace membership was not found.',
    'Open onboarding or workspace settings.'
  );

  const tableNames = [
    'tasks',
    'content_studio_items',
    'creative_assets',
    'content_studio_publish_attempts',
    'projects',
    'prompt_library',
    'releases',
    'notifications',
  ];
  const tableResults = await Promise.all(tableNames.map(async (table) => [table, await tableAccessible(supabase, workspaceId, table)] as const));

  addCheck(
    checks,
    'Supabase Database',
    'Current workspace data read',
    dataNotices.length === 0 ? 'ready' : 'needs_review',
    dataNotices.length === 0 ? 'Workspace reads completed.' : dataNotices[0],
    dataNotices.length === 0 ? 'No action needed.' : 'Review Supabase table access and migrations.'
  );

  for (const [table, error] of tableResults) {
    addCheck(
      checks,
      'Supabase Database',
      `${table} accessible`,
      error ? 'needs_review' : 'ready',
      error ? `${table}: ${error}` : `${table} can be queried for this workspace.`,
      error ? 'Apply pending migration or review RLS.' : 'No action needed.'
    );
  }

  const assetIdsInUse = new Set(contentItems.flatMap((item) => item.asset_ids));
  const missingMediaAssets = creativeAssets.filter((asset) => !hasAssetMediaUrl(asset));
  const linkedAssets = creativeAssets.filter((asset) => assetIdsInUse.has(asset.id)).length;

  addCheck(checks, 'Supabase Storage', 'creative-assets bucket readiness', storageBucket.status, storageBucket.details, storageBucket.status === 'ready' ? 'No action needed.' : 'Create or repair the creative-assets bucket.');
  addCheck(
    checks,
    'Supabase Storage',
    'Uploaded assets have media URLs',
    missingMediaAssets.length === 0 ? 'ready' : 'setup_required',
    missingMediaAssets.length === 0 ? 'No missing media URLs detected.' : `${missingMediaAssets.length} creative asset(s) need usable media URLs.`,
    missingMediaAssets.length === 0 ? 'No action needed.' : 'Open Creative Assets and repair upload/public URL metadata.'
  );

  const envChecks: EnvCheck[] = [
    envCheck('OPENAI_API_KEY', 'OpenAI text/image generation readiness.'),
    envCheck('META_APP_ID', 'Meta OAuth app ID.'),
    envCheck('META_APP_SECRET', 'Meta OAuth secret.'),
    envCheck('META_REDIRECT_URI', 'Meta OAuth callback URL.'),
    envCheck('META_GRAPH_API_VERSION', 'Optional Meta API version override.', true),
    envCheck('AD_TOKEN_ENCRYPTION_KEY', 'Server-side token encryption key.'),
    envCheck('GOOGLE_ADS_CLIENT_ID', 'Google Ads OAuth client ID.'),
    envCheck('GOOGLE_ADS_CLIENT_SECRET', 'Google Ads OAuth client secret.'),
    envCheck('GOOGLE_ADS_DEVELOPER_TOKEN', 'Google Ads developer token.'),
    envCheck('GOOGLE_ADS_REDIRECT_URI', 'Google Ads OAuth callback URL.'),
    envCheck('GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'Optional manager account ID.', true),
    envCheck('GOOGLE_ADS_API_VERSION', 'Optional Google Ads API version override.', true),
    { name: 'PINTEREST_APP_ID or PINTEREST_CLIENT_ID', status: getPinterestIdStatus(), note: 'Pinterest OAuth app/client ID.' },
    envCheck('PINTEREST_APP_SECRET', 'Pinterest OAuth secret.'),
    envCheck('PINTEREST_REDIRECT_URI', 'Pinterest OAuth callback URL.'),
    envCheck('CRON_SECRET', 'Protected scheduler endpoint secret.'),
    envCheck('GITHUB_TOKEN', 'GitHub read-only repository integration.'),
  ];

  for (const env of envChecks) {
    addCheck(
      checks,
      'Environment / Server Setup',
      env.name,
      env.status === 'present' || env.status === 'optional' ? 'ready' : env.status === 'needs_review' ? 'needs_review' : 'setup_required',
      env.status === 'present' ? 'Present server-side.' : env.status === 'optional' ? 'Optional and not required for baseline readiness.' : 'Missing server-side.',
      env.status === 'missing' ? 'Add the environment variable in Vercel/local env.' : 'No action needed.'
    );
  }

  const schedulerReadiness = getContentStudioSchedulerReadiness();
  const googleAdsReadiness = getGoogleAdsConfigReadiness();
  const pinterestReadiness = getPinterestConfigReadiness();
  const openAIReadiness = checkOpenAITextProviderReadiness();
  const githubReadiness = getGitHubReadiness();
  const aiConfig = getAITextProviderConfig();
  const providerReadinessEntries = await Promise.all([
    getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'facebook_post' }),
    getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'instagram_post' }),
    getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'google_ads_campaign_draft' }),
    getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'pinterest_pin' }),
    getContentStudioProviderReadiness({ workspaceId, userId, contentType: 'linkedin_post_planner' }),
  ]);
  const [facebookReadiness, instagramReadiness, googleProviderReadiness, pinterestProviderReadiness] =
    providerReadinessEntries;

  const metaMetadata = readObject(metaConnectionResult.data?.metadata);
  const selectedPage = safeString(metaMetadata.selected_facebook_page_name);
  const selectedInstagram = safeString(metaMetadata.selected_instagram_business_account_name);
  const selectedMetaAdAccount = safeString(metaMetadata.selected_meta_ad_account_name);
  const selectedPinterestBoard = safeString(pinterestProviderReadiness?.details?.selectedBoardName);
  const googleConnection = googleAdsConnectionResult.data;
  const latestFailedOpenAI = publishAttempts.find((attempt) =>
    /openai|quota|quota|insufficient/i.test(`${attempt.error_message ?? ''} ${JSON.stringify(attempt.provider_response_summary ?? {})}`)
  );
  const latestSchedulerAttempt = publishAttempts.find((attempt) => {
    const summary = readObject(attempt.request_summary);
    return safeString(summary.source) === 'scheduled_execution' || safeString(summary.trigger) === 'scheduler';
  });
  const stuckProcessingItems = contentItems.filter((item) => item.scheduled_execution_status === 'processing');
  const githubLinkedProjects = projects.filter((project) => {
    const metadata = readObject(project.metadata);
    const github = readObject(metadata.github);
    return Boolean(project.github_url || (safeString(github.owner) && safeString(github.repo)));
  }).length;

  const providers: ProviderHealth[] = [
    {
      name: 'OpenAI',
      status: getReadinessState(openAIReadiness),
      details: [
        openAIReadiness.isReady ? 'API key is present.' : 'API key is missing or setup is incomplete.',
        latestFailedOpenAI ? `Last known possible quota/quota issue: ${safeMessage(latestFailedOpenAI.error_message)}` : 'No recent quota/quota error found in tracked attempts.',
        'Image generation uses the same OpenAI server-side key when enabled.',
        `AI text provider: ${aiConfig.activeProvider}.`,
      ],
      missing: openAIReadiness.isReady ? [] : ['OPENAI_API_KEY'],
      href: '/dashboard/settings#provider-setup-wizard',
      cta: 'Open Provider Setup',
    },
    {
      name: 'Meta / Instagram / Facebook',
      status:
        getReadinessState(facebookReadiness) === 'ready' && getReadinessState(instagramReadiness) === 'ready'
          ? 'ready'
          : getReadinessState(instagramReadiness.state !== 'ready' ? instagramReadiness : facebookReadiness),
      details: [
        `OAuth connection: ${metaConnectionResult.data?.status ?? 'not_connected'}.`,
        `Granted scopes: ${metaConnectionResult.data?.scopes?.length ?? 0}.`,
        selectedPage ? `Facebook Page: ${selectedPage}.` : 'Facebook Page not selected.',
        selectedInstagram ? `Instagram Business Account: ${selectedInstagram}.` : 'Instagram Business Account not selected.',
        selectedMetaAdAccount ? `Meta Ad Account: ${selectedMetaAdAccount}.` : 'Meta Ad Account not selected.',
      ],
      missing: [
        ...(facebookReadiness.missing ?? []),
        ...(instagramReadiness.missing ?? []),
        ...(selectedPage ? [] : ['Selected Facebook Page']),
        ...(selectedInstagram ? [] : ['Selected Instagram Business Account']),
      ],
      href: '/dashboard/settings#provider-setup-wizard',
      cta: 'Open Provider Setup',
    },
    {
      name: 'Google Ads',
      status: getReadinessState(googleProviderReadiness ?? googleAdsReadiness),
      details: [
        googleAdsReadiness.isConfigured ? 'Required env vars are present.' : `Missing env vars: ${googleAdsReadiness.missingEnvironmentVariables.join(', ') || 'none'}.`,
        `OAuth connection: ${googleConnection?.status ?? 'not_connected'}.`,
        'Developer token/API approval must be confirmed externally.',
        'Paused campaign drafts are readiness-checked only.',
      ],
      missing: [
        ...googleAdsReadiness.missingEnvironmentVariables,
        ...(googleConnection?.status === 'connected' ? [] : ['Google Ads OAuth / refresh token']),
        'Developer token approval needs review',
      ],
      href: '/dashboard/settings#provider-setup-wizard',
      cta: 'Open Provider Setup',
    },
    {
      name: 'Pinterest',
      status: getReadinessState(pinterestProviderReadiness ?? pinterestReadiness),
      details: [
        pinterestReadiness.isConfigured ? 'Required env vars are present.' : `Missing env vars: ${pinterestReadiness.missingEnvironmentVariables.join(', ') || 'none'}.`,
        selectedPinterestBoard ? `Selected board: ${selectedPinterestBoard}.` : 'Pinterest board not selected.',
        missingMediaAssets.length === 0 ? 'Image URL readiness looks clean.' : `${missingMediaAssets.length} asset(s) may need media URLs.`,
      ],
      missing: [
        ...pinterestReadiness.missingEnvironmentVariables,
        ...(selectedPinterestBoard ? [] : ['Pinterest board selection']),
      ],
      href: '/dashboard/settings#provider-setup-wizard',
      cta: 'Open Provider Setup',
    },
    {
      name: 'LinkedIn',
      status: 'manual_only',
      details: ['Manual-only unless real OAuth publishing is implemented.'],
      missing: [],
      href: '/dashboard/content-studio?tab=linkedin',
      cta: 'Open LinkedIn Planner',
    },
    {
      name: 'GitHub Integration',
      status: githubReadiness.tokenPresent ? 'ready' : 'setup_required',
      details: [
        githubReadiness.message,
        `${githubLinkedProjects} project(s) have linked GitHub repository metadata.`,
        `Last GitHub setup check: ${githubReadiness.checkedAt}.`,
      ],
      missing: githubReadiness.tokenPresent ? [] : ['GITHUB_TOKEN'],
      href: '/dashboard/projects',
      cta: githubLinkedProjects > 0 ? 'Open Projects' : 'Link Repository',
    },
    {
      name: 'Scheduler',
      status: schedulerReadiness.isConfigured && cronRouteExists() && vercelCronExists() ? 'ready' : 'setup_required',
      details: [
        schedulerReadiness.message,
        cronRouteExists() ? 'Cron route exists.' : 'Cron route not found.',
        vercelCronExists() ? 'vercel.json cron schedule exists.' : 'vercel.json cron schedule not found.',
        latestSchedulerAttempt ? `Latest scheduler attempt: ${latestSchedulerAttempt.status}.` : 'Latest scheduler attempt not tracked yet.',
        stuckProcessingItems.length > 0 ? `${stuckProcessingItems.length} item(s) stuck processing.` : 'No stuck processing items detected.',
      ],
      missing: [
        ...(schedulerReadiness.cronSecretConfigured ? [] : ['CRON_SECRET']),
        ...(cronRouteExists() ? [] : ['Cron route']),
        ...(vercelCronExists() ? [] : ['Vercel cron schedule']),
      ],
      href: '/dashboard/calendar',
      cta: 'Open Calendar',
    },
    {
      name: 'Supabase Storage',
      status: storageBucket.status,
      details: [storageBucket.details, missingMediaAssets.length === 0 ? 'Media URL readiness is clear.' : `${missingMediaAssets.length} asset(s) missing media URLs.`],
      missing: storageBucket.status === 'ready' ? [] : ['creative-assets bucket'],
      href: '/dashboard/creative-assets',
      cta: 'Open Creative Assets',
    },
  ];

  for (const provider of providers) {
    addCheck(
      checks,
      'Provider Health',
      provider.name,
      provider.status,
      provider.details.join(' '),
      provider.status === 'ready' || provider.status === 'manual_only' ? 'No immediate setup action.' : provider.cta
    );
  }

  const contentStatusCounts = {
    ...Object.fromEntries(contentStatuses.map((status) => [status, 0])),
    ...countBy(contentItems.map((item) => item.status)),
  } as Record<ContentStudioStatus, number>;
  const manualOnlyCount = contentItems.filter(isManualOnlyItem).length;
  const attemptStatusCounts = {
    ...Object.fromEntries(attemptStatuses.map((status) => [status, 0])),
    ...countBy(publishAttempts.map((attempt) => attempt.status)),
  } as Record<(typeof attemptStatuses)[number], number>;
  const taskStatusCounts = {
    ...Object.fromEntries(taskStatuses.map((status) => [status, 0])),
    ...countBy(tasks.map((task) => task.status)),
  } as Record<TaskStatus, number>;
  const recoveryIssues =
    contentStatusCounts.failed +
    contentStatusCounts.setup_required +
    contentStatusCounts.approval_pending +
    attemptStatusCounts.failed +
    attemptStatusCounts.error +
    attemptStatusCounts.setup_required +
    taskStatusCounts.failed +
    releases.filter((release) => release.status === 'failed').length;
  const criticalBlockers =
    contentStatusCounts.failed +
    attemptStatusCounts.failed +
    attemptStatusCounts.error +
    taskStatusCounts.failed +
    releases.filter((release) => release.status === 'failed').length;

  const metrics: SystemHealthSummary['metrics'] = {
    content: {
      total: contentItems.length,
      ready: contentStatusCounts.ready,
      scheduled: contentStatusCounts.scheduled,
      published: contentStatusCounts.published,
      failed: contentStatusCounts.failed,
      setup_required: contentStatusCounts.setup_required,
      approval_pending: contentStatusCounts.approval_pending,
      manual_only: manualOnlyCount,
    },
    attempts: {
      total: publishAttempts.length,
      succeeded: attemptStatusCounts.succeeded,
      failed: attemptStatusCounts.failed,
      setup_required: attemptStatusCounts.setup_required,
      approval_pending: attemptStatusCounts.approval_pending,
      manual_only: attemptStatusCounts.manual_only,
      unsupported: attemptStatusCounts.unsupported,
    },
    tasks: {
      pending: taskStatusCounts.pending,
      processing: taskStatusCounts.processing,
      needs_review: taskStatusCounts.needs_review,
      completed: taskStatusCounts.completed,
      failed: taskStatusCounts.failed,
    },
    projects: {
      total: projects.length,
      active: projects.filter((project) => project.status === 'active').length,
      ready_to_deploy: projects.filter((project) => project.status === 'ready_to_deploy').length,
      deployed: projects.filter((project) => project.status === 'deployed').length,
      needs_review: projects.filter((project) => project.status === 'needs_review').length,
    },
    releases: {
      total: releases.length,
      latest: releases[0]?.title ?? 'Not tracked yet',
      failed: releases.filter((release) => release.status === 'failed').length,
      ready_to_deploy: releases.filter((release) => release.status === 'ready_to_deploy').length,
      deployed: releases.filter((release) => release.status === 'deployed').length,
    },
    recovery: {
      totalIssues: recoveryIssues,
      criticalBlockers,
      retryableIssues: publishAttempts.filter((attempt) => ['failed', 'error', 'token_missing'].includes(attempt.status)).length,
    },
    assets: {
      total: creativeAssets.length,
      missingMedia: missingMediaAssets.length,
      linked: linkedAssets,
      unlinked: creativeAssets.length - linkedAssets,
    },
  };

  for (const provider of providers) {
    if (provider.status === 'setup_required' || provider.status === 'token_missing' || provider.status === 'quota_limit') {
      addAction(actions, {
        priority: provider.name === 'OpenAI' || provider.name === 'Scheduler' ? 'high' : 'medium',
        title: `${provider.name} setup needs attention`,
        reason: provider.missing.length > 0 ? `Missing: ${provider.missing.join(', ')}` : provider.details[0],
        relatedArea: provider.name,
        href: provider.href,
        cta: provider.cta,
      });
    }
    if (provider.status === 'approval_pending') {
      addAction(actions, {
        priority: 'medium',
        title: `${provider.name} approval pending`,
        reason: provider.details[0],
        relatedArea: provider.name,
        href: provider.href,
        cta: provider.cta,
      });
    }
  }

  for (const item of contentItems.filter((item) => ['failed', 'setup_required', 'approval_pending'].includes(item.status)).slice(0, 4)) {
    addAction(actions, {
      priority: item.status === 'failed' ? 'critical' : 'high',
      title: `Fix content item: ${item.title}`,
      reason: safeMessage(item.provider_error ?? item.scheduled_execution_error ?? `Item is ${item.status.replace(/_/g, ' ')}.`),
      relatedArea: 'Content Studio',
      href: `/dashboard/content-studio?item=${item.id}`,
      cta: 'Open Content Item',
    });
  }

  if (missingMediaAssets.length > 0) {
    addAction(actions, {
      priority: 'high',
      title: 'Link usable media URLs to creative assets',
      reason: `${missingMediaAssets.length} asset(s) are missing image/storage/video URLs needed by publishing providers.`,
      relatedArea: 'Creative Assets',
      href: '/dashboard/creative-assets',
      cta: 'Open Creative Assets',
    });
  }

  if (projects.length === 0) {
    addAction(actions, {
      priority: 'low',
      title: 'Create first Project',
      reason: 'Projects are tracked, but this workspace has no project records yet.',
      relatedArea: 'Projects',
      href: '/dashboard/projects',
      cta: 'Open Projects',
    });
  }

  if (releases.length === 0) {
    addAction(actions, {
      priority: 'low',
      title: 'Create first Release record',
      reason: 'Release Manager is available, but no release record is tracked yet.',
      relatedArea: 'Releases',
      href: '/dashboard/releases',
      cta: 'Open Releases',
    });
  }

  const rankedActions = rankActions(actions);
  const score = calculateScore(checks);
  const label = scoreLabel(score);
  const topBlockers = rankedActions.slice(0, 3).map((action) => action.title);
  const badges = {
    healthy: checks.filter((check) => check.status === 'ready').length,
    needsSetup: checks.filter((check) => check.status === 'setup_required' || check.status === 'token_missing' || check.status === 'quota_limit').length,
    approvalPending: checks.filter((check) => check.status === 'approval_pending').length,
    errors: checks.filter((check) => check.status === 'error').length,
    manualOnly: checks.filter((check) => check.status === 'manual_only').length,
  };
  const summaryWithoutReport = {
    score,
    label,
    topBlockers,
    badges,
    checks,
    providers,
    envChecks,
    actions: rankedActions,
    dataNotice: dataNotices.length > 0 ? dataNotices[0] : null,
    metrics,
  };

  return {
    ...summaryWithoutReport,
    reportText: buildReportText(summaryWithoutReport),
  };
}

export async function getSystemHealthForCurrentWorkspace() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isSupabaseServerConfigured || !workspaceResult.data || !user) {
    return {
      workspace: workspaceResult.data,
      user,
      summary: null,
      error: workspaceResult.error ?? 'Workspace or authenticated user is unavailable.',
    };
  }

  return {
    workspace: workspaceResult.data,
    user,
    summary: await getSystemHealthSummary({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
    }),
    error: workspaceResult.error,
  };
}
