import 'server-only';

const GOOGLE_ADS_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://www.googleapis.com/oauth2/v3/token';
const DEFAULT_GOOGLE_ADS_API_VERSION = 'v22';
export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

export type GoogleAdsConfigStatus =
  | 'configured'
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'missing_developer_token'
  | 'missing_redirect_uri';

export type GoogleAdsRequiredEnvVar =
  | 'GOOGLE_ADS_CLIENT_ID'
  | 'GOOGLE_ADS_CLIENT_SECRET'
  | 'GOOGLE_ADS_DEVELOPER_TOKEN'
  | 'GOOGLE_ADS_REDIRECT_URI';

export interface GoogleAdsConfigReadiness {
  status: GoogleAdsConfigStatus;
  isConfigured: boolean;
  missingEnvironmentVariables: GoogleAdsRequiredEnvVar[];
  scopes: readonly string[];
}

interface GoogleAdsEnv {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  redirectUri: string;
  loginCustomerId: string | null;
  apiVersion: string;
}

interface GoogleOAuthTokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
}

interface GoogleAdsAccessibleCustomersResponse {
  resourceNames?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
}

export interface GoogleOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
  scope: string | null;
}

export interface GoogleAdsAccessibleCustomer {
  resourceName: string;
  customerId: string;
  displayName: string | null;
  accountTypeHint: string | null;
}

type GoogleAdsApiErrorKind = 'invalid_token' | 'permission' | 'unknown';

export class GoogleAdsConfigError extends Error {
  readonly status: GoogleAdsConfigStatus;
  readonly missingEnvironmentVariables: GoogleAdsRequiredEnvVar[];

  constructor(
    status: GoogleAdsConfigStatus,
    missingEnvironmentVariables: GoogleAdsRequiredEnvVar[]
  ) {
    super('Google Ads OAuth environment variables are not fully configured.');
    this.name = 'GoogleAdsConfigError';
    this.status = status;
    this.missingEnvironmentVariables = missingEnvironmentVariables;
  }
}

export class GoogleAdsApiError extends Error {
  readonly kind: GoogleAdsApiErrorKind;
  readonly status: number;

  constructor(kind: GoogleAdsApiErrorKind, message: string, status: number) {
    super(message);
    this.name = 'GoogleAdsApiError';
    this.kind = kind;
    this.status = status;
  }
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Google Ads helpers can only run on the server.');
  }
}

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() ?? '';
}

function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function safeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeGoogleAdsApiVersion(value: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return DEFAULT_GOOGLE_ADS_API_VERSION;
  }

  return normalized.startsWith('v') ? normalized : `v${normalized}`;
}

function normalizeGoogleAdsCustomerId(value: string | null) {
  const normalized = value?.replace(/\D/g, '') ?? '';
  return normalized || null;
}

function getMissingGoogleAdsEnvVars(): GoogleAdsRequiredEnvVar[] {
  const missing: GoogleAdsRequiredEnvVar[] = [];

  if (!getTrimmedEnv('GOOGLE_ADS_CLIENT_ID')) {
    missing.push('GOOGLE_ADS_CLIENT_ID');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_CLIENT_SECRET')) {
    missing.push('GOOGLE_ADS_CLIENT_SECRET');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_DEVELOPER_TOKEN')) {
    missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
  }

  if (!getTrimmedEnv('GOOGLE_ADS_REDIRECT_URI')) {
    missing.push('GOOGLE_ADS_REDIRECT_URI');
  }

  return missing;
}

function getStatusFromMissingEnv(
  missingEnvironmentVariables: GoogleAdsRequiredEnvVar[]
): GoogleAdsConfigStatus {
  if (missingEnvironmentVariables.includes('GOOGLE_ADS_CLIENT_ID')) {
    return 'missing_client_id';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_CLIENT_SECRET')) {
    return 'missing_client_secret';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_DEVELOPER_TOKEN')) {
    return 'missing_developer_token';
  }

  if (missingEnvironmentVariables.includes('GOOGLE_ADS_REDIRECT_URI')) {
    return 'missing_redirect_uri';
  }

  return 'configured';
}

export function getGoogleAdsReadOnlyScopes() {
  return [GOOGLE_ADS_SCOPE] as const;
}

