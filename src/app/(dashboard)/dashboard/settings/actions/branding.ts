'use server';

import { hasPermission } from '@/lib/auth/rbac';
import {
  defaultWorkspaceBranding,
  getBrandingForWorkspace,
  normalizeWorkspaceBranding,
  resetBrandingForWorkspace,
  saveBrandingForWorkspace,
} from '@/lib/data/branding';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  CREATIVE_ASSETS_BUCKET,
  createCreativeAssetPublicUrl,
} from '@/lib/storage/creative-assets';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readField,
  readOptionalFile,
  safeLogoStorageFileName,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_FILE_SIZE_BYTES,
  type BrandingSettingsState,
} from './_shared';

export async function getBrandingSettingsAction(): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getBrandingForWorkspace(supabase, context.workspace.id);

  return {
    error: result.error,
    branding: result.data.branding,
    exists: result.data.exists,
  };
}

export async function saveBrandingSettingsAction(
  _state: BrandingSettingsState,
  formData: FormData
): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();
  const fallbackBranding = normalizeWorkspaceBranding({
    logo_alt_text: readField(formData, 'logoAltText'),
  });

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: fallbackBranding,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update branding.');
    return {
      error: 'Only workspace owners and admins can update branding.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const logoFile = readOptionalFile(formData, 'logoFile');

  if (!logoFile) {
    return {
      error: 'Select a logo before saving.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  if (!LOGO_ALLOWED_TYPES.has(logoFile.type)) {
    return {
      error: 'Unsupported file type.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  if (logoFile.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return {
      error: 'Logo file is too large.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const storagePath = `${context.workspace.id}/${context.user.id}/branding/${safeLogoStorageFileName(logoFile)}`;
  const { error: uploadError } = await supabase.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .upload(storagePath, logoFile, {
      cacheControl: '31536000',
      contentType: logoFile.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      error: uploadError.message,
      branding: fallbackBranding,
      exists: false,
    };
  }

  const logoUrl = createCreativeAssetPublicUrl(storagePath);

  if (!logoUrl) {
    return {
      error: 'Could not create logo URL.',
      branding: fallbackBranding,
      exists: false,
    };
  }

  const result = await saveBrandingForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id,
    normalizeWorkspaceBranding({
      logo_url: logoUrl,
      logo_storage_path: storagePath,
      logo_alt_text: readField(formData, 'logoAltText') || 'AgentFlow AI logo',
      favicon_url: null,
    })
  );

  if (result.error) {
    return {
      error: result.error,
      branding: fallbackBranding,
      exists: false,
    };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'branding',
    message: 'Workspace logo updated.',
  });

  return {
    error: null,
    message: 'Logo updated successfully.',
    branding: result.data.branding,
    exists: true,
  };
}

export async function resetBrandingSettingsAction(): Promise<BrandingSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update branding.');
    return {
      error: 'Only workspace owners and admins can update branding.',
      branding: defaultWorkspaceBranding,
      exists: false,
    };
  }

  const result = await resetBrandingForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id
  );

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'branding',
      message: 'Workspace branding reset.',
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'Logo reset to default.',
    branding: result.data.branding,
    exists: result.data.exists,
  };
}
