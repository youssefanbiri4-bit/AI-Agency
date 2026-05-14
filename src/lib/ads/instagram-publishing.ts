/**
 * Instagram Reels publishing foundation.
 *
 * Publishing is only attempted after an explicit user action and only when the
 * Meta app, connection scopes, Instagram Business/Creator account metadata, and
 * public video URL are present. Access tokens are read only in the publish path.
 */

import { decryptToken } from '@/lib/ads/encryption';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';

const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
const REQUIRED_INSTAGRAM_PUBLISHING_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
] as const;

type RequiredInstagramPublishingScope =
  (typeof REQUIRED_INSTAGRAM_PUBLISHING_SCOPES)[number];

type PublishingReadinessState =
  | 'publishing_setup_required'
  | 'missing_instagram_content_publish_permission'
  | 'missing_instagram_business_account'
  | 'missing_video_url'
  | 'invalid_video_url'
  | 'ready_to_publish';

interface MetaPublishingConnection {
  status: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  metadata: JsonObject;
  encryptedAccessToken?: string;
}

interface MetaPublishingConnectionRow {
  status: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: unknown;
  access_token?: string;
}

interface MetaGraphErrorPayload {
  message?: string;
  code?: number;
  type?: string;
  error_subcode?: number;
}

interface MetaGraphResponse<T> {
  id?: string;
  error?: MetaGraphErrorPayload;
  data?: T;
}

interface InstagramContainerResponse {
  id?: string;
}

interface InstagramPublishResponse {
  id?: string;
}

interface InstagramMediaStatusResponse {
  id?: string;
  status_code?: string;
  permalink?: string;
  timestamp?: string;
}

export interface InstagramPublishingEnv {
  metaAppConfigured: boolean;
  metaAppSecretConfigured: boolean;
  graphApiVersion: string;
  isConfigured: boolean;
}

export interface InstagramPublishingState {
  isReady: boolean;
  state: PublishingReadinessState;
  label: string;
  reason: string;
  requiredScopes: RequiredInstagramPublishingScope[];
  missingScopes: RequiredInstagramPublishingScope[];
  hasInstagramBusinessAccount: boolean;
  hasValidVideoUrl: boolean;
  instagramBusinessAccountId?: string;
}

export interface CheckInstagramPublishingReadinessInput {
  workspaceId: string;
  userId: string;
  videoUrl?: string | null;
}

export interface InstagramReelContainerInput {
  videoUrl: string;
  caption?: string;
  coverUrl?: string;
  scheduledPublishTime?: string;
}

export interface InstagramReelPublishInput extends InstagramReelContainerInput {
  workspaceId: string;
  userId: string;
  reelId: string;
}

export interface InstagramReelPublishContainer {
  media_type: 'REELS';
  video_url: string;
  caption?: string;
  thumb_url?: string;
  share_to_feed: 'true';
  scheduled_publish_time?: string;
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Instagram publishing helpers can only run on the server.');
  }
}

function getGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

function buildGraphUrl(path: string) {
  return new URL(
    `https://graph.facebook.com/${getGraphApiVersion()}/${path.replace(/^\/+/, '')}`
  );
}

