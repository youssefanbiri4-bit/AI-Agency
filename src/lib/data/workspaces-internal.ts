import { createClient } from '@supabase/supabase-js';
import type { Database, WorkspaceRecord } from '@/types/database';
import { errorDataResult, emptyDataResult, type DataResult } from './types';

/**
 * Internal backend-safe workspace access.
 * - NO cookies
 * - NO auth session
 * - NO Next request context
 * - Uses Supabase service role client
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase service role is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey);
}

export async function getWorkspaceInternal(
  workspaceId: string
): Promise<DataResult<WorkspaceRecord | null>> {
  try {
    const client = getServiceRoleClient();

    const { data, error } = await client
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (error) {
      return errorDataResult(null, error.message);
    }

    return emptyDataResult(data as WorkspaceRecord, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get workspace';
    return errorDataResult(null, message);
  }
}
