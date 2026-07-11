/**
 * RBAC + Departments Type Definitions
 *
 * Central source of truth for:
 * - Department enum (user / membership department scoping)
 * - RBACRole enum + hierarchy
 * - Labels (i18n friendly)
 * - Permission helpers types
 *
 * Usage:
 *   import type { Department, RBACRole } from '@/types/auth';
 */

import type { WorkspaceRole } from './database';

// ======================
// Core Enums
// ======================

/**
 * Department values for RBAC scoping.
 * Used to restrict UI sections and actions to users belonging to specific departments.
 */
export type Department =
  | 'content'
  | 'creative'
  | 'social'
  | 'strategy'
  | 'paid_ads'
  | 'operations';

/**
 * RBAC roles ordered by privilege.
 * owner > admin > operator > editor > viewer
 */
export type RBACRole = WorkspaceRole; // 'viewer' | 'editor' | 'operator' | 'admin' | 'owner'

// ======================
// Hierarchy (numeric rank for easy comparisons)
// ======================

export const ROLE_HIERARCHY: Record<RBACRole, number> = {
  viewer: 1,
  editor: 2,
  operator: 3,
  admin: 4,
  owner: 5,
} as const;

/**
 * Ordered list of roles from lowest to highest privilege.
 */
export const ROLE_ORDER: readonly RBACRole[] = [
  'viewer',
  'editor',
  'operator',
  'admin',
  'owner',
] as const;

// ======================
// Labels (human readable + Arabic support ready)
// ======================

export const ROLE_LABELS: Record<RBACRole, { en: string; ar: string }> = {
  viewer: { en: 'Viewer', ar: 'مشاهد' },
  editor: { en: 'Editor', ar: 'محرر' },
  operator: { en: 'Operator', ar: 'مشغل' },
  admin: { en: 'Admin', ar: 'مدير' },
  owner: { en: 'Owner', ar: 'مالك' },
};

export const DEPARTMENT_LABELS: Record<Department, { en: string; ar: string; description: string }> = {
  content: {
    en: 'Content',
    ar: 'المحتوى',
    description: 'Blog posts, copy, long-form content, prompt library contributions',
  },
  creative: {
    en: 'Creative',
    ar: 'الإبداع',
    description: 'Visuals, design assets, reels production, creative studio',
  },
  social: {
    en: 'Social',
    ar: 'التواصل الاجتماعي',
    description: 'Social posts, community management, reels & stories publishing',
  },
  strategy: {
    en: 'Strategy',
    ar: 'الاستراتيجية',
    description: 'Research, audience analysis, planning, campaigns strategy',
  },
  paid_ads: {
    en: 'Paid Ads',
    ar: 'الإعلانات المدفوعة',
    description: 'Meta/Google/Pinterest ads, campaign management, budget controls',
  },
  operations: {
    en: 'Operations',
    ar: 'العمليات',
    description: 'Tasks, releases, reviews, agent workflows, system health',
  },
};

// ======================
// Department <-> Nav / Feature Mapping
// (Extensible: add areas that a department primarily owns)
// ======================

export const DEPARTMENT_FEATURES: Record<Department, string[]> = {
  content: ['prompt-library', 'content-library', 'knowledge-base'],
  creative: ['creative-assets', 'reels', 'ai-studio'],
  social: ['reels', 'campaigns', 'content-studio'],
  strategy: ['projects', 'reports', 'agent-library'],
  paid_ads: ['campaigns', 'content-studio'],
  operations: ['tasks', 'reviews', 'quality-review', 'releases', 'backups'],
};

/**
 * Global areas visible regardless of department (subject to role)
 */
export const GLOBAL_AREAS = [
  'dashboard',
  'alex',
  'agents',
  'settings',
  'notifications',
  'docs',
] as const;

export type GlobalArea = (typeof GLOBAL_AREAS)[number];

// ======================
// Permission Action Types (extensible)
// ======================

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'publish'
  | 'run'
  | 'export'
  | 'manage_settings'
  | 'assign_dept'
  | 'manage_roles';

export interface RBACPermissionContext {
  role: RBACRole;
  department?: Department | null;
  workspaceId: string;
}

// ======================
// Default / Fallbacks
// ======================

export const DEFAULT_ROLE: RBACRole = 'viewer';
export const DEFAULT_DEPARTMENT: Department | null = null; // no restriction

/**
 * Checks if a value is a valid RBACRole.
 */
export function isRBACRole(value: unknown): value is RBACRole {
  return typeof value === 'string' && ROLE_ORDER.includes(value as RBACRole);
}

/**
 * Checks if a value is a valid Department.
 */
export function isDepartment(value: unknown): value is Department {
  return (
    typeof value === 'string' &&
    ['content', 'creative', 'social', 'strategy', 'paid_ads', 'operations'].includes(value)
  );
}

/**
 * Returns display label for role (defaults to English).
 */
export function getRoleLabel(role: RBACRole, lang: 'en' | 'ar' = 'en'): string {
  return ROLE_LABELS[role]?.[lang] ?? role;
}

/**
 * Returns display label + description for department.
 */
export function getDepartmentLabel(
  dept: Department,
  lang: 'en' | 'ar' = 'en'
): { label: string; description: string } {
  const info = DEPARTMENT_LABELS[dept];
  return {
    label: info?.[lang] ?? dept,
    description: info?.description ?? '',
  };
}

/**
 * Returns the minimal set of depts a role typically can see (used for filtering).
 * Owner/Admin see everything; lower roles see their own + global.
 */
export function getVisibleDepartmentsForRole(role: RBACRole, userDept: Department | null): Department[] {
  if (role === 'owner' || role === 'admin') {
    return ['content', 'creative', 'social', 'strategy', 'paid_ads', 'operations'];
  }
  if (userDept) return [userDept];
  // Fallback: allow broad for operators/editors if no dept assigned
  if (role === 'operator' || role === 'editor') {
    return ['content', 'creative', 'social', 'strategy', 'paid_ads', 'operations'];
  }
  return [];
}

export type { WorkspaceRole } from './database';
