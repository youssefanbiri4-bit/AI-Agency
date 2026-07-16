import 'server-only';

import {
  withCircuitBreaker,
  CIRCUIT_BREAKER_PROVIDERS,
} from '@/lib/circuit-breaker';

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

interface GoogleAdsApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
}

interface GoogleAdsSearchStreamChunk {
  results?: unknown;
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

export interface GoogleAdsCampaignMetrics {
  customerId: string;
  customerResourceName: string;
  customerName: string | null;
  campaignId: string;
  campaignName: string;
  status: string | null;
  channelType: string | null;
  startDate: string | null;
  endDate: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averageCpc: number | null;
  cost: number | null;
  conversions: number | null;
  conversionsValue: number | null;
}

type GoogleAdsApiErrorKind = 'invalid_token' | 'permission' | 'api_issue' | 'unknown';

const GOOGLE_ADS_CAMPAIGN_METRICS_FIELDS = [
  'campaign.id',
  'campaign.name',
  'campaign.status',
  'campaign.advertising_channel_type',
  'campaign.start_date',
  'campaign.end_date',
  'metrics.impressions',
  'metrics.clicks',
  'metrics.ctr',
  'metrics.average_cpc',
  'metrics.cost_micros',
  'metrics.conversions',
  'metrics.conversions_value',
] as const;

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

function safeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
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

function normalizeGoogleAdsCampaignLimit(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 50;
  }

  return Math.max(1, Math.min(50, Math.floor(value)));
}

function microsToCurrencyUnits(value: unknown) {
  const micros = safeNumber(value);
  return micros === null ? null : micros / 1_000_000;
}

function readApiValue(
  record: Record<string, unknown> | null,
  camelKey: string,
  snakeKey?: string
) {
  if (!record) {
    return null;
  }

  if (camelKey in record) {
    return record[camelKey];
  }

  if (snakeKey && snakeKey in record) {
    return record[snakeKey];
  }

  return null;
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

function classifyGoogleAdsApiError(
  status: number,
  payload?: GoogleAdsApiErrorPayload | null
): GoogleAdsApiErrorKind {
  const apiStatus = safeString(payload?.error?.status)?.toUpperCase() ?? '';
  const apiMessage = safeString(payload?.error?.message)?.toLowerCase() ?? '';

  if (status === 401) {
    return 'invalid_token';
  }

  if (apiStatus === 'UNAUTHENTICATED') {
    return 'invalid_token';
  }

  if (
    apiMessage.includes('developer token') ||
    apiMessage.includes('developer-token') ||
    apiMessage.includes('login-customer-id') ||
    apiStatus === 'INVALID_ARGUMENT' ||
    apiStatus === 'FAILED_PRECONDITION' ||
    status === 400 ||
    status === 404
  ) {
    return 'api_issue';
  }

  if (status === 403 || apiStatus === 'PERMISSION_DENIED') {
    return 'permission';
  }

  return 'unknown';
}

function buildGoogleAdsApiHeaders(
  accessToken: string,
  env: GoogleAdsEnv,
  options: { hasJsonBody?: boolean } = {}
) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': env.developerToken,
  };

  if (options.hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (env.loginCustomerId) {
    headers['login-customer-id'] = env.loginCustomerId;
  }

  return headers;
}

function buildGoogleAdsCampaignMetricsQuery(limit: number) {
  return `SELECT
  ${GOOGLE_ADS_CAMPAIGN_METRICS_FIELDS.join(',\n  ')}
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY campaign.id
LIMIT ${normalizeGoogleAdsCampaignLimit(limit)}`;
}

export function getGoogleAdsCampaignMetricsFields() {
  return [...GOOGLE_ADS_CAMPAIGN_METRICS_FIELDS];
}

async function fetchGoogleOAuthToken(
  body: URLSearchParams
): Promise<GoogleOAuthToken> {
  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS,
    () =>
      fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
      })
  );
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
  return match?.[1] ?? null;
}

export async function listAccessibleGoogleAdsCustomers(
  accessToken: string
): Promise<GoogleAdsAccessibleCustomer[]> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new GoogleAdsApiError('invalid_token', 'Google Ads access token is missing.', 0);
  }

  const env = getGoogleAdsEnv();
  const headers = buildGoogleAdsApiHeaders(accessToken, env);

  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS_API,
    () =>
      fetch(buildGoogleAdsApiUrl('/customers:listAccessibleCustomers', env), {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
  );
  const payload = (await response.json().catch(() => null)) as
    | GoogleAdsAccessibleCustomersResponse
    | null;

  if (!response.ok || payload?.error || !Array.isArray(payload?.resourceNames)) {
    throw new GoogleAdsApiError(
      classifyGoogleAdsApiError(response.status, payload),
      'Google Ads accessible customers request failed.',
      response.status
    );
  }

  return payload.resourceNames
    .filter((resourceName): resourceName is string => typeof resourceName === 'string')
    .flatMap((resourceName) => {
      const customerId = getCustomerIdFromResourceName(resourceName);

      if (!customerId) {
        return [];
      }

      return {
        resourceName,
        customerId,
        displayName: null,
        accountTypeHint: null,
      };
    });
}

