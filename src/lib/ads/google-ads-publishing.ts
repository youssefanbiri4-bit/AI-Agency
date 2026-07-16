import 'server-only';

import {
  withCircuitBreaker,
  CIRCUIT_BREAKER_PROVIDERS,
} from '@/lib/circuit-breaker';
import { decryptToken, encryptToken } from '@/lib/ads/encryption';
import {
  getGoogleAdsConfigReadiness,
  getGoogleAdsEnv,
  getGoogleAdsReadOnlyScopes,
  refreshGoogleAccessToken,
  type GoogleAdsAccessibleCustomer,
} from '@/lib/ads/google-ads';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';
import type { ProviderExecutionResult, ProviderReadinessResult } from '@/lib/content-studio/provider-types';

const GOOGLE_ADS_ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

interface GoogleAdsConnectionRow {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
  metadata: unknown;
}

interface GoogleAdsCustomersResponse {
  resourceNames?: string[];
  error?: {
    message?: string;
    status?: string;
  };
}

interface GoogleAdsMutateResult {
  resourceName?: string;
}

interface GoogleAdsMutateResponse {
  results?: GoogleAdsMutateResult[];
  partialFailureError?: {
    message?: string;
  };
  error?: {
    message?: string;
    status?: string;
  };
}

interface ConnectedGoogleAdsContext {
  accessToken: string;
  metadata: JsonObject;
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

function normalizeCustomerId(value: string | null | undefined) {
  return value?.replace(/\D/g, '') || null;
}

function buildGoogleAdsApiUrl(path: string) {
  const env = getGoogleAdsEnv();
  return new URL(`https://googleads.googleapis.com/${env.apiVersion}/${path.replace(/^\/+/, '')}`);
}

function buildHeaders(accessToken: string, hasJsonBody = false) {
  const env = getGoogleAdsEnv();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': env.developerToken,
  };

  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (env.loginCustomerId) {
    headers['login-customer-id'] = env.loginCustomerId;
  }

  return headers;
}

function buildBudgetName(title: string) {
  return `AgentFlow Budget ${title.slice(0, 40)} ${Date.now()}`;
}

function buildCampaignName(title: string) {
  return `AgentFlow Campaign ${title.slice(0, 40)} ${Date.now()}`;
}

function buildApprovalPendingMessage(message: string | null | undefined) {
  const normalized = message?.toLowerCase() ?? '';

  if (
    normalized.includes('developer token') ||
    normalized.includes('developer-token') ||
    normalized.includes('access is not enabled') ||
    normalized.includes('pending') ||
    normalized.includes('developer token is not approved') ||
    normalized.includes('developer_token_not_approved') ||
    normalized.includes('developer token approval')
  ) {
    return 'Google Ads API approval or developer token access is still pending.';
  }

  return null;
}

async function loadGoogleAdsConnectionRow(workspaceId: string, userId: string) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      row: null,
      error: error ?? 'Supabase server credentials are not configured.',
    };
  }

  const { data, error: selectError } = await client
    .from('ad_connections')
    .select('access_token, refresh_token, token_expires_at, scopes, status, metadata')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google_ads')
    .maybeSingle();

  if (selectError) {
    return { row: null, error: 'Google Ads connection could not be verified.' };
  }

  return {
    row: (data as GoogleAdsConnectionRow | null) ?? null,
    error: null,
  };
}

async function listAccessibleCustomers(accessToken: string) {
  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS_API,
    () =>
      fetch(buildGoogleAdsApiUrl('/customers:listAccessibleCustomers'), {
    method: 'GET',
        headers: buildHeaders(accessToken),
        cache: 'no-store',
      })
  );
  const payload = (await response.json().catch(() => null)) as GoogleAdsCustomersResponse | null;

  if (!response.ok || payload?.error) {
    const approvalPending = buildApprovalPendingMessage(payload?.error?.message);

    if (approvalPending) {
      throw new Error(approvalPending);
    }

    throw new Error('Google Ads readiness could not be verified. Confirm OAuth connection, selected customer, developer token approval, and API access.');
  }

  return (payload?.resourceNames ?? [])
    .map((resourceName) => {
      const customerId = normalizeCustomerId(resourceName);

      if (!customerId) {
        return null;
      }

      return {
        resourceName,
        customerId,
        displayName: null,
        accountTypeHint: null,
      };
    })
    .filter(Boolean) as GoogleAdsAccessibleCustomer[];
}

