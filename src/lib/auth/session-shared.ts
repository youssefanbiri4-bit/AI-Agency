/** Idle session timeout — 45 minutes (within 30–60 min requirement). */
export const SESSION_IDLE_TIMEOUT_MS = 45 * 60 * 1000;

/** Minimum interval between activity cookie writes (5 min). */
export const SESSION_ACTIVITY_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const SESSION_ACTIVITY_COOKIE = 'agentflow-last-activity';
export const SESSION_CLIENT_IP_COOKIE = 'agentflow-session-ip';

export const SESSION_SUSPICIOUS_REASON = {
  idleTimeout: 'idle_timeout',
  ipMismatch: 'ip_mismatch',
  refreshFailed: 'refresh_failed',
  securityEvent: 'security_event',
} as const;

export type SessionSuspiciousReason =
  (typeof SESSION_SUSPICIOUS_REASON)[keyof typeof SESSION_SUSPICIOUS_REASON];

export function parseActivityTimestamp(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function isSessionIdleExpired(
  lastActivityMs: number | null,
  now = Date.now(),
  idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS
): boolean {
  if (lastActivityMs === null) {
    return false;
  }

  return now - lastActivityMs > idleTimeoutMs;
}

export function shouldTouchActivity(
  lastActivityMs: number | null,
  now = Date.now(),
  touchIntervalMs = SESSION_ACTIVITY_TOUCH_INTERVAL_MS
): boolean {
  if (lastActivityMs === null) {
    return true;
  }

  return now - lastActivityMs >= touchIntervalMs;
}

export function formatIdleTimeoutMinutes(idleTimeoutMs = SESSION_IDLE_TIMEOUT_MS): number {
  return Math.round(idleTimeoutMs / 60_000);
}

export function evaluateSessionActivity(
  lastActivityRaw: string | undefined | null,
  now = Date.now()
): { expired: boolean; lastActivityMs: number | null; shouldTouch: boolean } {
  const lastActivityMs = parseActivityTimestamp(lastActivityRaw);

  return {
    lastActivityMs,
    expired: isSessionIdleExpired(lastActivityMs, now),
    shouldTouch: shouldTouchActivity(lastActivityMs, now),
  };
}

export function evaluateSessionIpMismatch(
  storedIp: string | undefined | null,
  currentIp: string
): boolean {
  if (!storedIp || storedIp === 'unknown' || currentIp === 'unknown') {
    return false;
  }

  return storedIp !== currentIp;
}

export function buildSuspiciousLogoutMessage(reason: SessionSuspiciousReason): string {
  switch (reason) {
    case SESSION_SUSPICIOUS_REASON.idleTimeout:
      return 'Your session expired due to inactivity. Please sign in again.';
    case SESSION_SUSPICIOUS_REASON.ipMismatch:
      return 'Your session was ended after detecting a network change. Please sign in again.';
    case SESSION_SUSPICIOUS_REASON.refreshFailed:
      return 'Your session could not be refreshed. Please sign in again.';
    default:
      return 'Your session was ended for security reasons. Please sign in again.';
  }
}