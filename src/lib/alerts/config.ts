export interface ThresholdConfig {
  /** Fraction (0-1) of failed requests that triggers a high-error-rate alert. */
  errorRateThreshold: number;
  /** p95 latency (ms) above which a latency alert fires. */
  latencyP95ThresholdMs: number;
  /** Free Redis memory (MB) below which a cache-pressure alert fires (0 = disabled). */
  redisMemoryWarnMb: number;
  /** DB replication lag (seconds) above which a lag alert fires (0 = disabled). */
  dbReplicaLagWarnSeconds: number;
  /** Days since last successful backup before a backup-staleness alert. */
  backupMaxAgeDays: number;
}

export interface AlertConfig {
  enabled: boolean;
  /** Optional explicit channel allow-list (e.g. ['slack','email','webhook']). */
  channels: string[] | null;
  thresholds: ThresholdConfig;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseChannels(value: string | undefined): string[] | null {
  if (!value) return null;
  const parts = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * Alerts configuration derived entirely from environment variables.
 * Channel-specific credentials (RESEND_API_KEY, SLACK_WEBHOOK_URL,
 * PAGERDUTY_ROUTING_KEY) are read inside their respective channel factories —
 * no secrets are hardcoded here.
 */
export function getAlertConfig(): AlertConfig {
  return {
    enabled: bool(process.env.ALERTS_ENABLED, true),
    channels: parseChannels(process.env.ALERT_CHANNELS),
    thresholds: {
      errorRateThreshold: num(process.env.ALERT_ERROR_RATE_THRESHOLD, 0.05),
      latencyP95ThresholdMs: num(process.env.ALERT_LATENCY_P95_MS, 1500),
      redisMemoryWarnMb: num(process.env.ALERT_REDIS_MEMORY_WARN_MB, 0),
      dbReplicaLagWarnSeconds: num(process.env.ALERT_DB_LAG_WARN_SECONDS, 0),
      backupMaxAgeDays: num(process.env.ALERT_BACKUP_MAX_AGE_DAYS, 1),
    },
  };
}
