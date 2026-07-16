/**
 * Enterprise Security Policies
 *
 * Central registry of enforceable workspace security policies (MFA, password
 * length, session timeout, IP allowlist, data-residency, audit retention,
 * SSO enforcement, etc.). Policy state is stored in `security_policies` and
 * evaluated by guards used across the app.
 */

import 'server-only';

import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import {
  errorDataResult,
  emptyDataResult,
  type DataResult,
} from '@/lib/data/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

const log = logger.child('security-policies');

export const SECURITY_POLICY_KEYS = [
  'mfa_required',
  'password_min_length',
  'session_timeout_minutes',
  'ip_allowlist',
  'data_residency_region',
  'audit_log_retention_days',
  'sso_enforced',
  'block_personal_email_domains',
  'max_failed_logins',
] as const;

export type SecurityPolicyKey = (typeof SECURITY_POLICY_KEYS)[number];

export interface SecurityPolicyResult {
  key: SecurityPolicyKey;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: string;
}

export interface SecurityPolicyInput {
  workspaceId: string;
  key: SecurityPolicyKey;
  enabled?: boolean;
  config?: Record<string, unknown>;
  updatedBy?: string | null;
}

export const DEFAULT_POLICIES: Record<SecurityPolicyKey, SecurityPolicyResult> = {
  mfa_required: { key: 'mfa_required', enabled: false, config: {}, updatedBy: null, updatedAt: '' },
  password_min_length: {
    key: 'password_min_length',
    enabled: true,
    config: { min: 12 },
    updatedBy: null,
    updatedAt: '',
  },
  session_timeout_minutes: {
    key: 'session_timeout_minutes',
    enabled: true,
    config: { minutes: 480 },
    updatedBy: null,
    updatedAt: '',
  },
  ip_allowlist: { key: 'ip_allowlist', enabled: false, config: { cidrs: [] }, updatedBy: null, updatedAt: '' },
  data_residency_region: {
    key: 'data_residency_region',
    enabled: false,
    config: { region: 'eu' },
    updatedBy: null,
    updatedAt: '',
  },
  audit_log_retention_days: {
    key: 'audit_log_retention_days',
    enabled: true,
    config: { days: 365 },
    updatedBy: null,
    updatedAt: '',
  },
  sso_enforced: { key: 'sso_enforced', enabled: false, config: {}, updatedBy: null, updatedAt: '' },
  block_personal_email_domains: {
    key: 'block_personal_email_domains',
    enabled: false,
    config: { domains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'] },
    updatedBy: null,
    updatedAt: '',
  },
  max_failed_logins: {
    key: 'max_failed_logins',
    enabled: true,
    config: { max: 5 },
    updatedBy: null,
    updatedAt: '',
  },
};

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function setSecurityPolicy(
  input: SecurityPolicyInput
): Promise<DataResult<SecurityPolicyResult>> {
  if (!SECURITY_POLICY_KEYS.includes(input.key))
    return errorDataResult(null as never, `Unknown policy key: ${input.key}`);
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');

  const config = (input.config ?? DEFAULT_POLICIES[input.key].config ?? {}) as JsonObject;

  const { data, error: upsErr } = await client
    .from('security_policies')
    .upsert(
      {
        workspace_id: input.workspaceId,
        policy_key: input.key,
        enabled: input.enabled ?? true,
        config,
        updated_by: input.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,policy_key' }
    )
    .select('*')
    .single();
  if (upsErr) return errorDataResult(null as never, upsErr.message);
  log.info('security policy updated', { workspaceId: input.workspaceId, key: input.key });
  return emptyDataResult(toPolicy(data), true);
}

export async function getSecurityPolicy(
  workspaceId: string,
  key: SecurityPolicyKey
): Promise<DataResult<SecurityPolicyResult>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return emptyDataResult(DEFAULT_POLICIES[key], false);
  const { data, error: qErr } = await client
    .from('security_policies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('policy_key', key)
    .maybeSingle();
  if (qErr) return emptyDataResult(DEFAULT_POLICIES[key], true);
  if (!data) return emptyDataResult(DEFAULT_POLICIES[key], true);
  return emptyDataResult(toPolicy(data), true);
}

export async function listSecurityPolicies(
  workspaceId: string
): Promise<DataResult<SecurityPolicyResult[]>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult([], error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('security_policies')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (qErr) return errorDataResult([], qErr.message);
  const stored = new Map((data ?? []).map((d) => [d.policy_key as SecurityPolicyKey, toPolicy(d)]));
  const merged = SECURITY_POLICY_KEYS.map((k) => stored.get(k) ?? DEFAULT_POLICIES[k]);
  return emptyDataResult(merged, true);
}

// ─── Evaluation helpers ─────────────────────────────────────────────────────

export async function isPolicyEnabled(
  workspaceId: string,
  key: SecurityPolicyKey
): Promise<DataResult<boolean>> {
  const res = await getSecurityPolicy(workspaceId, key);
  if (res.error) return errorDataResult(false, res.error, res.isConfigured);
  return emptyDataResult(res.data.enabled, true);
}

export interface PolicyEvaluationContext {
  email?: string;
  ip?: string;
  failedLogins?: number;
}

/**
 * Evaluates the relevant security policies for a sign-in / session context
 * and returns the list of violations (empty = pass).
 */
export async function evaluateSecurityPolicies(
  workspaceId: string,
  ctx: PolicyEvaluationContext
): Promise<DataResult<string[]>> {
  const policies = await listSecurityPolicies(workspaceId);
  if (policies.error) return errorDataResult([], policies.error);
  const violations: string[] = [];

  for (const p of policies.data) {
    if (!p.enabled) continue;
    switch (p.key) {
      case 'block_personal_email_domains': {
        if (ctx.email) {
          const domain = ctx.email.split('@')[1]?.toLowerCase();
          const blocked = (p.config.domains as string[] | undefined) ?? [];
          if (domain && blocked.includes(domain)) violations.push('personal_email_domain');
        }
        break;
      }
      case 'ip_allowlist': {
        if (ctx.ip) {
          const cidrs = (p.config.cidrs as string[] | undefined) ?? [];
          if (cidrs.length > 0 && !cidrsMatch(ctx.ip, cidrs))
            violations.push('ip_not_in_allowlist');
        }
        break;
      }
      case 'max_failed_logins': {
        const max = (p.config.max as number | undefined) ?? 5;
        if (ctx.failedLogins !== undefined && ctx.failedLogins >= max)
          violations.push('too_many_failed_logins');
        break;
      }
      default:
        break;
    }
  }
  return emptyDataResult(violations, true);
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc << 8) | n;
  }
  return acc >>> 0;
}

function cidrsMatch(ip: string, cidrs: string[]): boolean {
  const addr = ipToInt(ip);
  if (addr === null) return false;
  for (const cidr of cidrs) {
    const [base, bitsRaw] = cidr.split('/');
    const bits = bitsRaw ? Number(bitsRaw) : 32;
    const baseInt = ipToInt(base);
    if (baseInt === null || bits < 0 || bits > 32) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((addr & mask) === (baseInt & mask)) return true;
  }
  return false;
}

function toPolicy(r: Database['public']['Tables']['security_policies']['Row']): SecurityPolicyResult {
  return {
    key: r.policy_key as SecurityPolicyKey,
    enabled: r.enabled,
    config: (r.config ?? {}) as Record<string, unknown>,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  };
}
