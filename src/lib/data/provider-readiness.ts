import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export const PROVIDER_READINESS_CACHE_TRACE_PREFIX = '[provider-readiness-cache]';

export interface ProviderReadinessCacheRecord {
  id: string;
  workspace_id: string;
  provider: string;
  readiness_state: string;
  message: string | null;
  missing: string[] | null;
  last_checked_at: string; // ISO string
  expires_at: string; // ISO string
}

type ProviderReadinessCacheClient = SupabaseClient<Database> & {
  from(table: 'provider_readiness_cache'): ReturnType<SupabaseClient<Database>['from']>;
};

async function getDefaultClient() {
  const { supabase } = await import('@/lib/supabase-client');
  return supabase as ProviderReadinessCacheClient;
}

/**
 * Get provider readiness from cache for a workspace and provider.
 * Returns null if not found or expired.
 */
export async function getProviderReadinessFromCache(
  workspaceId: string,
  provider: string,
  client?: SupabaseClient<Database>
): Promise<DataResult<ProviderReadinessCacheRecord | null>> {
  const db = (client ?? await getDefaultClient()) as ProviderReadinessCacheClient;

  try {
    const { data, error } = await db
      .from('provider_readiness_cache')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .gte('expires_at', new Date().toISOString()) // Only get non-expired entries
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return emptyDataResult(null, true);
      }
      return errorDataResult(null, error.message);
    }

    return emptyDataResult(data as ProviderReadinessCacheRecord, true);
  } catch (error) {
    return errorDataResult(null, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Upsert provider readiness cache for a workspace and provider.
 */
export async function upsertProviderReadinessCache(
  workspaceId: string,
  provider: string,
  readinessState: string,
  message: string | null,
  missing: string[] | null,
  client?: SupabaseClient<Database>
): Promise<DataResult<ProviderReadinessCacheRecord | null>> {
  const db = (client ?? await getDefaultClient()) as ProviderReadinessCacheClient;

  try {
    const now = new Date();
    // Cache expires in 5 minutes
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const { data, error } = await db
      .from('provider_readiness_cache')
      .upsert({
        workspace_id: workspaceId,
        provider,
        readiness_state: readinessState,
        message,
        missing: missing ?? [],
        last_checked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'workspace_id,provider'
      })
      .select()
      .single();

    if (error) {
      return errorDataResult(null, error.message);
    }

    return emptyDataResult(data as ProviderReadinessCacheRecord, true);
  } catch (error) {
    return errorDataResult(null, error instanceof Error ? error.message : String(error));
  }
}
