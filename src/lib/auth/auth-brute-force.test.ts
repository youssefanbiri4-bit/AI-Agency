import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  checkAuthBruteForce,
  clearAuthFailures,
  clearSpecialAuthEmailsCache,
  getAuthBruteForceLimits,
  getSpecialAuthEmails,
  recordAuthAttempt,
  recordAuthFailure,
  SPECIAL_AUTH_BRUTE_FORCE_LIMIT,
  SPECIAL_AUTH_BRUTE_FORCE_WINDOW_MS,
} from '@/lib/auth/auth-brute-force';
import { AUTH_BRUTE_FORCE_LIMIT, AUTH_BRUTE_FORCE_WINDOW_MS, InMemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

const DEFAULT_SPECIAL_EMAIL = 'youssefanbiri4@gmail.com';

describe('auth brute force protection', () => {
  beforeAll(() => {
    // Ensure the env var is set for tests that depend on it
    process.env.SPECIAL_AUTH_EMAILS = DEFAULT_SPECIAL_EMAIL;
    clearSpecialAuthEmailsCache();
  });

  afterAll(() => {
    delete process.env.SPECIAL_AUTH_EMAILS;
    clearSpecialAuthEmailsCache();
  });

  beforeEach(() => {
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  it('allows attempts under the 5/5min limit', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const check = await checkAuthBruteForce('login', '203.0.113.1', 'user@example.com');
      expect(check.allowed).toBe(true);
      await recordAuthAttempt('login', '203.0.113.1', 'user@example.com');
    }
  });

  it('blocks the 6th attempt within 5 minutes', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordAuthAttempt('login', '203.0.113.2', 'blocked@example.com');
    }

    const blocked = await checkAuthBruteForce('login', '203.0.113.2', 'blocked@example.com');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('rate_limit');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('enforces email-based limits independently from IP', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordAuthAttempt('login', `203.0.113.${attempt}`, 'shared@example.com');
    }

    const blocked = await checkAuthBruteForce('login', '198.51.100.10', 'shared@example.com');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('rate_limit');
  });

  it('locks out after 5 failed attempts for 15 minutes', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordAuthFailure('login', '203.0.113.50', 'lockout@example.com');
    }

    const blocked = await checkAuthBruteForce('login', '203.0.113.50', 'lockout@example.com');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('lockout');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('clears failures after a successful login path', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await recordAuthFailure('login', '203.0.113.60', 'recover@example.com');
    }

    await clearAuthFailures('login', '203.0.113.60', 'recover@example.com');

    const allowed = await checkAuthBruteForce('login', '203.0.113.60', 'recover@example.com');
    expect(allowed.allowed).toBe(true);
  });

  // ── Special email rate limit tests ───────────────────────────────

  it('resolves higher limits (50/15min) for youssefanbiri4@gmail.com', () => {
    const limits = getAuthBruteForceLimits(DEFAULT_SPECIAL_EMAIL);
    expect(limits.limit).toBe(SPECIAL_AUTH_BRUTE_FORCE_LIMIT);
    expect(limits.limit).toBe(50);
    expect(limits.windowMs).toBe(SPECIAL_AUTH_BRUTE_FORCE_WINDOW_MS);
    expect(limits.windowMs).toBe(15 * 60_000);
  });

  it('resolves standard limits (5/5min) for other emails', () => {
    const limits = getAuthBruteForceLimits('someone@example.com');
    expect(limits.limit).toBe(AUTH_BRUTE_FORCE_LIMIT);
    expect(limits.limit).toBe(5);
    expect(limits.windowMs).toBe(AUTH_BRUTE_FORCE_WINDOW_MS);
    expect(limits.windowMs).toBe(5 * 60_000);
  });

  it('allows 50 attempts for special email without blocking (different IPs per attempt to isolate email limit)', async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      // Each attempt from a different IP to avoid the IP-based 5/5min limit
      const check = await checkAuthBruteForce('login', `10.0.0.${attempt}`, DEFAULT_SPECIAL_EMAIL);
      expect(check.allowed).toBe(true);
      await recordAuthAttempt('login', `10.0.0.${attempt}`, DEFAULT_SPECIAL_EMAIL);
    }
  });

  it('blocks the 51st attempt for special email within 15 minutes (email-based limit)', async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await recordAuthAttempt('login', `10.0.0.${attempt}`, DEFAULT_SPECIAL_EMAIL);
    }

    const blocked = await checkAuthBruteForce('login', '10.0.200.1', DEFAULT_SPECIAL_EMAIL);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('rate_limit');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('enforces IP-based limit (5/5min) independently from email limit (50/15min) for special email', async () => {
    // Each attempt from a different IP, but same special email
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordAuthAttempt('login', `10.0.1.${attempt}`, DEFAULT_SPECIAL_EMAIL);
    }

    // Email-based limit should still be fine (only 5 out of 50 attempts)
    const emailCheck = await checkAuthBruteForce('login', '10.0.1.100', DEFAULT_SPECIAL_EMAIL);
    expect(emailCheck.allowed).toBe(true);

    // But IP-based limit should still block after 5 from the same IP
    // 10.0.1.0 already used 1 attempt, so 4 more to exhaust IP limit
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await recordAuthAttempt('login', '10.0.1.0', DEFAULT_SPECIAL_EMAIL);
    }

    const ipBlocked = await checkAuthBruteForce('login', '10.0.1.0', DEFAULT_SPECIAL_EMAIL);
    expect(ipBlocked.allowed).toBe(false);
    expect(ipBlocked.reason).toBe('rate_limit');
  });

  it('resolves limits case-insensitively', () => {
    const upper = getAuthBruteForceLimits('YOUSSEFANBIRI4@GMAIL.COM');
    expect(upper.limit).toBe(SPECIAL_AUTH_BRUTE_FORCE_LIMIT);
    expect(upper.limit).toBe(50);

    const mixed = getAuthBruteForceLimits('YoussefAnbiri4@Gmail.com');
    expect(mixed.limit).toBe(50);
  });

  // ── Env var override tests ──────────────────────────────────────

  it('reads special emails from SPECIAL_AUTH_EMAILS env var', () => {
    process.env.SPECIAL_AUTH_EMAILS = 'admin@agentflow.ai,owner@agentflow.ai';
    clearSpecialAuthEmailsCache();

    const emails = getSpecialAuthEmails();
    expect(emails.has('admin@agentflow.ai')).toBe(true);
    expect(emails.has('owner@agentflow.ai')).toBe(true);
    expect(emails.has('youssefanbiri4@gmail.com')).toBe(false);

    // Limits should use the env var emails
    expect(getAuthBruteForceLimits('admin@agentflow.ai').limit).toBe(50);
    expect(getAuthBruteForceLimits('owner@agentflow.ai').limit).toBe(50);
    expect(getAuthBruteForceLimits('someone@example.com').limit).toBe(5);

    // Restore
    process.env.SPECIAL_AUTH_EMAILS = DEFAULT_SPECIAL_EMAIL;
    clearSpecialAuthEmailsCache();
  });

  it('falls back to default if env var is empty or whitespace', () => {
    process.env.SPECIAL_AUTH_EMAILS = '   ';
    clearSpecialAuthEmailsCache();

    const emails = getSpecialAuthEmails();
    expect(emails.has(DEFAULT_SPECIAL_EMAIL)).toBe(true);

    process.env.SPECIAL_AUTH_EMAILS = DEFAULT_SPECIAL_EMAIL;
    clearSpecialAuthEmailsCache();
  });

  it('falls back to default if env var is not set', () => {
    delete process.env.SPECIAL_AUTH_EMAILS;
    clearSpecialAuthEmailsCache();

    const emails = getSpecialAuthEmails();
    expect(emails.has(DEFAULT_SPECIAL_EMAIL)).toBe(true);

    process.env.SPECIAL_AUTH_EMAILS = DEFAULT_SPECIAL_EMAIL;
    clearSpecialAuthEmailsCache();
  });

  it('handles whitespace around commas in env var', () => {
    process.env.SPECIAL_AUTH_EMAILS = ' user1@test.com , USER2@TEST.COM , user3@test.com ';
    clearSpecialAuthEmailsCache();

    const emails = getSpecialAuthEmails();
    expect(emails.has('user1@test.com')).toBe(true);
    expect(emails.has('user2@test.com')).toBe(true); // normalized to lowercase
    expect(emails.has('user3@test.com')).toBe(true);
    expect(emails.size).toBe(3);

    process.env.SPECIAL_AUTH_EMAILS = DEFAULT_SPECIAL_EMAIL;
    clearSpecialAuthEmailsCache();
  });
});