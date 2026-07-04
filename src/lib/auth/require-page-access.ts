/**
 * Dashboard route access rules — edge-safe (no server-only imports).
 *
 * Used by middleware/proxy and server layouts/actions for consistent RBAC + department checks.
 */

import {
  canViewArea,
  hasPermission,
  normalizeRole,
} from '@/lib/auth/rbac-client';
import type { Department, RBACRole } from '@/types/auth';
import { isDepartment } from '@/types/auth';

export const RBAC_DEPT_COOKIE = 'ai-agency-rbac-dept';
export const PATHNAME_HEADER = 'x-pathname';
export const ACCESS_DENIED_QUERY = 'access_denied';

export interface PageAccessContext {
  role: RBACRole;
  effectiveDepartment: Department | null;
}

export interface PageAccessResult {
  allowed: boolean;
  area: string | null;
  reason?: string;
}

export function extractDashboardArea(pathname: string): string | null {
  if (!pathname.startsWith('/dashboard')) {
    return null;
  }

  const segment = pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  return segment || 'dashboard';
}

export function isDashboardRoute(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function resolveEffectiveDepartment(options: {
  assignedDepartment: Department | null;
  role: RBACRole;
  cookieDepartment?: string | null;
}): Department | null {
  const { assignedDepartment, role, cookieDepartment } = options;

  if (hasPermission(role, 'admin') && isDepartment(cookieDepartment)) {
    return cookieDepartment;
  }

  return assignedDepartment;
}

export function buildPageAccessContext(options: {
  role: string | null | undefined;
  assignedDepartment?: string | null;
  cookieDepartment?: string | null;
}): PageAccessContext | null {
  const role = normalizeRole(options.role);
  const assignedDepartment = isDepartment(options.assignedDepartment)
    ? options.assignedDepartment
    : null;

  return {
    role,
    effectiveDepartment: resolveEffectiveDepartment({
      assignedDepartment,
      role,
      cookieDepartment: options.cookieDepartment,
    }),
  };
}

export function evaluatePageAccess(
  pathname: string,
  ctx: PageAccessContext
): PageAccessResult {
  if (!isDashboardRoute(pathname)) {
    return { allowed: true, area: null };
  }

  const area = extractDashboardArea(pathname) ?? 'dashboard';
  const allowed = canViewArea(area, ctx.role, ctx.effectiveDepartment);

  return {
    allowed,
    area,
    reason: allowed
      ? undefined
      : `Insufficient department access for "${area}" (role=${ctx.role}, dept=${ctx.effectiveDepartment ?? 'none'})`,
  };
}

export function buildAccessDeniedUrl(requestUrl: string, fromPath: string): URL {
  const url = new URL('/dashboard', requestUrl);
  url.searchParams.set(ACCESS_DENIED_QUERY, '1');
  if (fromPath && fromPath !== '/dashboard') {
    url.searchParams.set('from', fromPath);
  }
  return url;
}