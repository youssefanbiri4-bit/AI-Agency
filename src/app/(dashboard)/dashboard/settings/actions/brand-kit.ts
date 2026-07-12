'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { getBrandKitForWorkspace, saveBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { normalizeBrandKit } from '@/lib/data/brand-kit';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readBrandKitFormData,
  type BrandKitSettingsState,
} from './_shared';

export async function getBrandKitSettingsAction(): Promise<BrandKitSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      brandKit: normalizeBrandKit(null),
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getBrandKitForWorkspace(supabase, context.workspace.id);

  return {
    error: result.error,
    brandKit: result.data.brandKit,
    exists: result.data.exists,
  };
}

export async function saveBrandKitSettingsAction(
  _state: BrandKitSettingsState,
  formData: FormData
): Promise<BrandKitSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      brandKit: normalizeBrandKit(null),
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update the Brand Kit.');
    return {
      error: 'Only workspace owners and admins can update the Brand Kit.',
      brandKit: readBrandKitFormData(formData),
      exists: false,
    };
  }

  const brandKit = readBrandKitFormData(formData);

  if (!brandKit.brandName.trim()) {
    return {
      error: 'Please complete the required brand name field.',
      brandKit,
      exists: false,
    };
  }

  const result = await saveBrandKitForWorkspace(
    supabase,
    context.workspace.id,
    context.user.id,
    brandKit
  );

  if (result.error) {
    return {
      error: result.error,
      brandKit,
      exists: false,
    };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'sensitive_settings_updated',
    entityType: 'brand_kit',
    message: 'Workspace Brand Kit updated.',
  });

  return {
    error: null,
    message: 'Brand Kit saved.',
    brandKit: result.data.brandKit,
    exists: true,
  };
}
