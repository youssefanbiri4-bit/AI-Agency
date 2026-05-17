import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  IntegrationSettingsRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export const ACTIVE_WORKSPACE_COOKIE = 'ai-agency-active-workspace-id';
const WORKSPACE_TRACE_PREFIX = '[workspace-data]';

function traceWorkspaceData(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(WORKSPACE_TRACE_PREFIX, message, details);
    return;
  }

  console.info(WORKSPACE_TRACE_PREFIX, message);
}

export interface WorkspaceContextData {
  workspace: WorkspaceRecord | null;
  membership: WorkspaceMemberRecord | null;
  integrationSettings: IntegrationSettingsRecord | null;
}

export function buildWorkspaceSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function getCurrentUserWorkspace(
  client: SupabaseClient<Database>,
  preferredWorkspaceId?: string | null
): Promise<DataResult<WorkspaceRecord | null>> {
  if (preferredWorkspaceId) {
    traceWorkspaceData('before preferred workspace query', { preferredWorkspaceId });
    const { data, error } = await client
      .from('workspaces')
      .select('*')
      .eq('id', preferredWorkspaceId)
      .maybeSingle();
    traceWorkspaceData('after preferred workspace query', {
      preferredWorkspaceId,
      found: Boolean(data),
      error: error?.message ?? null,
    });

    if (error) {
      return errorDataResult(null, error.message);
    }

    if (data) {
      return emptyDataResult(data, true);
    }
  }

  traceWorkspaceData('before fallback workspace query');
  const { data, error } = await client
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  traceWorkspaceData('after fallback workspace query', {
    found: Boolean(data),
    error: error?.message ?? null,
  });

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function getCurrentWorkspaceId(
  client: SupabaseClient<Database>,
  preferredWorkspaceId?: string | null
): Promise<DataResult<string | null>> {
  const result = await getCurrentUserWorkspace(client, preferredWorkspaceId);

  if (result.error) {
    return errorDataResult(null, result.error);
  }

  return emptyDataResult(result.data?.id ?? null, result.isConfigured);
}

export async function getCurrentWorkspaceMembership(
  client: SupabaseClient<Database>,
  workspaceId: string,
  userId?: string
): Promise<DataResult<WorkspaceMemberRecord | null>> {
  traceWorkspaceData('before membership query', { workspaceId, userId: userId ?? null });
  let query = client
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.maybeSingle();
  traceWorkspaceData('after membership query', {
    workspaceId,
    userId: userId ?? null,
    found: Boolean(data),
    error: error?.message ?? null,
  });

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function getIntegrationSettings(
  client: SupabaseClient<Database>,
  workspaceId: string
): Promise<DataResult<IntegrationSettingsRecord | null>> {
  const { data, error } = await client
    .from('integration_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function getWorkspaceContext(
  client: SupabaseClient<Database>,
  preferredWorkspaceId?: string | null,
  userId?: string
): Promise<DataResult<WorkspaceContextData>> {
  const workspaceResult = await getCurrentUserWorkspace(client, preferredWorkspaceId);

  if (workspaceResult.error || !workspaceResult.data) {
    return {
      data: {
        workspace: null,
        membership: null,
        integrationSettings: null,
      },
      error: workspaceResult.error,
      isConfigured: workspaceResult.isConfigured,
    };
  }

  const [membershipResult, integrationResult] = await Promise.all([
    getCurrentWorkspaceMembership(client, workspaceResult.data.id, userId),
    getIntegrationSettings(client, workspaceResult.data.id),
  ]);

  return {
    data: {
      workspace: workspaceResult.data,
      membership: membershipResult.data,
      integrationSettings: integrationResult.data,
    },
    error: membershipResult.error ?? integrationResult.error,
    isConfigured: true,
  };
}
