/**
 * Backup Job Tracking (W20-T2)
 *
 * Senior DevOps + Infrastructure Engineer deliverable.
 *
 * Records backup runs in the `backup_jobs` table (migration
 * 20260720000000_backup_dr) so monitoring/alerting can detect missing or stale
 * backups. The actual dump is performed externally (scripts/backup-snapshot.sh
 * or Supabase managed backups); this module records status + freshness.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

const backupLog = logger.child('backup:jobs');

function getAdminClient(): SupabaseClient<Database> {
  const { client, error } = getSupabaseAdmin();
  if (!client) {
    throw new Error(error ?? 'Supabase admin client is not configured');
  }
  return client;
}

export interface BackupJobInput {
  workspaceId?: string | null;
  jobType: string;
  destination?: string;
  destinationPath?: string;
  rpoTargetMinutes?: number;
  rtoTargetMinutes?: number;
}

export interface BackupJobRecord extends BackupJobInput {
  id: string;
  status: 'started' | 'succeeded' | 'failed' | 'partial';
  sizeBytes: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

/**
 * Start a backup job record (status='started'). Returns the new job id.
 */
export async function startBackupJob(input: BackupJobInput): Promise<string | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('backup_jobs')
    .insert({
      workspace_id: input.workspaceId ?? null,
      job_type: input.jobType,
      destination: input.destination ?? null,
      destination_path: input.destinationPath ?? null,
      rpo_target_minutes: input.rpoTargetMinutes ?? null,
      rto_target_minutes: input.rtoTargetMinutes ?? null,
      status: 'started',
    })
    .select('id')
    .single();

  if (error) {
    backupLog.error('Failed to start backup job', { error: error.message });
    return null;
  }
  return data.id;
}

/**
 * Mark a backup job finished with status + size + optional error.
 */
export async function finishBackupJob(
  jobId: string,
  status: 'succeeded' | 'failed' | 'partial',
  opts?: { sizeBytes?: number; errorMessage?: string }
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('backup_jobs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      size_bytes: opts?.sizeBytes ?? 0,
      error_message: opts?.errorMessage ?? null,
    })
    .eq('id', jobId);

  if (error) {
    backupLog.error('Failed to finish backup job', { jobId, error: error.message });
  }
}

/**
 * Return the most recent successful backup per type (for staleness checks).
 */
export async function getLatestSuccessfulBackups(
  jobType: string
): Promise<Array<{ id: string; finishedAt: string; sizeBytes: number }>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('backup_jobs')
    .select('id, finished_at, size_bytes')
    .eq('job_type', jobType)
    .eq('status', 'succeeded')
    .order('finished_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    backupLog.warn('Failed to load backup history', { jobType, error: error?.message });
    return [];
  }
  return data.map((r) => ({
    id: r.id,
    finishedAt: r.finished_at ?? '',
    sizeBytes: r.size_bytes ?? 0,
  }));
}

/**
 * Days since the last successful backup of a given type (null if none).
 */
export async function daysSinceLastBackup(jobType: string): Promise<number | null> {
  const latest = await getLatestSuccessfulBackups(jobType);
  if (latest.length === 0 || !latest[0].finishedAt) return null;
  const diff = Date.now() - new Date(latest[0].finishedAt).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}
