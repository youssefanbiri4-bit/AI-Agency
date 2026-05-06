const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
const META_READ_ONLY_SCOPE = 'ads_read';

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

interface MetaDebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    expires_at?: number;
    is_valid?: boolean;
    issued_at?: number;
    scopes?: string[];
    user_id?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export interface MetaEnv {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
}

export interface MetaAccessToken {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number | null;
}

export interface MetaTokenDebugInfo {
  appId: string | null;
  tokenType: string | null;
  application: string | null;
  expiresAt: number | null;
  isValid: boolean;
  issuedAt: number | null;
  scopes: string[];
  userId: string | null;
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Meta Ads helpers can only run on the server.');
  }
}

function sanitizeMetaError(message: string | undefined) {
  return message?.trim() || 'Meta OAuth request failed.';
}

function buildMetaGraphUrl(path: string, env = getMetaEnv()) {
  return new URL(`https://graph.facebook.com/${env.graphApiVersion}/${path.replace(/^\/+/, '')}`);
}

async function fetchMetaToken(url: URL): Promise<MetaAccessToken> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as MetaTokenResponse | null;

  if (!response.ok || payload?.error || !payload?.access_token) {
    throw new Error(sanitizeMetaError(payload?.error?.message));
  }

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type ?? null,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
  };
}

export function getMetaEnv(): MetaEnv {
  assertServerOnly();

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  const graphApiVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Meta Ads OAuth environment variables are not fully configured.');
  }

  return {
    appId,
    appSecret,
    redirectUri,
    graphApiVersion,
  };
}

export function buildMetaOAuthUrl({ state }: { state: string }) {
  const env = getMetaEnv();
  const url = new URL(`https://www.facebook.com/${env.graphApiVersion}/dialog/oauth`);

  url.searchParams.set('client_id', env.appId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', META_READ_ONLY_SCOPE);
  url.searchParams.set('state', state);

  return url;
}

export async function exchangeMetaCodeForShortLivedToken(
  code: string
): Promise<MetaAccessToken> {
  const env = getMetaEnv();
  const url = buildMetaGraphUrl('/oauth/access_token', env);

  url.searchParams.set('client_id', env.appId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('client_secret', env.appSecret);
  url.searchParams.set('code', code);

  return fetchMetaToken(url);
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<MetaAccessToken> {
  const env = getMetaEnv();
  const url = buildMetaGraphUrl('/oauth/access_token', env);

  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', env.appId);
  url.searchParams.set('client_secret', env.appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  return fetchMetaToken(url);
}

export async function getMetaTokenDebugInfo(token: string): Promise<MetaTokenDebugInfo> {
  const env = getMetaEnv();
  const url = buildMetaGraphUrl('/debug_token', env);

  url.searchParams.set('input_token', token);
  url.searchParams.set('access_token', `${env.appId}|${env.appSecret}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as MetaDebugTokenResponse | null;

  if (!response.ok || payload?.error || !payload?.data) {
    throw new Error(sanitizeMetaError(payload?.error?.message));
  }

  return {
    appId: payload.data.app_id ?? null,
    tokenType: payload.data.type ?? null,
    application: payload.data.application ?? null,
    expiresAt:
      typeof payload.data.expires_at === 'number' ? payload.data.expires_at : null,
    isValid: Boolean(payload.data.is_valid),
    issuedAt:
      typeof payload.data.issued_at === 'number' ? payload.data.issued_at : null,
    scopes: Array.isArray(payload.data.scopes) ? payload.data.scopes : [],
    userId: payload.data.user_id ?? null,
  };
}

export function getMetaReadOnlyScopes() {
  return [META_READ_ONLY_SCOPE];
}
