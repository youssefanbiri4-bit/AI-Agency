import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';

type AuditSeverity = 'info' | 'warning' | 'critical';

export async function logSecurityAuditEvent({
  supabase,
  workspaceId,
  userId,
  eventType,
  severity = 'info',
  entityType,
  entityId,
  message,
  metadata,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string | null;
  eventType: string;
  severity?: AuditSeverity;
  entityType?: string | null;
  entityId?: string | null;
  message?: string | null;
  metadata?: JsonObject;
}) {
  try {
    const { client } = getSupabaseAdmin();
    const auditClient = client ?? supabase;

    await auditClient.from('security_audit_logs').insert({
      workspace_id: workspaceId,
      user_id: userId,
      event_type: eventType,
      severity,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      message: message ?? null,
      metadata: metadata ?? {},
    });
  } catch {
    // Audit logging is best-effort and must not expose or block sensitive flows.
  }
}
