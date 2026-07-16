import {
  withCircuitBreaker,
  CIRCUIT_BREAKER_PROVIDERS,
} from '@/lib/circuit-breaker';

const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
const META_READ_ONLY_SCOPE = 'ads_read';
const META_PAID_ADS_WRITE_SCOPE = 'ads_management';
const META_PUBLISHING_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const;
const META_AD_ACCOUNT_FIELDS = [
  'id',
  'account_id',
  'name',
  'account_status',
  'currency',
  'timezone_name',
].join(',');
const META_AD_ACCOUNTS_PAGE_SIZE = 50;
const META_AD_ACCOUNTS_MAX_PAGES = 2;
const META_AD_ACCOUNTS_MAX_RESULTS = 100;
const META_CAMPAIGN_FIELDS = [
  'id',
  'name',
  'status',
  'effective_status',
  'objective',
  'buying_type',
  'created_time',
  'updated_time',
  'start_time',
  'stop_time',
].join(',');
const META_CAMPAIGNS_PAGE_SIZE = 50;
const META_CAMPAIGNS_MAX_PAGES = 2;
const META_CAMPAIGNS_MAX_RESULTS = 100;
const META_CAMPAIGN_INSIGHTS_FIELDS = [
  'spend',
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'date_start',
  'date_stop',
].join(',');
const META_LEAD_ACTION_MARKERS = [
  'lead',
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'offsite_conversion.fb_pixel_lead',
] as const;
const META_CONVERSION_ACTION_MARKERS = [
  'purchase',
  'complete_registration',
  'contact',
  'submit_application',
  'schedule',
] as const;

type MetaGraphApiErrorKind = 'invalid_token' | 'permission' | 'unknown';

interface MetaGraphErrorPayload {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

interface MetaTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: MetaGraphErrorPayload;
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
  error?: MetaGraphErrorPayload;
}

interface MetaAdAccountPayload {
  id?: unknown;
  account_id?: unknown;
  name?: unknown;
  account_status?: unknown;
  currency?: unknown;
  timezone_name?: unknown;
}

interface MetaAdAccountsResponse {
  data?: MetaAdAccountPayload[];
  paging?: {
    cursors?: {
      after?: string;
    };
  };
  error?: MetaGraphErrorPayload;
}

interface MetaCampaignPayload {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  effective_status?: unknown;
  objective?: unknown;
  buying_type?: unknown;
  created_time?: unknown;
  updated_time?: unknown;
  start_time?: unknown;
  stop_time?: unknown;
}

interface MetaCampaignsResponse {
  data?: MetaCampaignPayload[];
  paging?: {
    cursors?: {
      after?: string;
    };
  };
  error?: MetaGraphErrorPayload;
}

interface MetaActionPayload {
  action_type?: unknown;
  value?: unknown;
}

interface MetaCampaignInsightsPayload {
  spend?: unknown;
  impressions?: unknown;
  reach?: unknown;
  clicks?: unknown;
  ctr?: unknown;
  cpc?: unknown;
  cpm?: unknown;
  actions?: unknown;
  date_start?: unknown;
  date_stop?: unknown;
}

interface MetaCampaignInsightsResponse {
  data?: MetaCampaignInsightsPayload[];
  error?: MetaGraphErrorPayload;
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

export interface MetaAdAccount {
  id: string | null;
  accountId: string | null;
  name: string | null;
  accountStatus: number | null;
  currency: string | null;
  timezoneName: string | null;
}

export interface MetaCampaign {
  id: string | null;
  name: string | null;
  status: string | null;
  effectiveStatus: string | null;
  objective: string | null;
  buyingType: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  startTime: string | null;
  stopTime: string | null;
}

export interface MetaCampaignInsights {
  hasData: boolean;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  leads: number | null;
  conversions: number | null;
  dateStart: string | null;
  dateStop: string | null;
}

export class MetaGraphApiError extends Error {
  readonly kind: MetaGraphApiErrorKind;
  readonly status: number;
  readonly code: number | null;

  constructor(kind: MetaGraphApiErrorKind, message: string, status: number, code?: number) {
    super(message);
    this.name = 'MetaGraphApiError';
    this.kind = kind;
    this.status = status;
    this.code = code ?? null;
  }
}

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Meta Ads helpers can only run on the server.');
  }
}

function sanitizeMetaError(message: string | undefined) {
  return message?.trim() || 'Meta OAuth request failed.';
}

