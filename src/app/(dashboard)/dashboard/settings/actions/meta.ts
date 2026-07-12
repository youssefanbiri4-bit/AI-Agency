'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getMetaAdAccountsForWorkspace,
  getMetaConnectionStatus,
  updateMetaConnectionMetadata,
} from '@/lib/data/ad-connections';
import {
  getMetaPublishingScopes,
  listMetaPublishingTargets,
} from '@/lib/ads/meta-publishing';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readField,
  readMetadataString,
  disconnectedMetaSettings,
  type MetaConnectionSettingsState,
} from './_shared';

export async function getMetaConnectionSettingsAction(): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  const connectionResult = await getMetaConnectionStatus(context.workspace.id, context.user.id);

  if (connectionResult.error) {
    return {
      ...disconnectedMetaSettings,
      error: connectionResult.error,
    };
  }

  const connection = connectionResult.data;
  const requiredScopes = getMetaPublishingScopes();
  const missingScopes = requiredScopes.filter((scope) => !connection.scopes.includes(scope));

  if (connection.status !== 'connected') {
    return {
      ...disconnectedMetaSettings,
      status: connection.status,
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
      tokenExpiresAt: connection.tokenExpiresAt,
      grantedScopes: connection.scopes,
      missingOrganicScopes: missingScopes,
      error: null,
    };
  }

  const [targets, adAccountsResult] = await Promise.all([
    listMetaPublishingTargets({
      workspaceId: context.workspace.id,
      userId: context.user.id,
    }),
    getMetaAdAccountsForWorkspace(context.workspace.id, context.user.id),
  ]);
  const metadata = connection.metadata;
  const adAccounts =
    adAccountsResult.data.state === 'connected' ? adAccountsResult.data.accounts : [];

  return {
    error: targets.error,
    status: connection.status,
    connectedAt: connection.connectedAt,
    updatedAt: connection.updatedAt,
    tokenExpiresAt: connection.tokenExpiresAt,
    grantedScopes: connection.scopes,
    requiredOrganicScopes: requiredScopes,
    missingOrganicScopes: missingScopes,
    connectedMetaUserId: readMetadataString(metadata, 'meta_user_id'),
    connectedMetaApplication: readMetadataString(metadata, 'meta_application'),
    scopesVerified: metadata.scopes_verified === true,
    scopeWarning:
      readMetadataString(metadata, 'scope_warning') ??
      readMetadataString(metadata, 'scope_verification_warning'),
    pages: targets.pages,
    adAccounts,
    selectedFacebookPageId: targets.selectedFacebookPageId,
    selectedFacebookPageName: targets.selectedFacebookPageName,
    selectedInstagramBusinessAccountId: targets.selectedInstagramBusinessAccountId,
    selectedInstagramUsername: targets.selectedInstagramUsername,
    selectedInstagramAssociatedFacebookPageId:
      targets.selectedInstagramAssociatedFacebookPageId,
    selectedMetaAdAccountId: readMetadataString(metadata, 'selected_meta_ad_account_id'),
    selectedMetaAdAccountName: readMetadataString(metadata, 'selected_meta_ad_account_name'),
    selectedMetaAdAccountCurrency: readMetadataString(metadata, 'selected_meta_ad_account_currency'),
    selectedMetaAdAccountTimezone: readMetadataString(metadata, 'selected_meta_ad_account_timezone'),
  };
}

export async function selectMetaFacebookPageAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const pageId = readField(formData, 'facebook_page_id');
  const targets = await listMetaPublishingTargets({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });
  const selectedPage = targets.pages.find((page) => page.id === pageId);

  if (!selectedPage) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Facebook Page setup required.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_facebook_page_id: selectedPage.id,
      selected_facebook_page_name: selectedPage.name,
      selected_facebook_page_selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Facebook Page selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Facebook Page selected.',
    error: null,
  };
}

export async function selectMetaInstagramAccountAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const instagramBusinessAccountId = readField(formData, 'instagram_business_account_id');
  const targets = await listMetaPublishingTargets({
    workspaceId: context.workspace.id,
    userId: context.user.id,
  });
  const selectedPage = targets.pages.find(
    (page) => page.instagramBusinessAccountId === instagramBusinessAccountId
  );

  if (!selectedPage?.instagramBusinessAccountId) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Instagram Business Account setup required.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_instagram_business_account_id: selectedPage.instagramBusinessAccountId,
      selected_instagram_username: selectedPage.instagramUsername ?? '',
      selected_instagram_associated_facebook_page_id: selectedPage.id,
      selected_instagram_associated_facebook_page_name: selectedPage.name,
      selected_instagram_selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Instagram account selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Instagram account selected.',
    error: null,
  };
}

export async function selectMetaAdAccountAction(
  _state: MetaConnectionSettingsState,
  formData: FormData
): Promise<MetaConnectionSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      ...disconnectedMetaSettings,
      error: context.error,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update provider settings.');
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Only workspace owners and admins can update provider settings.',
    };
  }

  const adAccountId = readField(formData, 'meta_ad_account_id');
  const accountsResult = await getMetaAdAccountsForWorkspace(context.workspace.id, context.user.id);
  const accounts =
    accountsResult.data.state === 'connected' ? accountsResult.data.accounts : [];
  const selectedAccount = accounts.find(
    (account) => account.id === adAccountId || account.accountId === adAccountId
  );

  if (!selectedAccount?.accountId) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: 'Meta Ad Account is not selected.',
    };
  }

  const updateResult = await updateMetaConnectionMetadata(
    context.workspace.id,
    context.user.id,
    {
      selected_meta_ad_account_id: selectedAccount.accountId,
      selected_meta_ad_account_name: selectedAccount.name ?? '',
      selected_meta_ad_account_currency: selectedAccount.currency ?? '',
      selected_meta_ad_account_timezone: selectedAccount.timezoneName ?? '',
      selected_at: new Date().toISOString(),
    }
  );

  if (updateResult.error) {
    return {
      ...(await getMetaConnectionSettingsAction()),
      error: updateResult.error,
    };
  }

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'provider_settings',
    message: 'Meta Ad Account selected.',
    metadata: { provider: 'meta' },
  });

  return {
    ...(await getMetaConnectionSettingsAction()),
    message: 'Meta Ad Account selected.',
    error: null,
  };
}
