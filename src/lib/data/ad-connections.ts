import { getSupabaseAdmin } from '@/lib/supabase-server';
import { decryptToken } from '@/lib/ads/encryption';
import {
  fetchMetaAdAccounts,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  MetaGraphApiError,
  type MetaAdAccount,
  type MetaCampaign,
  type MetaCampaignInsights,
} from '@/lib/ads/meta';
import type { AdConnectionStatus } from '@/types/database';
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

type ConnectedMetaAccessTokenResult =
  | {
      state: 'connected';
      accessToken: string;
    }
  | {
      state: Exclude<MetaAdAccountsState, 'connected' | 'empty'>;
    };

const SAFE_META_CONNECTION_SELECT =
  'provider, status, token_expires_at, ad_account_id, ad_account_name, scopes, created_at, updated_at';
const CONNECTED_META_TOKEN_SELECT = 'access_token, token_expires_at, scopes';
const META_CAMPAIGN_ACCOUNT_BATCH_SIZE = 3;
const META_CAMPAIGN_INSIGHTS_MAX_PER_ACCOUNT = 25;
const META_CAMPAIGN_INSIGHTS_MAX_TOTAL = 50;

const notConnectedMetaConnection: MetaConnectionStatusData = {
  provider: 'meta',
  status: 'not_connected',
  scopes: [],
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  adAccountId: null,
  adAccountName: null,
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

function emptyMetaAdAccountsData(
  state: MetaAdAccountsState,
  accounts: MetaAdAccountCampaignsData[] = []
): MetaAdAccountsForWorkspaceData {
  return {
    state,
    accounts,
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
  provider: 'meta';
  status: AdConnectionStatus;
  token_expires_at: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}): MetaConnectionStatusData {
  return {
    provider: row.provider,
    status: normalizeMetaConnectionStatus(row.status, row.token_expires_at),
    scopes: row.scopes ?? [],
    connectedAt: row.created_at,
    updatedAt: row.updated_at,
    tokenExpiresAt: row.token_expires_at,
    adAccountId: row.ad_account_id,
    adAccountName: row.ad_account_name,
  };
}

export async function getMetaConnectionStatus(
  workspaceId: string,
  userId: string
): Promise<DataResult<MetaConnectionStatusData>> {
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

  if (selectError) {
    return errorDataResult(notConnectedMetaConnection, selectError.message);
  }

  if (!data) {
    return emptyDataResult(notConnectedMetaConnection, true);
  }

  return emptyDataResult(mapMetaConnectionRow(data), true);
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
