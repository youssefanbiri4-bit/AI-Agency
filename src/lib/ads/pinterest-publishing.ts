import 'server-only';

import { decryptToken, encryptToken } from '@/lib/ads/encryption';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';
import type { ProviderExecutionResult, ProviderReadinessResult } from '@/lib/content-studio/provider-types';

const PINTEREST_API_BASE_URL = 'https://api.pinterest.com/v5';
const PINTEREST_OAUTH_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const PINTEREST_OAUTH_URL = 'https://www.pinterest.com/oauth/';
const PINTEREST_SCOPES = ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'] as const;
const PINTEREST_APP_ID_OR_CLIENT_ID_REQUIRED = 'Pinterest provider setup is incomplete.';
const PINTEREST_SECRET_REQUIRED = 'Pinterest app secret is missing.';
const PINTEREST_REDIRECT_URI_REQUIRED = 'Pinterest provider setup is incomplete.';
const PINTEREST_OAUTH_REQUIRED = 'Pinterest OAuth connection is missing.';
const PINTEREST_REFRESH_TOKEN_REQUIRED =
  'Pinterest provider setup is incomplete.';
const PINTEREST_BOARD_REQUIRED = 'Pinterest board is not selected.';
const PINTEREST_MEDIA_REQUIRED = 'A publishable image asset is required.';
const PINTEREST_IMAGE_URL_REQUIRED = 'Image URL must be public HTTPS.';

interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface PinterestBoard {
  id?: string;
  name?: string;
}

interface PinterestBoardsResponse {
  items?: PinterestBoard[];
  data?: PinterestBoard[];
  error?: string;
  message?: string;
}

interface PinterestPinResponse {
  id?: string;
  title?: string;
  link?: string;
  board_id?: string;
  error?: string;
  message?: string;
}

export interface PinterestBoardOption {
  id: string;
  name: string;
}

export interface PinterestConnectionSettingsResult {
  error: string | null;
  status: 'connected' | 'expired' | 'revoked' | 'error' | 'not_connected';
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  missingScopes: string[];
  missingEnvironmentVariables: string[];
  connectedAccount: string | null;
  tokenStatus: 'valid' | 'expired' | 'missing' | 'not_connected';
  boards: PinterestBoardOption[];
  selectedBoardId: string | null;
  selectedBoardName: string | null;
}

interface PinterestConnectionRow {
  status: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: unknown;
  created_at?: string;
  updated_at?: string;
  access_token?: string;
  refresh_token?: string | null;
}

function getPinterestEnv() {
  const appId = process.env.PINTEREST_APP_ID?.trim() || process.env.PINTEREST_CLIENT_ID?.trim() || '';
  const appSecret = process.env.PINTEREST_APP_SECRET?.trim() ?? '';
  const redirectUri = process.env.PINTEREST_REDIRECT_URI?.trim() ?? '';

  return {
    appId,
    appSecret,
    redirectUri,
    missing: [
      !appId ? 'PINTEREST_APP_ID/PINTEREST_CLIENT_ID' : null,
      !appSecret ? 'PINTEREST_APP_SECRET' : null,
      !redirectUri ? 'PINTEREST_REDIRECT_URI' : null,
    ].filter(Boolean) as string[],
  };
}

