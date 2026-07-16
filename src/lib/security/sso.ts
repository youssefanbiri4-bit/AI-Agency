/**
 * Enterprise SSO (Google Workspace, Microsoft Entra)
 *
 * Stores per-workspace SSO configuration in `sso_configs` (client secrets are
 * encrypted at rest via the shared AES-256-GCM helper). Builds the
 * authorization URLs that initiate the Supabase Auth SSO / OIDC flow, and
 * validates that a signing-in identity belongs to an allowed domain.
 *
 * Live token exchange is delegated to Supabase Auth's SSO endpoints; this
 * module only provisions config + builds the correct redirect URLs.
 */

import 'server-only';

import type { Database } from '@/types/database';
import {
  errorDataResult,
  emptyDataResult,
  type DataResult,
} from '@/lib/data/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { encryptToken, decryptToken } from '@/lib/ads/encryption';
import { logger } from '@/lib/logger';

const log = logger.child('sso');

export type SsoProvider = 'google_workspace' | 'microsoft_entra';

export const SSO_PROVIDERS: SsoProvider[] = ['google_workspace', 'microsoft_entra'];

export interface SsoConfigInput {
  workspaceId: string;
  provider: SsoProvider;
  enabled?: boolean;
  clientId: string;
  clientSecret?: string;
  tenantId?: string;
  domain?: string;
  issuerUrl?: string;
  allowSignUp?: boolean;
  allowedDomains?: string[];
}

