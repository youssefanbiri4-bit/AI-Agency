/**
 * SOC2 Compliance Readiness
 *
 * Tracks SOC2 (and other framework) control status and collected evidence in
 * `compliance_evidence`. Provides a readiness checklist derived from the
 * controls actually implemented across the security modules (audit logging,
 * access control, encryption, incident response, etc.) so an auditor can see
 * coverage at a glance.
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

const log = logger.child('compliance');

export type ComplianceStatus =
  | 'not_started'
  | 'implemented'
  | 'evidence_collected'
  | 'attested'
  | 'failed';

export interface ComplianceEvidenceResult {
  id: string;
  workspaceId: string;
  framework: string;
  controlId: string;
  controlName: string;
  status: ComplianceStatus;
  evidence: string | null;
  attestedBy: string | null;
  attestedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceEvidenceInput {
  workspaceId: string;
  framework?: string;
  controlId: string;
  controlName: string;
  status?: ComplianceStatus;
  evidence?: string;
  metadata?: Record<string, unknown>;
}

// SOC2 Common Criteria (CC) + Security (CC6 access, CC7 monitoring) mapped to
// capabilities delivered by this platform.
export const SOC2_CONTROLS: Array<{ id: string; name: string }> = [
  { id: 'CC6.1', name: 'Logical access — entity authentication (MFA, SSO)' },
  { id: 'CC6.2', name: 'Registration & authorization of new users' },
  { id: 'CC6.3', name: 'Access removal in a timely manner' },
  { id: 'CC6.6', name: 'Restriction of access to protected data' },
  { id: 'CC7.1', name: 'Detection of security incidents (audit logging)' },
  { id: 'CC7.2', name: 'Monitoring of anomalies & events' },
  { id: 'CC7.3', name: 'Evaluation of security events & incidents' },
  { id: 'CC8.1', name: 'Data encryption in transit & at rest' },
  { id: 'CC2.1', name: 'Corporate governance & accountability' },
  { id: 'CC3.1', name: 'Risk assessment & mitigation' },
  { id: 'CC4.1', name: 'Internal control monitoring (policy enforcement)' },
  { id: 'PRIV.1', name: 'Privacy — data subject rights (GDPR DSAR)' },
];

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function upsertComplianceEvidence(
  input: ComplianceEvidenceInput
): Promise<DataResult<ComplianceEvidenceResult>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');
  const { data, error: upsErr } = await client
    .from('compliance_evidence')
    .upsert(
      {
        workspace_id: input.workspaceId,
        framework: input.framework ?? 'SOC2',
        control_id: input.controlId,
        control_name: input.controlName,
        status: input.status ?? 'implemented',
        evidence: input.evidence ?? null,
        metadata: (input.metadata ?? {}) as JsonObject,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,control_id' }
    )
    .select('*')
    .single();
  if (upsErr) return errorDataResult(null as never, upsErr.message);
  return emptyDataResult(toEvidence(data), true);
}

export async function attestControl(
  workspaceId: string,
  controlId: string,
  attestedBy: string,
  evidence?: string
): Promise<DataResult<ComplianceEvidenceResult>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult(null as never, error ?? 'Supabase unavailable');
  const { data, error: updErr } = await client
    .from('compliance_evidence')
    .update({
      status: 'attested',
      attested_by: attestedBy,
      attested_at: new Date().toISOString(),
      evidence: evidence ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('control_id', controlId)
    .select('*')
    .single();
  if (updErr) return errorDataResult(null as never, updErr.message);
  log.info('control attested', { workspaceId, controlId, attestedBy });
  return emptyDataResult(toEvidence(data), true);
}

export async function listComplianceEvidence(
  workspaceId: string,
  framework = 'SOC2'
): Promise<DataResult<ComplianceEvidenceResult[]>> {
  const { client, error } = getSupabaseAdmin();
  if (error || !client) return errorDataResult([], error ?? 'Supabase unavailable');
  const { data, error: qErr } = await client
    .from('compliance_evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('framework', framework)
    .order('control_id', { ascending: true });
  if (qErr) return errorDataResult([], qErr.message);
  return emptyDataResult((data ?? []).map(toEvidence), true);
}

export interface ComplianceReadinessSummary {
  framework: string;
  totalControls: number;
  implemented: number;
  evidenceCollected: number;
  attested: number;
  coveragePct: number;
  missingControls: string[];
}

/**
 * Returns a SOC2 readiness summary, seeding the standard control set for the
 * workspace if no evidence rows exist yet (idempotent — uses upsert on list).
 */
export async function getComplianceReadiness(
  workspaceId: string,
  framework = 'SOC2'
): Promise<DataResult<ComplianceReadinessSummary>> {
  const existing = await listComplianceEvidence(workspaceId, framework);
  if (existing.error) return errorDataResult(null as never, existing.error);

  const byControl = new Map(existing.data.map((e) => [e.controlId, e]));

  // Auto-seed controls that have no evidence row yet (status = not_started).
  for (const c of SOC2_CONTROLS) {
    if (!byControl.has(c.id)) {
      const seeded = await upsertComplianceEvidence({
        workspaceId,
        framework,
        controlId: c.id,
        controlName: c.name,
        status: 'not_started',
      });
      if (!seeded.error && seeded.data) byControl.set(c.id, seeded.data);
    }
  }

  const all = Array.from(byControl.values());
  const implemented = all.filter((e) => e.status === 'implemented').length;
  const evidenceCollected = all.filter((e) => e.status === 'evidence_collected').length;
  const attested = all.filter((e) => e.status === 'attested').length;
  const missing = all.filter((e) => e.status === 'not_started').map((e) => e.controlId);

  const summary: ComplianceReadinessSummary = {
    framework,
    totalControls: all.length,
    implemented,
    evidenceCollected,
    attested,
    coveragePct: all.length === 0 ? 0 : Math.round(((implemented + evidenceCollected + attested) / all.length) * 100),
    missingControls: missing,
  };
  return emptyDataResult(summary, true);
}

function toEvidence(r: Database['public']['Tables']['compliance_evidence']['Row']): ComplianceEvidenceResult {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    framework: r.framework,
    controlId: r.control_id,
    controlName: r.control_name,
    status: r.status,
    evidence: r.evidence,
    attestedBy: r.attested_by,
    attestedAt: r.attested_at,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
