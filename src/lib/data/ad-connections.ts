import { getSupabaseAdmin } from '@/lib/supabase-server';
import { decryptToken, encryptToken } from '@/lib/ads/encryption';
import {
  fetchGoogleAdsCampaignMetrics,
  getGoogleAdsReadOnlyScopes,
  GoogleAdsApiError,
  listAccessibleGoogleAdsCustomers,
  refreshGoogleAccessToken,
  type GoogleAdsAccessibleCustomer,
  type GoogleAdsCampaignMetrics,
} from '@/lib/ads/google-ads';
import {
  fetchMetaAdAccounts,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  MetaGraphApiError,
  type MetaAdAccount,
  type MetaCampaign,
  type MetaCampaignInsights,
} from '@/lib/ads/meta';
import type { AdConnectionProvider, AdConnectionStatus } from '@/types/database';
import type { JsonObject } from '@/types';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface MetaConnectionStatusData {
  provider: 'meta';
  status: AdConnectionStatus | 'not_connected';
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
  adAccountId: string | null;
  adAccountName: string | null;
  metadata: JsonObject;
}

export interface MetaAdAccountOption {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  timezoneName: string | null;
}

export interface UpsertMetaConnectionInput {
  workspaceId: string;
  userId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string | null;
  tokenExpiresAt?: string | null;
  scopes: string[];
  metadata?: JsonObject;
}

export interface GoogleAdsConnectionStatusData {
  provider: 'google_ads';
  status: AdConnectionStatus | 'not_connected';
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
}

export interface UpsertGoogleAdsConnectionInput {
  workspaceId: string;
  userId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt?: string | null;
  scopes: string[];
  metadata?: JsonObject;
}

export type MetaAdAccountsState =
  | 'not_connected'
  | 'connected'
  | 'empty'
  | 'token_invalid'
  | 'permission_issue'
  | 'error';

export type MetaCampaignsState =
  | 'connected'
  | 'empty'
  | 'token_invalid'
  | 'permission_issue'
  | 'error';

export type MetaCampaignInsightsState =
  | 'connected'
  | 'empty'
  | 'token_invalid'
  | 'permission_issue'
  | 'error'
  | 'not_requested';

export interface MetaCampaignWithInsights extends MetaCampaign {
  insightsState: MetaCampaignInsightsState;
  insights: MetaCampaignInsights | null;
}

export interface MetaAdAccountCampaignsData extends MetaAdAccount {
  campaignsState: MetaCampaignsState;
  campaigns: MetaCampaignWithInsights[];
}

export interface MetaAdAccountsForWorkspaceData {
  state: MetaAdAccountsState;
  accounts: MetaAdAccountCampaignsData[];
}

export type GoogleAdsCustomersState =
  | 'not_connected'
  | 'connected'
  | 'empty'
  | 'token_invalid'
  | 'permission_issue'
  | 'api_issue'
  | 'error';

export type GoogleAdsCustomerAccount = GoogleAdsAccessibleCustomer;

export interface GoogleAdsAccessibleCustomersForWorkspaceData {
  state: GoogleAdsCustomersState;
  customers: GoogleAdsCustomerAccount[];
}

export type GoogleAdsCampaignMetricsState = GoogleAdsCustomersState;

export type GoogleAdsCustomerCampaignsState =
  | 'connected'
  | 'empty'
  | 'token_invalid'
  | 'permission_issue'
  | 'api_issue'
  | 'not_requested'
  | 'error';

export type GoogleAdsCampaignMetricsRow = GoogleAdsCampaignMetrics;

export interface GoogleAdsCustomerCampaignsData {
  customerId: string;
  customerResourceName: string;
  customerName: string | null;
  campaignsState: GoogleAdsCustomerCampaignsState;
  campaigns: GoogleAdsCampaignMetricsRow[];
}

export interface GoogleAdsCampaignMetricsForWorkspaceData {
  state: GoogleAdsCampaignMetricsState;
  customers: GoogleAdsCustomerCampaignsData[];
}

type ConnectedGoogleAdsCustomersResult =
  | {
      state: 'connected';
      accessToken: string;
      customers: GoogleAdsAccessibleCustomer[];
    }
  | {
      state: 'empty';
    }
  | {
      state: Exclude<GoogleAdsCustomersState, 'connected' | 'empty'>;
    };

