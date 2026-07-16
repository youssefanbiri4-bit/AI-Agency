/**
 * Advanced Audit Logging
 *
 * Extends the existing best-effort `logSecurityAuditEvent` with:
 *  - PII-safe redaction helpers (used before writing metadata / messages)
 *  - Tamper-evidence via a SHA-256 chained hash over appended audit rows
 *  - Exportable, signed audit bundles (JSON + checksum manifest)
 *
 * No new dependencies; uses Node `crypto` and the existing Supabase admin client.
 */

import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { logger } from '@/lib/logger';

const log = logger.child('audit-advanced');

// ─── PII redaction ──────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ key: RegExp; mask: string }> = [
  { key: /email/i, mask: '[email-redacted]' },
  { key: /phone|mobile|tel/i, mask: '[phone-redacted]' },
  { key: /ssn|social_?security/i, mask: '[ssn-redacted]' },
  { key: /card|ccnum|cardnumber|pan/i, mask: '[card-redacted]' },
  { key: /token|secret|password|passwd|apikey|api_key|authorization/i, mask: '[secret-redacted]' },
  { key: /ip|ipaddress/i, mask: '[ip-redacted]' },
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const GENERIC_TOKEN_RE = /\b([a-z0-9]{32,})\b/gi;

/**
 * Recursively walks an object and masks string values that look like PII.
 * Returns a new object; never mutates the input.
 */
export function redactPII<T>(value: T): T {
  if (typeof value === 'string') {
    let out = value.replace(EMAIL_RE, '[email-redacted]');
    out = out.replace(GENERIC_TOKEN_RE, '[token-redacted]');
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactPII(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = PII_PATTERNS.find((p) => p.key.test(k));
      if (hit && typeof v === 'string') {
        out[k] = hit.mask;
      } else {
        out[k] = redactPII(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

/** Stable stringify that sorts keys (needed for deterministic hashing). */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' ? sortKeys(v) : v));
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
}

// ─── Tamper-evident chaining ────────────────────────────────────────────────

/**
 * Computes the next chained hash for an audit entry.
 * hash = SHA256(prevHash || '|' || canonical(entry))
 * Storing `prev_hash` on each row lets a verifier re-walk the chain and detect
 * missing / altered rows. Returns { hash, prevHash }.
 */
export function computeAuditChainHash(
  entry: Record<string, unknown>,
  prevHash: string
): { hash: string; prevHash: string } {
  const canonical = stableStringify(redactPII(entry));
  const hash = crypto
    .createHash('sha256')
    .update(`${prevHash}|${canonical}`)
    .digest('hex');
  return { hash, prevHash };
}

const GENESIS = '0'.repeat(64);

/** Resolves the last hash in the chain for a workspace (for append verification). */
export async function getLastAuditChainHash(
  workspaceId: string,
  supabase?: SupabaseClient<Database>
): Promise<string | null> {
  const { client } = getSupabaseAdmin();
  const db = client ?? supabase;
  if (!db) return null;
  const { data, error } = await db
    .from('security_audit_logs')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const meta = (data[0]?.metadata ?? {}) as JsonObject;
  const last = (meta?.auditChainHash as string | undefined) ?? null;
  return last ?? null;
}

// ─── High-level helpers ─────────────────────────────────────────────────────

export interface AdvancedAuditEvent {
  workspaceId: string;
  userId: string | null;
  eventType: string;
  severity?: 'info' | 'warning' | 'critical';
  entityType?: string | null;
  entityId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an audit event with PII redaction applied to message + metadata, and
 * embeds the chained tamper-evidence hash into `metadata.auditChainHash`.
 * Best-effort: never throws to the caller.
 */
export async function logAdvancedAuditEvent(
  event: AdvancedAuditEvent,
  supabase?: SupabaseClient<Database>
): Promise<void> {
  const { client } = getSupabaseAdmin();
  const db = client ?? supabase;
  const prevHash = (await getLastAuditChainHash(event.workspaceId, db)) ?? GENESIS;
  const safeMessage = event.message ? redactPII(event.message) : null;
  const safeMeta = redactPII(event.metadata ?? {}) as JsonObject;
  const { hash } = computeAuditChainHash(
    {
      workspaceId: event.workspaceId,
      userId: event.userId,
      eventType: event.eventType,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      message: safeMessage,
      metadata: safeMeta,
      createdAt: new Date().toISOString(),
    },
    prevHash
  );
  const metadata: JsonObject = { ...safeMeta, auditChainHash: hash, prevAuditHash: prevHash };
  await logSecurityAuditEvent({
    supabase: db as SupabaseClient<Database>,
    workspaceId: event.workspaceId,
    userId: event.userId,
    eventType: event.eventType,
    severity: event.severity ?? 'info',
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    message: safeMessage,
    metadata,
  });
}

// ─── Signed export bundle ───────────────────────────────────────────────────

export interface AuditExportBundle {
  workspaceId: string;
  generatedAt: string;
  entries: Array<Record<string, unknown>>;
  manifest: {
    count: number;
    firstHash: string | null;
    lastHash: string | null;
    bundleChecksum: string;
    generatedAt: string;
  };
}

/**
 * Produces a verifiable export bundle of audit logs for a workspace over an
 * optional date window. The bundle checksum covers all entries + chain hashes.
 */
export async function exportAuditBundle(
  workspaceId: string,
  options: { from?: string; to?: string; limit?: number } = {},
  supabase?: SupabaseClient<Database>
): Promise<AuditExportBundle> {
  const { client } = getSupabaseAdmin();
  const db = client ?? supabase;
  if (!db) {
    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      entries: [],
      manifest: {
        count: 0,
        firstHash: null,
        lastHash: null,
        bundleChecksum: '',
        generatedAt: new Date().toISOString(),
      },
    };
  }
  let query = db
    .from('security_audit_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (options.from) query = query.gte('created_at', options.from);
  if (options.to) query = query.lte('created_at', options.to);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    log.warn('audit export failed', { workspaceId, error: error.message });
    throw error;
  }
  const entries = (data ?? []).map((r) => redactPII(r));
  const hashes = entries
    .map((e) => ((e.metadata as JsonObject | undefined)?.auditChainHash as string | undefined) ?? '')
    .filter(Boolean);
  const checksumSource = stableStringify({
    workspaceId,
    entries: entries.map((e) => ({ id: e.id, ch: (e.metadata as JsonObject)?.auditChainHash })),
  });
  const bundleChecksum = crypto.createHash('sha256').update(checksumSource).digest('hex');
  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    entries,
    manifest: {
      count: entries.length,
      firstHash: hashes[0] ?? null,
      lastHash: hashes[hashes.length - 1] ?? null,
      bundleChecksum,
      generatedAt: new Date().toISOString(),
    },
  };
}
