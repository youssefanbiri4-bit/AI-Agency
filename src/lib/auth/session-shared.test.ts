import { describe, expect, it } from 'vitest';
import {
  buildSuspiciousLogoutMessage,
  formatIdleTimeoutMinutes,
  isSessionIdleExpired,
  shouldTouchActivity,
  SESSION_IDLE_TIMEOUT_MS,
} from '@/lib/auth/session-shared';

describe('session-shared', () => {
  it('expires sessions after the idle timeout window', () => {
    const now = Date.now();
    const lastActivity = now - SESSION_IDLE_TIMEOUT_MS - 1;

    expect(isSessionIdleExpired(lastActivity, now)).toBe(true);
  });

  it('keeps active sessions alive inside the idle timeout window', () => {
    const now = Date.now();
    const lastActivity = now - 10 * 60 * 1000;

    expect(isSessionIdleExpired(lastActivity, now)).toBe(false);
  });

  it('throttles activity cookie writes', () => {
    const now = Date.now();
    const recent = now - 60_000;

    expect(shouldTouchActivity(recent, now)).toBe(false);
    expect(shouldTouchActivity(null, now)).toBe(true);
  });

  it('formats idle timeout minutes for UI copy', () => {
    expect(formatIdleTimeoutMinutes()).toBe(45);
  });

  it('builds user-facing suspicious logout messages', () => {
    expect(buildSuspiciousLogoutMessage('idle_timeout')).toContain('inactivity');
    expect(buildSuspiciousLogoutMessage('ip_mismatch')).toContain('network');
  });
});