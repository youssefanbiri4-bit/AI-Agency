'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getWorkspaceBrandingSettings,
  saveWhiteLabelConfig,
  addCustomDomain,
  removeCustomDomain,
  saveSSOProvider,
  removeSSOProvider,
} from '@/lib/data/workspace-branding';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readField,
  emptyToNull,
} from './_shared';
import type {
  WhiteLabelConfig,
  SSOProviderConfig,
  SSOProviderType,
} from '@/types/white-label';
import { defaultWhiteLabelConfig, defaultWorkspaceBrandingSettings } from '@/types/white-label';
import type { WorkspaceBrandingSettingsState } from './_shared';

// ---------------------------------------------------------------------------
// White Label
// ---------------------------------------------------------------------------

export async function getWhiteLabelAction(): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const result = await getWorkspaceBrandingSettings(context.supabase, context.workspace.id);

  return {
    error: result.error,
    settings: result.data.settings,
    exists: result.data.exists,
  };
}

export async function saveWhiteLabelAction(
  _state: WorkspaceBrandingSettingsState,
  formData: FormData
): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only admins can update white label settings.');
    return {
      error: 'Only workspace owners and admins can update white label settings.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const whiteLabel: WhiteLabelConfig = {
    ...defaultWhiteLabelConfig,
    enabled: formData.get('enabled') === 'on',
    companyName: emptyToNull(readField(formData, 'companyName')),
    tagline: emptyToNull(readField(formData, 'tagline')),
    hideAgentFlowBranding: formData.get('hideAgentFlowBranding') === 'on',
    customCss: emptyToNull(readField(formData, 'customCss')),
    colors: {
      primary: readField(formData, 'colorPrimary') || defaultWhiteLabelConfig.colors.primary,
      secondary: readField(formData, 'colorSecondary') || defaultWhiteLabelConfig.colors.secondary,
      accent: readField(formData, 'colorAccent') || defaultWhiteLabelConfig.colors.accent,
      background: readField(formData, 'colorBackground') || defaultWhiteLabelConfig.colors.background,
      text: readField(formData, 'colorText') || defaultWhiteLabelConfig.colors.text,
      sidebar: readField(formData, 'colorSidebar') || defaultWhiteLabelConfig.colors.sidebar,
      header: readField(formData, 'colorHeader') || defaultWhiteLabelConfig.colors.header,
    },
    logoUrl: emptyToNull(readField(formData, 'logoUrl')),
    logoAltText: emptyToNull(readField(formData, 'logoAltText')),
    faviconUrl: emptyToNull(readField(formData, 'faviconUrl')),
    updatedAt: new Date().toISOString(),
    updatedBy: context.user.id,
  };

  const result = await saveWhiteLabelConfig(
    context.supabase,
    context.workspace.id,
    context.user.id,
    whiteLabel
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'white_label',
      message: `White label settings ${whiteLabel.enabled ? 'enabled' : 'updated'}.`,
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'White label settings saved.',
    settings: result.data.settings,
    exists: result.data.exists,
  };
}

// ---------------------------------------------------------------------------
// Custom Domains
// ---------------------------------------------------------------------------

export async function addCustomDomainAction(
  _state: WorkspaceBrandingSettingsState,
  formData: FormData
): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only admins can manage custom domains.');
    return {
      error: 'Only workspace owners and admins can manage custom domains.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const domain = readField(formData, 'domain')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();

  if (!domain || !domain.includes('.')) {
    return {
      error: 'Please enter a valid domain (e.g., app.yourcompany.com).',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return {
      error: 'Invalid domain format. Use a fully qualified domain name.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const result = await addCustomDomain(
    context.supabase,
    context.workspace.id,
    context.user.id,
    domain
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'custom_domain',
      message: `Custom domain "${domain}" added.`,
    });
  }

  return {
    error: result.error,
    message: result.error ? null : `Domain "${domain}" added. Configure your DNS to point to cname.agentflow.ai.`,
    settings: result.data.settings,
    exists: result.data.exists,
  };
}

export async function removeCustomDomainAction(
  domainId: string
): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only admins can manage custom domains.');
    return {
      error: 'Only workspace owners and admins can manage custom domains.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const result = await removeCustomDomain(
    context.supabase,
    context.workspace.id,
    context.user.id,
    domainId
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'custom_domain',
      message: `Custom domain removed.`,
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'Domain removed.',
    settings: result.data.settings,
    exists: result.data.exists,
  };
}

// ---------------------------------------------------------------------------
// SSO Providers
// ---------------------------------------------------------------------------

export async function saveSSOProviderAction(
  _state: WorkspaceBrandingSettingsState,
  formData: FormData
): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only admins can configure SSO.');
    return {
      error: 'Only workspace owners and admins can configure SSO.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const providerType = readField(formData, 'providerType') as SSOProviderType;
  const validTypes: SSOProviderType[] = ['google_workspace', 'microsoft_entra', 'okta'];
  if (!validTypes.includes(providerType)) {
    return {
      error: 'Invalid SSO provider type.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const provider: SSOProviderConfig = {
    type: providerType,
    enabled: formData.get('enabled') === 'on',
    clientId: emptyToNull(readField(formData, 'clientId')),
    tenantId: emptyToNull(readField(formData, 'tenantId')),
    domain: emptyToNull(readField(formData, 'ssoDomain')),
    issuerUrl: emptyToNull(readField(formData, 'issuerUrl')),
    callbackUrl: emptyToNull(readField(formData, 'callbackUrl')),
    allowSignUp: formData.get('allowSignUp') !== 'off',
    domains: readField(formData, 'allowedDomains')
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter(Boolean),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = await saveSSOProvider(
    context.supabase,
    context.workspace.id,
    context.user.id,
    provider
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'sso_provider',
      message: `SSO provider "${providerType}" ${provider.enabled ? 'enabled' : 'updated'}.`,
    });
  }

  return {
    error: result.error,
    message: result.error ? null : `SSO provider "${providerType}" saved.`,
    settings: result.data.settings,
    exists: result.data.exists,
  };
}

export async function removeSSOProviderAction(
  providerType: SSOProviderType
): Promise<WorkspaceBrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only admins can configure SSO.');
    return {
      error: 'Only workspace owners and admins can configure SSO.',
      settings: defaultWorkspaceBrandingSettings,
      exists: false,
    };
  }

  const result = await removeSSOProvider(
    context.supabase,
    context.workspace.id,
    context.user.id,
    providerType
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'sso_provider',
      message: `SSO provider "${providerType}" removed.`,
    });
  }

  return {
    error: result.error,
    message: result.error ? null : `SSO provider "${providerType}" removed.`,
    settings: result.data.settings,
    exists: result.data.exists,
  };
}