function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function safeMetadata(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function getMetadataString(metadata: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = safeString(metadata[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function isPublicHttpsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== 'https:') {
      return false;
    }

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function emptyReadiness(
  state: PublishingReadinessState,
  reason: string,
  overrides: Partial<InstagramPublishingState> = {}
): InstagramPublishingState {
  return {
    isReady: false,
    state,
    label: reason,
    reason,
    requiredScopes: [...REQUIRED_INSTAGRAM_PUBLISHING_SCOPES],
    missingScopes: [],
    hasInstagramBusinessAccount: false,
    hasValidVideoUrl: false,
    ...overrides,
  };
}

async function loadPublishingConnection({
  workspaceId,
  userId,
  includeToken = false,
}: {
  workspaceId: string;
  userId: string;
  includeToken?: boolean;
}): Promise<{ connection: MetaPublishingConnection | null; error: string | null }> {
  assertServerOnly();

  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      connection: null,
      error: error || 'Supabase server credentials are not configured.',
    };
  }

  const select = includeToken
    ? 'access_token, status, token_expires_at, scopes, metadata'
    : 'status, token_expires_at, scopes, metadata';
  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(select)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .maybeSingle();

  if (selectError) {
    return { connection: null, error: 'Instagram connection could not be verified.' };
  }

  if (!data) {
    return { connection: null, error: null };
  }

  const row = data as unknown as MetaPublishingConnectionRow;

  return {
    connection: {
      status: row.status,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      tokenExpiresAt: row.token_expires_at,
      metadata: safeMetadata(row.metadata),
      encryptedAccessToken: includeToken ? row.access_token : undefined,
    },
    error: null,
  };
}

async function postMetaGraph<T>({
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
  const payload = (await response.json().catch(() => null)) as MetaGraphResponse<T> | null;

  if (!response.ok || payload?.error) {
    throw new Error(mapMetaErrorToSafeMessage(payload?.error));
  }

  return payload;
}

async function getMetaGraph<T>({
  path,
  accessToken,
  fields,
}: {
  path: string;
  accessToken: string;
  fields: string;
}) {
  const url = buildGraphUrl(path);
  url.searchParams.set('fields', fields);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as T & {
    error?: MetaGraphErrorPayload;
  };

  if (!response.ok || payload?.error) {
    throw new Error(mapMetaErrorToSafeMessage(payload?.error));
  }

  return payload;
}

export function getInstagramPublishingEnv(): InstagramPublishingEnv {
  assertServerOnly();

  const metaAppConfigured = Boolean(process.env.META_APP_ID?.trim());
  const metaAppSecretConfigured = Boolean(process.env.META_APP_SECRET?.trim());

  return {
    metaAppConfigured,
    metaAppSecretConfigured,
    graphApiVersion: getGraphApiVersion(),
    isConfigured: metaAppConfigured && metaAppSecretConfigured,
  };
}

export async function checkInstagramPublishingReadiness(
  input: CheckInstagramPublishingReadinessInput
): Promise<InstagramPublishingState> {
  const env = getInstagramPublishingEnv();

  if (!env.isConfigured) {
    return emptyReadiness(
      'publishing_setup_required',
      'Publishing setup required',
      {
        label: 'Publishing setup required',
        reason: 'Meta app configuration is missing.',
      }
    );
  }

  const { connection, error } = await loadPublishingConnection({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (error || !connection) {
    return emptyReadiness(
      'publishing_setup_required',
      'Publishing setup required',
      {
        label: 'Publishing setup required',
        reason:
          'Instagram publishing setup required. Connect an Instagram Business or Creator account with content publishing permissions.',
      }
    );
  }

  if (
    connection.status !== 'connected' ||
    (connection.tokenExpiresAt && Date.parse(connection.tokenExpiresAt) <= Date.now())
  ) {
    return emptyReadiness(
      'publishing_setup_required',
      'Publishing setup required',
      {
        label: 'Publishing setup required',
        reason: 'Reconnect Instagram before publishing Reels.',
      }
    );
  }

  const missingScopes = REQUIRED_INSTAGRAM_PUBLISHING_SCOPES.filter(
    (scope) => !connection.scopes.includes(scope)
  );

  if (missingScopes.length > 0) {
    return emptyReadiness(
      'missing_instagram_content_publish_permission',
      'Missing Instagram content publishing permission',
      {
        label: 'Missing Instagram content publishing permission',
        reason: 'Instagram content publishing permissions are missing.',
        missingScopes,
      }
    );
  }

  const instagramBusinessAccountId = getMetadataString(connection.metadata, [
    'instagram_business_account_id',
    'instagram_creator_account_id',
    'instagram_account_id',
    'ig_user_id',
  ]);

  if (!instagramBusinessAccountId) {
    return emptyReadiness(
      'missing_instagram_business_account',
      'Missing Instagram business account',
      {
        label: 'Missing Instagram business account',
        reason: 'Instagram Business or Creator account is required.',
        hasInstagramBusinessAccount: false,
      }
    );
  }

  if (!input.videoUrl) {
    return emptyReadiness('missing_video_url', 'Missing video URL', {
      label: 'Missing video URL',
      reason: 'A public video URL is required before publishing.',
      hasInstagramBusinessAccount: true,
      instagramBusinessAccountId,
    });
  }

  if (!isPublicHttpsUrl(input.videoUrl)) {
    return emptyReadiness('invalid_video_url', 'Missing video URL', {
      label: 'Missing video URL',
      reason: 'Video URL must be a public HTTPS URL.',
      hasInstagramBusinessAccount: true,
      instagramBusinessAccountId,
    });
  }

  return {
    isReady: true,
    state: 'ready_to_publish',
    label: 'Ready to publish',
    reason: 'Ready to publish',
    requiredScopes: [...REQUIRED_INSTAGRAM_PUBLISHING_SCOPES],
    missingScopes: [],
    hasInstagramBusinessAccount: true,
    hasValidVideoUrl: true,
    instagramBusinessAccountId,
  };
}

export function createInstagramReelContainer(
  input: InstagramReelContainerInput
): InstagramReelPublishContainer {
  return {
    media_type: 'REELS',
    video_url: input.videoUrl,
    caption: input.caption || undefined,
    thumb_url: input.coverUrl || undefined,
    share_to_feed: 'true',
    scheduled_publish_time: input.scheduledPublishTime || undefined,
  };
}

export async function getInstagramMediaStatus({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<{
  id: string;
  status: string;
  permalink?: string;
  timestamp?: string;
}> {
  assertServerOnly();

  const payload = await getMetaGraph<InstagramMediaStatusResponse>({
    path: `/${mediaId}`,
    accessToken,
    fields: 'id,status_code,permalink,timestamp',
  });

  return {
    id: payload.id || mediaId,
    status: payload.status_code || 'unknown',
    permalink: payload.permalink,
    timestamp: payload.timestamp,
  };
}

export async function publishInstagramReel(
  input: InstagramReelPublishInput
): Promise<{
  success: boolean;
  processing?: boolean;
  status?: string;
  mediaId?: string;
  permalink?: string;
  error?: string;
}> {
  try {
    const readiness = await checkInstagramPublishingReadiness({
      workspaceId: input.workspaceId,
      userId: input.userId,
      videoUrl: input.videoUrl,
    });

    if (!readiness.isReady || !readiness.instagramBusinessAccountId) {
      return {
        success: false,
        error: readiness.reason,
      };
    }

    const { connection } = await loadPublishingConnection({
      workspaceId: input.workspaceId,
      userId: input.userId,
      includeToken: true,
    });

    if (!connection?.encryptedAccessToken) {
      return {
        success: false,
        error: 'Instagram publishing setup required.',
      };
    }

    const accessToken = decryptToken(connection.encryptedAccessToken);
    const container = createInstagramReelContainer(input);
    const containerBody = Object.fromEntries(
      Object.entries(container)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    );
    const containerResponse = await postMetaGraph<InstagramContainerResponse>({
      path: `/${readiness.instagramBusinessAccountId}/media`,
      accessToken,
      body: containerBody,
    });
    const creationId = containerResponse?.id;

    if (!creationId) {
      return {
        success: false,
        error: 'Instagram publishing failed while preparing the Reel.',
      };
    }

    let containerStatus: Awaited<ReturnType<typeof getInstagramMediaStatus>> | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      containerStatus = await getInstagramMediaStatus({
        mediaId: creationId,
        accessToken,
      }).catch(() => null);

      if (
        !containerStatus ||
        containerStatus.status === 'FINISHED' ||
        containerStatus.status === 'ERROR'
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (containerStatus?.status === 'ERROR') {
      return {
        success: false,
        status: containerStatus.status,
        error: 'Instagram finished processing the Reel with an error.',
      };
    }

    if (containerStatus?.status && containerStatus.status !== 'FINISHED') {
      return {
        success: false,
        processing: true,
        status: containerStatus.status,
        error: 'Instagram is still processing the Reel video.',
      };
    }

    const publishResponse = await postMetaGraph<InstagramPublishResponse>({
      path: `/${readiness.instagramBusinessAccountId}/media_publish`,
      accessToken,
      body: {
        creation_id: creationId,
      },
    });
    const mediaId = publishResponse?.id;

    if (!mediaId) {
      return {
        success: false,
        error: 'Instagram publishing failed.',
      };
    }

    const status = await getInstagramMediaStatus({ mediaId, accessToken }).catch(() => null);

    return {
      success: true,
      status: status?.status,
      mediaId,
      permalink: status?.permalink,
    };
  } catch (error) {
    return {
      success: false,
      error: mapMetaErrorToSafeMessage(error),
    };
  }
}

export function mapMetaErrorToSafeMessage(
  error: unknown,
  defaultMessage = 'Instagram publishing failed. Please try again.'
) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : '';

  if (message.includes('permission') || message.includes('insufficient_scope')) {
    return 'Instagram content publishing permissions are missing.';
  }

  if (message.includes('access') || message.includes('token') || message.includes('oauth')) {
    return 'Instagram connection must be refreshed before publishing.';
  }

  if (message.includes('video')) {
    return 'Video format or URL is not supported for Instagram Reels.';
  }

  if (message.includes('rate')) {
    return 'Instagram publishing is temporarily rate limited. Please try again later.';
  }

  if (message.includes('temporarily') || message.includes('unavailable')) {
    return 'Instagram publishing is temporarily unavailable. Please try again later.';
  }

  return defaultMessage;
}