export function getGoogleAdsEnv(): GoogleAdsEnv {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingGoogleAdsEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  if (status !== 'configured') {
    throw new GoogleAdsConfigError(status, missingEnvironmentVariables);
  }

  return {
    clientId: getTrimmedEnv('GOOGLE_ADS_CLIENT_ID'),
    clientSecret: getTrimmedEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developerToken: getTrimmedEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
    redirectUri: getTrimmedEnv('GOOGLE_ADS_REDIRECT_URI'),
    loginCustomerId: normalizeGoogleAdsCustomerId(
      getTrimmedEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID') || null
    ),
    apiVersion: normalizeGoogleAdsApiVersion(
      getTrimmedEnv('GOOGLE_ADS_API_VERSION') || null
    ),
  };
}

export function getGoogleAdsConfigReadiness(): GoogleAdsConfigReadiness {
  assertServerOnly();

  const missingEnvironmentVariables = getMissingGoogleAdsEnvVars();
  const status = getStatusFromMissingEnv(missingEnvironmentVariables);

  return {
    status,
    isConfigured: status === 'configured',
    missingEnvironmentVariables,
    scopes: getGoogleAdsReadOnlyScopes(),
  };
}

export function buildGoogleAdsOAuthUrl({ state }: { state: string }) {
  const env = getGoogleAdsEnv();
  const url = new URL(GOOGLE_ADS_OAUTH_URL);

  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_ADS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return url;
}

function classifyGoogleAdsApiError(status: number): GoogleAdsApiErrorKind {
  if (status === 401) {
    return 'invalid_token';
  }

  if (status === 403) {
    return 'permission';
  }

  return 'unknown';
}

async function fetchGoogleOAuthToken(
  body: URLSearchParams
): Promise<GoogleOAuthToken> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | GoogleOAuthTokenPayload
    | null;
  const accessToken = safeString(payload?.access_token);

  if (!response.ok || payload?.error || !accessToken) {
    throw new GoogleAdsApiError(
      response.status === 400 ? 'invalid_token' : classifyGoogleAdsApiError(response.status),
      'Google OAuth token request failed.',
      response.status
    );
  }

  return {
    accessToken,
    refreshToken: safeString(payload?.refresh_token),
    expiresIn: safeNumber(payload?.expires_in),
    tokenType: safeString(payload?.token_type),
    scope: safeString(payload?.scope),
  };
}

export async function exchangeGoogleCodeForTokens(
  code: string
): Promise<GoogleOAuthToken> {
  assertServerOnly();

  const env = getGoogleAdsEnv();
  const body = new URLSearchParams();

  body.set('grant_type', 'authorization_code');
  body.set('client_id', env.clientId);
  body.set('client_secret', env.clientSecret);
  body.set('redirect_uri', env.redirectUri);
  body.set('code', code);

  return fetchGoogleOAuthToken(body);
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<GoogleOAuthToken> {
  assertServerOnly();

  if (!refreshToken.trim()) {
    throw new GoogleAdsApiError('invalid_token', 'Google refresh token is missing.', 0);
  }

  const env = getGoogleAdsEnv();
  const body = new URLSearchParams();

  body.set('grant_type', 'refresh_token');
  body.set('client_id', env.clientId);
  body.set('client_secret', env.clientSecret);
  body.set('refresh_token', refreshToken);

  return fetchGoogleOAuthToken(body);
}

function buildGoogleAdsApiUrl(path: string, env = getGoogleAdsEnv()) {
  return new URL(
    `https://googleads.googleapis.com/${env.apiVersion}/${path.replace(/^\/+/, '')}`
  );
}

function getCustomerIdFromResourceName(resourceName: string) {
  const match = /^customers\/(\d+)$/.exec(resourceName);
  return match?.[1] ?? resourceName.replace(/^customers\//, '');
}

export async function listAccessibleGoogleAdsCustomers(
  accessToken: string
): Promise<GoogleAdsAccessibleCustomer[]> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new GoogleAdsApiError('invalid_token', 'Google Ads access token is missing.', 0);
  }

  const env = getGoogleAdsEnv();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': env.developerToken,
  };

  if (env.loginCustomerId) {
    headers['login-customer-id'] = env.loginCustomerId;
  }

  const response = await fetch(buildGoogleAdsApiUrl('/customers:listAccessibleCustomers', env), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | GoogleAdsAccessibleCustomersResponse
    | null;

  if (!response.ok || payload?.error || !Array.isArray(payload?.resourceNames)) {
    throw new GoogleAdsApiError(
      classifyGoogleAdsApiError(response.status),
      'Google Ads accessible customers request failed.',
      response.status
    );
  }

  return payload.resourceNames
    .filter((resourceName): resourceName is string => typeof resourceName === 'string')
    .map((resourceName) => {
      const customerId = getCustomerIdFromResourceName(resourceName);

      return {
        resourceName,
        customerId,
        displayName: null,
        accountTypeHint: null,
      };
    });
}
