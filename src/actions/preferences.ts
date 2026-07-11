'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getWorkspaceAccessContext } from '@/lib/workspace-permissions';
import { hasPermission } from '@/lib/auth/rbac-client';
import { normalizeRole } from '@/lib/auth/rbac-client';
import type { Department } from '@/types/auth';
import { isDepartment } from '@/types/auth';
import { userPreferencesService } from '@/lib/preferences/user-preferences';

export interface SetViewAsDepartmentResult {
  ok: boolean;
  error?: string;
  department: Department | null;
}

export async function setViewAsDepartmentAction(
  department: Department | null
): Promise<SetViewAsDepartmentResult> {
  const access = await getWorkspaceAccessContext();
  if (!access.data) {
    return { ok: false, error: 'Workspace access required.', department: null };
  }

  const role = normalizeRole(access.data.role);
  if (!hasPermission(role, 'admin')) {
    return { ok: false, error: 'Only admins and owners can change department view.', department: null };
  }

  if (department !== null && !isDepartment(department)) {
    return { ok: false, error: 'Invalid department.', department: null };
  }

  const supabase = await createSupabaseServerClient();
  const userId = access.data.user.id;
  const workspaceId = access.data.workspace.id;

  try {
    await userPreferencesService.setViewAsDepartment(supabase, userId, workspaceId, department);
    return { ok: true, department };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save preference.',
      department: null,
    };
  }
}