type ConnectedMetaAccessTokenResult =
  | {
      state: 'connected';
      accessToken: string;
    }
  | {
      state: Exclude<MetaAdAccountsState, 'connected' | 'empty'>;
    };

type ConnectedGoogleAdsAccessTokenResult =
  | {
      state: 'connected';
      accessToken: string;
    }
  | {
      state: Exclude<GoogleAdsCustomersState, 'connected' | 'empty'>;
    };

const SAFE_META_CONNECTION_SELECT =
  'provider, status, token_expires_at, ad_account_id, ad_account_name, scopes, metadata, created_at, updated_at';
const CONNECTED_META_TOKEN_SELECT = 'access_token, token_expires_at, scopes';
const SAFE_GOOGLE_ADS_CONNECTION_SELECT =
  'provider, status, token_expires_at, scopes, created_at, updated_at';
const CONNECTED_GOOGLE_ADS_TOKEN_SELECT =
  'access_token, refresh_token, token_expires_at, scopes, status, metadata';
const META_CAMPAIGN_ACCOUNT_BATCH_SIZE = 3;
const META_CAMPAIGN_INSIGHTS_MAX_PER_ACCOUNT = 25;
const META_CAMPAIGN_INSIGHTS_MAX_TOTAL = 50;
const GOOGLE_ADS_ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
const GOOGLE_ADS_MAX_CUSTOMERS_TO_INSPECT = 10;
const GOOGLE_ADS_MAX_CAMPAIGNS_PER_CUSTOMER = 50;
const GOOGLE_ADS_MAX_TOTAL_CAMPAIGNS = 100;
const AD_CONNECTIONS_TRACE_PREFIX = '[ad-connections-data]';

const notConnectedMetaConnection: MetaConnectionStatusData = {
  provider: 'meta',
  status: 'not_connected',
  scopes: [],
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  adAccountId: null,
  adAccountName: null,
  metadata: {},
};

const notConnectedGoogleAdsConnection: GoogleAdsConnectionStatusData = {
  provider: 'google_ads',
  status: 'not_connected',
  scopes: [],
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
};

function getAdConnectionAdminClient() {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      client: null,
      error: error ?? 'Supabase server credentials are not configured.',
    };
  }

  return { client, error: null };
}

function assertServerOnlyMetaAccounts() {
  if (typeof window !== 'undefined') {
    throw new Error('Meta ad account helpers can only run on the server.');
  }
}

function assertServerOnlyGoogleAds() {
  if (typeof window !== 'undefined') {
    throw new Error('Google Ads helpers can only run on the server.');
  }
}

function emptyMetaAdAccountsData(
  state: MetaAdAccountsState,
  accounts: MetaAdAccountCampaignsData[] = []
): MetaAdAccountsForWorkspaceData {
  return {
    state,
    accounts,
  };
}

function emptyGoogleAdsAccessibleCustomersData(
  state: GoogleAdsCustomersState,
  customers: GoogleAdsCustomerAccount[] = []
): GoogleAdsAccessibleCustomersForWorkspaceData {
  return {
    state,
    customers,
  };
}

function emptyGoogleAdsCampaignMetricsData(
  state: GoogleAdsCampaignMetricsState,
  customers: GoogleAdsCustomerCampaignsData[] = []
): GoogleAdsCampaignMetricsForWorkspaceData {
  return {
    state,
    customers,
  };
}

function emptyGoogleAdsCustomerCampaignsData(
  customer: GoogleAdsAccessibleCustomer,
  campaignsState: GoogleAdsCustomerCampaignsState
): GoogleAdsCustomerCampaignsData {
  return {
    customerId: customer.customerId,
    customerResourceName: customer.resourceName,
    customerName: customer.displayName,
    campaignsState,
    campaigns: [],
  };
}

function emptyMetaCampaignsData(
  account: MetaAdAccount,
  campaignsState: MetaCampaignsState
): MetaAdAccountCampaignsData {
  return {
    ...account,
    campaignsState,
    campaigns: [],
  };
}

