import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  defaultWorkspaceTheme,
  normalizeWorkspaceTheme,
  themeToSettingsJson,
  type WorkspaceTheme,
} from '@/lib/theme';
import type { Database } from '@/types/database';
import type { DataResult } from './types';
import { emptyDataResult, errorDataResult } from './types';
import type { JsonObject, JsonValue } from '@/types';

function readSettings(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? ({ ...(value as Record<string, JsonValue>) } as JsonObject)
    : {};
}

export async function getWorkspaceTheme(
  client: SupabaseClient<Database>,
  workspaceId: string
): Promise<DataResult<WorkspaceTheme>> {
  const { data, error } = await client
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(defaultWorkspaceTheme, error.message);
  }

  return emptyDataResult(normalizeWorkspaceTheme(data?.settings ?? null), true);
}

export async function saveWorkspaceTheme(
  client: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  theme: WorkspaceTheme
): Promise<DataResult<WorkspaceTheme>> {
  const { data: current, error: currentError } = await client
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (currentError) {
    return errorDataResult(theme, currentError.message);
  }

  const settings = readSettings(current?.settings);
  settings.theme = themeToSettingsJson(theme);

  const { error } = await client.from('integration_settings').upsert(
    {
      workspace_id: workspaceId,
      settings,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  );

  if (error) {
    return errorDataResult(theme, error.message);
  }

  return emptyDataResult(theme, true);
}

export async function resetWorkspaceTheme(
  client: SupabaseClient<Database>,
  workspaceId: string,
  userId: string
) {
  return saveWorkspaceTheme(client, workspaceId, userId, {
    ...defaultWorkspaceTheme,
    updated_at: new Date().toISOString(),
  });
}
