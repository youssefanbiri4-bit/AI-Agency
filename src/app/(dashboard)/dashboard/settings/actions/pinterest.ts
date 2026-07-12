'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getPinterestConnectionSettings,
  updatePinterestSelectedBoard,
} from '@/lib/ads/pinterest-publishing';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readField,
  disconnectedPinterestSettings,
  type PinterestConnectionSettingsState,
} from './_shared';

export async function getPinterestConnectionSettingsAction(): Promise<PinterestConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedPinterestSettings,
      error: context.error,
    };
  }

  const settings = await getPinterestConnectionSettings({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });

  return settings;
}

export async function selectPinterestBoardAction(
  _state: PinterestConnectionSettingsState,
  formData: FormData
): Promise<PinterestConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedPinterestSettings,
      error: context.error,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const boardId = readField(formData, 'pinterest_board_id');

  if (!boardId) {
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: 'Pinterest board is required.',
    };
  }

  const updateResult = await updatePinterestSelectedBoard({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    boardId,
  });

  if (updateResult.error) {
    return {
      ...(await getPinterestConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Pinterest board selected.',
    metadata: { provider: 'pinterest' },
  });

  return {
    ...(await getPinterestConnectionSettingsAction()),
    message: 'Pinterest board selected.',
    error: null,
  };
}
