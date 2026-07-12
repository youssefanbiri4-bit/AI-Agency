'use server';

import { getPermissionLevelSummary, permissionsMatrix } from '@/lib/permissions-matrix';
import {
  getSettingsWorkspaceContext,
  countMembersForSettings,
  type RolesOverviewState,
} from './_shared';

export async function getRolesOverviewAction(): Promise<RolesOverviewState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      currentRole: 'viewer',
      isOwner: false,
      isAdmin: false,
      memberCount: null,
      permissionLevelSummary: getPermissionLevelSummary('viewer'),
      matrix: permissionsMatrix,
    };
  }

  return {
    error: null,
    currentRole: context.role,
    isOwner: context.role === 'owner',
    isAdmin: context.role === 'owner' || context.role === 'admin',
    memberCount: await countMembersForSettings(context.workspace.id),
    permissionLevelSummary: getPermissionLevelSummary(context.role),
    matrix: permissionsMatrix,
  };
}
