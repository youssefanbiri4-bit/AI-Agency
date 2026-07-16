import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InMemoryCircuitBreakerStore,
  checkCircuit,
  recordCircuitSuccess,
  recordCircuitFailure,
  withCircuitBreaker,
  resetCircuit,
  getCircuitState,
  getAllCircuitStates,
  registerCircuitBreaker,
  CircuitBreakerOpenError,
  CIRCUIT_BREAKER_PROVIDERS,
  setCircuitBreakerStore,
} from './circuit-breaker';

describe('Circuit Breaker', () => {
  let store: InMemoryCircuitBreakerStore;

  beforeEach(() => {
    store = new InMemoryCircuitBreakerStore();
    store.clear();
    setCircuitBreakerStore(store);
    // Re-register defaults after clearing store
    registerCircuitBreaker({
      name: 'test-provider',
      failureThreshold: 3,
      successThreshold: 2,
      cooldownMs: 100_000, // Long cooldown for deterministic tests
      halfOpenMaxRequests: 1,
    });
  });

  describe('InMemoryCircuitBreakerStore', () => {
    it('starts with no state for unknown circuits', () => {
      const state = store.getState('unknown');
      expect(state).toBeNull();
    });

    it('records failures and tracks count', () => {
      const state1 = store.recordFailure('test-circ');
      expect(state1.failureCount).toBe(1);
      expect(state1.totalFailures).toBe(1);
      expect(state1.state).toBe('CLOSED');

      const state2 = store.recordFailure('test-circ');
      expect(state2.failureCount).toBe(2);
    });

    it('records successes and resets failure count in CLOSED state', () => {
      store.recordFailure('test-circ');
      store.recordFailure('test-circ');

      const success = store.recordSuccess('test-circ');
      expect(success.successCount).toBe(1);
      expect(success.failureCount).toBe(0); // Reset on success in CLOSED
    });

    it('resets circuit state', () => {
      store.recordFailure('test-circ');
      expect(store.getState('test-circ')).not.toBeNull();

      store.reset('test-circ');
      expect(store.getState('test-circ')).toBeNull();
    });

    it('clears all state', () => {
      store.recordFailure('circ-a');
      store.recordFailure('circ-b');
      store.clear();
      expect(Object.keys(store.getAll())).toHaveLength(0);
    });
  });

  describe('checkCircuit', () => {
    it('allows requests when circuit is CLOSED', () => {
      const result = checkCircuit('test-provider');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });

    it('allows requests when circuit is fresh (no state)', () => {
      const result = checkCircuit('unknown-circuit');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });

    it('blocks requests when circuit is OPEN', () => {
      // Trip the circuit
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider'); // Should trip at 3

      const result = checkCircuit('test-provider');
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('OPEN');
      expect(result.cooldownRemainingMs).toBeGreaterThan(0);
    });

    it('allows probe request when cooldown elapses (HALF_OPEN)', () => {
      // Register with very short cooldown for testing
      registerCircuitBreaker({
        name: 'fast-cooldown',
        failureThreshold: 2,
        successThreshold: 1,
        cooldownMs: 50,
        halfOpenMaxRequests: 1,
      });

      recordCircuitFailure('fast-cooldown');
      recordCircuitFailure('fast-cooldown');

      // Circuit should be OPEN
      const openResult = checkCircuit('fast-cooldown');
      expect(openResult.state).toBe('OPEN');

      // Wait for cooldown
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const halfOpenResult = checkCircuit('fast-cooldown');
          expect(halfOpenResult.allowed).toBe(true);
          expect(halfOpenResult.state).toBe('HALF_OPEN');
          resolve();
        }, 60);
      });
    });

    it('limits probe requests in HALF_OPEN state', () => {
      registerCircuitBreaker({
        name: 'probe-limit',
        failureThreshold: 1,
        successThreshold: 1,
        cooldownMs: 50,
        halfOpenMaxRequests: 1,
      });

      recordCircuitFailure('probe-limit');

      // Wait for cooldown then acquire probe slot
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const first = checkCircuit('probe-limit');
          expect(first.allowed).toBe(true);
          expect(first.state).toBe('HALF_OPEN');

          // Second probe should be blocked (still HALF_OPEN state, but probe slot full)
          const second = checkCircuit('probe-limit');
          expect(second.allowed).toBe(false);
          expect(second.state).toBe('HALF_OPEN');
          resolve();
        }, 60);
      });
    });
  });

  describe('recordCircuitSuccess', () => {
    it('closes circuit after threshold successes in HALF_OPEN', () => {
      registerCircuitBreaker({
        name: 'half-open-close',
        failureThreshold: 1,
        successThreshold: 2,
        cooldownMs: 50,
        halfOpenMaxRequests: 2,
      });

      recordCircuitFailure('half-open-close');

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          // First probe — enters HALF_OPEN
          const probe1 = checkCircuit('half-open-close');
          expect(probe1.state).toBe('HALF_OPEN');
          expect(probe1.allowed).toBe(true);
          recordCircuitSuccess('half-open-close');

          // Second probe — still HALF_OPEN
          const probe2 = checkCircuit('half-open-close');
          expect(probe2.state).toBe('HALF_OPEN');
          expect(probe2.allowed).toBe(true);
          recordCircuitSuccess('half-open-close');

          // Now should be CLOSED
          const state = getCircuitState('half-open-close');
          expect(state?.state).toBe('CLOSED');
          resolve();
        }, 60);
      });
    });
  });

  describe('recordCircuitFailure', () => {
    it('trips to OPEN when failure threshold is reached', () => {
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');

      const state = getCircuitState('test-provider');
      expect(state?.state).toBe('OPEN');
    });

    it('re-opens circuit on failure in HALF_OPEN', () => {
      registerCircuitBreaker({
        name: 'reopen-on-half-fail',
        failureThreshold: 1,
        successThreshold: 1,
        cooldownMs: 50,
        halfOpenMaxRequests: 1,
      });

      recordCircuitFailure('reopen-on-half-fail');

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          const probe = checkCircuit('reopen-on-half-fail');
          expect(probe.state).toBe('HALF_OPEN');

          // Failure in HALF_OPEN → back to OPEN
          recordCircuitFailure('reopen-on-half-fail');
          const state = getCircuitState('reopen-on-half-fail');
          expect(state?.state).toBe('OPEN');
          resolve();
        }, 60);
      });
    });

    it('fires onOpen callback when circuit opens', () => {
      const onOpen = vi.fn();
      registerCircuitBreaker({
        name: 'on-open-cb',
        failureThreshold: 2,
        onOpen,
      });

      recordCircuitFailure('on-open-cb');
      expect(onOpen).not.toHaveBeenCalled();

      recordCircuitFailure('on-open-cb'); // Should trip
      expect(onOpen).toHaveBeenCalledWith('on-open-cb', 2);
    });

    it('fires onFailure callback on each failure', () => {
      const onFailure = vi.fn();
      registerCircuitBreaker({
        name: 'on-failure-cb',
        failureThreshold: 5,
        onFailure,
      });

      recordCircuitFailure('on-failure-cb', new Error('e1'));
      recordCircuitFailure('on-failure-cb', new Error('e2'));

      expect(onFailure).toHaveBeenCalledTimes(2);
    });
  });

  describe('withCircuitBreaker', () => {
    it('executes function when circuit is CLOSED', async () => {
      const result = await withCircuitBreaker('test-provider', async () => 'ok');
      expect(result).toBe('ok');
    });

    it('throws CircuitBreakerOpenError when circuit is OPEN', async () => {
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');

      await expect(
        withCircuitBreaker('test-provider', async () => 'should not run')
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('records success after successful execution', async () => {
      await withCircuitBreaker('test-provider', async () => 'ok');
      const state = getCircuitState('test-provider');
      expect(state?.totalSuccesses).toBe(1);
    });

    it('records failure after failed execution', async () => {
      await expect(
        withCircuitBreaker('test-provider', async () => { throw new Error('boom'); })
      ).rejects.toThrow('boom');

      const state = getCircuitState('test-provider');
      expect(state?.totalFailures).toBe(1);
    });

    it('respects custom isFailure classifier', async () => {
      const isFailure = vi.fn().mockReturnValue(false);

      await expect(
        withCircuitBreaker('test-provider', async () => { throw new Error('ignore-me'); }, { isFailure })
      ).rejects.toThrow('ignore-me');

      const state = getCircuitState('test-provider');
      expect(state?.totalFailures).toBe(0); // Not counted as failure
      expect(isFailure).toHaveBeenCalled();
    });
  });

  describe('resetCircuit', () => {
    it('resets circuit back to CLOSED state', () => {
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');
      recordCircuitFailure('test-provider');

      resetCircuit('test-provider');

      const result = checkCircuit('test-provider');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('CLOSED');
    });
  });

  describe('getCircuitState / getAllCircuitStates', () => {
    it('returns null for unregistered circuits', () => {
      expect(getCircuitState('does-not-exist')).toBeNull();
    });

    it('returns state for registered circuits', () => {
      recordCircuitFailure('test-provider');
      const state = getCircuitState('test-provider');
      expect(state).not.toBeNull();
      expect(state?.state).toBe('CLOSED');
      expect(state?.totalFailures).toBe(1);
    });

    it('getAllCircuitStates returns all circuits', () => {
      registerCircuitBreaker({ name: 'circ-a' });
      registerCircuitBreaker({ name: 'circ-b' });
      recordCircuitFailure('circ-a');

      const all = getAllCircuitStates();
      expect(all['circ-a']).toBeDefined();
      expect(all['circ-b']).toBeDefined();
    });
  });
});
