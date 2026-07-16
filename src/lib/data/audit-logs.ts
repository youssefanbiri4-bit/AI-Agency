/**
 * Audit Logs Data Access
 *
 * Provides workspace-scoped querying, filtering, pagination, and export of
 * security_audit_logs records.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { errorDataResult, emptyDataResult, type DataResult } from '@/lib/data/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuditLogSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogRecord {
  id: string;
  workspaceId: string;
  userId: string | null;
  eventType: string;
  severity: AuditLogSeverity;
  entityType: string | null;
  entityId: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogFilter {
  /** Free-text search across event_type, message, entity_type */
  search?: string;
  /** Filter by severity (info, warning, critical) */
  severity?: AuditLogSeverity | AuditLogSeverity[];
  /** Filter by event type (exact match) */
  eventType?: string;
  /** Filter by entity type */
  entityType?: string;
  /** Filter by user ID */
  userId?: string;
  /** Start date (ISO string) */
  dateFrom?: string;
  /** End date (ISO string) */
  dateTo?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page number (1-indexed) */
  page?: number;
  /** Page size (max 100) */
  pageSize?: number;
}

export interface AuditLogPage {
  records: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogStats {
  total: number;
  bySeverity: Record<AuditLogSeverity, number>;
  byEventType: Record<string, number>;
  oldestRecord: string | null;
  newestRecord: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE_MAX = 100;
const PAGE_SIZE_DEFAULT = 25;

function mapRow(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: String(row.id ?? ''),
    workspaceId: String(row.workspace_id ?? ''),
    userId: row.user_id ? String(row.user_id) : null,
    eventType: String(row.event_type ?? ''),
    severity: (row.severity as AuditLogSeverity) || 'info',
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    message: row.message ? String(row.message) : null,
    metadata: (typeof row.metadata === 'object' && row.metadata ? row.metadata : {}) as Record<string, unknown>,
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

// ─── Query ──────────────────────────────────────────────────────────────────

/**
 * Query audit logs for a workspace with filtering and pagination.
 */
export async function queryAuditLogs(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  filter: AuditLogFilter = {}
): Promise<DataResult<AuditLogPage>> {
  const {
    search,
    severity,
    eventType,
    entityType,
    userId,
    dateFrom,
    dateTo,
    sortDirection = 'desc',
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  } = filter;

  const clampedPageSize = Math.max(1, Math.min(pageSize, PAGE_SIZE_MAX));
  const clampedPage = Math.max(1, page);
  const from = (clampedPage - 1) * clampedPageSize;
  const to = from + clampedPageSize - 1;

  // Build base query for filtering
  let query = supabase
    .from('security_audit_logs')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId);

  // Apply filters
  if (severity) {
    if (Array.isArray(severity)) {
      query = query.in('severity', severity);
    } else {
      query = query.eq('severity', severity);
    }
  }

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  if (search) {
    query = query.or(
      `event_type.ilike.%${search}%,message.ilike.%${search}%,entity_type.ilike.%${search}%`
    );
  }

  // Apply sorting and pagination
  query = query
    .order('created_at', { ascending: sortDirection === 'asc' })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return errorDataResult(null as never, error.message);
  }

  const records = (data ?? []).map(mapRow) as unknown as AuditLogRecord[];
  const total = count ?? 0;

  return emptyDataResult(
    {
      records,
      total,
      page: clampedPage,
      pageSize: clampedPageSize,
      totalPages: Math.max(1, Math.ceil(total / clampedPageSize)),
    },
    true
  );
}

// ─── Stats ──────────────────────────────────────────────────────────────────

/**
 * Get aggregate statistics for audit logs in a workspace.
 */
export async function getAuditLogStats(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<DataResult<AuditLogStats>> {
  // Get total count
  const { count: total, error: totalError } = await supabase
    .from('security_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (totalError) {
    return errorDataResult(null as never, totalError.message);
  }

  // Count by severity
  const severities: AuditLogSeverity[] = ['info', 'warning', 'critical'];
  const severityCounts = await Promise.all(
    severities.map(async (sev) => {
      const { count } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('severity', sev);
      return [sev, count ?? 0] as const;
    })
  );

  // Get date range
  const { data: oldest } = await supabase
    .from('security_audit_logs')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1);

  const { data: newest } = await supabase
    .from('security_audit_logs')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);

