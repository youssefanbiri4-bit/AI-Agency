import { getSupabaseAdmin } from '@/lib/supabase-server';
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

const SAFE_META_CONNECTION_SELECT =
  'provider, status, token_expires_at, ad_account_id, ad_account_name, scopes, created_at, updated_at';

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
