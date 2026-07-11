/**
 * Client-safe RBAC helpers (no server-only imports).
 *
 * Use in Client Components (Sidebar, dashboards) for pure role/department checks.
 * Server code should import from `@/lib/auth/rbac` which re-exports these helpers.
 */

import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';
import type { Department, RBACRole } from '@/types/auth';
import {
  ROLE_HIERARCHY,
  ROLE_ORDER,
  DEPARTMENT_FEATURES,
  GLOBAL_AREAS,
  isRBACRole,
  isDepartment,
  getVisibleDepartmentsForRole,
} from '@/types/auth';

export type { Department, RBACRole } from '@/types/auth';
export { ROLE_HIERARCHY, ROLE_ORDER, DEPARTMENT_FEATURES, GLOBAL_AREAS } from '@/types/auth';

export function hasPermission(role: RBACRole | StrictWorkspaceRole, minRole: RBACRole): boolean {
  const r = normalizeRole(role);
  return ROLE_HIERARCHY[r] >= ROLE_HIERARCHY[minRole];
}

export function normalizeRole(role: string | null | undefined | StrictWorkspaceRole): RBACRole {
  if (isRBACRole(role)) return role;
  if (role === 'member') return 'viewer';
  return 'viewer';
}

export function getNextRole(role: RBACRole): RBACRole | null {
  const idx = ROLE_ORDER.indexOf(role);
  return idx < ROLE_ORDER.length - 1 ? ROLE_ORDER[idx + 1] : null;
}

export function canAccessDepartment(
  userRole: RBACRole,
  userDepartment: Department | null | undefined,
  requestedDepartment?: Department | null
): boolean {
  if (!requestedDepartment) return true;

  if (hasPermission(userRole, 'admin')) {
    return true;
  }

  if (!userDepartment) {
    return hasPermission(userRole, 'operator');
  }

  return userDepartment === requestedDepartment;
}

export function getAccessibleDepartments(
  role: RBACRole,
  userDepartment: Department | null
): Department[] {
  return getVisibleDepartmentsForRole(role, userDepartment);
}

export function canViewArea(
  areaOrHref: string,
  role: RBACRole,
  userDept: Department | null
): boolean {
  const normalized = areaOrHref.replace(/^\/dashboard\/?/, '').split('/')[0] || 'dashboard';

  if (GLOBAL_AREAS.includes(normalized as (typeof GLOBAL_AREAS)[number])) {
    return true;
  }

  if (hasPermission(role, 'admin')) return true;

  const accessibleDepts = getAccessibleDepartments(role, userDept);

  for (const dept of accessibleDepts) {
    const features = DEPARTMENT_FEATURES[dept] || [];
    if (features.some((f) => normalized.includes(f) || f.includes(normalized))) {
      return true;
    }
  }

  return hasPermission(role, 'operator');
}

// ======================
// Catalog ↔ RBAC Department Mapping
// ======================

/** Agent catalog department IDs (public.departments.id) */
export type CatalogDepartmentId =
  | 'research_strategy'
  | 'content_growth'
  | 'sales_operations'
  | 'development_engineering';

export const CATALOG_DEPARTMENT_IDS: readonly CatalogDepartmentId[] = [
  'research_strategy',
  'content_growth',
  'sales_operations',
  'development_engineering',
] as const;

export const CATALOG_DEPARTMENT_NAMES: Record<CatalogDepartmentId, string> = {
  research_strategy: 'Research & Strategy',
  content_growth: 'Content & Growth',
  sales_operations: 'Sales & Operations',
  development_engineering: 'Development & Engineering',
};

/**
 * Maps agent catalog department IDs to RBAC department scopes.
 * One catalog bucket may span multiple RBAC teams.
 */
export const DEPARTMENT_MAP: Record<CatalogDepartmentId, readonly Department[]> = {
  research_strategy: ['strategy'],
  content_growth: ['content', 'social', 'creative'],
  sales_operations: ['operations', 'paid_ads'],
  development_engineering: ['operations', 'strategy'],
};

const CATALOG_NAME_TO_ID = Object.fromEntries(
  Object.entries(CATALOG_DEPARTMENT_NAMES).map(([id, name]) => [name, id])
) as Record<string, CatalogDepartmentId>;

export function isCatalogDepartmentId(value: unknown): value is CatalogDepartmentId {
  return typeof value === 'string' && (CATALOG_DEPARTMENT_IDS as readonly string[]).includes(value);
}

export function resolveCatalogDepartmentId(
  value: string | null | undefined
): CatalogDepartmentId | null {
  if (!value) return null;
  if (isCatalogDepartmentId(value)) return value;
  if (isDepartment(value)) {
    return rbacDepartmentToCatalogIds(value)[0] ?? null;
  }
  return CATALOG_NAME_TO_ID[value] ?? null;
}

export function getRbacDepartmentsForCatalog(
  catalogRef: string | null | undefined
): Department[] {
  const catalogId = resolveCatalogDepartmentId(catalogRef);
  if (!catalogId) return [];
  return [...DEPARTMENT_MAP[catalogId]];
}

export function rbacDepartmentToCatalogIds(department: Department): CatalogDepartmentId[] {
  return (Object.entries(DEPARTMENT_MAP) as [CatalogDepartmentId, readonly Department[]][])
    .filter(([, rbacDepts]) => rbacDepts.includes(department))
    .map(([catalogId]) => catalogId);
}

/** Primary RBAC department stored on task rows (first mapped value). */
export function resolvePrimaryRbacDepartment(
  catalogRef: string | null | undefined
): Department | null {
  const rbacDepts = getRbacDepartmentsForCatalog(catalogRef);
  return rbacDepts[0] ?? null;
}

export function canAccessCatalogDepartment(
  userRole: RBACRole,
  userDepartment: Department | null | undefined,
  catalogRef: string | null | undefined
): boolean {
  if (hasPermission(userRole, 'admin')) return true;

  const rbacDepts = getRbacDepartmentsForCatalog(catalogRef);
  if (rbacDepts.length === 0) return true;

  if (!userDepartment) {
    return hasPermission(userRole, 'operator');
  }

  return rbacDepts.includes(userDepartment);
}

export const AREA_TO_DEPARTMENT: Partial<Record<string, Department>> = {
  'content-studio': 'content',
  'content-library': 'content',
  'prompt-library': 'content',
  reels: 'social',
  'creative-assets': 'creative',
  campaigns: 'paid_ads',
  'ai-studio': 'creative',
  tasks: 'operations',
  reviews: 'operations',
  releases: 'operations',
  projects: 'strategy',
  reports: 'strategy',
};

export function describeRBAC(ctx: {
  rbacRole: RBACRole;
  department: Department | null;
  user: { id: string };
}): string {
  return `RBAC(role=${ctx.rbacRole}, dept=${ctx.department ?? '∅'}, user=${ctx.user.id.slice(0, 8)})`;
}