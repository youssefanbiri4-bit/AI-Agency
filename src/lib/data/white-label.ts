import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { WhiteLabelConfig, WhiteLabelColors } from '@/types/white-label';
import { defaultWhiteLabelConfig, DEFAULT_WHITE_LABEL_COLORS } from '@/types/white-label';

export type { WhiteLabelConfig, WhiteLabelColors };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: WhiteLabelConfig | null; at: number }>();

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeColors(raw: unknown): WhiteLabelColors {
  const obj = readObject(raw);
  const hex = (v: unknown, fb: string) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : fb;
  };
  return {
    primary: hex(obj.primary, DEFAULT_WHITE_LABEL_COLORS.primary),
    secondary: hex(obj.secondary, DEFAULT_WHITE_LABEL_COLORS.secondary),
    accent: hex(obj.accent, DEFAULT_WHITE_LABEL_COLORS.accent),
    background: hex(obj.background, DEFAULT_WHITE_LABEL_COLORS.background),
    text: hex(obj.text, DEFAULT_WHITE_LABEL_COLORS.text),
    sidebar: hex(obj.sidebar, DEFAULT_WHITE_LABEL_COLORS.sidebar),
    header: hex(obj.header, DEFAULT_WHITE_LABEL_COLORS.header),
  };
}

function normalizeWhiteLabelConfig(raw: unknown): WhiteLabelConfig {
  const obj = readObject(raw);
  return {
    ...defaultWhiteLabelConfig,
    enabled: readBoolean(obj.enabled, false),
    companyName: readString(obj.companyName),
    tagline: readString(obj.tagline),
    logoUrl: readString(obj.logoUrl),
    logoStoragePath: readString(obj.logoStoragePath),
    logoAltText: readString(obj.logoAltText),
    faviconUrl: readString(obj.faviconUrl),
    faviconStoragePath: readString(obj.faviconStoragePath),
    colors: normalizeColors(obj.colors),
    hideAgentFlowBranding: readBoolean(obj.hideAgentFlowBranding, false),
    customCss: readString(obj.customCss),
    updatedAt: readString(obj.updatedAt),
    updatedBy: readString(obj.updatedBy),
  };
}

function getServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Load white-label config for a workspace.
 * Uses service role client + in-memory cache for fast reads at the layout level.
 */
export async function getWhiteLabelForWorkspace(
  workspaceId: string,
  useCache = true
): Promise<WhiteLabelConfig | null> {
  if (useCache) {
    const hit = cache.get(workspaceId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  }

  const client = getServiceRoleClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('integration_settings')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error || !data) {
      cache.set(workspaceId, { value: null, at: Date.now() });
      return null;
    }

    const settings = readObject(data.settings);
    const raw = readObject(settings.workspace_branding);
    const rawWL = readObject(raw.whiteLabel);

    const config = rawWL.enabled ? normalizeWhiteLabelConfig(rawWL) : null;
    cache.set(workspaceId, { value: config, at: Date.now() });
    return config;
  } catch (err) {
    logger.warn('Failed to load white-label config', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Clear the white-label cache (call after settings update).
 */
export function clearWhiteLabelCache(workspaceId: string): void {
  cache.delete(workspaceId);
}
