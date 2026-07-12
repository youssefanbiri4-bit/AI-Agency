'use server';

import { revalidatePath } from 'next/cache';
import { getRBACContext, hasPermission } from '@/lib/auth/rbac';
import { workspaceRoles, type StrictWorkspaceRole } from '@/lib/permissions-matrix';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';

export interface RoleChangeState {
  error: string | null;
  message?: string | null;
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isStrictRole(value: string): value is StrictWorkspaceRole {
  return workspaceRoles.includes(value as StrictWorkspaceRole);
}

export async function updateWorkspaceMemberRoleAction(
  _state: RoleChangeState,
  formData: FormData
): Promise<RoleChangeState> {
  const access = await getRBACContext();

  if (access.error || !access.data) {
    return { error: 'Authentication and workspace access are required.' };
  }

  if (!hasPermission(access.data.role, 'owner')) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'roles',
      message: 'Blocked role update.',
      metadata: { role: access.data.role },
    });

    return { error: 'Only workspace owners can manage roles.' };
  }

  const userId = readField(formData, 'userId');
  const role = readField(formData, 'role');

  if (!userId || !isStrictRole(role)) {
    return { error: 'Choose a member and role.' };
  }

  if (userId === access.data.workspace.owner_id && role !== 'owner') {
    return { error: 'The workspace owner must keep the Owner role.' };
  }

  if (userId === access.data.user.id && role !== 'owner') {
    return { error: 'You cannot lower your own Owner role.' };
  }

  const { data: existing } = await access.data.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', access.data.workspace.id)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await access.data.supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', access.data.workspace.id)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  await logSecurityAuditEvent({
    supabase: access.data.supabase,
    workspaceId: access.data.workspace.id,
    userId: access.data.user.id,
    eventType: 'role_changed',
    severity: 'warning',
    entityType: 'roles',
    message: 'Workspace member role changed.',
    metadata: {
      target_user_id: userId,
      previous_role: existing?.role ?? null,
      new_role: role,
    },
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/settings/roles');

  return { error: null, message: 'Role updated.' };
}
