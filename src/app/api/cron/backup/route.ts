/**
 * Backup Monitor Cron — GET/POST /api/cron/backup
 *
 * W20-T2: DevOps Engineer deliverable.
 *
 * Acts as the backup freshness monitor: records a checkpoint, verifies the last
 * successful database backup is within the configured RPO window
 * (ALERT_BACKUP_MAX_AGE_DAYS), and fires a critical alert if backups are
 * missing or stale. The actual dump is performed by scripts/backup-snapshot.sh
 * (or Supabase managed backups); this route ensures we would notice if it
 * stopped working.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import {
  startBackupJob,
  finishBackupJob,
  daysSinceLastBackup,
} from '@/lib/backup/backup-jobs';
import { alertBackupFailure } from '@/lib/alerts';
import { getAlertConfig } from '@/lib/alerts/config';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const routeLog = logger.child('cron:backup');

export async function GET(request: NextRequest) {
  return handleBackupMonitor(request);
}

export async function POST(request: NextRequest) {
  return handleBackupMonitor(request);
}

async function handleBackupMonitor(request: NextRequest) {
  const auth = isCronAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const jobId = await startBackupJob({ jobType: 'db_snapshot', destination: 'monitor' });
  const maxAgeDays = getAlertConfig().thresholds.backupMaxAgeDays;

  try {
    const ageDays = await daysSinceLastBackup('db_snapshot_real');
    let status: 'succeeded' | 'failed' | 'partial' = 'succeeded';

    if (ageDays === null) {
      routeLog.warn('No successful database backup found');
      await alertBackupFailure({
        jobType: 'db_snapshot',
        reason: 'No successful database backup on record.',
      });
      status = 'failed';
    } else if (ageDays > maxAgeDays) {
      routeLog.warn('Database backup is stale', { ageDays, maxAgeDays });
      await alertBackupFailure({
        jobType: 'db_snapshot',
        reason: `Last successful backup is older than RPO target.`,
        ageDays,
      });
      status = 'partial';
    }

    await finishBackupJob(jobId ?? 'unknown', status, {
      errorMessage: status === 'succeeded' ? undefined : 'Backup missing or stale',
    });

    return NextResponse.json({
      success: status === 'succeeded',
      ageDays,
      maxAgeDays,
      status,
    });
  } catch (err) {
    await finishBackupJob(jobId ?? 'unknown', 'failed', {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    routeLog.error('Backup monitor failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: 'Backup monitor failed' }, { status: 500 });
  }
}
