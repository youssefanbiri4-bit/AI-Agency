/**
 * W9-VER-T2 — Circuit Breaker live verification
 *
 * Verifies CLOSED/OPEN/HALF_OPEN state transitions, the OPEN/HALF_OPEN
 * logging callbacks, recovery to CLOSED, and that `withCircuitBreaker`
 * fast-fails while OPEN. The logger is mocked so we can assert on the
 * `Circuit OPEN` / `Circuit HALF_OPEN` log lines produced by the breaker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const log = {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => log,
  };
  return { log };
});

vi.mock('@/lib/logger', () => ({
  logger: { ...h.log, child: () => h.log },
}));

import { logger } from '@/lib/logger';
import {
  checkCircuit,
  getAllCircuitStates,
  getCircuitState,
  recordCircuitFailure,
  recordCircuitSuccess,
  registerCircuitBreaker,
  registerDefaultCircuitBreakers,
  resetCircuit,
  withCircuitBreaker,
  CircuitBreakerOpenError,
} from '@/lib/circuit-breaker';

const PROVIDER = 'verify-cb';

beforeEach(() => {
  h.log.warn.mockClear();
  h.log.info.mockClear();
  h.log.error.mockClear();

  // Register a breaker with tiny thresholds/cooldown so transitions are fast.
  registerCircuitBreaker({
    name: PROVIDER,
    failureThreshold: 2,
    successThreshold: 1,
    cooldownMs: 50,
    halfOpenMaxRequests: 1,
    onOpen: (n, count) =>
      logger.child('circuit-breaker').warn('Circuit OPEN', { provider: n, failureCount: count }),
    onHalfOpen: (n) =>
      logger.child('circuit-breaker').info('Circuit HALF_OPEN', { provider: n }),
    onClose: (n) =>
      logger.child('circuit-breaker').info('Circuit CLOSED', { provider: n }),
  });
});

afterEach(() => {
  resetCircuit(PROVIDER);
});

describe('Circuit Breaker — state machine', () => {
  it('allows requests when CLOSED (fresh circuit)', () => {
    const result = checkCircuit(PROVIDER);
    expect(result.allowed).toBe(true);
    expect(result.state).toBe('CLOSED');
    expect(getCircuitState(PROVIDER)?.state).toBe('CLOSED');
  });

  it('trips to OPEN after reaching the failure threshold and logs OPEN', () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);

    expect(getCircuitState(PROVIDER)?.state).toBe('OPEN');
    expect(h.log.warn).toHaveBeenCalledWith(
      'Circuit OPEN',
      expect.objectContaining({ provider: PROVIDER, failureCount: 2 }),
    );
  });

  it('blocks requests while OPEN and reports a remaining cooldown', () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);

    const result = checkCircuit(PROVIDER);
    expect(result.allowed).toBe(false);
    expect(result.state).toBe('OPEN');
    expect(result.cooldownRemainingMs).toBeGreaterThan(0);
  });

  it('transitions to HALF_OPEN after cooldown elapses and logs HALF_OPEN', async () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);
    expect(getCircuitState(PROVIDER)?.state).toBe('OPEN');

    await new Promise((resolve) => setTimeout(resolve, 70));

    const result = checkCircuit(PROVIDER);
    expect(result.allowed).toBe(true);
    expect(result.state).toBe('HALF_OPEN');
    expect(h.log.info).toHaveBeenCalledWith(
      'Circuit HALF_OPEN',
      expect.objectContaining({ provider: PROVIDER }),
    );
  });

  it('recovers to CLOSED after success threshold in HALF_OPEN and logs CLOSED', async () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);
    await new Promise((resolve) => setTimeout(resolve, 70));
    checkCircuit(PROVIDER); // -> HALF_OPEN

    recordCircuitSuccess(PROVIDER); // successThreshold = 1

    expect(getCircuitState(PROVIDER)?.state).toBe('CLOSED');
    expect(h.log.info).toHaveBeenCalledWith(
      'Circuit CLOSED',
      expect.objectContaining({ provider: PROVIDER }),
    );
  });

  it('withCircuitBreaker throws CircuitBreakerOpenError while OPEN', async () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);

    await expect(withCircuitBreaker(PROVIDER, async () => 'ok')).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
  });

  it('withCircuitBreaker executes and records success while CLOSED', async () => {
    const value = await withCircuitBreaker(PROVIDER, async () => 42);
    expect(value).toBe(42);
    expect(getCircuitState(PROVIDER)?.totalSuccesses).toBe(1);
  });

  it('exposes state via getAllCircuitStates', () => {
    recordCircuitFailure(PROVIDER);
    recordCircuitFailure(PROVIDER);
    const all = getAllCircuitStates();
    expect(all[PROVIDER]).toBeDefined();
    expect(all[PROVIDER].state).toBe('OPEN');
  });
});

describe('Circuit Breaker — default provider logging', () => {
  it('logs Circuit OPEN for a real default provider (openai-image)', () => {
    registerDefaultCircuitBreakers();
    // openai-image has failureThreshold: 3
    recordCircuitFailure('openai-image');
    recordCircuitFailure('openai-image');
    recordCircuitFailure('openai-image');

    expect(h.log.warn).toHaveBeenCalledWith(
      'Circuit OPEN',
      expect.objectContaining({ provider: 'openai-image' }),
    );
    resetCircuit('openai-image');
  });
});
