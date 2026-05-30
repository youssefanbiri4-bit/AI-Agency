import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, InMemoryRateLimitStore } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset any state between tests
  });

  describe('InMemoryRateLimitStore', () => {
    it('should allow requests within limit', () => {
      const store = new InMemoryRateLimitStore();

      const result1 = store.check({
        key: 'user-123',
        limit: 10,
        windowMs: 60000,
      });

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);

      const result2 = store.check({
        key: 'user-123',
        limit: 10,
        windowMs: 60000,
      });

      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8);
    });

    it('should reject requests exceeding limit', () => {
      const store = new InMemoryRateLimitStore();

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        store.check({
          key: 'user-456',
          limit: 10,
          windowMs: 60000,
        });
      }

      // 11th request should be rejected
      const result = store.check({
        key: 'user-456',
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const store = new InMemoryRateLimitStore();
      const windowMs = 100; // 100ms window

      const result1 = store.check({
        key: 'user-789',
        limit: 1,
        windowMs,
      });

      expect(result1.allowed).toBe(true);

      // Second request should be rejected
      const result2 = store.check({
        key: 'user-789',
        limit: 1,
        windowMs,
      });

      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

      const result3 = store.check({
        key: 'user-789',
        limit: 1,
        windowMs,
      });

      expect(result3.allowed).toBe(true);
    });

    it('should track different keys separately', () => {
      const store = new InMemoryRateLimitStore();

      const result1 = store.check({
        key: 'user-a',
        limit: 2,
        windowMs: 60000,
      });

      const result2 = store.check({
        key: 'user-b',
        limit: 2,
        windowMs: 60000,
      });

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.remaining).toBe(1);
      expect(result2.remaining).toBe(1);
    });

    it('should handle burst traffic', () => {
      const store = new InMemoryRateLimitStore();
      const limit = 100;
      const results = [];

      for (let i = 0; i < limit + 10; i++) {
        const result = store.check({
          key: 'burst-user',
          limit,
          windowMs: 60000,
        });
        results.push(result.allowed);
      }

      const allowedCount = results.filter((allowed) => allowed).length;
      expect(allowedCount).toBe(limit);

      // Remaining requests should be rejected
      const rejectedCount = results.filter((allowed) => !allowed).length;
      expect(rejectedCount).toBe(10);
    });
  });

  describe('checkRateLimit', () => {
    it('should provide rate limiting interface', async () => {
      const result = await checkRateLimit({
        key: 'test-key',
        limit: 5,
        windowMs: 60000,
      });

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetAt');
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.resetAt).toBe('number');
    });
  });
});
