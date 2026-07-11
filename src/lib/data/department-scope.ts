import 'server-only';

import { getRBACContext } from '@/lib/auth/rbac';
import { userPreferencesService } from '@/lib/preferences/user-preferences';
import { RBAC_DEPT_COOKIE } from '@/lib/auth/require-page-access';
import { isDepartment } from '@/types/auth';
import type { Department } from '@/types/auth';
import { buildDepartmentListScope } from '@/lib/data/department-filter';
import { cookies } from 'next/headers';

/**
 * Resolves the department list scope for the current authenticated user,
 * including admin view-as preferences AND the RBAC_DEPT_COOKIE (M8 fix).
 *
 * Priority for effective department:
 *  1. Saved DB preference (setViewAsDepartmentAction)
 *  2. RBAC_DEPT_COOKIE (client-side set by admin department switcher)
 *  3. Assigned membership department
 */
export async function resolveDepartmentListScopeFromRBAC(): Promise<Department[] | null> {
  const rbacRes = await getRBACContext();
  if (!rbacRes.data) {
    return [];
  }

  let effectiveDepartment: Department | null | undefined = undefined;

  if (rbacRes.data.isAdminOrHigher) {
    // 1. Try saved DB preference first (persisted via setViewAsDepartmentAction)
    const savedPreference = await userPreferencesService.getViewAsDepartment(
      rbacRes.data.supabase,
      rbacRes.data.user.id,
      rbacRes.data.workspace.id
    );

    if (savedPreference) {
      effectiveDepartment = savedPreference;
    } else {
      // 2. Fall back to RBAC_DEPT_COOKIE — covers race conditions where
      //    the DB save hasn't completed or the cookie is the only source
      try {
        const cookieStore = await cookies();
        const cookieDeptRaw = cookieStore.get(RBAC_DEPT_COOKIE)?.value;
        if (isDepartment(cookieDeptRaw)) {
          effectiveDepartment = cookieDeptRaw;
        }
      } catch {
        // cookies() throws in non-server contexts; fall through
      }
    }
  }

  return buildDepartmentListScope({
    role: rbacRes.data.rbacRole,
    assignedDepartment: rbacRes.data.department,
    effectiveDepartment,
  });
}

/**
 * Convenience alias for list endpoints — mirrors `user_can_access_rbac_department` scoping.
 */
export const departmentScope = resolveDepartmentListScopeFromRBAC;