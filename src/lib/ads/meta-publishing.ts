import 'server-only';

import { decryptToken } from '@/lib/ads/encryption';
import {
  checkInstagramPublishingReadiness,
  publishInstagramReel,
} from '@/lib/ads/instagram-publishing';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';
import type { ProviderExecutionResult, ProviderReadinessResult } from '@/lib/content-studio/provider-types';

const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
const META_PUBLISH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const;
const FACEBOOK_PAGE_CONNECTION_REQUIRED = 'Facebook Page connection is required.';
const INSTAGRAM_ACCOUNT_REQUIRED = 'Instagram professional account is not connected.';
const PUBLISHABLE_CREATIVE_ASSET_REQUIRED = 'A publishable creative asset is required.';

interface MetaConnectionRow {
  status: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: unknown;
  access_token?: string;
}

interface MetaPageAccount {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
  };
}

interface MetaListResponse<T> {
  data?: T[];
  error?: {
    message?: string;
  };
}

interface MetaPublishResponse {
  id?: string;
  post_id?: string;
  error?: {
    message?: string;
  };
}

interface MetaPublishingConnection {
  status: string;
  tokenExpiresAt: string | null;
  scopes: string[];
  metadata: JsonObject;
  encryptedAccessToken?: string;
}

interface MetaPublishingTarget {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessAccountId?: string;
  instagramUsername?: string;
}

export interface MetaPublishingPageOption {
  id: string;
  name: string;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
}

export interface MetaPublishingTargetsResult {
  pages: MetaPublishingPageOption[];
  selectedFacebookPageId: string | null;
  selectedFacebookPageName: string | null;
  selectedInstagramBusinessAccountId: string | null;
  selectedInstagramUsername: string | null;
  selectedInstagramAssociatedFacebookPageId: string | null;
  error: string | null;
}

function getGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

function buildGraphUrl(path: string) {
  return new URL(`https://graph.facebook.com/${getGraphApiVersion()}/${path.replace(/^\/+/, '')}`);
}

function getSafeMetadata(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function isPublicHttpsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getSelectedFacebookPageId(metadata: JsonObject) {
  return safeString(metadata.selected_facebook_page_id);
}

function getSelectedInstagramBusinessAccountId(metadata: JsonObject) {
  return safeString(metadata.selected_instagram_business_account_id);
}

function getSelectedInstagramAssociatedPageId(metadata: JsonObject) {
  return safeString(metadata.selected_instagram_associated_facebook_page_id);
}

function mapMetaPublishErrorToSafeMessage(
  error: unknown,
  defaultMessage = 'Meta publishing failed. Please try again.'
) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : '';

  if (message.includes('permission') || message.includes('insufficient_scope')) {
    return 'Meta publishing permissions are missing.';
  }

  if (message.includes('access') || message.includes('token') || message.includes('oauth')) {
    return FACEBOOK_PAGE_CONNECTION_REQUIRED;
  }

  if (message.includes('rate')) {
    return 'Meta publishing is temporarily rate limited. Please try again later.';
  }

  if (message.includes('temporarily') || message.includes('unavailable')) {
    return 'Meta publishing is temporarily unavailable. Please try again later.';
  }

  if (message.includes('video')) {
    return 'Video format or URL is not supported for Instagram Reels.';
  }

  return defaultMessage;
}

function readPublishMessage(input: {
  title: string;
  caption: string | null;
  script: string | null;
  adCopy: string | null;
  objective: string | null;
}) {
  return (
    trimToNull(input.caption) ??
    trimToNull(input.script) ??
    trimToNull(input.adCopy) ??
    trimToNull(input.objective) ??
    input.title
  );
}

async function loadMetaPublishingConnection({
  workspaceId,
  userId,
  includeToken = false,
}: {
  workspaceId: string;
  userId: string;
  includeToken?: boolean;
}) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      connection: null,
      error: error ?? 'Supabase server credentials are not configured.',
    };
  }

  const select = includeToken
    ? 'status, token_expires_at, scopes, metadata, access_token'
    : 'status, token_expires_at, scopes, metadata';
  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(select)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .maybeSingle();

  if (selectError) {
    return { connection: null, error: 'Meta connection could not be verified.' };
  }

  if (!data) {
    return { connection: null, error: null };
  }

  const row = data as unknown as MetaConnectionRow;

  return {
    connection: {
      status: row.status,
      tokenExpiresAt: row.token_expires_at,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      metadata: getSafeMetadata(row.metadata),
      encryptedAccessToken: includeToken ? row.access_token : undefined,
    } satisfies MetaPublishingConnection,
    error: null,
  };
}