async function refreshConnectionAccessToken(
  workspaceId: string,
  userId: string,
  row: GoogleAdsConnectionRow
) {
  if (!row.refresh_token) {
    throw new Error('Provider setup required: Google Ads refresh token is missing.');
  }

  const refreshToken = decryptToken(row.refresh_token);
  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const tokenExpiresAt = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    : null;
  const metadata: JsonObject = {
    ...safeMetadata(row.metadata),
    token_type: refreshed.tokenType,
    last_refreshed_at: new Date().toISOString(),
  };

  const { client, error } = getSupabaseAdmin();

  if (!client) {
    throw new Error(error ?? 'Supabase server credentials are not configured.');
  }

  const { error: updateError } = await client
    .from('ad_connections')
    .update({
      access_token: encryptToken(refreshed.accessToken),
      token_expires_at: tokenExpiresAt,
      status: 'connected',
      scopes: [...getGoogleAdsReadOnlyScopes()],
      metadata,
    })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google_ads');

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    accessToken: refreshed.accessToken,
    metadata,
  } satisfies ConnectedGoogleAdsContext;
}

async function getConnectedGoogleAdsContext(
  workspaceId: string,
  userId: string
): Promise<ConnectedGoogleAdsContext> {
  const { row, error } = await loadGoogleAdsConnectionRow(workspaceId, userId);

  if (error) {
    throw new Error(error);
  }

  if (!row) {
    throw new Error('Provider setup required: connect Google Ads OAuth first.');
  }

  if (row.status !== 'connected') {
    throw new Error('Provider setup required: reconnect Google Ads because the token is not active.');
  }

  if (!row.scopes?.includes(getGoogleAdsReadOnlyScopes()[0])) {
    throw new Error('Provider setup required: reconnect Google Ads with the adwords scope.');
  }

  if (
    row.token_expires_at &&
    Date.parse(row.token_expires_at) <= Date.now() + GOOGLE_ADS_ACCESS_TOKEN_REFRESH_BUFFER_MS
  ) {
    return refreshConnectionAccessToken(workspaceId, userId, row);
  }

  return {
    accessToken: decryptToken(row.access_token),
    metadata: safeMetadata(row.metadata),
  };
}

async function mutateGoogleAdsResource<TPayload extends Record<string, unknown>>({
  customerId,
  path,
  accessToken,
  payload,
}: {
  customerId: string;
  path: string;
  accessToken: string;
  payload: TPayload;
}) {
  const response = await withCircuitBreaker(
    CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS_API,
    () =>
      fetch(
        buildGoogleAdsApiUrl(`/customers/${customerId}/${path.replace(/^\/+/, '')}`),
        {
      method: 'POST',
      headers: buildHeaders(accessToken, true),
          body: JSON.stringify(payload),
          cache: 'no-store',
        }
      )
  );
  const data = (await response.json().catch(() => null)) as GoogleAdsMutateResponse | null;

  if (!response.ok || data?.error || data?.partialFailureError) {
    const providerMessage =
      data?.error?.message || data?.partialFailureError?.message || 'Google Ads mutate failed.';
    const approvalPending = buildApprovalPendingMessage(providerMessage);

    if (approvalPending) {
      throw new Error(approvalPending);
    }

    throw new Error(providerMessage);
  }

  if (!data) {
    throw new Error('Google Ads mutate failed.');
  }

  return data;
}

