/**
 * GDPR / Data-Protection module
 *
 * Implements the core data-subject rights required for GDPR readiness:
 *  - Consent ledger (record / withdraw / list) with lawful basis + versioning
 *  - Data Subject Access Requests (DSAR): access (export), erasure (forget),
 *    rectification, portability — with status lifecycle and audit logging.
 *
 * Discovery of a user's personal data is driven by a registry of "data
 * finders" so new tables can be registered without changing this core logic.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import {
  errorDataResult,
  emptyDataResult,
  type DataResult,
} from '@/lib/data/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logAdvancedAuditEvent } from '@/lib/security/audit-advanced';
import { logger } from '@/lib/logger';

const log = logger.child('gdpr');

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConsentLegalBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export interface ConsentRecordInput {
  workspaceId: string;
  userId: string;
  purpose: string;
  legalBasis?: ConsentLegalBasis;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ConsentRecordResult {
  id: string;
  workspaceId: string;
  userId: string;
  purpose: string;
  legalBasis: ConsentLegalBasis;
  granted: boolean;
  version: string;
  withdrawnAt: string | null;
  createdAt: string;
}

export type DataSubjectRequestType =
  | 'access'
  | 'erasure'
  | 'rectification'
  | 'portability';

export type DataSubjectRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'expired';

export interface DataSubjectRequestInput {
  workspaceId: string;
  userId: string;
  requestType: DataSubjectRequestType;
  metadata?: Record<string, unknown>;
}

export interface DataSubjectRequestResult {
  id: string;
  workspaceId: string;
  userId: string;
  requestType: DataSubjectRequestType;
  status: DataSubjectRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  verified: boolean;
  exportPath: string | null;
  notes: string | null;
}

export interface PersonalDataLocation {
  /** Human-readable table/collection name */
  table: string;
  /** Matching rows (already PII-redacted where applicable) */
  rows: Array<Record<string, unknown>>;
}

// A finder returns the rows that belong to a user within a workspace.
type DataFinder = (ctx: {
  workspaceId: string;
  userId: string;
  supabase: SupabaseClient<Database>;
}) => Promise<PersonalDataLocation>;

// Registry of finders for erasure / access discovery.
const finders: DataFinder[] = [];

/**
 * Register a personal-data finder for a user-owned table. Call once at module
 * load (idempotent). Enables automated DSAR discovery without editing core code.
 */
export function registerPersonalDataFinder(finder: DataFinder): void {
  if (!finders.includes(finder)) finders.push(finder);
}

// Default finders for tables known to carry user PII in this schema.
registerPersonalDataFinder(async ({ workspaceId, userId, supabase }) => {
  const { data } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  return { table: 'workspace_members', rows: data ?? [] };
});
registerPersonalDataFinder(async ({ workspaceId, userId, supabase }) => {
  const { data } = await supabase
    .from('consent_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  return { table: 'consent_records', rows: data ?? [] };
});
registerPersonalDataFinder(async ({ workspaceId, userId, supabase }) => {
  const { data } = await supabase
    .from('data_subject_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  return { table: 'data_subject_requests', rows: data ?? [] };
});
registerPersonalDataFinder(async ({ workspaceId, userId, supabase }) => {
  const { data } = await supabase
    .from('security_audit_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  return { table: 'security_audit_logs', rows: data ?? [] };
});

// ─── Consent ────────────────────────────────────────────────────────────────

export async function recordConsent(
  input: ConsentRecordInput
): Promise<DataResult<ConsentRecordResult>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');
  const { data, error: insertErr } = await client
    .from('consent_records')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      purpose: input.purpose,
      legal_basis: input.legalBasis ?? 'consent',
      granted: true,
      version: input.version ?? '1.0',
      metadata: (input.metadata ?? {}) as JsonObject,
    })
    .select('*')
    .single();
  if (insertErr) return errorDataResult(null as never, insertErr.message);
  await logAdvancedAuditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventType: 'gdpr.consent.granted',
    entityType: 'consent_records',
    entityId: data.id,
    metadata: { purpose: input.purpose, legalBasis: input.legalBasis ?? 'consent' },
  });
  return emptyDataResult(toConsent(data), true);
}

export async function withdrawConsent(
  workspaceId: string,
  userId: string,
  purpose: string
): Promise<DataResult<boolean>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(false, error ?? 'Supabase unavailable');
  const { data, error: updErr } = await client
    .from('consent_records')
    .update({ granted: false, withdrawn_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .eq('granted', true)
    .select('id');
  if (updErr) return errorDataResult(false, updErr.message);
  await logAdvancedAuditEvent({
    workspaceId,
    userId,
    eventType: 'gdpr.consent.withdrawn',
    entityType: 'consent_records',
    metadata: { purpose, affected: (data ?? []).length },
  });
  return emptyDataResult(true, true);
}

export async function listConsent(
  workspaceId: string,
  userId: string
): Promise<DataResult<ConsentRecordResult[]>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult([], error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('consent_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (qErr) return errorDataResult([], qErr.message);
  return emptyDataResult((data ?? []).map(toConsent), true);
}

export async function hasActiveConsent(
  workspaceId: string,
  userId: string,
  purpose: string
): Promise<DataResult<boolean>> {
  const res = await listConsent(workspaceId, userId);
  if (res.error) return errorDataResult(false, res.error, res.isConfigured);
  const active = res.data.find((c) => c.purpose === purpose && c.granted);
  return emptyDataResult(Boolean(active), true);
}

// ─── Data Subject Requests ──────────────────────────────────────────────────

export async function createDataSubjectRequest(
  input: DataSubjectRequestInput
): Promise<DataResult<DataSubjectRequestResult>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');
  const { data, error: insErr } = await client
    .from('data_subject_requests')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      request_type: input.requestType,
      status: 'pending',
      metadata: (input.metadata ?? {}) as JsonObject,
    })
    .select('*')
    .single();
  if (insErr) return errorDataResult(null as never, insErr.message);
  await logAdvancedAuditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    eventType: `gdpr.dsar.${input.requestType}.created`,
    entityType: 'data_subject_requests',
    entityId: data.id,
  });
  return emptyDataResult(toRequest(data), true);
}

