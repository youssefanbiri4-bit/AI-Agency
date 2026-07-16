import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ApiKeyRecord, ApiKeyScope } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';

const KEY_PREFIX = 'af_pub_';
const RAW_KEY_BYTES = 24; // -> base64url length ~32 chars

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  hash: string;
}

export interface CreateApiKeyInput {
  workspaceId: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  rateLimit?: number;
  expiresAt?: string | null;
}

/** Generates a new API key. The raw key is only available at creation time. */
export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(RAW_KEY_BYTES).toString('base64url');
  const rawKey = `${KEY_PREFIX}${random}`;
  const prefix = rawKey.slice(0, KEY_PREFIX.length + 6);
  const hash = hashApiKey(rawKey);
  return { rawKey, prefix, hash };
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function isValidApiKeyFormat(rawKey: string): boolean {
  return new RegExp(`^${KEY_PREFIX}[A-Za-z0-9_-]{16,}$`).test(rawKey);
}

/** Looks up a key by its hashed secret using the admin (service-role) client. */
export async function findApiKeyByRawKey(
  rawKey: string,
  admin: SupabaseClient<Database>
): Promise<DataResult<ApiKeyRecord | null>> {
  const hash = hashApiKey(rawKey);
  const { data, error } = await admin
    .from('api_keys')
    .select('*')
    .eq('key_hash', hash)
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function markApiKeyUsed(
  id: string,
  admin: SupabaseClient<Database>
): Promise<void> {
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', id);
}

/** Creates a key in the workspace context (RLS requires admin role). */
export async function createApiKey(
  input: CreateApiKeyInput,
  supabase: SupabaseClient<Database>
): Promise<DataResult<{ record: ApiKeyRecord; rawKey: string }>> {
  const generated = generateApiKey();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      scopes: input.scopes,
      rate_limit: input.rateLimit ?? 60,
      expires_at: input.expiresAt ?? null,
      created_by: input.userId,
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null as never, error.message);
  return emptyDataResult({ record: data as ApiKeyRecord, rawKey: generated.rawKey }, true);
}

export async function listApiKeys(
  workspaceId: string,
  supabase: SupabaseClient<Database>
): Promise<DataResult<ApiKeyRecord[]>> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) return errorDataResult([], error.message);
  return emptyDataResult((data ?? []) as ApiKeyRecord[], true);
}

export async function revokeApiKey(
  id: string,
  workspaceId: string,
  supabase: SupabaseClient<Database>
): Promise<DataResult<boolean>> {
  const { error } = await supabase
    .from('api_keys')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) return errorDataResult(false, error.message);
  return emptyDataResult(true, true);
}

export async function getApiKeyById(
  id: string,
  workspaceId: string,
  supabase: SupabaseClient<Database>
): Promise<DataResult<ApiKeyRecord | null>> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}