function classifyMetaGraphApiError(
  status: number,
  error: MetaGraphErrorPayload | undefined
): MetaGraphApiErrorKind {
  const errorType = error?.type?.toLowerCase() ?? '';

  if (status === 401 || error?.code === 190) {
    return 'invalid_token';
  }

  if (
    status === 403 ||
    error?.code === 10 ||
    error?.code === 200 ||
    errorType.includes('permission')
  ) {
    return 'permission';
  }

  return 'unknown';
}

function buildMetaGraphUrl(path: string, env = getMetaEnv()) {
  return new URL(`https://graph.facebook.com/${env.graphApiVersion}/${path.replace(/^\/+/, '')}`);
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

function mapMetaAdAccount(account: MetaAdAccountPayload): MetaAdAccount {
  return {
    id: safeString(account.id),
    accountId: safeString(account.account_id),
    name: safeString(account.name),
    accountStatus: safeNumber(account.account_status),
    currency: safeString(account.currency),
    timezoneName: safeString(account.timezone_name),
  };
}

function normalizeMetaAdAccountId(adAccountId: string) {
  const normalized = adAccountId.trim().replace(/^act_/i, '');

  if (!normalized || !/^\d+$/.test(normalized)) {
    throw new MetaGraphApiError('unknown', 'Meta ad account ID is missing.', 0);
  }

  return normalized;
}

function normalizeMetaCampaignId(campaignId: string) {
  const normalized = campaignId.trim();

  if (!normalized || !/^\d+$/.test(normalized)) {
    throw new MetaGraphApiError('unknown', 'Meta campaign ID is missing.', 0);
  }

  return normalized;
}

function mapMetaCampaign(campaign: MetaCampaignPayload): MetaCampaign {
  return {
    id: safeString(campaign.id),
    name: safeString(campaign.name),
    status: safeString(campaign.status),
    effectiveStatus: safeString(campaign.effective_status),
    objective: safeString(campaign.objective),
    buyingType: safeString(campaign.buying_type),
    createdTime: safeString(campaign.created_time),
    updatedTime: safeString(campaign.updated_time),
    startTime: safeString(campaign.start_time),
    stopTime: safeString(campaign.stop_time),
  };
}

function emptyMetaCampaignInsights(): MetaCampaignInsights {
  return {
    hasData: false,
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    ctr: null,
    cpc: null,
    cpm: null,
    leads: null,
    conversions: null,
    dateStart: null,
    dateStop: null,
  };
}

function isMetaActionPayload(value: unknown): value is MetaActionPayload {
  return typeof value === 'object' && value !== null;
}

function actionTypeContains(actionType: string, markers: readonly string[]) {
  return markers.some((marker) => actionType.includes(marker));
}

function summarizeMetaActions(actions: unknown) {
  if (!Array.isArray(actions)) {
    return {
      leads: 0,
      conversions: 0,
    };
  }

  return actions.reduce(
    (summary, action) => {
      if (!isMetaActionPayload(action)) {
        return summary;
      }

      const actionType = safeString(action.action_type)?.toLowerCase() ?? '';
      const value = safeNumber(action.value);

      if (!actionType || value === null) {
        return summary;
      }

      if (actionTypeContains(actionType, META_LEAD_ACTION_MARKERS)) {
        summary.leads += value;
      }

      if (actionTypeContains(actionType, META_CONVERSION_ACTION_MARKERS)) {
        summary.conversions += value;
      }

      return summary;
    },
    {
      leads: 0,
      conversions: 0,
    }
  );
}

function mapMetaCampaignInsights(
  insight: MetaCampaignInsightsPayload | undefined
): MetaCampaignInsights {
  if (!insight) {
    return emptyMetaCampaignInsights();
  }

  const actionSummary = summarizeMetaActions(insight.actions);

  return {
    hasData: true,
    spend: safeNumber(insight.spend),
    impressions: safeNumber(insight.impressions),
    reach: safeNumber(insight.reach),
    clicks: safeNumber(insight.clicks),
    ctr: safeNumber(insight.ctr),
    cpc: safeNumber(insight.cpc),
    cpm: safeNumber(insight.cpm),
    leads: actionSummary.leads,
    conversions: actionSummary.conversions,
    dateStart: safeString(insight.date_start),
    dateStop: safeString(insight.date_stop),
  };
}

async function fetchMetaToken(url: URL): Promise<MetaAccessToken> {
  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.META_API,
    () =>
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      })
  );
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
  url.searchParams.set('scope', [META_READ_ONLY_SCOPE, ...META_PUBLISHING_SCOPES].join(','));
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

  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.META_API,
    () =>
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      })
  );
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

