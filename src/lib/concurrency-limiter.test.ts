import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryConcurrencyStore,
  withConcurrencyLimit,
  ConcurrencyLimitError,
  CONCURRENCY_SLOTS,
  DEFAULT_MAX_CONCURRENCY,
  setConcurrencyStore,
} from './concurrency-limiter';

describe('Concurrency Limiter', () => {
  let store: InMemoryConcurrencyStore;

  beforeEach(() => {
    store = new InMemoryConcurrencyStore();
    setConcurrencyStore(store);
  });

  describe('InMemoryConcurrencyStore', () => {
    it('allows acquiring a slot when under the limit', () => {
      const result = store.tryAcquire('test-slot', 5);
      expect(result.acquired).toBe(true);
      expect(result.activeCount).toBe(1);
      expect(result.release).toBeInstanceOf(Function);
    });

    it('rejects acquiring a slot when at the limit', () => {
      // Fill all 2 slots
      const r1 = store.tryAcquire('test-slot', 2);
      const r2 = store.tryAcquire('test-slot', 2);
      expect(r1.acquired).toBe(true);
      expect(r2.acquired).toBe(true);

      // Third should fail
      const r3 = store.tryAcquire('test-slot', 2);
      expect(r3.acquired).toBe(false);
      expect(r3.release).toBeNull();
      expect(r3.activeCount).toBe(2);
    });

    it('releases a slot and allows queued requests', async () => {
      const r1 = store.tryAcquire('test-slot', 1);
      expect(r1.acquired).toBe(true);

      // Second should not acquire immediately
      const r2 = store.tryAcquire('test-slot', 1);
      expect(r2.acquired).toBe(false);

      // Release first slot
      r1.release!();

      // Now second should be able to acquire
      const r3 = store.tryAcquire('test-slot', 1);
      expect(r3.acquired).toBe(true);
    });

    it('tracks active count correctly after multiple acquire/release cycles', () => {
      const r1 = store.tryAcquire('test-slot', 3);
      const r2 = store.tryAcquire('test-slot', 3);
      expect(store.getActiveCount('test-slot')).toBe(2);

      r1.release!();
      expect(store.getActiveCount('test-slot')).toBe(1);

      r2.release!();
      expect(store.getActiveCount('test-slot')).toBe(0);
    });

    it('acquire waits asynchronously when slots are full', async () => {
      const r1 = store.tryAcquire('wait-slot', 1);
      expect(r1.acquired).toBe(true);

      // Start async acquire (will wait)
      const acquirePromise = store.acquire('wait-slot', 1, 5000);

      // Release after short delay
      setTimeout(() => r1.release!(), 100);

      const result = await acquirePromise;
      expect(result.acquired).toBe(true);
      result.release!();
    });

    it('acquire times out when no slot becomes available', async () => {
      const r1 = store.tryAcquire('timeout-slot', 1);
      expect(r1.acquired).toBe(true);

      const result = await store.acquire('timeout-slot', 1, 200);
      expect(result.acquired).toBe(false);
    });

    it('getAllSlots returns correct data', () => {
      store.tryAcquire('slot-a', 5);
      store.tryAcquire('slot-a', 5);
      store.tryAcquire('slot-b', 3);

      const all = store.getAllSlots();
      expect(all['slot-a']?.active).toBe(2);
      expect(all['slot-b']?.active).toBe(1);
    });

    it('resets all state', () => {
      store.tryAcquire('slot-a', 5);
      store.tryAcquire('slot-b', 3);
      store.reset();

      expect(store.getActiveCount('slot-a')).toBe(0);
      expect(store.getActiveCount('slot-b')).toBe(0);
      expect(Object.keys(store.getAllSlots())).toHaveLength(0);
    });

    it('handles 0 maxConcurrency gracefully', () => {
      const result = store.tryAcquire('zero-slot', 0);
      expect(result.acquired).toBe(false);
    });
  });

  describe('withConcurrencyLimit', () => {
    it('executes the function when a slot is available', async () => {
      const result = await withConcurrencyLimit('test-slot', async () => {
        return 'success';
      }, { maxConcurrency: 5 });
      expect(result).toBe('success');
    });

    it('throws ConcurrencyLimitError when slots are full (failOnQueue = true)', async () => {
      // Fill the slot
      const r1 = store.tryAcquire('test-slot', 2);
      const r2 = store.tryAcquire('test-slot', 2);
      expect(r1.acquired).toBe(true);
      expect(r2.acquired).toBe(true);

      await expect(
        withConcurrencyLimit('test-slot', async () => 'should not run', { maxConcurrency: 2 })
      ).rejects.toThrow(ConcurrencyLimitError);
    });

    it('releases slot after function success', async () => {
      await withConcurrencyLimit('test-slot', async () => 'ok', { maxConcurrency: 3 });
      expect(store.getActiveCount('test-slot')).toBe(0);
    });

    it('releases slot after function failure', async () => {
      await expect(
        withConcurrencyLimit('test-slot', async () => { throw new Error('boom'); }, { maxConcurrency: 3 })
      ).rejects.toThrow('boom');
      expect(store.getActiveCount('test-slot')).toBe(0);
    });

    it('uses default max concurrency from config', async () => {
      const result = await withConcurrencyLimit(CONCURRENCY_SLOTS.AI_GENERATION, async () => 'default');
      expect(result).toBe('default');
    });
  });

  describe('DEFAULT_MAX_CONCURRENCY', () => {
    it('has reasonable defaults for all slots', () => {
      expect(DEFAULT_MAX_CONCURRENCY[CONCURRENCY_SLOTS.AI_GENERATION]).toBeGreaterThan(0);
      expect(DEFAULT_MAX_CONCURRENCY[CONCURRENCY_SLOTS.PDF_GENERATION]).toBeGreaterThan(0);
      expect(DEFAULT_MAX_CONCURRENCY[CONCURRENCY_SLOTS.BULK_OPERATION]).toBe(1);
      expect(DEFAULT_MAX_CONCURRENCY[CONCURRENCY_SLOTS.CONTENT_PUBLISH]).toBeGreaterThan(0);
    });
  });

  describe('ConcurrencyLimitError', () => {
    it('has correct properties', () => {
      const err = new ConcurrencyLimitError('test-slot', 5, 10, 2000);
      expect(err.name).toBe('ConcurrencyLimitError');
      expect(err.slotName).toBe('test-slot');
      expect(err.activeCount).toBe(5);
      expect(err.maxConcurrency).toBe(10);
      expect(err.estimatedWaitMs).toBe(2000);
      expect(err.message).toContain('test-slot');
    });
  });
});