function withEmptyInsights(campaign: MetaCampaign): MetaCampaignWithInsights {
  return {
    ...campaign,
    insightsState: 'not_requested',
    insights: null,
  };
}

function normalizeMetaConnectionStatus(
  status: AdConnectionStatus,
  tokenExpiresAt: string | null
) {
  if (status === 'connected' && tokenExpiresAt && Date.parse(tokenExpiresAt) <= Date.now()) {
    return 'expired';
  }

  return status;
}

function mapMetaConnectionRow(row: {
  provider: AdConnectionProvider;
  status: AdConnectionStatus;
  token_expires_at: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  scopes: string[];
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}): MetaConnectionStatusData {
  return {
    provider: 'meta',
    status: normalizeMetaConnectionStatus(row.status, row.token_expires_at),
    scopes: row.scopes ?? [],
    connectedAt: row.created_at,
    updatedAt: row.updated_at,
    tokenExpiresAt: row.token_expires_at,
    adAccountId: row.ad_account_id,
    adAccountName: row.ad_account_name,
    metadata: safeMetadata(row.metadata),
  };
}

function mapGoogleAdsConnectionRow(row: {
  provider: AdConnectionProvider;
  status: AdConnectionStatus;
  token_expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}): GoogleAdsConnectionStatusData {
  return {
    provider: 'google_ads',
    status: row.status,
    scopes: row.scopes ?? [],
    connectedAt: row.created_at,
    updatedAt: row.updated_at,
    tokenExpiresAt: row.token_expires_at,
  };
}

function buildGoogleAdsTokenExpiresAt(expiresIn: number | null) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function shouldRefreshGoogleAdsAccessToken(tokenExpiresAt: string | null) {
  if (!tokenExpiresAt) {
    return false;
  }

  return Date.parse(tokenExpiresAt) <= Date.now() + GOOGLE_ADS_ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

function safeMetadata(value: JsonObject | null | undefined): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value;
}

