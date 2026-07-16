/**
 * RBAC Core Implementation (server-side)
 *
 * Re-exports client-safe helpers from rbac-client.ts and adds async server guards.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, WorkspaceMemberRecord, WorkspaceRecord } from '@/types/database';
import type {
  Department,
  RBACRole,
} from '@/types/auth';
import { isDepartment } from '@/types/auth';
import { cookies, headers } from 'next/headers';
import {
  hasPermission,
  normalizeRole,
  canAccessDepartment,
} from '@/lib/auth/rbac-client';
import {
  buildPageAccessContext,
  evaluatePageAccess,
  PATHNAME_HEADER,
  RBAC_DEPT_COOKIE,
  resolveEffectiveDepartment,
  type PageAccessResult,
} from '@/lib/auth/require-page-access';

import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';

// Client-safe helpers — safe to re-export for server consumers
export {
  ROLE_HIERARCHY,
  ROLE_ORDER,
  DEPARTMENT_FEATURES,
  GLOBAL_AREAS,
  hasPermission,
  normalizeRole,
  getNextRole,
  canAccessDepartment,
  getAccessibleDepartments,
  canViewArea,
  AREA_TO_DEPARTMENT,
  describeRBAC,
  DEPARTMENT_MAP,
  CATALOG_DEPARTMENT_IDS,
  CATALOG_DEPARTMENT_NAMES,
  resolveCatalogDepartmentId,
  getRbacDepartmentsForCatalog,
  rbacDepartmentToCatalogIds,
  resolvePrimaryRbacDepartment,
  canAccessCatalogDepartment,
  isCatalogDepartmentId,
} from '@/lib/auth/rbac-client';

export type { CatalogDepartmentId } from '@/lib/auth/rbac-client';

export type { Department, RBACRole, RBACPermissionContext, PermissionAction } from '@/types/auth';

// ======================
// Inlined legacy context types and helpers (migrated from workspace-permissions.ts)
// ======================

interface WorkspaceAccessContext {
  supabase: SupabaseClient<Database>;
  user: { id: string; email?: string | null };
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord | null;
  role: RBACRole;
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number | null;
}

async function countWorkspaceMembers(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<number | null> {
  const { count, error } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  if (error) return null;
  return count;
}

/** @deprecated Use getRBACContext() instead. */
export function normalizeWorkspaceRole(
  role: string | null | undefined,
  workspace?: Pick<WorkspaceRecord, 'owner_id'> | null,
  userId?: string | null
): RBACRole {
  if (workspace?.owner_id && userId && workspace.owner_id === userId) {
    return 'owner';
  }
  if (role === 'owner' || role === 'admin' || role === 'operator' || role === 'editor' || role === 'viewer') {
    return role;
  }
  return 'viewer';
}

async function getWorkspaceAccessContextInternal(): Promise<
  { data: WorkspaceAccessContext | null; error: string | null }
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
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

// ======================
// Core Context Builders
// ======================

export interface RBACContext extends WorkspaceAccessContext {
  rbacRole: RBACRole;
  department: Department | null;
  isAdminOrHigher: boolean;
  isOperatorOrHigher: boolean;
}

export interface GetRBACContextResult {
  data: RBACContext | null;
  error: string | null;
}

export async function getRBACContext(): Promise<GetRBACContextResult> {
  const legacy = await getWorkspaceAccessContextInternal();

  if (!legacy.data) {
    return { data: null, error: legacy.error };
  }

  const { role, membership, ...rest } = legacy.data;
  const rbacRole = normalizeRole(role);
  const dept = extractDepartment(membership);

  return {
    data: {
      ...rest,
      role,
      rbacRole,
      department: dept,
      membership,
      isAdminOrHigher: hasPermission(rbacRole, 'admin'),
      isOperatorOrHigher: hasPermission(rbacRole, 'operator'),
    },
    error: null,
  };
}

function extractDepartment(membership: WorkspaceMemberRecord | null): Department | null {
  if (!membership) return null;
  const d = (membership as { department?: string | null }).department;
  if (isDepartment(d)) return d;
  return null;
}

// ======================
// Require Guards
// ======================

export interface RequireOptions {
  minRole?: RBACRole;
  department?: Department | null;
  strictDepartment?: boolean;
}

export interface RequireResult {
  ok: boolean;
  error?: string;
  context?: RBACContext;
}

export async function requireRole(minRole: RBACRole): Promise<RequireResult> {
  const ctxRes = await getRBACContext();
  if (!ctxRes.data) {
    return { ok: false, error: ctxRes.error || 'Access denied' };
  }

  if (!hasPermission(ctxRes.data.rbacRole, minRole)) {
    return {
      ok: false,
      error: `Requires ${minRole} role or higher. Current: ${ctxRes.data.rbacRole}`,
      context: ctxRes.data,
    };
  }

  return { ok: true, context: ctxRes.data };
}

