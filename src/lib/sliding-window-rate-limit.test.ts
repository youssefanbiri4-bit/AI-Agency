import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySlidingWindowStore,
  checkSlidingWindowRateLimit,
  peekSlidingWindowRateLimit,
  resetSlidingWindowRateLimit,
  clearSlidingWindowRateLimits,
  checkWorkspaceRateLimit,
  checkUserRateLimit,
  checkWorkspaceUserRateLimit,
  buildWorkspaceRateLimitKey,
  buildUserRateLimitKey,
  buildWorkspaceUserRateLimitKey,
  buildIpRateLimitKey,
  SlidingWindowRateLimitError,
  RATE_LIMIT_ACTIONS,
  DEFAULT_RATE_LIMITS,
  setSlidingWindowStore,
} from './sliding-window-rate-limit';

describe('Sliding Window Rate Limiter', () => {
  let store: InMemorySlidingWindowStore;

  beforeEach(() => {
    store = new InMemorySlidingWindowStore();
    store.clear();
    setSlidingWindowStore(store);
  });

  describe('InMemorySlidingWindowStore', () => {
    it('allows requests within the limit', () => {
      const result = store.check({ key: 'test-key', limit: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(4);
    });

    it('blocks requests when limit is exceeded', () => {
      const key = 'exceed-key';
      // Use all 3 slots
      store.check({ key, limit: 3, windowMs: 60_000 });
      store.check({ key, limit: 3, windowMs: 60_000 });
      store.check({ key, limit: 3, windowMs: 60_000 });

      // 4th should be blocked
      const result = store.check({ key, limit: 3, windowMs: 60_000 });
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('allows requests after window slides', async () => {
      const key = 'slide-key';
      // Use 2 of 3 slots, with a delay between them
      store.check({ key, limit: 3, windowMs: 200 });

      // Wait just past the first window
      await new Promise((resolve) => setTimeout(resolve, 210));

      // First timestamp expired, second should be added fresh
      const result = store.check({ key, limit: 3, windowMs: 200 });
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1); // Only the new one
    });

    it('peek does not increment the counter', () => {
      const key = 'peek-key';

      const peek1 = store.peek({ key, limit: 5, windowMs: 60_000 });
      expect(peek1.current).toBe(0);

      store.check({ key, limit: 5, windowMs: 60_000 });

      const peek2 = store.peek({ key, limit: 5, windowMs: 60_000 });
      expect(peek2.current).toBe(1); // Sees the check, doesn't add to it

      const peek3 = store.peek({ key, limit: 5, windowMs: 60_000 });
      expect(peek3.current).toBe(1); // Still 1
    });

    it('reset clears state for a key', () => {
      const key = 'reset-key';
      store.check({ key, limit: 1, windowMs: 60_000 });

      const blocked = store.check({ key, limit: 1, windowMs: 60_000 });
      expect(blocked.allowed).toBe(false);

      store.reset(key);

      const allowed = store.check({ key, limit: 1, windowMs: 60_000 });
      expect(allowed.allowed).toBe(true);
    });

    it('clear removes all state', () => {
      store.check({ key: 'key-a', limit: 5, windowMs: 60_000 });
      store.check({ key: 'key-b', limit: 5, windowMs: 60_000 });

      store.clear();

      expect(store.peek({ key: 'key-a', limit: 5, windowMs: 60_000 }).current).toBe(0);
      expect(store.peek({ key: 'key-b', limit: 5, windowMs: 60_000 }).current).toBe(0);
    });

    it('handles 0 limit correctly', () => {
      const result = store.check({ key: 'zero-limit', limit: 0, windowMs: 60_000 });
      expect(result.allowed).toBe(false);
    });

    it('provides accurate resetInMs for rate limited requests', () => {
      const key = 'reset-time';
      store.check({ key, limit: 1, windowMs: 5000 });
      const blocked = store.check({ key, limit: 1, windowMs: 5000 });

      expect(blocked.allowed).toBe(false);
      expect(blocked.resetInMs).toBeGreaterThan(0);
      expect(blocked.resetInMs).toBeLessThanOrEqual(5000);
    });
  });

  describe('checkSlidingWindowRateLimit', () => {
    it('uses the store and returns result', async () => {
      const result = await checkSlidingWindowRateLimit({
        key: 'api-key',
        limit: 10,
        windowMs: 60_000,
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(9);
    });

    it('falls back to allowed=true on store error', async () => {
      setSlidingWindowStore({
        check: async () => { throw new Error('store error'); },
        peek: async () => { throw new Error('store error'); },
        reset: () => {},
        clear: () => {},
      });

      const result = await checkSlidingWindowRateLimit({
        key: 'error-key',
        limit: 10,
        windowMs: 60_000,
      });

      expect(result.allowed).toBe(true); // Fallback to allow
      expect(result.current).toBe(0);
    });
  });

  describe('peekSlidingWindowRateLimit', () => {
    it('peeks without incrementing', async () => {
      await checkSlidingWindowRateLimit({ key: 'peek-check', limit: 5, windowMs: 60_000 });

      const peek1 = await peekSlidingWindowRateLimit({ key: 'peek-check', limit: 5, windowMs: 60_000 });
      expect(peek1.current).toBe(1);

      // Peek again - should be same
      const peek2 = await peekSlidingWindowRateLimit({ key: 'peek-check', limit: 5, windowMs: 60_000 });
      expect(peek2.current).toBe(1);
    });
  });

  describe('Key helpers', () => {
    it('buildWorkspaceRateLimitKey', () => {
      const key = buildWorkspaceRateLimitKey('ws-1', 'content:publish');
      expect(key).toBe('sw:ws:ws-1:content:publish');
    });

    it('buildUserRateLimitKey', () => {
      const key = buildUserRateLimitKey('user-1', 'ai:chat');
      expect(key).toBe('sw:user:user-1:ai:chat');
    });

    it('buildWorkspaceUserRateLimitKey', () => {
      const key = buildWorkspaceUserRateLimitKey('ws-1', 'user-1', 'task:execute');
      expect(key).toBe('sw:ws:ws-1:user:user-1:task:execute');
    });

    it('buildIpRateLimitKey', () => {
      const key = buildIpRateLimitKey('127.0.0.1', 'auth:login');
      expect(key).toBe('sw:ip:127.0.0.1:auth:login');
    });
  });

  describe('checkWorkspaceRateLimit / checkUserRateLimit', () => {
    it('checkWorkspaceRateLimit uses defaults', async () => {
      const result = await checkWorkspaceRateLimit('ws-1', 'content:publish');
      expect(result.allowed).toBe(true);
    });

    it('checkUserRateLimit uses defaults', async () => {
      const result = await checkUserRateLimit('user-1', 'ai:chat');
      expect(result.allowed).toBe(true);
    });

    it('checkWorkspaceUserRateLimit combines both', async () => {
      const result = await checkWorkspaceUserRateLimit('ws-1', 'user-1', 'task:execute');
      expect(result.allowed).toBe(true);
    });

    it('allows overriding limit and window', async () => {
      const result = await checkUserRateLimit('user-1', 'ai:chat', { limit: 1, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1);

      // Second should be blocked
      const blocked = await checkUserRateLimit('user-1', 'ai:chat', { limit: 1, windowMs: 60_000 });
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('RATE_LIMIT_ACTIONS and DEFAULT_RATE_LIMITS', () => {
    it('has defaults for all actions', () => {
      for (const action of Object.values(RATE_LIMIT_ACTIONS)) {
        expect(DEFAULT_RATE_LIMITS[action]).toBeDefined();
        expect(DEFAULT_RATE_LIMITS[action].limit).toBeGreaterThan(0);
        expect(DEFAULT_RATE_LIMITS[action].windowMs).toBeGreaterThan(0);
      }
    });
  });

  describe('SlidingWindowRateLimitError', () => {
    it('has correct properties', () => {
      const result = {
        allowed: false,
        current: 5,
        limit: 5,
        windowMs: 60_000,
        windowStart: Date.now() - 10_000,
        windowEnd: Date.now() + 50_000,
        remaining: 0,
        resetInMs: 50_000,
      };

      const err = new SlidingWindowRateLimitError('test-key', result);
      expect(err.name).toBe('SlidingWindowRateLimitError');
      expect(err.key).toBe('test-key');
      expect(err.result.limit).toBe(5);
      expect(err.message).toContain('test-key');
      expect(err.message).toContain('5/5');
    });
  });
});
