import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject, JsonValue } from '@/types';
import type { Database } from '@/types/database';
import type {
  WhiteLabelConfig,
  CustomDomain,
  SSOProviderConfig,
  WorkspaceBrandingSettings,
  WhiteLabelColors,
  DomainStatus,
  SSOProviderType,
  DomainDnsRecord,
} from '@/types/white-label';
import {
  defaultWorkspaceBrandingSettings,
  defaultWhiteLabelConfig,
  DEFAULT_WHITE_LABEL_COLORS,
  defaultSSOProviderConfig,
} from '@/types/white-label';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type BrandingClient = SupabaseClient<Database>;

export interface WorkspaceBrandingSettingsState {
  error?: string | null;
  message?: string | null;
  settings: WorkspaceBrandingSettings;
  exists: boolean;
}

const BRANDING_SETTINGS_KEY = 'workspace_branding';

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
}

function cleanJsonObject(value: Record<string, JsonValue | undefined | null>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
  );
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

function normalizeDomainDnsRecord(raw: unknown): DomainDnsRecord {
  const obj = readObject(raw);
  return {
    type: readString(obj.type) ?? 'CNAME',
    host: readString(obj.host) ?? '',
    value: readString(obj.value) ?? '',
    required: readBoolean(obj.required, true),
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

function normalizeCustomDomain(raw: unknown): CustomDomain {
  const obj = readObject(raw);
  const validStatuses: DomainStatus[] = ['pending', 'verifying', 'verified', 'failed', 'removed'];
  const status = readString(obj.status) as DomainStatus | null;

  return {
    id: readString(obj.id) ?? '',
    domain: readString(obj.domain) ?? '',
    status: status && validStatuses.includes(status) ? status : 'pending',
    verifiedAt: readString(obj.verifiedAt),
    cnameTarget: readString(obj.cnameTarget) ?? 'cname.agentflow.ai',
    dnsRecords: Array.isArray(obj.dnsRecords)
      ? obj.dnsRecords.map(normalizeDomainDnsRecord)
      : [],
    lastCheckedAt: readString(obj.lastCheckedAt),
    errorMessage: readString(obj.errorMessage),
    createdAt: readString(obj.createdAt),
  };
}

function normalizeSSOProviderConfig(raw: unknown): SSOProviderConfig {
  const obj = readObject(raw);
  const validTypes: SSOProviderType[] = ['google_workspace', 'microsoft_entra', 'okta'];
  const type = readString(obj.type) as SSOProviderType | null;

  return {
    ...defaultSSOProviderConfig,
    type: type && validTypes.includes(type) ? type : 'google_workspace',
    enabled: readBoolean(obj.enabled, false),
    clientId: readString(obj.clientId),
    tenantId: readString(obj.tenantId),
    domain: readString(obj.domain),
    issuerUrl: readString(obj.issuerUrl),
    callbackUrl: readString(obj.callbackUrl),
    allowSignUp: readBoolean(obj.allowSignUp, true),
    domains: readStringList(obj.domains),
    createdAt: readString(obj.createdAt),
    updatedAt: readString(obj.updatedAt),
  };
}

export function normalizeWorkspaceBrandingSettings(raw: unknown): WorkspaceBrandingSettings {
  const obj = readObject(raw);
  return {
    whiteLabel: normalizeWhiteLabelConfig(obj.whiteLabel),
    customDomains: Array.isArray(obj.customDomains)
      ? obj.customDomains.map(normalizeCustomDomain)
      : [],
    ssoProviders: Array.isArray(obj.ssoProviders)
      ? obj.ssoProviders.map(normalizeSSOProviderConfig)
      : [],
    updatedAt: readString(obj.updatedAt),
  };
}

export function serializeWorkspaceBrandingSettings(settings: WorkspaceBrandingSettings): JsonObject {
  return cleanJsonObject({
    whiteLabel: settings.whiteLabel as unknown as JsonValue,
    customDomains: settings.customDomains as unknown as JsonValue,
    ssoProviders: settings.ssoProviders as unknown as JsonValue,
    updatedAt: settings.updatedAt,
  });
}

export async function getWorkspaceBrandingSettings(
  client: BrandingClient,
  workspaceId: string
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const { data, error } = await client
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(
      { settings: defaultWorkspaceBrandingSettings, exists: false },
      error.message
    );
  }

  const allSettings = readObject(data?.settings);
  const raw = allSettings[BRANDING_SETTINGS_KEY];

  return emptyDataResult(
    {
      settings: raw
        ? normalizeWorkspaceBrandingSettings(raw)
        : defaultWorkspaceBrandingSettings,
      exists: Boolean(raw),
    },
    true
  );
}

export async function saveWorkspaceBrandingSettings(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  settings: WorkspaceBrandingSettings
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const { data: existing, error: existingError } = await client
    .from('integration_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) {
    return errorDataResult({ settings, exists: false }, existingError.message);
  }

  const allSettings = readObject(existing?.settings);
  const normalized = normalizeWorkspaceBrandingSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  const nextSettings: JsonObject = {
    ...allSettings,
    [BRANDING_SETTINGS_KEY]: serializeWorkspaceBrandingSettings(normalized),
  };

  const { error } = await client.from('integration_settings').upsert({
    workspace_id: workspaceId,
    supabase_status: existing?.supabase_status ?? 'configured',
    n8n_status: existing?.n8n_status ?? 'not_connected',
    settings: nextSettings,
    updated_by: userId,
  });

  if (error) {
    return errorDataResult({ settings: normalized, exists: false }, error.message);
  }

  return emptyDataResult({ settings: normalized, exists: true }, true);
}

export async function saveWhiteLabelConfig(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  whiteLabel: WhiteLabelConfig
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const current = await getWorkspaceBrandingSettings(client, workspaceId);
  if (current.error) return current;

  const next = {
    ...current.data.settings,
    whiteLabel: {
      ...whiteLabel,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    },
    updatedAt: new Date().toISOString(),
  };

  return saveWorkspaceBrandingSettings(client, workspaceId, userId, next);
}

export async function addCustomDomain(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  domain: string
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const current = await getWorkspaceBrandingSettings(client, workspaceId);
  if (current.error) return current;

  const existing = current.data.settings.customDomains.find(
    (d) => d.domain.toLowerCase() === domain.toLowerCase()
  );
  if (existing) {
    return errorDataResult(current.data, 'This domain is already registered.');
  }

  const id = `dom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newDomain: CustomDomain = {
    id,
    domain: domain.toLowerCase().trim(),
    status: 'pending',
    verifiedAt: null,
    cnameTarget: 'cname.agentflow.ai',
    dnsRecords: [
      { type: 'CNAME', host: domain, value: 'cname.agentflow.ai', required: true },
    ],
    lastCheckedAt: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };

  const next = {
    ...current.data.settings,
    customDomains: [...current.data.settings.customDomains, newDomain],
    updatedAt: new Date().toISOString(),
  };

  return saveWorkspaceBrandingSettings(client, workspaceId, userId, next);
}

export async function removeCustomDomain(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  domainId: string
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const current = await getWorkspaceBrandingSettings(client, workspaceId);
  if (current.error) return current;

  const next = {
    ...current.data.settings,
    customDomains: current.data.settings.customDomains.filter((d) => d.id !== domainId),
    updatedAt: new Date().toISOString(),
  };

  return saveWorkspaceBrandingSettings(client, workspaceId, userId, next);
}

export async function updateDomainStatus(
  client: BrandingClient,
  workspaceId: string,
  domainId: string,
  status: DomainStatus,
  errorMessage?: string
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const { data: existing, error: existingError } = await client
    .from('integration_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError || !existing) {
    return errorDataResult(
      { settings: defaultWorkspaceBrandingSettings, exists: false },
      existingError?.message ?? 'Not found'
    );
  }

  const allSettings = readObject(existing.settings);
  const raw = allSettings[BRANDING_SETTINGS_KEY];
  const settings = raw ? normalizeWorkspaceBrandingSettings(raw) : defaultWorkspaceBrandingSettings;

  settings.customDomains = settings.customDomains.map((d) => {
    if (d.id !== domainId) return d;
    return {
      ...d,
      status,
      verifiedAt: status === 'verified' ? new Date().toISOString() : d.verifiedAt,
      lastCheckedAt: new Date().toISOString(),
      errorMessage: errorMessage ?? null,
    };
  });
  settings.updatedAt = new Date().toISOString();

  const nextSettings: JsonObject = {
    ...allSettings,
    [BRANDING_SETTINGS_KEY]: serializeWorkspaceBrandingSettings(settings),
  };

  const { error } = await client.from('integration_settings').upsert({
    workspace_id: workspaceId,
    supabase_status: existing.supabase_status ?? 'configured',
    n8n_status: existing.n8n_status ?? 'not_connected',
    settings: nextSettings,
  });

  if (error) {
    return errorDataResult({ settings, exists: false }, error.message);
  }

  return emptyDataResult({ settings, exists: true }, true);
}

export async function saveSSOProvider(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  provider: SSOProviderConfig
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const current = await getWorkspaceBrandingSettings(client, workspaceId);
  if (current.error) return current;

  const existingIdx = current.data.settings.ssoProviders.findIndex(
    (p) => p.type === provider.type
  );

  const updatedProvider: SSOProviderConfig = {
    ...provider,
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx >= 0
      ? current.data.settings.ssoProviders[existingIdx].createdAt
      : new Date().toISOString(),
  };

  const ssoProviders = [...current.data.settings.ssoProviders];
  if (existingIdx >= 0) {
    ssoProviders[existingIdx] = updatedProvider;
  } else {
    ssoProviders.push(updatedProvider);
  }

  const next = {
    ...current.data.settings,
    ssoProviders,
    updatedAt: new Date().toISOString(),
  };

  return saveWorkspaceBrandingSettings(client, workspaceId, userId, next);
}

export async function removeSSOProvider(
  client: BrandingClient,
  workspaceId: string,
  userId: string,
  providerType: SSOProviderType
): Promise<DataResult<WorkspaceBrandingSettingsState>> {
  const current = await getWorkspaceBrandingSettings(client, workspaceId);
  if (current.error) return current;

  const next = {
    ...current.data.settings,
    ssoProviders: current.data.settings.ssoProviders.filter((p) => p.type !== providerType),
    updatedAt: new Date().toISOString(),
  };

  return saveWorkspaceBrandingSettings(client, workspaceId, userId, next);
}