async function fetchMetaPages(accessToken: string) {
  const url = buildGraphUrl('/me/accounts');
  url.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username}'
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as MetaListResponse<MetaPageAccount> | null;

  if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
    throw new Error(payload?.error?.message || 'Meta Pages could not be loaded.');
  }

  return payload.data
    .map((page) => ({
      id: safeString(page.id),
      name: safeString(page.name),
      accessToken: safeString(page.access_token),
      instagramBusinessAccountId: safeString(page.instagram_business_account?.id),
      instagramUsername: safeString(page.instagram_business_account?.username),
    }))
    .filter(
      (page): page is {
        id: string;
        name: string;
        accessToken: string;
        instagramBusinessAccountId: string | null;
        instagramUsername: string | null;
      } => Boolean(page.id && page.name)
    );
}

async function resolveMetaTarget({
  workspaceId,
  userId,
  requireInstagram,
}: {
  workspaceId: string;
  userId: string;
  requireInstagram: boolean;
}) {
  const { connection, error } = await loadMetaPublishingConnection({
    workspaceId,
    userId,
    includeToken: true,
  });

  if (error || !connection?.encryptedAccessToken) {
    return {
      target: null,
      error: error || FACEBOOK_PAGE_CONNECTION_REQUIRED,
    };
  }

  const accessToken = decryptToken(connection.encryptedAccessToken);
  const pages = await fetchMetaPages(accessToken);
  const preferredPageId = getSelectedFacebookPageId(connection.metadata);
  const preferredInstagramId = getSelectedInstagramBusinessAccountId(connection.metadata);
  const preferredInstagramPageId = getSelectedInstagramAssociatedPageId(connection.metadata);
  const selectedPage = requireInstagram
    ? pages.find((page) => {
        if (!preferredInstagramId || page.instagramBusinessAccountId !== preferredInstagramId) {
          return false;
        }

        return !preferredInstagramPageId || page.id === preferredInstagramPageId;
      })
    : pages.find((page) => page.id === preferredPageId);

  if (!selectedPage) {
    return {
      target: null,
      error: requireInstagram
        ? 'Instagram Business account selection is required.'
        : 'Facebook Page selection is required.',
    };
  }

  if (!selectedPage.accessToken) {
    return {
      target: null,
      error: FACEBOOK_PAGE_CONNECTION_REQUIRED,
    };
  }

  if (requireInstagram && !selectedPage.instagramBusinessAccountId) {
    return {
      target: null,
      error: INSTAGRAM_ACCOUNT_REQUIRED,
    };
  }

  return {
    target: {
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageAccessToken: selectedPage.accessToken,
      instagramBusinessAccountId: selectedPage.instagramBusinessAccountId ?? undefined,
      instagramUsername: selectedPage.instagramUsername ?? undefined,
    } satisfies MetaPublishingTarget,
    error: null,
  };
}