function safeMetadata(value: unknown): JsonObject {
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

function buildExpiresAt(expiresIn: number | null | undefined) {
  if (!expiresIn || !Number.isFinite(expiresIn)) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function getPinterestEnvMissingMessage(missing: string[]) {
  if (missing.includes('PINTEREST_APP_ID/PINTEREST_CLIENT_ID')) {
    return PINTEREST_APP_ID_OR_CLIENT_ID_REQUIRED;
  }

  if (missing.includes('PINTEREST_APP_SECRET')) {
    return PINTEREST_SECRET_REQUIRED;
  }

  if (missing.includes('PINTEREST_REDIRECT_URI')) {
    return PINTEREST_REDIRECT_URI_REQUIRED;
  }

  return `Pinterest setup required: missing ${missing.join(', ')}.`;
}

function normalizeConnectionStatus(status: string, tokenExpiresAt: string | null) {
  if (status === 'connected' && tokenExpiresAt && Date.parse(tokenExpiresAt) <= Date.now()) {
    return 'expired' as const;
  }

  if (status === 'connected' || status === 'expired' || status === 'revoked' || status === 'error') {
    return status;
  }

  return 'error';
}

function mapPinterestErrorToSafeMessage(
  error: unknown,
  defaultMessage = 'Pinterest publishing failed. Please try again.'
) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : '';

  if (message.includes('refresh token')) {
    return PINTEREST_REFRESH_TOKEN_REQUIRED;
  }

  if (message.includes('connect pinterest') || message.includes('oauth')) {
    return PINTEREST_OAUTH_REQUIRED;
  }

  if (message.includes('board')) {
    return PINTEREST_BOARD_REQUIRED;
  }

  if (message.includes('image') || message.includes('media url') || message.includes('media')) {
    return PINTEREST_MEDIA_REQUIRED;
  }

  if (message.includes('access token') || message.includes('token is not active') || message.includes('token refresh')) {
    return 'Pinterest setup required: reconnect Pinterest because the token is not active.';
  }

  if (message.includes('permission') || message.includes('scope')) {
    return 'Pinterest setup required: reconnect Pinterest with boards:read and pins:write.';
  }

  if (message.includes('rate')) {
    return 'Pinterest publishing is temporarily rate limited. Please try again later.';
  }

  if (message.includes('temporarily') || message.includes('unavailable')) {
    return 'Pinterest publishing is temporarily unavailable. Please try again later.';
  }

  return defaultMessage;
}

async function loadPinterestConnection({
  workspaceId,
  userId,
  includeTokens = false,
}: {
  workspaceId: string;
  userId: string;
  includeTokens?: boolean;
}) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      row: null,
      error: error ?? 'Supabase server credentials are not configured.',
    };
  }

  const select = includeTokens
    ? 'status, token_expires_at, scopes, metadata, created_at, updated_at, access_token, refresh_token'
    : 'status, token_expires_at, scopes, metadata, created_at, updated_at';
  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(select)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'pinterest')
    .maybeSingle();

  if (selectError) {
    return { row: null, error: 'Pinterest connection could not be verified.' };
  }

  return {
    row: (data as PinterestConnectionRow | null) ?? null,
    error: null,
  };
}

async function upsertPinterestConnection(input: {
  workspaceId: string;
  userId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  metadata: JsonObject;
}) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    throw new Error(error ?? 'Supabase server credentials are not configured.');
  }

  const { error: upsertError } = await client
    .from('ad_connections')
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: 'pinterest',
        status: 'connected',
        access_token: input.encryptedAccessToken,
        refresh_token: input.encryptedRefreshToken,
        token_expires_at: input.tokenExpiresAt,
        scopes: input.scopes,
        metadata: input.metadata,
      },
      {
        onConflict: 'workspace_id,user_id,provider',
      }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

