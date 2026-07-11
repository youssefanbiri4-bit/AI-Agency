import 'server-only';

import { logger } from '@/lib/logger';
import {
  AUTH_BRUTE_FORCE_LIMIT,
  AUTH_BRUTE_FORCE_WINDOW_MS,
  AUTH_LOCKOUT_WINDOW_MS,
  checkRateLimit,
  checkRateLimitLockout,
  clearRateLimitKey,
  peekRateLimit,
  setRateLimitLockout,
} from '@/lib/rate-limit';

const authBruteForceLog = logger.child('auth:brute-force');

// ── Special email overrides ───────────────────────────────────────
// Certain emails get higher brute-force limits to avoid lockout.
// IP-based rate limits remain at the standard (5/5min) for everyone.
//
// To add emails, set the SPECIAL_AUTH_EMAILS env var as a comma-separated list:
//   SPECIAL_AUTH_EMAILS=youssefanbiri4@gmail.com,admin@agentflow.ai
export const SPECIAL_AUTH_BRUTE_FORCE_LIMIT = 50;
export const SPECIAL_AUTH_BRUTE_FORCE_WINDOW_MS = 15 * 60_000; // 15 minutes

const SPECIAL_AUTH_EMAILS_DEFAULT = 'youssefanbiri4@gmail.com';

let cachedSpecialEmails: Set<string> | null = null;

/**
 * Returns the set of emails that get elevated brute-force limits.
 * Reads from `SPECIAL_AUTH_EMAILS` env var (comma-separated).
 * Falls back to `youssefanbiri4@gmail.com` if the env var is not set.
 * Cached after first call for performance.
 */
export function getSpecialAuthEmails(): Set<string> {
  if (cachedSpecialEmails) {
    return cachedSpecialEmails;
  }

  const raw = process.env.SPECIAL_AUTH_EMAILS?.trim();
  if (raw) {
    const emails = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    cachedSpecialEmails = new Set(emails);
  } else {
    cachedSpecialEmails = new Set([SPECIAL_AUTH_EMAILS_DEFAULT]);
  }

  return cachedSpecialEmails;
}

/**
 * Clears the cached special emails set.
 * Useful in tests to re-read from a changed env var.
 */
export function clearSpecialAuthEmailsCache(): void {
  cachedSpecialEmails = null;
}

export function getAuthBruteForceLimits(email: string): {
  limit: number;
  windowMs: number;
} {
  const normalized = normalizeAuthEmail(email);
  if (getSpecialAuthEmails().has(normalized)) {
    return {
      limit: SPECIAL_AUTH_BRUTE_FORCE_LIMIT,
      windowMs: SPECIAL_AUTH_BRUTE_FORCE_WINDOW_MS,
    };
  }
  return { limit: AUTH_BRUTE_FORCE_LIMIT, windowMs: AUTH_BRUTE_FORCE_WINDOW_MS };
}

export type AuthBruteForceAction = 'login' | 'signup';

export type AuthBruteForceBlockReason = 'lockout' | 'rate_limit';

export interface AuthBruteForceCheckResult {
  allowed: boolean;
  reason?: AuthBruteForceBlockReason;
  retryAfterSeconds: number;
  resetAt: number;
}

interface AuthBruteForceKeys {
  attemptIp: string;
  attemptEmail: string;
  lockoutIp: string;
  lockoutEmail: string;
  failureIp: string;
  failureEmail: string;
}

export function normalizeAuthEmail(email: string): string {
  return email.toLowerCase().trim();
}

function buildAuthBruteForceKeys(
  action: AuthBruteForceAction,
  clientIp: string,
  email: string
): AuthBruteForceKeys {
  const normalizedEmail = normalizeAuthEmail(email);

  return {
    attemptIp: `auth:${action}:attempt:ip:${clientIp}`,
    attemptEmail: `auth:${action}:attempt:email:${normalizedEmail}`,
    lockoutIp: `auth:${action}:lockout:ip:${clientIp}`,
    lockoutEmail: `auth:${action}:lockout:email:${normalizedEmail}`,
    failureIp: `auth:${action}:failure:ip:${clientIp}`,
    failureEmail: `auth:${action}:failure:email:${normalizedEmail}`,
  };
}