async function postMetaGraph({
  path,
  accessToken,
  body,
}: {
  path: string;
  accessToken: string;
  body: Record<string, string>;
}) {
  const response = await fetch(buildGraphUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as MetaPublishResponse | null;

  if (!response.ok || payload?.error) {
    throw new Error(mapMetaPublishErrorToSafeMessage(payload?.error));
  }

  if (!payload) {
    throw new Error('Meta publishing failed.');
  }

  return payload;
}

export function getMetaPublishingScopes() {
  return [...META_PUBLISH_SCOPES];
}

export async function listMetaPublishingTargets({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<MetaPublishingTargetsResult> {
  const { connection, error } = await loadMetaPublishingConnection({
    workspaceId,
    userId,
    includeToken: true,
  });

  if (error || !connection?.encryptedAccessToken) {
    return {
      pages: [],
      selectedFacebookPageId: null,
      selectedFacebookPageName: null,
      selectedInstagramBusinessAccountId: null,
      selectedInstagramUsername: null,
      selectedInstagramAssociatedFacebookPageId: null,
      error: error || FACEBOOK_PAGE_CONNECTION_REQUIRED,
    };
  }

  try {
    const accessToken = decryptToken(connection.encryptedAccessToken);
    const pages = await fetchMetaPages(accessToken);
    const selectedFacebookPageId = getSelectedFacebookPageId(connection.metadata);
    const selectedInstagramBusinessAccountId =
      getSelectedInstagramBusinessAccountId(connection.metadata);
    const selectedInstagramAssociatedFacebookPageId =
      getSelectedInstagramAssociatedPageId(connection.metadata);
    const selectedPage =
      pages.find((page) => page.id === selectedFacebookPageId) ?? null;
    const selectedInstagramPage =
      pages.find((page) => {
        if (!selectedInstagramBusinessAccountId) {
          return false;
        }

        if (page.instagramBusinessAccountId !== selectedInstagramBusinessAccountId) {
          return false;
        }

        return (
          !selectedInstagramAssociatedFacebookPageId ||
          page.id === selectedInstagramAssociatedFacebookPageId
        );
      }) ?? null;

    return {
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        instagramBusinessAccountId: page.instagramBusinessAccountId,
        instagramUsername: page.instagramUsername,
      })),
      selectedFacebookPageId,
      selectedFacebookPageName:
        safeString(connection.metadata.selected_facebook_page_name) ?? selectedPage?.name ?? null,
      selectedInstagramBusinessAccountId,
      selectedInstagramUsername:
        safeString(connection.metadata.selected_instagram_username) ??
        selectedInstagramPage?.instagramUsername ??
        null,
      selectedInstagramAssociatedFacebookPageId,
      error: null,
    };
  } catch (targetError) {
    return {
      pages: [],
      selectedFacebookPageId: null,
      selectedFacebookPageName: null,
      selectedInstagramBusinessAccountId: null,
      selectedInstagramUsername: null,
      selectedInstagramAssociatedFacebookPageId: null,
      error:
        targetError instanceof Error
          ? targetError.message
          : 'Meta Pages could not be loaded.',
    };
  }
}

export async function getMetaPublishingReadiness({
  workspaceId,
  userId,
  contentType,
}: {
  workspaceId: string;
  userId: string;
  contentType: 'facebook_post' | 'facebook_reel' | 'instagram_post' | 'instagram_reel';
}): Promise<ProviderReadinessResult> {
  const missingEnv = ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'].filter(
    (key) => !process.env[key]?.trim()
  );

  if (missingEnv.length > 0) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'setup_required',
      message: `Provider setup required: missing ${missingEnv.join(', ')}.`,
      missing: missingEnv,
    };
  }

  if (contentType === 'facebook_reel') {
    return {
      provider: 'facebook',
      state: 'unsupported',
      message: 'Facebook Reel publishing is not supported in this phase. Use Facebook Page posts instead.',
      missing: [],
    };
  }

  const { connection, error } = await loadMetaPublishingConnection({
    workspaceId,
    userId,
  });

  if (error) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'error',
      message: error,
      missing: [],
    };
  }

  if (!connection) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'token_missing',
      message: FACEBOOK_PAGE_CONNECTION_REQUIRED,
      missing: ['Meta OAuth connection'],
    };
  }

  if (
    connection.status !== 'connected' ||
    (connection.tokenExpiresAt && Date.parse(connection.tokenExpiresAt) <= Date.now())
  ) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'token_missing',
      message: FACEBOOK_PAGE_CONNECTION_REQUIRED,
      missing: ['Valid Meta access token'],
    };
  }

  const requiredScopes =
    contentType === 'facebook_post'
      ? ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']
      : ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'];
  const missingScopes = requiredScopes.filter((scope) => !connection.scopes.includes(scope));

  if (missingScopes.length > 0) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'setup_required',
      message: `Provider setup required: reconnect Facebook with ${missingScopes.join(', ')}.`,
      missing: missingScopes,
    };
  }

  try {
    const targetResult = await resolveMetaTarget({
      workspaceId,
      userId,
      requireInstagram: contentType === 'instagram_post' || contentType === 'instagram_reel',
    });

    if (!targetResult.target) {
      return {
        provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
        state: 'setup_required',
        message: `Provider setup required: ${targetResult.error || 'no valid publishing target found.'}`,
        missing: [
          contentType === 'instagram_post' || contentType === 'instagram_reel'
            ? 'Connected Instagram professional account'
            : 'Connected Facebook Page',
        ],
      };
    }
  } catch (targetError) {
    return {
      provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
      state: 'error',
      message:
        targetError instanceof Error
          ? targetError.message
          : 'Meta publishing readiness could not be verified.',
      missing: [],
    };
  }

  return {
    provider: contentType.startsWith('instagram') ? 'instagram' : 'facebook',
    state: 'ready',
    message: 'Provider is ready.',
    missing: [],
  };
}

