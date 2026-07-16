import type { AlertChannel, AlertPayload } from './channels';
import { createEmailChannel } from './email';
import { createSlackChannel } from './slack';
import { createWebhookChannel } from './webhook';
import { logger } from '@/lib/logger';
import { getAlertConfig } from './config';

const alertLog = logger.child('alerts');

let channels: AlertChannel[] | null = null;

function getChannels(): AlertChannel[] {
  if (!channels) {
    channels = [createEmailChannel(), createSlackChannel(), createWebhookChannel()];
  }
  return channels;
}

/**
 * Dispatch an alert to all configured channels (email + slack + webhook).
 * Each channel self-gates on its own enable/env config. Failures on a channel
 * are logged but never thrown, so alerting can never crash the caller.
 *
 * If `ALERT_CHANNELS` is set, only the named channels are used.
 */
export async function dispatchAlert(payload: AlertPayload): Promise<void> {
  const config = getAlertConfig();
  if (!config.enabled) {
    alertLog.debug('Alerts disabled; skipping', { source: payload.source });
    return;
  }

  const allowed = config.channels;
  const targets = allowed
    ? getChannels().filter((ch) => allowed.includes(ch.name))
    : getChannels();

  const results = await Promise.all(
    targets.map(async (ch) => {
      try {
        const ok = await ch.send(payload);
        return { name: ch.name, ok };
      } catch (e) {
        return {
          name: ch.name,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    alertLog.warn('Some alert channels failed', {
      source: payload.source,
      failed: failed.map((f) => f.name),
    });
  } else {
    alertLog.info('Alert dispatched', {
      source: payload.source,
      severity: payload.severity,
    });
  }
}

export async function alertHealthDegradation(details: {
  status: string;
  reason: string;
  workspaceId?: string | null;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  await dispatchAlert({
    source: 'health',
    severity: 'warning',
    title: 'System health degraded',
    message: details.reason,
    workspaceId: details.workspaceId ?? null,
    metadata: { status: details.status, ...(details.metrics ?? {}) },
  });
}

export interface ErrorRateInput {
  rate: number;
  count: number;
  windowMs: number;
  context?: string;
}

/** Fire a critical alert when the error rate exceeds the configured fraction. */
export async function alertHighErrorRate(input: ErrorRateInput): Promise<void> {
  const threshold = getAlertConfig().thresholds.errorRateThreshold;
  if (input.rate < threshold) return;

  await dispatchAlert({
    source: 'error-rate',
    severity: 'critical',
    title: 'High error rate detected',
    message: `Error rate ${(input.rate * 100).toFixed(2)}% exceeded threshold ${(
      threshold * 100
    ).toFixed(2)}%${input.context ? ` (${input.context})` : ''}.`,
    metadata: {
      rate: input.rate,
      count: input.count,
      windowMs: input.windowMs,
      context: input.context,
    },
  });
}

/** Fire an alert when request latency exceeds the configured p95 threshold. */
export async function alertHighLatency(input: {
  p95Ms: number;
  route?: string;
  sampleCount?: number;
}): Promise<void> {
  const threshold = getAlertConfig().thresholds.latencyP95ThresholdMs;
  if (threshold <= 0 || input.p95Ms < threshold) return;

  await dispatchAlert({
    source: 'latency',
    severity: 'warning',
    title: 'High request latency',
    message: `p95 latency ${Math.round(input.p95Ms)}ms exceeded threshold ${threshold}ms${
      input.route ? ` on ${input.route}` : ''
    }.`,
    metadata: { p95Ms: input.p95Ms, route: input.route, sampleCount: input.sampleCount },
  });
}

/** Fire a critical alert when a backup job fails or is stale. */
export async function alertBackupFailure(input: {
  jobType: string;
  reason: string;
  workspaceId?: string | null;
  ageDays?: number;
}): Promise<void> {
  await dispatchAlert({
    source: 'backup',
    severity: 'critical',
    title: 'Backup failure or staleness',
    message: `Backup (${input.jobType}) issue: ${input.reason}${
      input.ageDays !== undefined ? ` (last successful ${input.ageDays}d ago)` : ''
    }.`,
    workspaceId: input.workspaceId ?? null,
    metadata: { jobType: input.jobType, ageDays: input.ageDays },
  });
}

/** Fire a warning when Redis memory pressure crosses the configured floor. */
export async function alertCachePressure(input: { freeMb: number }): Promise<void> {
  const threshold = getAlertConfig().thresholds.redisMemoryWarnMb;
  if (threshold <= 0 || input.freeMb >= threshold) return;

  await dispatchAlert({
    source: 'cache',
    severity: 'warning',
    title: 'Redis memory pressure',
    message: `Redis free memory ${Math.round(input.freeMb)}MB below threshold ${threshold}MB.`,
    metadata: { freeMb: input.freeMb, thresholdMb: threshold },
  });
}