export interface SsoConfigResult {
  id: string;
  workspaceId: string;
  provider: SsoProvider;
  enabled: boolean;
  clientId: string | null;
  tenantId: string | null;
  domain: string | null;
  issuerUrl: string | null;
  allowSignUp: boolean;
  allowedDomains: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SsoAuthorizationUrlInput {
  workspaceId: string;
  provider: SsoProvider;
  redirectTo: string;
  state?: string;
}

// ─── Config CRUD ────────────────────────────────────────────────────────────

function assertProvider(p: string): p is SsoProvider {
  return p === 'google_workspace' || p === 'microsoft_entra';
}

export async function upsertSsoConfig(
  input: SsoConfigInput
): Promise<DataResult<SsoConfigResult>> {
  if (!assertProvider(input.provider))
    return errorDataResult(null as never, `Unsupported SSO provider: ${input.provider}`);
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');

  const secretEnc = input.clientSecret ? encryptToken(input.clientSecret) : null;

  const row = {
    workspace_id: input.workspaceId,
    provider: input.provider,
    enabled: input.enabled ?? false,
    client_id: input.clientId,
    client_secret_encrypted: secretEnc,
    tenant_id: input.tenantId ?? null,
    domain: input.domain ?? null,
    issuer_url: input.issuerUrl ?? null,
    allow_sign_up: input.allowSignUp ?? false,
    allowed_domains: input.allowedDomains ?? [],
    updated_at: new Date().toISOString(),
  };

  const { data, error: upsertErr } = await client
    .from('sso_configs')
    .upsert(row, { onConflict: 'workspace_id,provider' })
    .select('*')
    .single();
  if (upsertErr) return errorDataResult(null as never, upsertErr.message);

  log.info('sso config upserted', { workspaceId: input.workspaceId, provider: input.provider });
  return emptyDataResult(toConfig(data), true);
}

export async function getSsoConfig(
  workspaceId: string,
  provider: SsoProvider
): Promise<DataResult<SsoConfigResult | null>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null, error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('sso_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle();
  if (qErr) return errorDataResult(null, qErr.message);
  return emptyDataResult(data ? toConfig(data) : null, true);
}

export async function listSsoConfigs(
  workspaceId: string
): Promise<DataResult<SsoConfigResult[]>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult([], error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('sso_configs')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (qErr) return errorDataResult([], qErr.message);
  return emptyDataResult((data ?? []).map(toConfig), true);
}

export async function setSsoEnabled(
  workspaceId: string,
  provider: SsoProvider,
  enabled: boolean
): Promise<DataResult<SsoConfigResult | null>> {
  const existing = await getSsoConfig(workspaceId, provider);
  if (existing.error) return errorDataResult(null, existing.error);
  if (!existing.data)
    return errorDataResult(null as never, `No SSO config for provider ${provider}`);
  const { client } = getSupabaseAdmin();
  if (!client) return errorDataResult(null, 'Supabase unavailable');
  const { data, error: updErr } = await client
    .from('sso_configs')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .select('*')
    .single();
  if (updErr) return errorDataResult(null, updErr.message);
  log.info('sso enabled changed', { workspaceId, provider, enabled });
  return emptyDataResult(toConfig(data), true);
}

// ─── Authorization URL (Supabase Auth SSO redirect) ─────────────────────────

/**
 * Builds the Supabase Auth SSO initiation URL. The actual OIDC/SAML handshake
 * is performed by Supabase Auth; we only pass provider + redirect + state.
 */
export async function buildSsoAuthorizationUrl(
  input: SsoAuthorizationUrlInput
): Promise<DataResult<string>> {
  const cfg = await getSsoConfig(input.workspaceId, input.provider);
  if (cfg.error) return errorDataResult('', cfg.error);
  if (!cfg.data) return errorDataResult('', `SSO not configured for ${input.provider}`);
  if (!cfg.data.enabled) return errorDataResult('', `SSO is disabled for ${input.provider}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return errorDataResult('', 'Supabase URL not configured');

  const params = new URLSearchParams();
  params.set('redirect_to', input.redirectTo);
  if (input.state) params.set('state', input.state);
  if (cfg.data.domain) params.set('domain', cfg.data.domain);
  // Supabase Auth SSO endpoint
  const url = `${supabaseUrl}/auth/v1/authorize?provider=${input.provider}&${params.toString()}`;
  return emptyDataResult(url, true);
}

// ─── Domain / identity validation ───────────────────────────────────────────

/**
 * Validates that an authenticating email is permitted by the workspace SSO
 * policy (allowed domains list + provider domain). Returns whether allowed.
 */
export async function isSsoIdentityAllowed(
  workspaceId: string,
  provider: SsoProvider,
  email: string
): Promise<DataResult<boolean>> {
  const cfg = await getSsoConfig(workspaceId, provider);
  if (cfg.error) return errorDataResult(false, cfg.error);
  if (!cfg.data || !cfg.data.enabled) return errorDataResult(false, 'SSO disabled');

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return emptyDataResult(false, true);

  const allowed = cfg.data.allowedDomains.map((d) => d.toLowerCase());
  if (cfg.data.domain) allowed.push(cfg.data.domain.toLowerCase());
  if (allowed.length > 0 && !allowed.includes(domain))
    return emptyDataResult(false, true);

  return emptyDataResult(true, true);
}

// ─── Mapper (client secret never leaves the server unmarshalled) ────────────

function toConfig(r: Database['public']['Tables']['sso_configs']['Row']): SsoConfigResult {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    provider: r.provider,
    enabled: r.enabled,
    clientId: r.client_id,
    tenantId: r.tenant_id,
    domain: r.domain,
    issuerUrl: r.issuer_url,
    allowSignUp: r.allow_sign_up,
    allowedDomains: r.allowed_domains,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Decrypts the stored client secret (server-only, used at token-exchange time). */
export async function getSsoClientSecret(
  workspaceId: string,
  provider: SsoProvider
): Promise<DataResult<string | null>> {
  const cfg = await getSsoConfig(workspaceId, provider);
  if (cfg.error) return errorDataResult(null, cfg.error);
  const { client } = getSupabaseAdmin();
  if (!client) return errorDataResult(null, 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('sso_configs')
    .select('client_secret_encrypted')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle();
  if (qErr) return errorDataResult(null, qErr.message);
  const enc = data?.client_secret_encrypted ?? null;
  if (!enc) return emptyDataResult(null, true);
  try {
    return emptyDataResult(decryptToken(enc), true);
  } catch {
    return errorDataResult(null, 'Failed to decrypt client secret');
  }
}