export async function publishFacebookPagePost(input: {
  workspaceId: string;
  userId: string;
  title: string;
  caption: string | null;
  script: string | null;
  adCopy: string | null;
  objective: string | null;
  imageUrl: string | null;
}): Promise<ProviderExecutionResult> {
  const readiness = await getMetaPublishingReadiness({
    workspaceId: input.workspaceId,
    userId: input.userId,
    contentType: 'facebook_post',
  });

  if (readiness.state !== 'ready') {
    return {
      provider: 'facebook',
      actionType: 'publish_post',
      status: readiness.state === 'approval_pending' ? 'approval_pending' : 'setup_required',
      message: readiness.message,
    };
  }

  const targetResult = await resolveMetaTarget({
    workspaceId: input.workspaceId,
    userId: input.userId,
    requireInstagram: false,
  });

  if (!targetResult.target) {
    return {
      provider: 'facebook',
      actionType: 'publish_post',
      status: 'setup_required',
      message: targetResult.error || 'Facebook Page setup is incomplete.',
    };
  }

  const message = readPublishMessage(input);
  const imageUrl = isPublicHttpsUrl(input.imageUrl) ? input.imageUrl : null;

  if (!message && !imageUrl) {
    return {
      provider: 'facebook',
      actionType: 'publish_post',
      status: 'failed',
      message: 'Could not publish. Add post text or a publishable creative asset first.',
    };
  }

  const response = await postMetaGraph({
    path: imageUrl ? `/${targetResult.target.pageId}/photos` : `/${targetResult.target.pageId}/feed`,
    accessToken: targetResult.target.pageAccessToken,
    body: imageUrl
      ? {
          url: imageUrl,
          ...(message ? { caption: message } : {}),
        }
      : {
          message,
        },
  });

  return {
    provider: 'facebook',
    actionType: 'publish_post',
    status: 'succeeded',
    message: 'Published successfully.',
    providerExternalId: response.id ?? response.post_id ?? null,
    providerResponseSummary: {
      page_id: targetResult.target.pageId,
      page_name: targetResult.target.pageName,
      publish_mode: imageUrl ? 'photo' : 'feed',
      post_id: response.id ?? response.post_id ?? null,
    },
  };
}

export async function publishInstagramImagePost(input: {
  workspaceId: string;
  userId: string;
  title: string;
  caption: string | null;
  script: string | null;
  adCopy: string | null;
  objective: string | null;
  imageUrl: string | null;
}): Promise<ProviderExecutionResult> {
  const readiness = await getMetaPublishingReadiness({
    workspaceId: input.workspaceId,
    userId: input.userId,
    contentType: 'instagram_post',
  });

  if (readiness.state !== 'ready') {
    return {
      provider: 'instagram',
      actionType: 'publish_post',
      status: readiness.state === 'approval_pending' ? 'approval_pending' : 'setup_required',
      message: readiness.message,
    };
  }

  if (!isPublicHttpsUrl(input.imageUrl)) {
    return {
      provider: 'instagram',
      actionType: 'publish_post',
      status: 'failed',
      message: PUBLISHABLE_CREATIVE_ASSET_REQUIRED,
    };
  }
  const imageUrl = input.imageUrl as string;

  const targetResult = await resolveMetaTarget({
    workspaceId: input.workspaceId,
    userId: input.userId,
    requireInstagram: true,
  });

  if (!targetResult.target?.instagramBusinessAccountId) {
    return {
      provider: 'instagram',
      actionType: 'publish_post',
      status: 'setup_required',
      message: targetResult.error || 'Instagram Business account setup is incomplete.',
    };
  }

  const caption = readPublishMessage(input);
  const containerResponse = await postMetaGraph({
    path: `/${targetResult.target.instagramBusinessAccountId}/media`,
    accessToken: targetResult.target.pageAccessToken,
    body: {
      image_url: imageUrl,
      caption,
    },
  });

  const creationId = containerResponse.id;

  if (!creationId) {
    return {
      provider: 'instagram',
      actionType: 'publish_post',
      status: 'failed',
      message: 'Could not publish. Instagram media container creation failed.',
    };
  }

  const publishResponse = await postMetaGraph({
    path: `/${targetResult.target.instagramBusinessAccountId}/media_publish`,
    accessToken: targetResult.target.pageAccessToken,
    body: {
      creation_id: creationId,
    },
  });

  return {
    provider: 'instagram',
    actionType: 'publish_post',
    status: 'succeeded',
    message: 'Published successfully.',
    providerExternalId: publishResponse.id ?? null,
    providerResponseSummary: {
      page_id: targetResult.target.pageId,
      instagram_business_account_id: targetResult.target.instagramBusinessAccountId,
      media_creation_id: creationId,
      media_id: publishResponse.id ?? null,
    },
  };
}

