'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getWorkspaceTheme,
  resetWorkspaceTheme,
  saveWorkspaceTheme,
} from '@/lib/data/theme';
import { defaultWorkspaceTheme } from '@/lib/theme';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  CREATIVE_ASSETS_BUCKET,
  createCreativeAssetPublicUrl,
} from '@/lib/storage/creative-assets';
import {
  getSettingsWorkspaceContext,
  denySettingsAction,
  readThemeFormData,
  readOptionalFile,
  safeThemeBackgroundStorageFileName,
  THEME_BACKGROUND_ALLOWED_TYPES,
  THEME_BACKGROUND_MAX_FILE_SIZE_BYTES,
  type ThemeSettingsState,
} from './_shared';

export async function getThemeSettingsAction(): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await getWorkspaceTheme(supabase, context.workspace.id);

  return {
    error: result.error,
    theme: result.data,
    exists: !result.error,
  };
}

export async function saveThemeSettingsAction(
  _state: ThemeSettingsState,
  formData: FormData
): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();
  let theme = readThemeFormData(formData);

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update theme settings.');
    return {
      error: 'Only workspace owners and admins can update theme settings.',
      theme,
      exists: false,
    };
  }

  const backgroundFile = readOptionalFile(formData, 'background_file');

  if (backgroundFile) {
    if (!THEME_BACKGROUND_ALLOWED_TYPES.has(backgroundFile.type)) {
      return {
        error: 'Unsupported file type.',
        theme,
        exists: false,
      };
    }

    if (backgroundFile.size > THEME_BACKGROUND_MAX_FILE_SIZE_BYTES) {
      return {
        error: 'File is too large.',
        theme,
        exists: false,
      };
    }

    const storagePath = `${context.workspace.id}/${context.user.id}/theme/${safeThemeBackgroundStorageFileName(backgroundFile)}`;
    const { error: uploadError } = await supabase.storage
      .from(CREATIVE_ASSETS_BUCKET)
      .upload(storagePath, backgroundFile, {
        cacheControl: '31536000',
        contentType: backgroundFile.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        error: uploadError.message,
        theme,
        exists: false,
      };
    }

    const backgroundUrl = createCreativeAssetPublicUrl(storagePath);

    if (!backgroundUrl) {
      return {
        error: 'Could not create background image URL.',
        theme,
        exists: false,
      };
    }

    theme = {
      ...theme,
      background_image_url: backgroundUrl,
      background_image_storage_path: storagePath,
      background_mode: 'image',
    };
  }

  const result = await saveWorkspaceTheme(supabase, context.workspace.id, context.user.id, theme);

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'theme',
      message: 'Workspace theme settings updated.',
      metadata: { background_uploaded: Boolean(backgroundFile) },
    });
  }

  return {
    error: result.error,
    message: result.error ? null : backgroundFile ? 'Background uploaded.' : 'Theme saved.',
    theme: result.data,
    exists: !result.error,
  };
}

export async function resetThemeSettingsAction(): Promise<ThemeSettingsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error,
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const supabase = context.supabase;

  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Only workspace owners and admins can update theme settings.');
    return {
      error: 'Only workspace owners and admins can update theme settings.',
      theme: defaultWorkspaceTheme,
      exists: false,
    };
  }

  const result = await resetWorkspaceTheme(supabase, context.workspace.id, context.user.id);

  if (!result.error) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'sensitive_settings_updated',
      entityType: 'theme',
      message: 'Workspace theme settings reset.',
    });
  }

  return {
    error: result.error,
    message: result.error ? null : 'Theme reset to default.',
    theme: result.data,
    exists: !result.error,
  };
}