function toBlockedResult(
  reason: AuthBruteForceBlockReason,
  resetAt: number
): AuthBruteForceCheckResult {
  return {
    allowed: false,
    reason,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

function pickStricterBlock(
  current: AuthBruteForceCheckResult,
  candidate: AuthBruteForceCheckResult
): AuthBruteForceCheckResult {
  if (!candidate.allowed) {
    return candidate;
  }
  return current;
}

async function checkLockoutPair(
  keys: AuthBruteForceKeys
): Promise<AuthBruteForceCheckResult> {
  let result: AuthBruteForceCheckResult = { allowed: true, retryAfterSeconds: 0, resetAt: Date.now() };

  for (const lockoutKey of [keys.lockoutIp, keys.lockoutEmail]) {
    const lockout = await checkRateLimitLockout(lockoutKey);
    if (!lockout.allowed) {
      result = pickStricterBlock(result, toBlockedResult('lockout', lockout.resetAt));
    }
  }

  return result;
}

async function checkAttemptPair(
  keys: AuthBruteForceKeys,
  emailLimits?: { limit: number; windowMs: number }
): Promise<AuthBruteForceCheckResult> {
  let result: AuthBruteForceCheckResult = { allowed: true, retryAfterSeconds: 0, resetAt: Date.now() };

  // IP-based check — always uses standard limits (5/5min) for everyone
  const ipAttempt = await peekRateLimit({
    key: keys.attemptIp,
    limit: AUTH_BRUTE_FORCE_LIMIT,
    windowMs: AUTH_BRUTE_FORCE_WINDOW_MS,
  });
  if (!ipAttempt.allowed) {
    result = pickStricterBlock(result, toBlockedResult('rate_limit', ipAttempt.resetAt));
  }

  // Email-based check — can use custom limits for special emails
  const effectiveEmailLimits = emailLimits ?? {
    limit: AUTH_BRUTE_FORCE_LIMIT,
    windowMs: AUTH_BRUTE_FORCE_WINDOW_MS,
  };
  const emailAttempt = await peekRateLimit({
    key: keys.attemptEmail,
    limit: effectiveEmailLimits.limit,
    windowMs: effectiveEmailLimits.windowMs,
  });
  if (!emailAttempt.allowed) {
    result = pickStricterBlock(result, toBlockedResult('rate_limit', emailAttempt.resetAt));
  }

  return result;
}

export async function checkAuthBruteForce(
  action: AuthBruteForceAction,
  clientIp: string,
  email: string
): Promise<AuthBruteForceCheckResult> {
  const keys = buildAuthBruteForceKeys(action, clientIp, email);
  const emailLimits = getAuthBruteForceLimits(email);

  const lockoutResult = await checkLockoutPair(keys);
  if (!lockoutResult.allowed) {
    authBruteForceLog.warn('auth lockout active', {
      action,
      reason: lockoutResult.reason,
      clientIp,
      email,
      retryAfterSeconds: lockoutResult.retryAfterSeconds,
    });
    return lockoutResult;
  }

  const attemptResult = await checkAttemptPair(keys, emailLimits);
  if (!attemptResult.allowed) {
    authBruteForceLog.warn('auth attempt rate limit exceeded', {
      action,
      reason: attemptResult.reason,
      clientIp,
      email,
      emailLimit: emailLimits.limit,
      emailWindowMs: emailLimits.windowMs,
      retryAfterSeconds: attemptResult.retryAfterSeconds,
    });
    return attemptResult;
  }

  return { allowed: true, retryAfterSeconds: 0, resetAt: Date.now() };
}

export async function recordAuthAttempt(
  action: AuthBruteForceAction,
  clientIp: string,
  email: string
): Promise<void> {
  const keys = buildAuthBruteForceKeys(action, clientIp, email);
  const emailLimits = getAuthBruteForceLimits(email);

  await Promise.all([
    // IP-based — always standard limits
    checkRateLimit({
      key: keys.attemptIp,
      limit: AUTH_BRUTE_FORCE_LIMIT,
      windowMs: AUTH_BRUTE_FORCE_WINDOW_MS,
    }),
    // Email-based — may have higher limits for special emails
    checkRateLimit({
      key: keys.attemptEmail,
      limit: emailLimits.limit,
      windowMs: emailLimits.windowMs,
    }),
  ]);
}

async function maybeActivateLockout(lockoutKey: string, failureResult: { remaining: number }) {
  if (failureResult.remaining === 0) {
    await setRateLimitLockout(lockoutKey, AUTH_LOCKOUT_WINDOW_MS);
  }
}

export async function recordAuthFailure(
  action: AuthBruteForceAction,
  clientIp: string,
  email: string
): Promise<void> {
  const keys = buildAuthBruteForceKeys(action, clientIp, email);
  const emailLimits = getAuthBruteForceLimits(email);

  const [ipFailure, emailFailure] = await Promise.all([
    // IP-based — always standard limits
    checkRateLimit({
      key: keys.failureIp,
      limit: AUTH_BRUTE_FORCE_LIMIT,
      windowMs: AUTH_BRUTE_FORCE_WINDOW_MS,
    }),
    // Email-based — may have higher limits for special emails
    checkRateLimit({
      key: keys.failureEmail,
      limit: emailLimits.limit,
      windowMs: emailLimits.windowMs,
    }),
  ]);

  await Promise.all([
    maybeActivateLockout(keys.lockoutIp, ipFailure),
    maybeActivateLockout(keys.lockoutEmail, emailFailure),
  ]);

  authBruteForceLog.warn('auth failure recorded', {
    action,
    clientIp,
    email,
    ipFailuresRemaining: ipFailure.remaining,
    emailFailuresRemaining: emailFailure.remaining,
    lockoutTriggered: ipFailure.remaining === 0 || emailFailure.remaining === 0,
    emailLimit: emailLimits.limit,
    emailWindowMs: emailLimits.windowMs,
  });
}

export async function clearAuthFailures(
  action: AuthBruteForceAction,
  clientIp: string,
  email: string
): Promise<void> {
  const keys = buildAuthBruteForceKeys(action, clientIp, email);

  await Promise.all([
    clearRateLimitKey(keys.failureIp),
    clearRateLimitKey(keys.failureEmail),
    clearRateLimitKey(keys.lockoutIp),
    clearRateLimitKey(keys.lockoutEmail),
  ]);
}

export function buildAuthRateLimitMessage(
  reason: AuthBruteForceBlockReason,
  retryAfterSeconds: number
): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

  if (reason === 'lockout') {
    return `Too many failed attempts. Your account is temporarily locked. Try again in about ${minutes} minute(s).`;
  }

  return `Too many attempts. Please wait about ${minutes} minute(s) before trying again.`;
}