export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new MetaGraphApiError('invalid_token', 'Meta access token is missing.', 0);
  }

  const accounts: MetaAdAccount[] = [];
  let after: string | undefined;

  for (
    let page = 0;
    page < META_AD_ACCOUNTS_MAX_PAGES && accounts.length < META_AD_ACCOUNTS_MAX_RESULTS;
    page += 1
  ) {
    const url = buildMetaGraphUrl('/me/adaccounts');
    const remaining = META_AD_ACCOUNTS_MAX_RESULTS - accounts.length;

    url.searchParams.set('fields', META_AD_ACCOUNT_FIELDS);
    url.searchParams.set('limit', String(Math.min(META_AD_ACCOUNTS_PAGE_SIZE, remaining)));

    if (after) {
      url.searchParams.set('after', after);
    }

    const response = await withCircuitBreaker(
      CIRCUIT_BREAKER_PROVIDERS.META_API,
      () =>
        fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        })
    );
    const payload = (await response.json().catch(() => null)) as
      | MetaAdAccountsResponse
      | null;

    if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
      const error = payload?.error;

      throw new MetaGraphApiError(
        classifyMetaGraphApiError(response.status, error),
        'Meta ad accounts request failed.',
        response.status,
        error?.code
      );
    }

    accounts.push(...payload.data.map(mapMetaAdAccount));

    after = payload.paging?.cursors?.after;

    if (!after || payload.data.length === 0) {
      break;
    }
  }

  return accounts.slice(0, META_AD_ACCOUNTS_MAX_RESULTS);
}

export async function fetchMetaCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<MetaCampaign[]> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new MetaGraphApiError('invalid_token', 'Meta access token is missing.', 0);
  }

  const normalizedAdAccountId = normalizeMetaAdAccountId(adAccountId);
  const campaigns: MetaCampaign[] = [];
  let after: string | undefined;

  for (
    let page = 0;
    page < META_CAMPAIGNS_MAX_PAGES && campaigns.length < META_CAMPAIGNS_MAX_RESULTS;
    page += 1
  ) {
    const url = buildMetaGraphUrl(`/act_${normalizedAdAccountId}/campaigns`);
    const remaining = META_CAMPAIGNS_MAX_RESULTS - campaigns.length;

    url.searchParams.set('fields', META_CAMPAIGN_FIELDS);
    url.searchParams.set('limit', String(Math.min(META_CAMPAIGNS_PAGE_SIZE, remaining)));

    if (after) {
      url.searchParams.set('after', after);
    }

    const response = await withCircuitBreaker(
      CIRCUIT_BREAKER_PROVIDERS.META_API,
      () =>
        fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        })
    );
    const payload = (await response.json().catch(() => null)) as
      | MetaCampaignsResponse
      | null;

    if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
      const error = payload?.error;

      throw new MetaGraphApiError(
        classifyMetaGraphApiError(response.status, error),
        'Meta campaigns request failed.',
        response.status,
        error?.code
      );
    }

    campaigns.push(...payload.data.map(mapMetaCampaign));

    after = payload.paging?.cursors?.after;

    if (!after || payload.data.length === 0) {
      break;
    }
  }

  return campaigns.slice(0, META_CAMPAIGNS_MAX_RESULTS);
}

export async function fetchMetaCampaignInsights(
  accessToken: string,
  campaignId: string
): Promise<MetaCampaignInsights> {
  assertServerOnly();

  if (!accessToken.trim()) {
    throw new MetaGraphApiError('invalid_token', 'Meta access token is missing.', 0);
  }

  const normalizedCampaignId = normalizeMetaCampaignId(campaignId);
  const url = buildMetaGraphUrl(`/${normalizedCampaignId}/insights`);

  url.searchParams.set('date_preset', 'last_30d');
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('fields', META_CAMPAIGN_INSIGHTS_FIELDS);

  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.META_API,
    () =>
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })
  );
  const payload = (await response.json().catch(() => null)) as
    | MetaCampaignInsightsResponse
    | null;

  if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
    const error = payload?.error;

    throw new MetaGraphApiError(
      classifyMetaGraphApiError(response.status, error),
      'Meta campaign insights request failed.',
      response.status,
      error?.code
    );
  }

  return mapMetaCampaignInsights(payload.data[0]);
}

export function getMetaReadOnlyScopes() {
  return [META_READ_ONLY_SCOPE];
}

export function getMetaPaidAdsWriteScopes() {
  return [META_PAID_ADS_WRITE_SCOPE];
}

export function getMetaConnectionScopes() {
  return [META_READ_ONLY_SCOPE, META_PAID_ADS_WRITE_SCOPE, ...META_PUBLISHING_SCOPES];
}