export async function requireDepartment(department: Department): Promise<RequireResult> {
  const ctxRes = await getRBACContext();
  if (!ctxRes.data) {
    return { ok: false, error: ctxRes.error || 'Access denied' };
  }

  const { rbacRole, department: userDept } = ctxRes.data;

  if (!canAccessDepartment(rbacRole, userDept, department)) {
    return {
      ok: false,
      error: `Department access denied. Requested: ${department}. Your dept: ${userDept ?? 'none'}`,
      context: ctxRes.data,
    };
  }

  return { ok: true, context: ctxRes.data };
}

export async function requireWorkspaceAccessWithRBAC(
  options: RequireOptions = {}
): Promise<RequireResult> {
  const ctxRes = await getRBACContext();

  if (!ctxRes.data) {
    return { ok: false, error: ctxRes.error || 'Authentication and workspace are required.' };
  }

  const { rbacRole, department: userDept } = ctxRes.data;

  if (options.minRole && !hasPermission(rbacRole, options.minRole)) {
    return {
      ok: false,
      error: `Insufficient role. Minimum required: ${options.minRole}. You have: ${rbacRole}.`,
      context: ctxRes.data,
    };
  }

  if (options.department) {
    const strict = !!options.strictDepartment;
    const allowed = strict
      ? userDept === options.department
      : canAccessDepartment(rbacRole, userDept, options.department);

    if (!allowed) {
      return {
        ok: false,
        error: `Department '${options.department}' is restricted for your role/department.`,
        context: ctxRes.data,
      };
    }
  }

  return { ok: true, context: ctxRes.data };
}

// ======================
// Page access (server — mirrors middleware / proxy)
// ======================

export {
  buildPageAccessContext,
  evaluatePageAccess,
  extractDashboardArea,
  isDashboardRoute,
  resolveEffectiveDepartment,
  buildAccessDeniedUrl,
  PATHNAME_HEADER,
  RBAC_DEPT_COOKIE,
  ACCESS_DENIED_QUERY,
} from '@/lib/auth/require-page-access';

export type { PageAccessContext, PageAccessResult } from '@/lib/auth/require-page-access';

export async function requirePageAccess(pathname?: string): Promise<{
  ok: boolean;
  error?: string;
  access: PageAccessResult;
  context?: RBACContext;
}> {
  const ctxRes = await getRBACContext();

  if (!ctxRes.data) {
    return {
      ok: false,
      error: ctxRes.error || 'Authentication and workspace are required.',
      access: { allowed: false, area: null, reason: 'no_rbac_context' },
    };
  }

  const headersList = await headers();
  const cookieStore = await cookies();
  const cookieDept = cookieStore.get(RBAC_DEPT_COOKIE)?.value ?? null;

  const accessCtx = buildPageAccessContext({
    role: ctxRes.data.rbacRole,
    assignedDepartment: ctxRes.data.department,
    cookieDepartment: cookieDept,
  });

  if (!accessCtx) {
    return {
      ok: false,
      error: 'Invalid RBAC context.',
      access: { allowed: false, area: null },
      context: ctxRes.data,
    };
  }

  const resolvedPath =
    pathname?.trim() ||
    headersList.get(PATHNAME_HEADER) ||
    headersList.get('x-invoke-path') ||
    '';

  const access = evaluatePageAccess(resolvedPath, accessCtx);

  if (!access.allowed) {
    return {
      ok: false,
      error: access.reason || 'You do not have access to this area.',
      access,
      context: ctxRes.data,
    };
  }

  return { ok: true, access, context: ctxRes.data };
}

export function resolveEffectiveDepartmentFromMembership(
  rbacRole: RBACRole,
  assignedDepartment: Department | null,
  cookieDepartment: string | null | undefined
): Department | null {
  return resolveEffectiveDepartment({
    assignedDepartment,
    role: rbacRole,
    cookieDepartment,
  });
}

export function parseDepartmentFromMembership(
  membership: WorkspaceMemberRecord | null
): Department | null {
  if (!membership) return null;
  const raw = (membership as { department?: string | null }).department;
  return isDepartment(raw) ? raw : null;
}

// ======================
// Membership updates
// ======================

export async function updateMemberRBAC(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  targetUserId: string,
  updates: { role?: RBACRole; department?: Department | null }
): Promise<{ success: boolean; error?: string }> {
  const payload: {
    updated_at: string;
    role?: RBACRole;
    department?: Department | null;
  } = { updated_at: new Date().toISOString() };
  if (updates.role) payload.role = updates.role;
  if (updates.department !== undefined) payload.department = updates.department;

  const { error } = await supabase
    .from('workspace_members')
    .update(payload)
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}