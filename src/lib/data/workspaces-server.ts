import 'server-only';

import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import type { WorkspaceRecord } from '@/types/database';
import { errorDataResult, type DataResult } from './types';

/**
 * Get workspace from request context (cookies/headers)
 * Used in API routes to retrieve the active workspace
 * Server-only function for retrieving workspace context
 * @param preferredWorkspaceId - Optional workspace ID override
 * @returns Workspace data or error
 */
export async function getWorkspace(
  preferredWorkspaceId?: string | null
): Promise<DataResult<WorkspaceRecord | null>> {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Use provided ID or try to get from cookie
    let workspaceId = preferredWorkspaceId;
    if (!workspaceId) {
      workspaceId = await getActiveWorkspaceIdFromCookie();
    }

    const result = await getCurrentUserWorkspace(supabase, workspaceId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get workspace';
    return errorDataResult(null, message);
  }
}