export async function getGoogleAdsExecutionReadiness({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<ProviderReadinessResult> {
  const config = getGoogleAdsConfigReadiness();

  if (!config.isConfigured) {
    return {
      provider: 'google_ads',
      state: 'setup_required',
      message: `Provider setup required: missing ${config.missingEnvironmentVariables.join(', ')}.`,
      missing: config.missingEnvironmentVariables,
    };
  }

  try {
    const context = await getConnectedGoogleAdsContext(workspaceId, userId);
    const metadata = context.metadata;
    const preferredCustomerId = normalizeCustomerId(safeString(metadata.google_ads_customer_id));
    const customers = await listAccessibleCustomers(context.accessToken);

    if (customers.length === 0) {
      return {
        provider: 'google_ads',
        state: 'setup_required',
        message: 'Provider setup required: no accessible Google Ads customer account was found.',
        missing: ['Google Ads customer ID'],
      };
    }

    const selectedCustomerId =
      preferredCustomerId ??
      customers[0]?.customerId ??
      normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null);

    if (!selectedCustomerId) {
      return {
        provider: 'google_ads',
        state: 'setup_required',
        message: 'Provider setup required: Google Ads customer ID is missing.',
        missing: ['Google Ads customer ID'],
      };
    }

    return {
      provider: 'google_ads',
      state: 'ready',
      message: 'Provider is ready.',
      missing: [],
      details: {
        customer_id: selectedCustomerId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Ads readiness failed.';

    if (message === 'Google Ads API approval or developer token access is still pending.') {
      return {
        provider: 'google_ads',
        state: 'approval_pending',
        message,
        missing: [],
      };
    }

    if (message.toLowerCase().includes('connect google ads')) {
      return {
        provider: 'google_ads',
        state: 'token_missing',
        message,
        missing: ['Google Ads OAuth connection'],
      };
    }

    if (message.toLowerCase().includes('provider setup required')) {
      return {
        provider: 'google_ads',
        state: 'setup_required',
        message,
        missing: [],
      };
    }

    return {
      provider: 'google_ads',
      state: 'error',
      message,
      missing: [],
    };
  }
}

export async function createGoogleAdsCampaignDraft(input: {
  workspaceId: string;
  userId: string;
  title: string;
}) : Promise<ProviderExecutionResult> {
  const readiness = await getGoogleAdsExecutionReadiness({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (readiness.state !== 'ready') {
    return {
      provider: 'google_ads',
      actionType: 'create_campaign_draft',
      status: readiness.state === 'approval_pending' ? 'approval_pending' : 'setup_required',
      message: readiness.message,
    };
  }

  const context = await getConnectedGoogleAdsContext(input.workspaceId, input.userId);
  const customerId = normalizeCustomerId(
    safeString(readiness.details?.customer_id) ??
      safeString(context.metadata.google_ads_customer_id) ??
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??
      null
  );

  if (!customerId) {
    return {
      provider: 'google_ads',
      actionType: 'create_campaign_draft',
      status: 'setup_required',
      message: 'Provider setup required: Google Ads customer ID is missing.',
    };
  }

  const budgetResponse = await mutateGoogleAdsResource({
    customerId,
    path: 'campaignBudgets:mutate',
    accessToken: context.accessToken,
    payload: {
      operations: [
        {
          create: {
            name: buildBudgetName(input.title),
            deliveryMethod: 'STANDARD',
            amountMicros: '5000000',
          },
        },
      ],
    },
  });
  const budgetResourceName = budgetResponse.results?.[0]?.resourceName ?? null;

  if (!budgetResourceName) {
    return {
      provider: 'google_ads',
      actionType: 'create_campaign_draft',
      status: 'failed',
      message: 'Could not publish. Google Ads budget creation failed.',
    };
  }

  const campaignResponse = await mutateGoogleAdsResource({
    customerId,
    path: 'campaigns:mutate',
    accessToken: context.accessToken,
    payload: {
      operations: [
        {
          create: {
            name: buildCampaignName(input.title),
            status: 'PAUSED',
            campaignBudget: budgetResourceName,
            advertisingChannelType: 'SEARCH',
            manualCpc: {},
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
          },
        },
      ],
    },
  });
  const campaignResourceName = campaignResponse.results?.[0]?.resourceName ?? null;

  if (!campaignResourceName) {
    return {
      provider: 'google_ads',
      actionType: 'create_campaign_draft',
      status: 'failed',
      message: 'Could not publish. Google Ads campaign draft creation failed.',
    };
  }

  return {
    provider: 'google_ads',
    actionType: 'create_campaign_draft',
    status: 'succeeded',
    message: 'Paused Google Ads campaign draft created successfully.',
    providerExternalId: campaignResourceName,
    providerResponseSummary: {
      customer_id: customerId,
      budget_resource_name: budgetResourceName,
      campaign_resource_name: campaignResourceName,
      campaign_status: 'PAUSED',
    },
  };
}
