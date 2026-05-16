import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, WorkspaceMemberRecord, WorkspaceRecord } from '@/types/database';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
export {
  actionLabels,
  getPermissionLevelSummary,
  permissionsMatrix,
  workspaceRoles,
  type StrictWorkspaceRole,
  type WorkspacePermission,
} from '@/lib/permissions-matrix';
import {
  workspaceRoles,
  type StrictWorkspaceRole,
} from '@/lib/permissions-matrix';

export interface WorkspaceAccessContext {
  supabase: SupabaseClient<Database>;
  user: { id: string; email?: string | null };
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord | null;
  role: StrictWorkspaceRole;
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number | null;
}

export function normalizeWorkspaceRole(
  role: string | null | undefined,
  workspace?: Pick<WorkspaceRecord, 'owner_id'> | null,
  userId?: string | null
): StrictWorkspaceRole {
  if (workspace?.owner_id && userId && workspace.owner_id === userId) {
    return 'owner';
  }

  if (role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor' || role === 'viewer') {
    return role;
  }

  return 'viewer';
}

export function hasWorkspaceRole(role: StrictWorkspaceRole, allowed: StrictWorkspaceRole[]) {
  return allowed.includes(role);
}

export function requireWorkspaceRole(
  role: StrictWorkspaceRole,
  allowed: StrictWorkspaceRole[]
) {
  return hasWorkspaceRole(role, allowed);
}

export function canManageSettings(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canManageProviders(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canCreateTasks(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor';
}

export function canRunTasks(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator';
}

export function canReviewTasks(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor';
}

export function canPublishContent(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator';
}

export function canRunScheduler(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canManageBackups(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canManageSecurity(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canManageRoles(role: StrictWorkspaceRole) {
  return role === 'owner';
}

export function canEditContent(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor';
}

export function canDeleteContent(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canUseAIGeneration(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor';
}

export function canManageReleases(role: StrictWorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export function canViewReports(role: StrictWorkspaceRole) {
  return workspaceRoles.includes(role);
}

export async function countWorkspaceMembers(
  supabase: SupabaseClient<Database>,
  workspaceId: string
) {
  const { count, error } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) {
    return null;
  }

  return count;
}

export async function getWorkspaceAccessContext(): Promise<
  | { data: WorkspaceAccessContext; error: null }
  | { data: null; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Authentication is required.' };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (workspaceResult.error) {
    return { data: null, error: workspaceResult.error };
  }

  if (!workspaceResult.data) {
    return { data: null, error: 'Active workspace is required.' };
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  if (membershipResult.error) {
    return { data: null, error: membershipResult.error };
  }

  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);
  const memberCount = await countWorkspaceMembers(supabase, workspaceResult.data.id);

  return {
    data: {
      supabase,
      user,
      workspace: workspaceResult.data,
      membership: membershipResult.data,
      role,
      isOwner: role === 'owner',
      isAdmin: role === 'owner' || role === 'admin',
      memberCount,
    },
    error: null,
  };
}