async function callPinterestApi<T>({
  path,
  method = 'GET',
  accessToken,
  body,
}: {
  path: string;
  method?: 'GET' | 'POST';
  accessToken: string;
  body?: Record<string, unknown>;
}) {
  const response = await fetch(`${PINTEREST_API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok || payload?.error) {
    throw new Error('Pinterest action could not be completed. Confirm OAuth connection, board selection, public media URL, and Pinterest account status.');
  }

  return payload;
}

async function refreshPinterestAccessToken(refreshToken: string) {
  const env = getPinterestEnv();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: PINTEREST_SCOPES.join(','),
  });
  const credentials = Buffer.from(`${env.appId}:${env.appSecret}`).toString('base64');
  const response = await fetch(PINTEREST_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as PinterestTokenResponse | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Pinterest token refresh failed.');
  }

  return payload;
}

async function getConnectedPinterestAccessToken(
  workspaceId: string,
  userId: string
): Promise<{ accessToken: string; metadata: JsonObject }> {
  const { row, error } = await loadPinterestConnection({
    workspaceId,
    userId,
    includeTokens: true,
  });

  if (error) {
    throw new Error(error);
  }

  if (!row) {
    throw new Error(PINTEREST_OAUTH_REQUIRED);
  }

  if (row.status !== 'connected') {
    throw new Error('Provider setup required: reconnect Pinterest because the token is not active.');
  }

  if (!row.scopes?.includes('boards:read') || !row.scopes.includes('pins:write')) {
    throw new Error('Provider setup required: reconnect Pinterest with boards:read and pins:write.');
  }

  if (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now() && row.refresh_token) {
    const refreshed = await refreshPinterestAccessToken(decryptToken(row.refresh_token));
    const refreshedAccessToken = refreshed.access_token;

    if (!refreshedAccessToken) {
      throw new Error('Pinterest token refresh failed.');
    }

    const tokenExpiresAt = buildExpiresAt(refreshed.expires_in);
    const metadata = {
      ...safeMetadata(row.metadata),
      token_type: refreshed.token_type ?? null,
      refreshed_at: new Date().toISOString(),
    };

    await upsertPinterestConnection({
      workspaceId,
      userId,
      encryptedAccessToken: encryptToken(refreshedAccessToken),
      encryptedRefreshToken: refreshed.refresh_token
        ? encryptToken(refreshed.refresh_token)
        : row.refresh_token,
      tokenExpiresAt,
      scopes: refreshed.scope
        ? refreshed.scope.split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean)
        : [...PINTEREST_SCOPES],
      metadata,
    });

    return {
      accessToken: refreshedAccessToken,
      metadata: metadata as JsonObject,
    };
  }

  if (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now() && !row.refresh_token) {
    throw new Error(PINTEREST_REFRESH_TOKEN_REQUIRED);
  }

  if (!row.access_token) {
    throw new Error('Pinterest access token is missing.');
  }

  return {
    accessToken: decryptToken(row.access_token),
    metadata: safeMetadata(row.metadata) as JsonObject,
  };
}

export function buildPinterestPublishingOAuthUrl({ state }: { state: string }) {
  const env = getPinterestEnv();
  const url = new URL(PINTEREST_OAUTH_URL);

  url.searchParams.set('client_id', env.appId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', PINTEREST_SCOPES.join(','));
  url.searchParams.set('state', state);

  return url;
}

export async function exchangePinterestCodeForTokens(code: string) {
  const env = getPinterestEnv();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.redirectUri,
  });
  const credentials = Buffer.from(`${env.appId}:${env.appSecret}`).toString('base64');
  const response = await fetch(PINTEREST_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as PinterestTokenResponse | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Pinterest token exchange failed.');
  }

  return payload;
}

export async function completePinterestOAuthConnection(input: {
  workspaceId: string;
  userId: string;
  code: string;
}) {
  const tokens = await exchangePinterestCodeForTokens(input.code);
  const accessToken = tokens.access_token ?? '';
  const boardsResponse = await callPinterestApi<PinterestBoardsResponse>({
    path: 'boards?page_size=25',
    accessToken,
  }).catch(() => null);
  const boards = boardsResponse?.items ?? boardsResponse?.data ?? [];
  const firstBoard = boards.find((board) => safeString(board.id) && safeString(board.name)) ?? null;
  const scopes = tokens.scope
    ? tokens.scope.split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean)
    : [...PINTEREST_SCOPES];

  await upsertPinterestConnection({
    workspaceId: input.workspaceId,
    userId: input.userId,
    encryptedAccessToken: encryptToken(accessToken),
    encryptedRefreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    tokenExpiresAt: buildExpiresAt(tokens.expires_in),
    scopes,
    metadata: {
      connected_via: 'pinterest_oauth',
      selected_pinterest_board_id: firstBoard ? safeString(firstBoard.id) : null,
      selected_pinterest_board_name: firstBoard ? safeString(firstBoard.name) : null,
      selected_board_id: firstBoard ? safeString(firstBoard.id) : null,
      selected_board_name: firstBoard ? safeString(firstBoard.name) : null,
      selected_at: firstBoard ? new Date().toISOString() : null,
      token_type: tokens.token_type ?? null,
    },
  });
}

function normalizeBoards(response: PinterestBoardsResponse | null): PinterestBoardOption[] {
  const boards = response?.items ?? response?.data ?? [];

  return boards
    .map((board) => {
      const id = safeString(board.id);
      const name = safeString(board.name);

      return id && name ? { id, name } : null;
    })
    .filter((board): board is PinterestBoardOption => Boolean(board));
}

export async function listPinterestBoards({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<{ boards: PinterestBoardOption[]; error: string | null }> {
  try {
    const { accessToken } = await getConnectedPinterestAccessToken(workspaceId, userId);
    const boardsResponse = await callPinterestApi<PinterestBoardsResponse>({
      path: 'boards?page_size=100',
      accessToken,
    });

    return {
      boards: normalizeBoards(boardsResponse),
      error: null,
    };
  } catch (error) {
    return {
      boards: [],
      error: mapPinterestErrorToSafeMessage(error),
    };
  }
}

export async function updatePinterestSelectedBoard({
  workspaceId,
  userId,
  boardId,
}: {
  workspaceId: string;
  userId: string;
  boardId: string;
}): Promise<{ error: string | null }> {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return { error: error ?? 'Supabase server credentials are not configured.' };
  }

  const { row, error: connectionError } = await loadPinterestConnection({
    workspaceId,
    userId,
    includeTokens: false,
  });

  if (connectionError || !row) {
    return { error: connectionError ?? PINTEREST_OAUTH_REQUIRED };
  }

  const boardsResult = await listPinterestBoards({ workspaceId, userId });

  if (boardsResult.error) {
    return { error: boardsResult.error };
  }

  const selectedBoard = boardsResult.boards.find((board) => board.id === boardId);

  if (!selectedBoard) {
    return { error: PINTEREST_BOARD_REQUIRED };
  }

  const metadata = {
    ...safeMetadata(row.metadata),
    selected_pinterest_board_id: selectedBoard.id,
    selected_pinterest_board_name: selectedBoard.name,
    selected_board_id: selectedBoard.id,
    selected_board_name: selectedBoard.name,
    selected_at: new Date().toISOString(),
  };

  const { error: updateError } = await client
    .from('ad_connections')
    .update({ metadata })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'pinterest');

  return { error: updateError?.message ?? null };
}

export async function getPinterestConnectionSettings({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<PinterestConnectionSettingsResult> {
  const env = getPinterestEnv();
  const requiredScopes = [...PINTEREST_SCOPES];
  const { row, error } = await loadPinterestConnection({
    workspaceId,
    userId,
    includeTokens: false,
  });

  if (env.missing.length > 0 || error || !row) {
    return {
      error: error ?? null,
      status: 'not_connected',
      connectedAt: null,
      updatedAt: null,
      tokenExpiresAt: null,
      grantedScopes: [],
      missingScopes: requiredScopes,
      missingEnvironmentVariables: env.missing,
      connectedAccount: null,
      tokenStatus: row ? 'missing' : 'not_connected',
      boards: [],
      selectedBoardId: null,
      selectedBoardName: null,
    };
  }

  const metadata = safeMetadata(row.metadata);
  const status = normalizeConnectionStatus(row.status, row.token_expires_at);
  const grantedScopes = Array.isArray(row.scopes) ? row.scopes : [];
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  const boardsResult = status === 'connected'
    ? await listPinterestBoards({ workspaceId, userId })
    : { boards: [] as PinterestBoardOption[], error: null };

  return {
    error: boardsResult.error,
    status,
    connectedAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    tokenExpiresAt: row.token_expires_at,
    grantedScopes,
    missingScopes,
    missingEnvironmentVariables: env.missing,
    connectedAccount:
      safeString(metadata.username) ??
      safeString(metadata.account_name) ??
      safeString(metadata.pinterest_user_id),
    tokenStatus:
      status === 'connected'
        ? 'valid'
        : status === 'expired'
          ? 'expired'
          : 'missing',
    boards: boardsResult.boards,
    selectedBoardId:
      safeString(metadata.selected_pinterest_board_id) ?? safeString(metadata.selected_board_id),
    selectedBoardName:
      safeString(metadata.selected_pinterest_board_name) ?? safeString(metadata.selected_board_name),
  };
}

export async function getPinterestPublishingReadiness({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<ProviderReadinessResult> {
  const env = getPinterestEnv();

  if (env.missing.length > 0) {
    return {
      provider: 'pinterest',
      state: 'setup_required',
      message: getPinterestEnvMissingMessage(env.missing),
      missing: env.missing,
    };
  }

  try {
    const { metadata } = await getConnectedPinterestAccessToken(workspaceId, userId);
    const boardId =
      safeString(metadata.selected_pinterest_board_id) ?? safeString(metadata.selected_board_id);

    if (!boardId) {
      return {
        provider: 'pinterest',
        state: 'setup_required',
        message: PINTEREST_BOARD_REQUIRED,
        missing: ['Pinterest board ID'],
      };
    }

    return {
      provider: 'pinterest',
      state: 'ready',
      message: 'Provider is ready.',
      missing: [],
      details: {
        selectedBoardId: boardId,
        selectedBoardName:
          safeString(metadata.selected_pinterest_board_name) ?? safeString(metadata.selected_board_name),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pinterest readiness failed.';
    const safeMessage = mapPinterestErrorToSafeMessage(error, message);

    if (safeMessage === PINTEREST_OAUTH_REQUIRED) {
      return {
        provider: 'pinterest',
        state: 'token_missing',
        message: safeMessage,
        missing: ['Pinterest OAuth connection'],
      };
    }

    if (safeMessage.toLowerCase().includes('pinterest setup required')) {
      return {
        provider: 'pinterest',
        state: 'setup_required',
        message: safeMessage,
        missing: [],
      };
    }

    return {
      provider: 'pinterest',
      state: 'error',
      message: safeMessage,
      missing: [],
    };
  }
}

export async function publishPinterestPin(input: {
  workspaceId: string;
  userId: string;
  title: string;
  description: string | null;
  destinationUrl?: string | null;
  imageUrl: string | null;
}) : Promise<ProviderExecutionResult> {
  try {
    const readiness = await getPinterestPublishingReadiness({
      workspaceId: input.workspaceId,
      userId: input.userId,
    });

    if (readiness.state !== 'ready') {
      return {
        provider: 'pinterest',
        actionType: 'publish_pin',
        status: readiness.state === 'approval_pending' ? 'approval_pending' : 'setup_required',
        message: readiness.message,
      };
    }

    if (!isPublicHttpsUrl(input.imageUrl)) {
      return {
        provider: 'pinterest',
        actionType: 'publish_pin',
        status: 'setup_required',
        message: PINTEREST_IMAGE_URL_REQUIRED,
      };
    }

    const { accessToken, metadata } = await getConnectedPinterestAccessToken(
      input.workspaceId,
      input.userId
    );

    const boardId =
      safeString(metadata.selected_pinterest_board_id) ?? safeString(metadata.selected_board_id);
    const boardName =
      safeString(metadata.selected_pinterest_board_name) ?? safeString(metadata.selected_board_name);

    if (!boardId) {
      return {
        provider: 'pinterest',
        actionType: 'publish_pin',
        status: 'setup_required',
        message: PINTEREST_BOARD_REQUIRED,
      };
    }

    const pin = await callPinterestApi<PinterestPinResponse>({
      path: 'pins',
      method: 'POST',
      accessToken,
      body: {
        board_id: boardId,
        title: input.title,
        description: input.description ?? input.title,
        link: input.destinationUrl || undefined,
        media_source: {
          source_type: 'image_url',
          url: input.imageUrl,
        },
      },
    });

    return {
      provider: 'pinterest',
      actionType: 'publish_pin',
      status: 'succeeded',
      message: 'Published successfully.',
      providerExternalId: pin.id ?? null,
      providerResponseSummary: {
        board_id: boardId,
        board_name: boardName,
        pin_id: pin.id ?? null,
        title: pin.title ?? input.title,
        destination_url: input.destinationUrl ?? null,
      },
    };
  } catch (error) {
    const message = mapPinterestErrorToSafeMessage(error);
    const isSetupRequired =
      message.toLowerCase().includes('pinterest setup required') ||
      [
        PINTEREST_APP_ID_OR_CLIENT_ID_REQUIRED,
        PINTEREST_SECRET_REQUIRED,
        PINTEREST_REDIRECT_URI_REQUIRED,
        PINTEREST_OAUTH_REQUIRED,
        PINTEREST_REFRESH_TOKEN_REQUIRED,
        PINTEREST_BOARD_REQUIRED,
        PINTEREST_MEDIA_REQUIRED,
        PINTEREST_IMAGE_URL_REQUIRED,
      ].includes(message);

    return {
      provider: 'pinterest',
      actionType: 'publish_pin',
      status: isSetupRequired ? 'setup_required' : 'failed',
      message,
    };
  }
}