export async function publishInstagramReelPost(input: {
  workspaceId: string;
  userId: string;
  itemId: string;
  title: string;
  caption: string | null;
  script: string | null;
  adCopy: string | null;
  objective: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
}): Promise<ProviderExecutionResult> {
  const readiness = await getMetaPublishingReadiness({
    workspaceId: input.workspaceId,
    userId: input.userId,
    contentType: 'instagram_reel',
  });

  if (readiness.state !== 'ready') {
    return {
      provider: 'instagram',
      actionType: 'publish_reel',
      status: readiness.state === 'approval_pending' ? 'approval_pending' : 'setup_required',
      message: readiness.message,
    };
  }

  if (!isPublicHttpsUrl(input.videoUrl)) {
    return {
      provider: 'instagram',
      actionType: 'publish_reel',
      status: 'setup_required',
      message: 'Video URL must be public HTTPS.',
    };
  }
  const videoUrl = input.videoUrl as string;
  const coverUrl = isPublicHttpsUrl(input.coverUrl) ? (input.coverUrl as string) : undefined;

  const targetResult = await resolveMetaTarget({
    workspaceId: input.workspaceId,
    userId: input.userId,
    requireInstagram: true,
  });

  if (!targetResult.target?.instagramBusinessAccountId) {
    return {
      provider: 'instagram',
      actionType: 'publish_reel',
      status: 'setup_required',
      message: targetResult.error || INSTAGRAM_ACCOUNT_REQUIRED,
    };
  }

  const instagramReadiness = await checkInstagramPublishingReadiness({
    workspaceId: input.workspaceId,
    userId: input.userId,
    videoUrl,
  });

  if (!instagramReadiness.isReady) {
    return {
      provider: 'instagram',
      actionType: 'publish_reel',
      status:
        instagramReadiness.state === 'missing_instagram_business_account' ||
        instagramReadiness.state === 'publishing_setup_required' ||
        instagramReadiness.state === 'missing_instagram_content_publish_permission'
          ? 'setup_required'
          : 'failed',
      message:
        instagramReadiness.state === 'missing_instagram_business_account'
          ? INSTAGRAM_ACCOUNT_REQUIRED
          : instagramReadiness.state === 'missing_video_url'
            ? PUBLISHABLE_CREATIVE_ASSET_REQUIRED
            : instagramReadiness.reason,
    };
  }

  const caption = readPublishMessage(input);
  const publishResult = await publishInstagramReel({
    workspaceId: input.workspaceId,
    userId: input.userId,
    reelId: input.itemId,
    videoUrl,
    coverUrl,
    caption,
  });

  if (!publishResult.success || !publishResult.mediaId) {
    return {
      provider: 'instagram',
      actionType: 'publish_reel',
      status: publishResult.processing ? 'approval_pending' : 'failed',
      message: publishResult.error || 'Instagram Reel publishing failed.',
      providerResponseSummary: {
        processing_status: publishResult.status ?? null,
      },
    };
  }

  return {
    provider: 'instagram',
    actionType: 'publish_reel',
    status: 'succeeded',
    message: 'Published successfully.',
    providerExternalId: publishResult.mediaId,
    providerResponseSummary: {
      page_id: targetResult.target.pageId,
      instagram_business_account_id: targetResult.target.instagramBusinessAccountId,
      media_id: publishResult.mediaId,
      processing_status: publishResult.status ?? null,
      permalink: publishResult.permalink ?? null,
    },
  };
}
