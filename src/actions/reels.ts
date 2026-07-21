/**
 * Centralized Reels Actions with RBAC + Production Gate + Dept Scoping
 * (TASK 1)
 */

import 'server-only';
import { requireWorkspaceAccessWithRBAC, getRBACContext, hasPermission } from '@/lib/auth/rbac';
// Note: workspace context resolved inside the delegated actions for RBAC/dept
import {
  publishReelAction as originalPublishReelAction,
  createReelAction as originalCreate,
  type ReelActionState,
} from '@/app/(dashboard)/dashboard/reels/actions';

export async function gatedCreateReel(state: unknown, formData: FormData) {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbac.ok) {
    return { error: rbac.error || 'Operator role required.' };
  }
  const ctx = await getRBACContext();
  if (ctx.data) {
    const isAdmin = hasPermission(ctx.data.rbacRole, 'admin');
    const d = ctx.data.department;
    if (!isAdmin && d && !['social', 'content', 'creative'].includes(d)) {
      return { error: 'Reels scoped to social, content, or creative departments.' };
    }
  }
  // delegated action will assert gate
  return originalCreate(state as ReelActionState, formData);
}

export async function gatedPublishReel(reelId: string, state: unknown) {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbac.ok) {
    return { error: rbac.error || 'Operator role required to publish.' };
  }
  // Assume context inside
  return originalPublishReelAction(reelId, state as ReelActionState);
}
