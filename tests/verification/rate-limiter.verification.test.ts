/**
 * W9-VER-T2 — Rate Limiter live verification
 *
 * Verifies the fixed-window limiter (checkRateLimit) and the sliding-window
 * limiter (checkSlidingWindowRateLimit): blocking at the limit, the 429
 * response headers produced by buildRateLimitExceededHeaders, and fail-open
 * behavior (a throwing store must allow the request rather than crash).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRateLimitExceededHeaders,
  checkRateLimit,
  InMemoryRateLimitStore,
  setRateLimitStore,
} from '@/lib/rate-limit';
import {
  checkSlidingWindowRateLimit,
  InMemorySlidingWindowStore,
  peekSlidingWindowRateLimit,
  setSlidingWindowStore,
  type SlidingWindowStore,
} from '@/lib/sliding-window-rate-limit';

afterEach(() => {
  setRateLimitStore(new InMemoryRateLimitStore());
  setSlidingWindowStore(new InMemorySlidingWindowStore());
});

describe('Rate Limiter — fixed window (checkRateLimit)', () => {
  it('allows up to the limit then blocks and reports remaining=0', async () => {
    const key = 'fixed-key';
    const limit = 3;

    const r1 = await checkRateLimit({ key, limit, windowMs: 10_000 });
    const r2 = await checkRateLimit({ key, limit, windowMs: 10_000 });
    const r3 = await checkRateLimit({ key, limit, windowMs: 10_000 });
    expect(r1.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const blocked = await checkRateLimit({ key, limit, windowMs: 10_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('produces 429 response headers (Retry-After + X-RateLimit-*)', async () => {
    const key = 'header-key';
    const limit = 1;
    await checkRateLimit({ key, limit, windowMs: 10_000 });
    const blocked = await checkRateLimit({ key, limit, windowMs: 10_000 });

    const headers = buildRateLimitExceededHeaders({
      allowed: blocked.allowed,
      remaining: blocked.remaining,
      resetAt: blocked.resetAt,
    });

    expect(headers['Retry-After']).toMatch(/^\d+$/);
    expect(headers['X-RateLimit-Limit']).toBe('0');
    expect(headers['X-RateLimit-Reset']).toMatch(/^\d+$/);
  });
});

describe('Rate Limiter — sliding window', () => {
  it('blocks once the sliding window limit is reached', async () => {
    const key = 'sw-key';
    const limit = 2;

    const a = await checkSlidingWindowRateLimit({ key, limit, windowMs: 10_000 });
    const b = await checkSlidingWindowRateLimit({ key, limit, windowMs: 10_000 });
    expect(a.allowed).toBe(true);
    expect(b.remaining).toBe(0);

    const c = await checkSlidingWindowRateLimit({ key, limit, windowMs: 10_000 });
    expect(c.allowed).toBe(false);
    expect(c.current).toBe(2);
  });

  it('peek does not increment the counter', async () => {
    const key = 'sw-peek';
    const p = await peekSlidingWindowRateLimit({ key, limit: 3, windowMs: 10_000 });
    expect(p.allowed).toBe(true);

    const after = await checkSlidingWindowRateLimit({ key, limit: 3, windowMs: 10_000 });
    expect(after.current).toBe(1);
  });

  it('fails OPEN: a throwing store still allows the request', async () => {
    const throwing: SlidingWindowStore = {
      check: () => {
        throw new Error('store unavailable');
      },
      peek: () => {
        throw new Error('store unavailable');
      },
      reset: () => {},
      clear: () => {},
    };
    setSlidingWindowStore(throwing);

    const result = await checkSlidingWindowRateLimit({ key: 'x', limit: 5, windowMs: 1000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