export async function getMetaConnectionStatus(
  workspaceId: string,
  userId: string
): Promise<DataResult<MetaConnectionStatusData>> {
  console.info(AD_CONNECTIONS_TRACE_PREFIX, 'before meta connection status query', {
    workspaceId,
    userId,
  });
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(
      notConnectedMetaConnection,
      error ?? 'Supabase server credentials are not configured.'
    );
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(SAFE_META_CONNECTION_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .maybeSingle();
  console.info(AD_CONNECTIONS_TRACE_PREFIX, 'after meta connection status query', {
    workspaceId,
    userId,
    found: Boolean(data),
    error: selectError?.message ?? null,
  });

  if (selectError) {
    return errorDataResult(notConnectedMetaConnection, selectError.message);
  }

  if (!data) {
    return emptyDataResult(notConnectedMetaConnection, true);
  }

  return emptyDataResult(mapMetaConnectionRow(data), true);
}

export async function getGoogleAdsConnectionStatus(
  workspaceId: string,
  userId: string
): Promise<DataResult<GoogleAdsConnectionStatusData>> {
  console.info(AD_CONNECTIONS_TRACE_PREFIX, 'before google ads connection status query', {
    workspaceId,
    userId,
  });
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(
      notConnectedGoogleAdsConnection,
      error ?? 'Supabase server credentials are not configured.'
    );
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(SAFE_GOOGLE_ADS_CONNECTION_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google_ads')
    .maybeSingle();
  console.info(AD_CONNECTIONS_TRACE_PREFIX, 'after google ads connection status query', {
    workspaceId,
    userId,
    found: Boolean(data),
    error: selectError?.message ?? null,
  });

  if (selectError) {
    return errorDataResult(notConnectedGoogleAdsConnection, selectError.message);
  }

  if (!data) {
    return emptyDataResult(notConnectedGoogleAdsConnection, true);
  }

  return emptyDataResult(mapGoogleAdsConnectionRow(data), true);
}

async function loadCampaignsForMetaAdAccount(
  accessToken: string,
  account: MetaAdAccount
): Promise<MetaAdAccountCampaignsData> {
  const adAccountId = account.accountId ?? account.id;

  if (!adAccountId) {
    return emptyMetaCampaignsData(account, 'error');
  }

  try {
    const campaigns = await fetchMetaCampaigns(accessToken, adAccountId);

    return {
      ...account,
      campaignsState: campaigns.length > 0 ? 'connected' : 'empty',
      campaigns: campaigns.map(withEmptyInsights),
    };
  } catch (error) {
    if (error instanceof MetaGraphApiError) {
      if (error.kind === 'invalid_token') {
        return emptyMetaCampaignsData(account, 'token_invalid');
      }

      if (error.kind === 'permission') {
        return emptyMetaCampaignsData(account, 'permission_issue');
      }
    }

    return emptyMetaCampaignsData(account, 'error');
  }
}

async function loadInsightsForMetaCampaign(
  accessToken: string,
  campaign: MetaCampaignWithInsights
): Promise<MetaCampaignWithInsights> {
  if (!campaign.id) {
    return {
      ...campaign,
      insightsState: 'error',
      insights: null,
    };
  }

  try {
    const insights = await fetchMetaCampaignInsights(accessToken, campaign.id);

    return {
      ...campaign,
      insightsState: insights.hasData ? 'connected' : 'empty',
      insights,
    };
  } catch (error) {
    if (error instanceof MetaGraphApiError) {
      if (error.kind === 'invalid_token') {
        return {
          ...campaign,
          insightsState: 'token_invalid',
          insights: null,
        };
      }

      if (error.kind === 'permission') {
        return {
          ...campaign,
          insightsState: 'permission_issue',
          insights: null,
        };
      }
    }

    return {
      ...campaign,
      insightsState: 'error',
      insights: null,
    };
  }
}

async function loadInsightsForMetaAdAccounts(
  accessToken: string,
  accounts: MetaAdAccountCampaignsData[]
) {
  const accountsWithInsights: MetaAdAccountCampaignsData[] = [];
  let totalInsightsRequests = 0;

  for (const account of accounts) {
    let accountInsightsRequests = 0;
    const campaigns: MetaCampaignWithInsights[] = [];

    for (const campaign of account.campaigns) {
      const canRequestInsights =
        account.campaignsState === 'connected' &&
        accountInsightsRequests < META_CAMPAIGN_INSIGHTS_MAX_PER_ACCOUNT &&
        totalInsightsRequests < META_CAMPAIGN_INSIGHTS_MAX_TOTAL;

      if (!canRequestInsights) {
        campaigns.push(campaign);
        continue;
      }

      accountInsightsRequests += 1;
      totalInsightsRequests += 1;
      campaigns.push(await loadInsightsForMetaCampaign(accessToken, campaign));
    }

    accountsWithInsights.push({
      ...account,
      campaigns,
    });
  }

  return accountsWithInsights;
}

async function loadCampaignsForMetaAdAccounts(
  accessToken: string,
  accounts: MetaAdAccount[]
) {
  const accountsWithCampaigns: MetaAdAccountCampaignsData[] = [];

  for (let index = 0; index < accounts.length; index += META_CAMPAIGN_ACCOUNT_BATCH_SIZE) {
    const batch = accounts.slice(index, index + META_CAMPAIGN_ACCOUNT_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((account) => loadCampaignsForMetaAdAccount(accessToken, account))
    );

    accountsWithCampaigns.push(...batchResults);
  }

  return loadInsightsForMetaAdAccounts(accessToken, accountsWithCampaigns);
}

async function loadConnectedMetaAccessToken(
  workspaceId: string,
  userId: string
): Promise<DataResult<ConnectedMetaAccessTokenResult>> {
  assertServerOnlyMetaAccounts();

  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(
      { state: 'error' },
      error ?? 'Supabase server credentials are not configured.'
    );
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(CONNECTED_META_TOKEN_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .eq('status', 'connected')
    .maybeSingle();

  if (selectError) {
    return errorDataResult({ state: 'error' }, selectError.message);
  }

  if (!data) {
    return emptyDataResult({ state: 'not_connected' }, true);
  }

  if (data.token_expires_at && Date.parse(data.token_expires_at) <= Date.now()) {
    return emptyDataResult({ state: 'token_invalid' }, true);
  }

  if (!data.scopes?.includes('ads_read')) {
    return emptyDataResult({ state: 'permission_issue' }, true);
  }

  try {
    return emptyDataResult(
      {
        state: 'connected',
        accessToken: decryptToken(data.access_token),
      },
      true
    );
  } catch {
    return emptyDataResult({ state: 'token_invalid' }, true);
  }
}

async function markGoogleAdsConnectionStatus(
  workspaceId: string,
  userId: string,
  status: AdConnectionStatus
) {
  const { client } = getAdConnectionAdminClient();

  if (!client) {
    return;
  }

  await client
    .from('ad_connections')
    .update({ status })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google_ads');
}

async function loadConnectedGoogleAdsAccessToken(
  workspaceId: string,
  userId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<DataResult<ConnectedGoogleAdsAccessTokenResult>> {
  assertServerOnlyGoogleAds();

  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(
      { state: 'error' },
      error ?? 'Supabase server credentials are not configured.'
    );
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(CONNECTED_GOOGLE_ADS_TOKEN_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google_ads')
    .maybeSingle();

  if (selectError) {
    return errorDataResult({ state: 'error' }, selectError.message);
  }

  if (!data) {
    return emptyDataResult({ state: 'not_connected' }, true);
  }

  if (data.status !== 'connected') {
    return emptyDataResult({ state: 'token_invalid' }, true);
  }

  if (!data.scopes?.includes(getGoogleAdsReadOnlyScopes()[0])) {
    return emptyDataResult({ state: 'permission_issue' }, true);
  }

  const shouldRefresh =
    options.forceRefresh || shouldRefreshGoogleAdsAccessToken(data.token_expires_at);

  if (shouldRefresh) {
    if (!data.refresh_token) {
      await markGoogleAdsConnectionStatus(workspaceId, userId, 'expired');
      return emptyDataResult({ state: 'token_invalid' }, true);
    }

    try {
      const refreshToken = decryptToken(data.refresh_token);
      const refreshedToken = await refreshGoogleAccessToken(refreshToken);
      const tokenExpiresAt = buildGoogleAdsTokenExpiresAt(refreshedToken.expiresIn);
      const encryptedAccessToken = encryptToken(refreshedToken.accessToken);
      const metadata: JsonObject = {
        ...safeMetadata(data.metadata),
        token_type: refreshedToken.tokenType,
        last_refreshed_at: new Date().toISOString(),
      };
      const { error: updateError } = await client
        .from('ad_connections')
        .update({
          access_token: encryptedAccessToken,
          token_expires_at: tokenExpiresAt,
          status: 'connected',
          scopes: [...getGoogleAdsReadOnlyScopes()],
          metadata,
        })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('provider', 'google_ads');

      if (updateError) {
        return errorDataResult({ state: 'error' }, updateError.message);
      }

      return emptyDataResult(
        {
          state: 'connected',
          accessToken: refreshedToken.accessToken,
        },
        true
      );
    } catch (error) {
      if (error instanceof GoogleAdsApiError && error.kind === 'permission') {
        return emptyDataResult({ state: 'permission_issue' }, true);
      }

      await markGoogleAdsConnectionStatus(workspaceId, userId, 'expired');
      return emptyDataResult({ state: 'token_invalid' }, true);
    }
  }

  try {
    return emptyDataResult(
      {
        state: 'connected',
        accessToken: decryptToken(data.access_token),
      },
      true
    );
  } catch {
    await markGoogleAdsConnectionStatus(workspaceId, userId, 'expired');
    return emptyDataResult({ state: 'token_invalid' }, true);
  }
}

function mapGoogleAdsApiErrorToState(
  error: GoogleAdsApiError
): Exclude<GoogleAdsCustomersState, 'connected' | 'empty' | 'not_connected'> {
  if (error.kind === 'invalid_token') {
    return 'token_invalid';
  }

  if (error.kind === 'permission') {
    return 'permission_issue';
  }

  if (error.kind === 'api_issue') {
    return 'api_issue';
  }

  return 'error';
}

async function loadAccessibleGoogleAdsCustomersWithRetry(
  workspaceId: string,
  userId: string
): Promise<DataResult<ConnectedGoogleAdsCustomersResult>> {
  let tokenResult = await loadConnectedGoogleAdsAccessToken(workspaceId, userId);

  if (tokenResult.error) {
    return errorDataResult(
      { state: 'error' },
      'Google Ads customer accounts could not be loaded.',
      tokenResult.isConfigured
    );
  }

  if (tokenResult.data.state !== 'connected') {
    return emptyDataResult({ state: tokenResult.data.state }, true);
  }

  try {
    const customers = await listAccessibleGoogleAdsCustomers(tokenResult.data.accessToken);

    if (customers.length === 0) {
      return emptyDataResult({ state: 'empty' }, true);
    }

    return emptyDataResult(
      {
        state: 'connected',
        accessToken: tokenResult.data.accessToken,
        customers,
      },
      true
    );
  } catch (error) {
    if (!(error instanceof GoogleAdsApiError)) {
      return errorDataResult(
        { state: 'error' },
        'Google Ads customer accounts could not be loaded.'
      );
    }

    if (error.kind !== 'invalid_token') {
      return emptyDataResult({ state: mapGoogleAdsApiErrorToState(error) }, true);
    }

    tokenResult = await loadConnectedGoogleAdsAccessToken(workspaceId, userId, {
      forceRefresh: true,
    });

    if (tokenResult.error) {
      return errorDataResult(
        { state: 'error' },
        'Google Ads customer accounts could not be loaded.',
        tokenResult.isConfigured
      );
    }

    if (tokenResult.data.state !== 'connected') {
      return emptyDataResult({ state: tokenResult.data.state }, true);
    }

    try {
      const customers = await listAccessibleGoogleAdsCustomers(tokenResult.data.accessToken);

      if (customers.length === 0) {
        return emptyDataResult({ state: 'empty' }, true);
      }

      return emptyDataResult(
        {
          state: 'connected',
          accessToken: tokenResult.data.accessToken,
          customers,
        },
        true
      );
    } catch (retryError) {
      if (retryError instanceof GoogleAdsApiError) {
        if (retryError.kind === 'invalid_token') {
          await markGoogleAdsConnectionStatus(workspaceId, userId, 'expired');
        }

        return emptyDataResult(
          { state: mapGoogleAdsApiErrorToState(retryError) },
          true
        );
      }
    }

    return errorDataResult(
      { state: 'error' },
      'Google Ads customer accounts could not be loaded.'
    );
  }
}

async function loadGoogleAdsCampaignMetricsForCustomer(
  accessToken: string,
  customer: GoogleAdsAccessibleCustomer,
  remainingCampaignSlots: number
): Promise<GoogleAdsCustomerCampaignsData> {
  if (remainingCampaignSlots <= 0) {
    return emptyGoogleAdsCustomerCampaignsData(customer, 'not_requested');
  }

  try {
    const campaigns = await fetchGoogleAdsCampaignMetrics(accessToken, customer, {
      limit: Math.min(GOOGLE_ADS_MAX_CAMPAIGNS_PER_CUSTOMER, remainingCampaignSlots),
    });

    return {
      customerId: customer.customerId,
      customerResourceName: customer.resourceName,
      customerName: customer.displayName,
      campaignsState: campaigns.length > 0 ? 'connected' : 'empty',
      campaigns,
    };
  } catch (error) {
    if (error instanceof GoogleAdsApiError) {
      return emptyGoogleAdsCustomerCampaignsData(
        customer,
        mapGoogleAdsApiErrorToState(error)
      );
    }

    return emptyGoogleAdsCustomerCampaignsData(customer, 'error');
  }
}

async function loadGoogleAdsCampaignMetricsForCustomers(
  accessToken: string,
  customers: GoogleAdsAccessibleCustomer[]
) {
  const inspectedCustomers = customers.slice(0, GOOGLE_ADS_MAX_CUSTOMERS_TO_INSPECT);
  const customerCampaigns: GoogleAdsCustomerCampaignsData[] = [];
  let totalCampaigns = 0;

  for (const customer of inspectedCustomers) {
    const remainingCampaignSlots = GOOGLE_ADS_MAX_TOTAL_CAMPAIGNS - totalCampaigns;
    const customerData = await loadGoogleAdsCampaignMetricsForCustomer(
      accessToken,
      customer,
      remainingCampaignSlots
    );

    totalCampaigns += customerData.campaigns.length;
    customerCampaigns.push(customerData);
  }

  return customerCampaigns;
}

export async function getMetaAdAccountsForWorkspace(
  workspaceId: string,
  userId: string
): Promise<DataResult<MetaAdAccountsForWorkspaceData>> {
  assertServerOnlyMetaAccounts();

  const tokenResult = await loadConnectedMetaAccessToken(workspaceId, userId);

  if (tokenResult.error) {
    return errorDataResult(
      emptyMetaAdAccountsData('error'),
      'Meta ad accounts could not be loaded.',
      tokenResult.isConfigured
    );
  }

  if (tokenResult.data.state !== 'connected') {
    return emptyDataResult(emptyMetaAdAccountsData(tokenResult.data.state), true);
  }

  const { accessToken } = tokenResult.data;

  try {
    const accounts = await fetchMetaAdAccounts(accessToken);

    if (accounts.length === 0) {
      return emptyDataResult(emptyMetaAdAccountsData('empty'), true);
    }

    const accountsWithCampaigns = await loadCampaignsForMetaAdAccounts(
      accessToken,
      accounts
    );

    return emptyDataResult(
      emptyMetaAdAccountsData('connected', accountsWithCampaigns),
      true
    );
  } catch (error) {
    if (error instanceof MetaGraphApiError) {
      if (error.kind === 'invalid_token') {
        return emptyDataResult(emptyMetaAdAccountsData('token_invalid'), true);
      }

      if (error.kind === 'permission') {
        return emptyDataResult(emptyMetaAdAccountsData('permission_issue'), true);
      }
    }

    return errorDataResult(
      emptyMetaAdAccountsData('error'),
      'Meta ad accounts could not be loaded.'
    );
  }
}

export async function getGoogleAdsAccessibleCustomersForWorkspace(
  workspaceId: string,
  userId: string
): Promise<DataResult<GoogleAdsAccessibleCustomersForWorkspaceData>> {
  assertServerOnlyGoogleAds();

  const customersResult = await loadAccessibleGoogleAdsCustomersWithRetry(
    workspaceId,
    userId
  );

  if (customersResult.error) {
    return errorDataResult(
      emptyGoogleAdsAccessibleCustomersData('error'),
      'Google Ads customer accounts could not be loaded.',
      customersResult.isConfigured
    );
  }

  if (customersResult.data.state !== 'connected') {
    return emptyDataResult(
      emptyGoogleAdsAccessibleCustomersData(customersResult.data.state),
      true
    );
  }

  return emptyDataResult(
    emptyGoogleAdsAccessibleCustomersData(
      'connected',
      customersResult.data.customers.slice(0, GOOGLE_ADS_MAX_CUSTOMERS_TO_INSPECT)
    ),
    true
  );
}

export async function getGoogleAdsCampaignMetricsForWorkspace(
  workspaceId: string,
  userId: string
): Promise<DataResult<GoogleAdsCampaignMetricsForWorkspaceData>> {
  assertServerOnlyGoogleAds();

  const customersResult = await loadAccessibleGoogleAdsCustomersWithRetry(
    workspaceId,
    userId
  );

  if (customersResult.error) {
    return errorDataResult(
      emptyGoogleAdsCampaignMetricsData('error'),
      'Google Ads campaign metrics could not be loaded.',
      customersResult.isConfigured
    );
  }

  if (customersResult.data.state !== 'connected') {
    return emptyDataResult(
      emptyGoogleAdsCampaignMetricsData(customersResult.data.state),
      true
    );
  }

  let customers = await loadGoogleAdsCampaignMetricsForCustomers(
    customersResult.data.accessToken,
    customersResult.data.customers
  );

  if (customers.some((customer) => customer.campaignsState === 'token_invalid')) {
    const refreshedTokenResult = await loadConnectedGoogleAdsAccessToken(
      workspaceId,
      userId,
      { forceRefresh: true }
    );

    if (refreshedTokenResult.error) {
      return errorDataResult(
        emptyGoogleAdsCampaignMetricsData('error'),
        'Google Ads campaign metrics could not be loaded.',
        refreshedTokenResult.isConfigured
      );
    }

    if (refreshedTokenResult.data.state !== 'connected') {
      return emptyDataResult(
        emptyGoogleAdsCampaignMetricsData(refreshedTokenResult.data.state),
        true
      );
    }

    customers = await loadGoogleAdsCampaignMetricsForCustomers(
      refreshedTokenResult.data.accessToken,
      customersResult.data.customers
    );

    if (customers.some((customer) => customer.campaignsState === 'token_invalid')) {
      await markGoogleAdsConnectionStatus(workspaceId, userId, 'expired');
      return emptyDataResult(
        emptyGoogleAdsCampaignMetricsData('token_invalid'),
        true
      );
    }
  }

  return emptyDataResult(
    emptyGoogleAdsCampaignMetricsData('connected', customers),
    true
  );
}

export async function upsertMetaConnection(
  input: UpsertMetaConnectionInput
): Promise<DataResult<MetaConnectionStatusData | null>> {
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(null, error ?? 'Supabase server credentials are not configured.');
  }

  const { data, error: upsertError } = await client
    .from('ad_connections')
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: 'meta',
        status: 'connected',
        access_token: input.encryptedAccessToken,
        refresh_token: input.encryptedRefreshToken ?? null,
        token_expires_at: input.tokenExpiresAt ?? null,
        scopes: input.scopes,
        metadata: input.metadata ?? {},
      },
      {
        onConflict: 'workspace_id,user_id,provider',
      }
    )
    .select(SAFE_META_CONNECTION_SELECT)
    .single();

  if (upsertError) {
    return errorDataResult(null, upsertError.message);
  }

  return emptyDataResult(mapMetaConnectionRow(data), true);
}

export async function updateMetaConnectionMetadata(
  workspaceId: string,
  userId: string,
  metadataPatch: JsonObject
): Promise<DataResult<MetaConnectionStatusData | null>> {
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(null, error ?? 'Supabase server credentials are not configured.');
  }

  const { data: existing, error: selectError } = await client
    .from('ad_connections')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .eq('status', 'connected')
    .maybeSingle();

  if (selectError) {
    return errorDataResult(null, selectError.message);
  }

  if (!existing) {
    return errorDataResult(null, 'Meta connection is required.');
  }

  const { data, error: updateError } = await client
    .from('ad_connections')
    .update({
      metadata: {
        ...safeMetadata(existing.metadata as JsonObject),
        ...metadataPatch,
      },
    })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .select(SAFE_META_CONNECTION_SELECT)
    .single();

  if (updateError) {
    return errorDataResult(null, updateError.message);
  }

  return emptyDataResult(mapMetaConnectionRow(data), true);
}

export async function upsertGoogleAdsConnection(
  input: UpsertGoogleAdsConnectionInput
): Promise<DataResult<GoogleAdsConnectionStatusData | null>> {
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(null, error ?? 'Supabase server credentials are not configured.');
  }

  const { data, error: upsertError } = await client
    .from('ad_connections')
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: 'google_ads',
        status: 'connected',
        access_token: input.encryptedAccessToken,
        refresh_token: input.encryptedRefreshToken,
        token_expires_at: input.tokenExpiresAt ?? null,
        scopes: input.scopes,
        metadata: input.metadata ?? {},
      },
      {
        onConflict: 'workspace_id,user_id,provider',
      }
    )
    .select(SAFE_GOOGLE_ADS_CONNECTION_SELECT)
    .single();

  if (upsertError) {
    return errorDataResult(null, upsertError.message);
  }

  return emptyDataResult(mapGoogleAdsConnectionRow(data), true);
}

export async function disconnectMetaConnection(
  workspaceId: string,
  userId: string
): Promise<DataResult<MetaConnectionStatusData | null>> {
  const { client, error } = getAdConnectionAdminClient();

  if (!client) {
    return errorDataResult(null, error ?? 'Supabase server credentials are not configured.');
  }

  const { data, error: updateError } = await client
    .from('ad_connections')
    .update({ status: 'revoked' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .select(SAFE_META_CONNECTION_SELECT)
    .maybeSingle();

  if (updateError) {
    return errorDataResult(null, updateError.message);
  }

  return emptyDataResult(data ? mapMetaConnectionRow(data) : null, true);
}
