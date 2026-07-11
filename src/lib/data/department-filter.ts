/**
 * Server-side department list scoping — mirrors `user_can_access_rbac_department`
 * and SQL department mapper functions for list endpoints.
 */

import type { Department, RBACRole } from '@/types/auth';
import { isDepartment } from '@/types/auth';
import { hasPermission } from '@/lib/auth/rbac-client';
import type {
  ContentStudioPlatform,
  ContentStudioType,
  CreativeAssetPlatform,
  CreativeAssetType,
} from '@/types/database';

export const REELS_RBAC_DEPARTMENT: Department = 'social';

export interface DepartmentListScopeInput {
  role: RBACRole;
  assignedDepartment: Department | null;
  /** Admin "view as" department from preferences (null = all departments). */
  effectiveDepartment?: Department | null;
}

/**
 * Mirrors `public.user_can_access_rbac_department(workspace_id, required_dept)`.
 */
export function userCanAccessRbacDepartment(
  role: RBACRole,
  assignedDepartment: Department | null,
  requiredDept: Department
): boolean {
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  if (!assignedDepartment && hasPermission(role, 'operator')) {
    return true;
  }

  return assignedDepartment === requiredDept;
}

/**
 * Resolves which RBAC departments list queries should include.
 * `null` = no extra server filter (owner/admin all-depts, or operator cross-dept).
 */
export function buildDepartmentListScope(input: DepartmentListScopeInput): Department[] | null {
  const { role, assignedDepartment, effectiveDepartment } = input;

  if ((role === 'owner' || role === 'admin') && effectiveDepartment) {
    return [effectiveDepartment];
  }

  if (role === 'owner' || role === 'admin') {
    return null;
  }

  if (!assignedDepartment && role === 'operator') {
    return null;
  }

  if (assignedDepartment) {
    return [assignedDepartment];
  }

  return null;
}

export function scopeIncludesDepartment(
  scope: Department[] | null | undefined,
  department: Department
): boolean {
  if (!scope) {
    return true;
  }

  return scope.includes(department);
}

export function scopeAllowsAnyDepartment(scope: Department[] | null | undefined): boolean {
  return !scope || scope.length > 0;
}

/** Mirrors `public.creative_asset_rbac_department(asset_type, platform)`. */
export function creativeAssetRbacDepartment(
  assetType: CreativeAssetType | string,
  platform: CreativeAssetPlatform | string | null | undefined
): Department {
  const normalizedPlatform = platform ?? '';
  const normalizedType = assetType ?? '';

  if (normalizedPlatform === 'google_ads' || normalizedPlatform === 'pinterest') {
    return 'paid_ads';
  }

  if (normalizedType === 'ad_creative' || normalizedType === 'campaign_visual') {
    return 'paid_ads';
  }

  if (normalizedType === 'reel_cover' || normalizedType === 'reel_video') {
    return 'social';
  }

  if (
    (normalizedPlatform === 'instagram' || normalizedPlatform === 'facebook') &&
    ['image', 'video', 'thumbnail', 'carousel_slide', 'story_visual'].includes(normalizedType)
  ) {
    return 'creative';
  }

  return 'creative';
}

/** Mirrors `public.content_studio_item_rbac_department(platform, content_type)`. */
export function contentStudioItemRbacDepartment(
  platform: ContentStudioPlatform | string,
  contentType: ContentStudioType | string
): Department {
  const normalizedPlatform = platform ?? '';
  const normalizedType = contentType ?? '';

  if (normalizedPlatform === 'google_ads' || normalizedType.includes('google_ads')) {
    return 'paid_ads';
  }

  if (normalizedPlatform === 'pinterest' || normalizedType.includes('pinterest')) {
    return 'paid_ads';
  }

  if (normalizedType.includes('reel')) {
    return 'social';
  }

  if (normalizedPlatform === 'instagram' || normalizedPlatform === 'facebook') {
    return 'social';
  }

  if (normalizedPlatform === 'linkedin') {
    return 'content';
  }

  return 'content';
}

export function filterRowsByDepartmentScope<T>(
  rows: T[],
  scope: Department[] | null | undefined,
  resolveDepartment: (row: T) => Department
): T[] {
  if (!scope) {
    return rows;
  }

  return rows.filter((row) => scopeIncludesDepartment(scope, resolveDepartment(row)));
}

export function taskRowMatchesDepartmentScope(
  agentDepartment: Department | string | null | undefined,
  scope: Department[] | null | undefined
): boolean {
  if (!scope) {
    return true;
  }

  if (!agentDepartment || !isDepartment(agentDepartment)) {
    return false;
  }

  return scope.includes(agentDepartment);
}