function getGoogleAdsSearchStreamErrorPayload(
  payload: unknown
): GoogleAdsApiErrorPayload | null {
  const record = safeRecord(payload);

  if (record?.error) {
    return { error: safeRecord(record.error) ?? undefined };
  }

  if (Array.isArray(payload)) {
    const chunkWithError = payload.find((chunk) => Boolean(safeRecord(chunk)?.error));
    const chunkRecord = safeRecord(chunkWithError);

    if (chunkRecord?.error) {
      return { error: safeRecord(chunkRecord.error) ?? undefined };
    }
  }

  return null;
}

function getGoogleAdsSearchStreamResults(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((chunk) => {
    const chunkRecord = safeRecord(chunk) as GoogleAdsSearchStreamChunk | null;
    return Array.isArray(chunkRecord?.results) ? chunkRecord.results : [];
  });
}

function mapGoogleAdsCampaignMetricsResult({
  result,
  customer,
}: {
  result: unknown;
  customer: GoogleAdsAccessibleCustomer;
}): GoogleAdsCampaignMetrics | null {
  const resultRecord = safeRecord(result);
  const campaign = safeRecord(resultRecord?.campaign);
  const metrics = safeRecord(resultRecord?.metrics);
  const campaignId = safeString(readApiValue(campaign, 'id'));

  if (!campaignId) {
    return null;
  }

  return {
    customerId: customer.customerId,
    customerResourceName: customer.resourceName,
    customerName: customer.displayName,
    campaignId,
    campaignName: safeString(readApiValue(campaign, 'name')) ?? campaignId,
    status: safeString(readApiValue(campaign, 'status')),
    channelType: safeString(
      readApiValue(campaign, 'advertisingChannelType', 'advertising_channel_type')
    ),
    startDate: safeString(readApiValue(campaign, 'startDate', 'start_date')),
    endDate: safeString(readApiValue(campaign, 'endDate', 'end_date')),
    impressions: safeNumber(readApiValue(metrics, 'impressions')),
    clicks: safeNumber(readApiValue(metrics, 'clicks')),
    ctr: safeNumber(readApiValue(metrics, 'ctr')),
    averageCpc: microsToCurrencyUnits(
      readApiValue(metrics, 'averageCpc', 'average_cpc')
    ),
    cost: microsToCurrencyUnits(readApiValue(metrics, 'costMicros', 'cost_micros')),
    conversions: safeNumber(readApiValue(metrics, 'conversions')),
    conversionsValue: safeNumber(
      readApiValue(metrics, 'conversionsValue', 'conversions_value')
    ),
  };
}

export async function fetchGoogleAdsCampaignMetrics(
  accessToken: string,
  customer: GoogleAdsAccessibleCustomer,
  options: { limit?: number } = {}
): Promise<GoogleAdsCampaignMetrics[]> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new GoogleAdsApiError('invalid_token', 'Google Ads access token is missing.', 0);
  }

  const customerId = normalizeGoogleAdsCustomerId(customer.customerId);

  if (!customerId) {
    throw new GoogleAdsApiError(
      'api_issue',
      'Google Ads customer ID is not valid for campaign metrics.',
      0
    );
  }

  const env = getGoogleAdsEnv();
  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS_API,
    () =>
      fetch(
        buildGoogleAdsApiUrl(`/customers/${customerId}/googleAds:searchStream`, env),
        {
          method: 'POST',
          headers: buildGoogleAdsApiHeaders(accessToken, env, { hasJsonBody: true }),
          body: JSON.stringify({
            query: buildGoogleAdsCampaignMetricsQuery(options.limit ?? 50),
          }),
          cache: 'no-store',
        }
      )
  );
  const payload = (await response.json().catch(() => null)) as unknown;
  const errorPayload = getGoogleAdsSearchStreamErrorPayload(payload);

  if (!response.ok || errorPayload) {
    throw new GoogleAdsApiError(
      classifyGoogleAdsApiError(response.status, errorPayload),
      'Google Ads campaign metrics request failed.',
      response.status
    );
  }

  return getGoogleAdsSearchStreamResults(payload)
    .map((result) => mapGoogleAdsCampaignMetricsResult({ result, customer }))
    .filter((campaign): campaign is GoogleAdsCampaignMetrics => campaign !== null);
}