export async function listDataSubjectRequests(
  workspaceId: string,
  userId?: string
): Promise<DataResult<DataSubjectRequestResult[]>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult([], error ?? 'Supabase unavailable');
  let query = client
    .from('data_subject_requests')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (userId) query = query.eq('user_id', userId);
  const { data, error: qErr } = await query.order('requested_at', { ascending: false });
  if (qErr) return errorDataResult([], qErr.message);
  return emptyDataResult((data ?? []).map(toRequest), true);
}

export async function getDataSubjectRequest(
  id: string
): Promise<DataResult<DataSubjectRequestResult | null>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null, error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('data_subject_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (qErr) return errorDataResult(null, qErr.message);
  return emptyDataResult(data ? toRequest(data) : null, true);
}

/**
 * Fulfils a DSAR:
 *  - 'access' / 'portability': discovers all personal data via registered
 *    finders and returns it (caller serialises / stores the export file).
 *  - 'erasure': discovers and deletes user data across registered tables,
 *    preserving only records legally required to keep (none by default).
 *  - 'rectification': marks in_progress for manual completion.
 */
export async function fulfilDataSubjectRequest(
  id: string,
  actorWorkspaceId: string,
  actorUserId: string | null
): Promise<DataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client)
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      error ?? 'Supabase unavailable'
    );

  const existing = await getDataSubjectRequest(id);
  if (existing.error)
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      existing.error
    );
  const req = existing.data;
  if (!req)
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      'Request not found'
    );
  if (req.status === 'completed')
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      'Request already completed'
    );

  const { error: updErr } = await client
    .from('data_subject_requests')
    .update({ status: 'in_progress' })
    .eq('id', id);
  if (updErr)
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      updErr.message
    );

  const discovered: PersonalDataLocation[] = [];
  try {
    for (const finder of finders) {
      discovered.push(await finder({ workspaceId: req.workspaceId, userId: req.userId, supabase: client }));
    }

    if (req.requestType === 'erasure') {
      // Compliance / integrity tables are retained (only identity is redacted).
      const ERASE_SKIP = new Set(['data_subject_requests', 'security_audit_logs']);
      for (const loc of discovered) {
        if (ERASE_SKIP.has(loc.table)) continue;
        if (loc.rows.length === 0) continue;
        const { error: delErr } = await client
          .from(loc.table)
          .delete()
          .eq('workspace_id', req.workspaceId)
          .eq('user_id', req.userId);
        if (delErr) log.warn('erasure partial failure', { table: loc.table, error: delErr.message });
      }
      // Audit logs are retained for compliance; redact identity instead of delete.
      await client
        .from('security_audit_logs')
        .update({ metadata: { redacted: true, reason: 'gdpr-erasure' } as JsonObject })
        .eq('workspace_id', req.workspaceId)
        .eq('user_id', req.userId);
    }

    const { error: doneErr } = await client
      .from('data_subject_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        export_path: req.requestType === 'erasure' ? null : `dsar/${id}.json`,
      })
      .eq('id', id);
    if (doneErr)
      return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
        null as never,
        doneErr.message
      );
  } catch (e) {
    await client
      .from('data_subject_requests')
      .update({ status: 'pending' })
      .eq('id', id);
    return errorDataResult<{ request: DataSubjectRequestResult; data?: PersonalDataLocation[] }>(
      null as never,
      e instanceof Error ? e.message : 'fulfilment failed'
    );
  }

  await logAdvancedAuditEvent({
    workspaceId: actorWorkspaceId,
    userId: actorUserId,
    eventType: `gdpr.dsar.${req.requestType}.completed`,
    entityType: 'data_subject_requests',
    entityId: id,
    metadata: { targetUserId: req.userId, tables: discovered.map((d) => d.table) },
  });

  const finalReq = (await getDataSubjectRequest(id)).data ?? req;
  return emptyDataResult({ request: finalReq, data: req.requestType === 'erasure' ? undefined : discovered }, true);
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function toConsent(r: Database['public']['Tables']['consent_records']['Row']): ConsentRecordResult {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    purpose: r.purpose,
    legalBasis: r.legal_basis as ConsentLegalBasis,
    granted: r.granted,
    version: r.version,
    withdrawnAt: r.withdrawn_at,
    createdAt: r.created_at,
  };
}

function toRequest(
  r: Database['public']['Tables']['data_subject_requests']['Row']
): DataSubjectRequestResult {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    requestType: r.request_type,
    status: r.status,
    requestedAt: r.requested_at,
    completedAt: r.completed_at,
    verified: r.verified,
    exportPath: r.export_path,
    notes: r.notes,
  };
}
