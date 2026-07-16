import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getN8nReadiness } from '@/lib/n8n';
import { reportAppError } from '@/lib/logger';
import { writeHealthSnapshot, type HealthStatus as SnapshotStatus } from '@/lib/db/health-snapshot';
import { alertHealthDegradation } from '@/lib/alerts';

export type ServiceStatus = 'unknown' | 'ok' | 'error';

export type ServiceState = {
  status: ServiceStatus;
  message?: string;
};

export type DetailedHealth = {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: ServiceState;
    supabase: ServiceState;
    n8n: ServiceState;
    storage: ServiceState;
    env: ServiceState;
  };
};

export function toSnapshotStatus(status: 'ok' | 'degraded' | 'error'): SnapshotStatus {
  if (status === 'ok') return 'healthy';
  if (status === 'error') return 'critical';
  return 'degraded';
}

async function canWriteTmp(): Promise<boolean> {
  const fs = await import('node:fs');
  fs.accessSync('/tmp', fs.constants.W_OK);
  return true;
}

/** Build the full detailed health status (may leak internal details — behind auth). */
export async function buildDetailedHealth(): Promise<DetailedHealth> {
  const status: DetailedHealth = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown' },
      supabase: { status: 'unknown' },
      n8n: { status: 'unknown' },
      storage: { status: 'unknown' },
      env: { status: 'unknown' },
    },
  };

  const requiredEnvVars = ['N8N_WEBHOOK_URL', 'N8N_CALLBACK_SECRET'] as const;

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ''
  );

  status.services.env.status = missingEnvVars.length === 0 ? 'ok' : 'error';
  if (missingEnvVars.length > 0) {
    status.services.env.message = `Missing environment variables: ${missingEnvVars.join(', ')}`;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('workspaces').select('count').limit(1);

    if (error) throw error;

    status.services.supabase.status = 'ok';
  } catch (caughtError) {
    reportAppError('Health check: Supabase connection failed', caughtError);
    status.services.supabase.status = 'error';
    status.services.supabase.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  status.services.database.status = status.services.supabase.status;

  try {
    const n8nReadiness = await getN8nReadiness();

    if (!n8nReadiness.canExecute) {
      status.services.n8n.status = 'error';
      status.services.n8n.message = n8nReadiness.message;
    } else {
      status.services.n8n.status = 'ok';
    }
  } catch (caughtError) {
    reportAppError('Health check: n8n readiness check failed', caughtError);
    status.services.n8n.status = 'error';
    status.services.n8n.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  try {
    await canWriteTmp();
    status.services.storage.status = 'ok';
  } catch (caughtError) {
    status.services.storage.status = 'error';
    status.services.storage.message =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
  }

  const allServicesOk = Object.values(status.services).every(
    (service) => service.status === 'ok'
  );

  status.status = allServicesOk ? 'ok' : 'degraded';
  return status;
}

/** Compute a 0-100 health score from the detailed service states. */
export function computeHealthScore(detailed: DetailedHealth): number {
  const services = Object.values(detailed.services);
  const okCount = services.filter((s) => s.status === 'ok').length;
  return services.length ? Math.round((okCount / services.length) * 100) : 0;
}

export interface SnapshotResult {
  detailed: DetailedHealth;
  score: number;
  status: SnapshotStatus;
  responseMs: number;
}

const HEALTH_ALERT_DEBOUNCE_MS = 5 * 60 * 1000;
let lastHealthAlertAt = 0;

/**
 * Run a full system health check, persist a global (workspace-less) snapshot,
 * and fire a debounced degradation alert when unhealthy. Best-effort: snapshot
 * and alert failures never throw.
 */
export async function snapshotSystemHealth(): Promise<SnapshotResult> {
  const startTime = Date.now();
  const detailed = await buildDetailedHealth();
  const score = computeHealthScore(detailed);
  const status = toSnapshotStatus(detailed.status);
  const responseMs = Date.now() - startTime;

  await writeHealthSnapshot({
    workspaceId: null,
    status,
    score,
    metrics: { services: detailed.services, responseMs },
    details: { timestamp: detailed.timestamp },
  }).catch(() => undefined);

  if (detailed.status !== 'ok') {
    const services = Object.values(detailed.services);
    const okCount = services.filter((s) => s.status === 'ok').length;
    const now = Date.now();
    if (now - lastHealthAlertAt > HEALTH_ALERT_DEBOUNCE_MS) {
      lastHealthAlertAt = now;
      await alertHealthDegradation({
        status: detailed.status,
        reason: `Platform health is ${detailed.status} (${okCount}/${services.length} services ok).`,
        metrics: { score, responseMs },
      }).catch(() => undefined);
    }
  }

  return { detailed, score, status, responseMs };
}