  return emptyDataResult(
    {
      total: total ?? 0,
      bySeverity: Object.fromEntries(severityCounts) as Record<AuditLogSeverity, number>,
      byEventType: {}, // Full breakdown requires aggregation query
      oldestRecord: oldest?.[0]?.created_at ?? null,
      newestRecord: newest?.[0]?.created_at ?? null,
    },
    true
  );
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Export audit logs as JSON for a workspace.
 * Limited to the most recent 10,000 records.
 */
export async function exportAuditLogs(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  filter: AuditLogFilter = {}
): Promise<DataResult<AuditLogRecord[]>> {
  const result = await queryAuditLogs(supabase, workspaceId, {
    ...filter,
    pageSize: 10_000,
    page: 1,
  });

  if (result.error) {
    return errorDataResult([], result.error);
  }

  return emptyDataResult(result.data?.records ?? [], true);
}

// ─── Retention Policy ───────────────────────────────────────────────────────

/**
 * Retention period in days for different severity levels.
 */
export const RETENTION_DAYS: Record<AuditLogSeverity, number> = {
  info: 90,     // 3 months
  warning: 180, // 6 months
  critical: 365, // 1 year
};

/**
 * Default retention period for logs without a specific severity setting.
 */
export const DEFAULT_RETENTION_DAYS = 90;

/**
 * Execute the audit log retention policy: delete records older than their
 * severity-specific retention period.
 *
 * Uses the admin (service-role) client for deletion.
 * Returns the number of deleted records.
 */
export async function executeAuditLogRetention(): Promise<DataResult<{ deleted: number; details: Record<string, number> }>> {
  const admin = getSupabaseAdmin();
  if (!admin.client) {
    return errorDataResult({ deleted: 0, details: {} }, 'Supabase admin client not available');
  }

  const details: Record<string, number> = {};
  let totalDeleted = 0;

  for (const [severityStr, days] of Object.entries(RETENTION_DAYS)) {
    const severity = severityStr as AuditLogSeverity;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await admin.client
      .from('security_audit_logs')
      .delete()
      .eq('severity', severity)
      .lt('created_at', cutoff)
      .select('count');

    if (error) {
      continue; // Best-effort per severity
    }

    const deleted = count ?? 0;
    details[severity] = deleted;
    totalDeleted += deleted;
  }

  return emptyDataResult({ deleted: totalDeleted, details }, true);
}

/**
 * Count audit-log records that are older than their severity-specific retention
 * cutoff (i.e. eligible for deletion on the next retention run). Also reports the
 * total number of records and per-severity counts so the viewer can surface the
 * effective retention posture.
 */
export interface RetentionSummary {
  total: number;
  bySeverity: Record<AuditLogSeverity, number>;
  eligibleForDeletion: number;
  eligibleBySeverity: Record<AuditLogSeverity, number>;
  cutoffs: Record<AuditLogSeverity, string>;
}

export async function getRetentionSummary(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<DataResult<RetentionSummary>> {
  const severities: AuditLogSeverity[] = ['info', 'warning', 'critical'];
  const counts = await Promise.all(
    severities.map(async (sev) => {
      const { count } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('severity', sev);
      return [sev, count ?? 0] as const;
    })
  );
  const bySeverity = Object.fromEntries(counts) as Record<AuditLogSeverity, number>;
  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);

  const eligibility = await Promise.all(
    severities.map(async (sev) => {
      const cutoff = new Date(Date.now() - RETENTION_DAYS[sev] * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('severity', sev)
        .lt('created_at', cutoff);
      return [sev, count ?? 0] as const;
    })
  );
  const eligibleBySeverity = Object.fromEntries(eligibility) as Record<AuditLogSeverity, number>;
  const eligibleForDeletion = Object.values(eligibleBySeverity).reduce((a, b) => a + b, 0);

  const cutoffs = Object.fromEntries(
    severities.map((sev) => [
      sev,
      new Date(Date.now() - RETENTION_DAYS[sev] * 24 * 60 * 60 * 1000).toISOString(),
    ])
  ) as Record<AuditLogSeverity, string>;

  return emptyDataResult(
    { total, bySeverity, eligibleForDeletion, eligibleBySeverity, cutoffs },
    true
  );
}

// ─── Distinct Event Types ───────────────────────────────────────────────────

/**
 * Get distinct event types that exist in the workspace's audit logs.
 */
export async function getDistinctEventTypes(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<DataResult<string[]>> {
  const { data, error } = await supabase
    .from('security_audit_logs')
    .select('event_type')
    .eq('workspace_id', workspaceId);

  if (error) {
    return errorDataResult([], error.message);
  }

  const types = [...new Set((data ?? []).map((row) => row.event_type).filter(Boolean))] as string[];
  types.sort();

  return emptyDataResult(types, true);
}
