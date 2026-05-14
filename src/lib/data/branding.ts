import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject, JsonValue } from '@/types';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type BrandingClient = SupabaseClient<Database>;

export interface WorkspaceBranding extends JsonObject {
  logo_url: string | null;
  logo_storage_path: string | null;
  logo_alt_text: string | null;
  favicon_url: string | null;
  updated_at: string | null;
}

export interface WorkspaceBrandingState {
  branding: WorkspaceBranding;
  exists: boolean;
}

export const BRANDING_SETTINGS_KEY = 'branding';

export const defaultWorkspaceBranding: WorkspaceBranding = {
  logo_url: null,
  logo_storage_path: null,
  logo_alt_text: 'AgentFlow AI',
  favicon_url: null,
  updated_at: null,
};

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanJsonObject(value: Record<string, JsonValue | undefined | null>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
  );
}

export function normalizeWorkspaceBranding(value: unknown): WorkspaceBranding {
  const raw = readObject(value);

  return {
    ...defaultWorkspaceBranding,
    logo_url: readString(raw.logo_url),
    logo_storage_path: readString(raw.logo_storage_path),
    logo_alt_text: readString(raw.logo_alt_text) ?? defaultWorkspaceBranding.logo_alt_text,
    favicon_url: readString(raw.favicon_url),
    updated_at: readString(raw.updated_at),
  };
}

export function serializeWorkspaceBranding(branding: WorkspaceBranding): JsonObject {
  return cleanJsonObject({
    logo_url: branding.logo_url,
    logo_storage_path: branding.logo_storage_path,
    logo_alt_text: branding.logo_alt_text,
    favicon_url: branding.favicon_url,
    updated_at: branding.updated_at,
  });
}

export async function getBrandingForWorkspace(
  client: BrandingClient,
  workspaceId: string
): Promise<DataResult<WorkspaceBrandingState>> {
  const { data, error } = await client
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(
      { branding: defaultWorkspaceBranding, exists: false },
      error.message
    );
  }

  const settings = readObject(data?.settings);
  const rawBranding = settings[BRANDING_SETTINGS_KEY];

  return emptyDataResult(
    {
      branding: rawBranding
        ? normalizeWorkspaceBranding(rawBranding)
        : defaultWorkspaceBranding,
      exists: Boolean(rawBranding),
    },
    true
  );
}

export async function saveBrandingForWorkspace(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  branding: WorkspaceBranding
): Promise<DataResult<WorkspaceBrandingState>> {
  const { data: existing, error: existingError } = await client
    .from('integration_settings')
    .select('settings, supabase_status, n8n_status')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) {
    return errorDataResult({ branding, exists: false }, existingError.message);
  }

  const settings = readObject(existing?.settings);
  const nextBranding = normalizeWorkspaceBranding({
    ...branding,
    updated_at: new Date().toISOString(),
  });
  const nextSettings: JsonObject = {
    ...settings,
    [BRANDING_SETTINGS_KEY]: serializeWorkspaceBranding(nextBranding),
  };

  const { error } = await client.from('integration_settings').upsert({
    workspace_id: workspaceId,
    supabase_status: existing?.supabase_status ?? 'configured',
    n8n_status: existing?.n8n_status ?? 'not_connected',
    settings: nextSettings,
    updated_by: userId,
  });

  if (error) {
    return errorDataResult({ branding: nextBranding, exists: false }, error.message);
  }

  return emptyDataResult({ branding: nextBranding, exists: true }, true);
}

export async function resetBrandingForWorkspace(
  client: BrandingClient,
  workspaceId: string,
  userId: string
): Promise<DataResult<WorkspaceBrandingState>> {
  const { data: existing, error: existingError } = await client
    .from('integration_settings')
    .select('settings, supabase_status, n8n_status')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) {
    return errorDataResult(
      { branding: defaultWorkspaceBranding, exists: false },
      existingError.message
    );
  }

  const settings = readObject(existing?.settings);
  const nextSettings: JsonObject = {
    ...settings,
    [BRANDING_SETTINGS_KEY]: serializeWorkspaceBranding({
      ...defaultWorkspaceBranding,
      updated_at: new Date().toISOString(),
    }),
  };

  const { error } = await client.from('integration_settings').upsert({
    workspace_id: workspaceId,
    supabase_status: existing?.supabase_status ?? 'configured',
    n8n_status: existing?.n8n_status ?? 'not_connected',
    settings: nextSettings,
    updated_by: userId,
  });

  if (error) {
    return errorDataResult(
      { branding: defaultWorkspaceBranding, exists: false },
      error.message
    );
  }

  return emptyDataResult(
    {
      branding: normalizeWorkspaceBranding(nextSettings[BRANDING_SETTINGS_KEY]),
      exists: true,
    },
    true
  );
}
