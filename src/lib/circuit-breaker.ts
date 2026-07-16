// SPDX-License-Identifier: MIT
// AgentFlow-AI — Circuit Breaker
// W9-PERF-T2: Failure threshold + half-open + recovery for external providers

if (typeof window !== 'undefined') {
  throw new Error('circuit-breaker.ts can only be used on the server');
}

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

/**
 * Circuit breaker states.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuration for a circuit breaker instance.
 */
export interface CircuitBreakerConfig {
  /** Provider/service name for identification */
  name: string;

  /** Number of consecutive failures to trip the circuit (default: 5) */
  failureThreshold?: number;

  /** Number of consecutive successes in HALF_OPEN to close the circuit (default: 3) */
  successThreshold?: number;

  /** Cooldown period in ms before moving from OPEN to HALF_OPEN (default: 30_000) */
  cooldownMs?: number;

  /** Max requests allowed in HALF_OPEN state (default: 1) */
  halfOpenMaxRequests?: number;

  /** Optional timeout in ms for the operation (default: 10_000) */
  timeoutMs?: number;

  /** Callback when circuit opens */
  onOpen?: (name: string, failureCount: number) => void;

  /** Callback when circuit half-opens */
  onHalfOpen?: (name: string) => void;

  /** Callback when circuit closes */
  onClose?: (name: string) => void;

  /** Callback on each failure */
  onFailure?: (name: string, error: Error, failureCount: number) => void;
}

/**
 * Circuit breaker state snapshot (for monitoring/observability).
 */
export interface CircuitBreakerState {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  halfOpenAt: number | null;
  closedAt: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Result of a circuit breaker check.
 */
export interface CircuitBreakerResult {
  /** Whether the request is allowed to proceed */
  allowed: boolean;
  /** Current circuit state */
  state: CircuitState;
  /** Remaining cooldown in ms (0 if allowed) */
  cooldownRemainingMs: number;
  /** Human-readable message */
  message: string;
}

/**
 * Circuit breaker store interface.
 * Implement this for persistent/Redis-backed storage.
 */
export interface CircuitBreakerStore {
  /** Get current state and counters for a circuit */
  getState(name: string): CircuitBreakerInternalState | null;

  /** Set the full state for a circuit */
  setState(name: string, state: CircuitBreakerInternalState): void;

  /** Record a failure for a circuit */
  recordFailure(name: string): CircuitBreakerInternalState;

  /** Record a success for a circuit */
  recordSuccess(name: string): CircuitBreakerInternalState;

  /** Reset a circuit back to CLOSED */
  reset(name: string): void;

  /** Get all circuit states */
  getAll(): Record<string, CircuitBreakerInternalState>;

  /** Clear all states (for testing) */
  clear(): void;
}

/**
 * Internal circuit breaker state stored in the store.
 * Includes threshold values so the store can make state transition decisions
 * without needing an external config reference.
 */
export interface CircuitBreakerInternalState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  halfOpenAt: number | null;
  closedAt: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  failureThreshold: number;
  successThreshold: number;
  cooldownMs: number;
  halfOpenMaxRequests: number;
  timeoutMs: number;
}

/**
 * In-memory circuit breaker store.
 */
export class InMemoryCircuitBreakerStore implements CircuitBreakerStore {
  private circuits = new Map<string, CircuitBreakerInternalState>();

  getState(name: string): CircuitBreakerInternalState | null {
    return this.circuits.get(name) ?? null;
  }

  setState(name: string, state: CircuitBreakerInternalState): void {
    this.circuits.set(name, { ...state });
  }

  recordFailure(name: string): CircuitBreakerInternalState {
    const current = this.circuits.get(name);
    if (!current) {
      const initial = this.createInitialState();
      return this.recordFailureInner(name, initial);
    }
    return this.recordFailureInner(name, current);
  }

  private recordFailureInner(name: string, current: CircuitBreakerInternalState): CircuitBreakerInternalState {
    const updated: CircuitBreakerInternalState = {
      ...current,
      failureCount: current.failureCount + 1,
      lastFailureAt: Date.now(),
      totalFailures: current.totalFailures + 1,
      totalRequests: current.totalRequests + 1,
    };

    // If failure threshold reached, trip to OPEN
    if (updated.state === 'CLOSED' && updated.failureCount >= updated.failureThreshold) {
      updated.state = 'OPEN';
      updated.openedAt = Date.now();
      updated.halfOpenAt = null;
    }

    // If in HALF_OPEN and a failure occurs, go back to OPEN
    if (updated.state === 'HALF_OPEN') {
      updated.state = 'OPEN';
      updated.openedAt = Date.now();
      updated.halfOpenAt = null;
      updated.successCount = 0;
    }

    this.circuits.set(name, updated);
    return updated;
  }

  recordSuccess(name: string): CircuitBreakerInternalState {
    const current = this.circuits.get(name);
    if (!current) {
      const initial = this.createInitialState();
      return this.recordSuccessInner(name, initial);
    }
    return this.recordSuccessInner(name, current);
  }

  private recordSuccessInner(name: string, current: CircuitBreakerInternalState): CircuitBreakerInternalState {
    const updated: CircuitBreakerInternalState = {
      ...current,
      successCount: current.successCount + 1,
      lastSuccessAt: Date.now(),
      totalSuccesses: current.totalSuccesses + 1,
      totalRequests: current.totalRequests + 1,
      failureCount: current.state === 'CLOSED' ? 0 : current.failureCount,
    };

    // If in HALF_OPEN and success threshold reached, close the circuit
    if (updated.state === 'HALF_OPEN' && updated.successCount >= updated.successThreshold) {
      updated.state = 'CLOSED';
      updated.closedAt = Date.now();
      updated.failureCount = 0;
      updated.successCount = 0;
    }

    this.circuits.set(name, updated);
    return updated;
  }

  reset(name: string): void {
    this.circuits.delete(name);
  }

  getAll(): Record<string, CircuitBreakerInternalState> {
    const all: Record<string, CircuitBreakerInternalState> = {};
    for (const [name, state] of this.circuits) {
      all[name] = { ...state };
    }
    return all;
  }

  clear(): void {
    this.circuits.clear();
  }

  private createInitialState(): CircuitBreakerInternalState {
    return {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      openedAt: null,
      halfOpenAt: null,
      closedAt: null,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      failureThreshold: 5,
      successThreshold: 3,
      cooldownMs: 30_000,
      halfOpenMaxRequests: 1,
      timeoutMs: 10_000,
    };
  }
}

function createProgrammaticState(config: CircuitBreakerConfig): CircuitBreakerInternalState {
  return {
    state: 'CLOSED',
    failureCount: 0,
    successCount: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    openedAt: null,
    halfOpenAt: null,
    closedAt: null,
    totalRequests: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    failureThreshold: config.failureThreshold ?? 5,
    successThreshold: config.successThreshold ?? 3,
    cooldownMs: config.cooldownMs ?? 30_000,
    halfOpenMaxRequests: config.halfOpenMaxRequests ?? 1,
    timeoutMs: config.timeoutMs ?? 10_000,
  };
}

// ─── Redis-backed circuit breaker store ───────────────────────────────────────

/**
 * Redis-backed circuit breaker store.
 *
 * Uses a sync-in-memory pattern for the existing synchronous CircuitBreakerStore
 * interface. All operations update the in-memory store synchronously, and
 * asynchronously sync to Redis as a side-effect for cross-instance persistence.
 *
 * This ensures the existing circuit-breaker.ts code (checkCircuit, recordFailure,
 * etc.) works without modification — they never need to `await` store calls.
 *
 * State stored in Redis HASH with key `agentflow:cb:{name}`.
 * Falls back to in-memory only if getRedisClient() returns null.
 */
export class RedisCircuitBreakerStore implements CircuitBreakerStore {
  private mem: InMemoryCircuitBreakerStore;
  private redisInit = false;
  private redisAvailable = false;
  private client: import('ioredis').Redis | null = null;

  constructor() {
    this.mem = new InMemoryCircuitBreakerStore();
    // Warm up Redis connection asynchronously
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    if (this.redisInit) return;
    this.redisInit = true;
    try {
      this.client = await getRedisClient();
      this.redisAvailable = this.client !== null;
    } catch {
      this.redisAvailable = false;
    }
  }

  private redisKey(name: string): string {
    return `agentflow:cb:${name}`;
  }

  private toHash(state: CircuitBreakerInternalState): Record<string, string> {
    return {
      state: state.state,
      failureCount: String(state.failureCount),
      successCount: String(state.successCount),
      lastFailureAt: state.lastFailureAt !== null ? String(state.lastFailureAt) : '',
      lastSuccessAt: state.lastSuccessAt !== null ? String(state.lastSuccessAt) : '',
      openedAt: state.openedAt !== null ? String(state.openedAt) : '',
      halfOpenAt: state.halfOpenAt !== null ? String(state.halfOpenAt) : '',
      closedAt: state.closedAt !== null ? String(state.closedAt) : '',
      totalRequests: String(state.totalRequests),
      totalFailures: String(state.totalFailures),
      totalSuccesses: String(state.totalSuccesses),
      failureThreshold: String(state.failureThreshold),
      successThreshold: String(state.successThreshold),
      cooldownMs: String(state.cooldownMs),
      halfOpenMaxRequests: String(state.halfOpenMaxRequests),
      timeoutMs: String(state.timeoutMs),
    };
  }

  /** Sync the in-memory state to Redis asynchronously (fire-and-forget). */
  private syncToRedis(name: string): void {
    if (!this.redisAvailable || !this.client) return;
    const state = this.mem.getState(name);
    if (!state) {
      this.client.del(this.redisKey(name)).catch(() => {});
      return;
    }
    this.client.hset(this.redisKey(name), this.toHash(state)).catch(() => {});
  }

  getState(name: string): CircuitBreakerInternalState | null {
    return this.mem.getState(name);
  }

  setState(name: string, state: CircuitBreakerInternalState): void {
    this.mem.setState(name, state);
    this.syncToRedis(name);
  }

  recordFailure(name: string): CircuitBreakerInternalState {
    const updated = this.mem.recordFailure(name);
    this.syncToRedis(name);
    return updated;
  }

  recordSuccess(name: string): CircuitBreakerInternalState {
    const updated = this.mem.recordSuccess(name);
    this.syncToRedis(name);
    return updated;
  }

  reset(name: string): void {
    this.mem.reset(name);
    if (this.redisAvailable && this.client) {
      this.client.del(this.redisKey(name)).catch(() => {});
    }
  }

  getAll(): Record<string, CircuitBreakerInternalState> {
    return this.mem.getAll();
  }

  clear(): void {
    this.mem.clear();
    // Async clear all Redis keys
    if (this.redisAvailable && this.client) {
      this.clearRedisKeys();
    }
  }

  private async clearRedisKeys(): Promise<void> {
    if (!this.client) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', 'agentflow:cb:*', 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // ignore async clear errors
    }
  }
}

// ─── Global Registry ─────────────────────────────────────────────────────────

let defaultStore: CircuitBreakerStore | null = null;
let activeStore: CircuitBreakerStore | null = null;
const circuitConfigs = new Map<string, CircuitBreakerConfig>();
const halfOpenRequestsInFlight = new Map<string, number>();

export function setCircuitBreakerStore(store: CircuitBreakerStore): void {
  activeStore = store;
}

export function getCircuitBreakerStore(): CircuitBreakerStore {
  if (activeStore) return activeStore;
  if (!defaultStore) {
    const host = process.env.REDIS_HOST?.trim();
    if (host) {
      defaultStore = new RedisCircuitBreakerStore();
    } else {
      defaultStore = new InMemoryCircuitBreakerStore();
    }
  }
  return defaultStore;
}

// ─── Provider Names ──────────────────────────────────────────────────────────

export const CIRCUIT_BREAKER_PROVIDERS = {
  OPENAI_TEXT: 'openai-text',
  OPENAI_IMAGE: 'openai-image',
  OPENAI_VIDEO: 'openai-video',
  GOOGLE_ADS: 'google-ads',
  GOOGLE_ADS_API: 'google-ads-api',
  META_ADS: 'meta-ads',
  META_API: 'meta-api',
  PINTEREST: 'pinterest',
  N8N: 'n8n',
  N8N_CALLBACK: 'n8n-callback',
  GITHUB: 'github',
  SUPABASE: 'supabase',
} as const;

export type CircuitBreakerProvider = (typeof CIRCUIT_BREAKER_PROVIDERS)[keyof typeof CIRCUIT_BREAKER_PROVIDERS];

// ─── Default configurations ──────────────────────────────────────────────────

const circuitLogger = logger.child('circuit-breaker');

function createDefaultConfig(name: string, overrides: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  return {
    name,
    failureThreshold: 5,
    successThreshold: 3,
    cooldownMs: 30_000,
    halfOpenMaxRequests: 1,
    timeoutMs: 10_000,
    onOpen: (n, count) => circuitLogger.warn('Circuit OPEN', { provider: n, failureCount: count }),
    onHalfOpen: (n) => circuitLogger.info('Circuit HALF_OPEN', { provider: n }),
    ...overrides,
  };
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  [CIRCUIT_BREAKER_PROVIDERS.OPENAI_TEXT]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.OPENAI_TEXT, {
    failureThreshold: 5,
    successThreshold: 3,
    cooldownMs: 30_000,
    timeoutMs: 35_000,
  }),
  [CIRCUIT_BREAKER_PROVIDERS.OPENAI_IMAGE]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.OPENAI_IMAGE, {
    failureThreshold: 3,
    successThreshold: 2,
    cooldownMs: 60_000,
    timeoutMs: 60_000,
  }),
  [CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.GOOGLE_ADS, {
    failureThreshold: 5,
    cooldownMs: 30_000,
    timeoutMs: 15_000,
  }),
  [CIRCUIT_BREAKER_PROVIDERS.N8N]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.N8N, {
    failureThreshold: 5,
    successThreshold: 2,
    cooldownMs: 20_000,
    timeoutMs: 10_000,
  }),
  [CIRCUIT_BREAKER_PROVIDERS.META_API]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.META_API, {
    failureThreshold: 5,
    cooldownMs: 30_000,
    timeoutMs: 15_000,
  }),
  [CIRCUIT_BREAKER_PROVIDERS.PINTEREST]: createDefaultConfig(CIRCUIT_BREAKER_PROVIDERS.PINTEREST, {
    failureThreshold: 5,
    cooldownMs: 30_000,
    timeoutMs: 15_000,
  }),
};

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Register or update a circuit breaker configuration.
 */
export function registerCircuitBreaker(config: CircuitBreakerConfig): void {
  circuitConfigs.set(config.name, config);

  // Initialize state in store if not present
  const store = getCircuitBreakerStore();
  const existing = store.getState(config.name);
  if (!existing) {
    store.setState(config.name, createProgrammaticState(config));
  }
}

/**
 * Get the circuit breaker configuration for a provider.
 * If not registered, registers with defaults.
 */
function getConfig(name: string): CircuitBreakerConfig {
  let config = circuitConfigs.get(name);
  if (!config) {
    config = DEFAULT_CIRCUIT_BREAKER_CONFIGS[name] ?? {
      name,
      failureThreshold: 5,
      successThreshold: 3,
      cooldownMs: 30_000,
      halfOpenMaxRequests: 1,
    };
    registerCircuitBreaker(config);
  }
  return config;
}

/**
 * Check if a request to the given provider is allowed through the circuit breaker.
 */
export function checkCircuit(name: string): CircuitBreakerResult {
  const config = getConfig(name);
  const store = getCircuitBreakerStore();
  const state = store.getState(name);
  const now = Date.now();

  // No state yet — fresh circuit, allow through
  if (!state) {
    return {
      allowed: true,
      state: 'CLOSED',
      cooldownRemainingMs: 0,
      message: `Circuit "${name}" is CLOSED — allowing request.`,
    };
  }

  // CLOSED state: allow all
  if (state.state === 'CLOSED') {
    return {
      allowed: true,
      state: 'CLOSED',
      cooldownRemainingMs: 0,
      message: `Circuit "${name}" is CLOSED — allowing request.`,
    };
  }

  // OPEN state: check if cooldown has elapsed
  if (state.state === 'OPEN') {
    const cooldownMs = state.cooldownMs;
    const openedAt = state.openedAt ?? now;
    const elapsed = now - openedAt;
    const remaining = Math.max(0, cooldownMs - elapsed);

    if (elapsed >= cooldownMs) {
      // Move to HALF_OPEN
      const halfOpenMax = state.halfOpenMaxRequests;
      const inFlight = halfOpenRequestsInFlight.get(name) ?? 0;

      if (inFlight < halfOpenMax) {
        halfOpenRequestsInFlight.set(name, inFlight + 1);
        store.setState(name, {
          ...state,
          state: 'HALF_OPEN',
          halfOpenAt: now,
          successCount: 0,
        });
        config.onHalfOpen?.(name);

        return {
          allowed: true,
          state: 'HALF_OPEN',
          cooldownRemainingMs: 0,
          message: `Circuit "${name}" is HALF_OPEN — allowing probe request.`,
        };
      }

      return {
        allowed: false,
        state: 'OPEN',
        cooldownRemainingMs: 0,
        message: `Circuit "${name}" is OPEN but probe slots are full. Try again shortly.`,
      };
    }

    return {
      allowed: false,
      state: 'OPEN',
      cooldownRemainingMs: remaining,
      message: `Circuit "${name}" is OPEN — fast-failing. Cooldown ${Math.ceil(remaining / 1000)}s remaining.`,
    };
  }

  // HALF_OPEN state: limit requests
  if (state.state === 'HALF_OPEN') {
    const halfOpenMax = state.halfOpenMaxRequests;
    const inFlight = halfOpenRequestsInFlight.get(name) ?? 0;

    if (inFlight < halfOpenMax) {
      halfOpenRequestsInFlight.set(name, inFlight + 1);
      return {
        allowed: true,
        state: 'HALF_OPEN',
        cooldownRemainingMs: 0,
        message: `Circuit "${name}" is HALF_OPEN — allowing limited request.`,
      };
    }

    return {
      allowed: false,
      state: 'HALF_OPEN',
      cooldownRemainingMs: 0,
      message: `Circuit "${name}" is HALF_OPEN — probe request already in flight.`,
    };
  }

  // Fallback: allow
  return {
    allowed: true,
    state: 'CLOSED',
    cooldownRemainingMs: 0,
    message: `Circuit "${name}" — default allow.`,
  };
}

/**
 * Record a successful circuit breaker operation.
 */
export function recordCircuitSuccess(name: string): void {
  const config = getConfig(name);
  const store = getCircuitBreakerStore();
  const state = store.getState(name);

  if (!state) return;

  const updated = store.recordSuccess(name);

  // Release half-open slot if applicable
  const inFlight = halfOpenRequestsInFlight.get(name) ?? 0;
  if (inFlight > 0) {
    halfOpenRequestsInFlight.set(name, Math.max(0, inFlight - 1));
  }

  // Check if we transitioned from HALF_OPEN to CLOSED
  if (state.state === 'HALF_OPEN' && updated.state === 'CLOSED') {
    config.onClose?.(name);
  }
}

/**
 * Record a failed circuit breaker operation.
 */
export function recordCircuitFailure(name: string, error?: Error): void {
  const config = getConfig(name);
  const store = getCircuitBreakerStore();
  const state = store.getState(name);

  if (!state) {
    // Initialize state and record failure
    store.setState(name, createProgrammaticState(config));
  }

  const updated = store.recordFailure(name);

  // Release half-open slot if applicable
  const inFlight = halfOpenRequestsInFlight.get(name) ?? 0;
  if (inFlight > 0) {
    halfOpenRequestsInFlight.set(name, Math.max(0, inFlight - 1));
  }

  // Check if we transitioned from CLOSED to OPEN
  if (state && state.state === 'CLOSED' && updated.state === 'OPEN') {
    config.onOpen?.(name, updated.failureCount);
  }

  config.onFailure?.(name, error ?? new Error('Unknown circuit breaker failure'), updated.failureCount);
}

/**
 * Execute a function through the circuit breaker.
 * If the circuit is OPEN, the function is not called and an error is thrown.
 * If the circuit is HALF_OPEN, limited requests are allowed.
 * If the circuit is CLOSED, all requests are allowed.
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    /** Override the default timeout for this call */
    timeoutMs?: number;
    /** Error classifier: return true if the error should count as a failure */
    isFailure?: (error: unknown) => boolean;
  }
): Promise<T> {
  const check = checkCircuit(name);
  if (!check.allowed) {
    throw new CircuitBreakerOpenError(name, check.state, check.cooldownRemainingMs, check.message);
  }

  try {
    const timeoutMs = options?.timeoutMs ?? getConfig(name).timeoutMs ?? 10_000;
    const result = await executeWithTimeout(fn, timeoutMs);
    recordCircuitSuccess(name);
    return result;
  } catch (error) {
    const shouldCount = options?.isFailure ? options.isFailure(error) : true;
    if (shouldCount) {
      recordCircuitFailure(name, error instanceof Error ? error : new Error(String(error)));
    }
    throw error;
  }
}

async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Circuit breaker operation timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

/**
 * Reset a circuit breaker to CLOSED state.
 */
export function resetCircuit(name: string): void {
  const store = getCircuitBreakerStore();
  store.reset(name);
  halfOpenRequestsInFlight.delete(name);
}

/**
 * Get the current state snapshot of a circuit breaker.
 */
export function getCircuitState(name: string): CircuitBreakerState | null {
  const store = getCircuitBreakerStore();
  const state = store.getState(name);

  if (!state) return null;

  return {
    name,
    state: state.state,
    failureCount: state.failureCount,
    successCount: state.successCount,
    lastFailureAt: state.lastFailureAt,
    lastSuccessAt: state.lastSuccessAt,
    openedAt: state.openedAt,
    halfOpenAt: state.halfOpenAt,
    closedAt: state.closedAt,
    totalRequests: state.totalRequests,
    totalFailures: state.totalFailures,
    totalSuccesses: state.totalSuccesses,
  };
}

/**
 * Get all circuit breaker states (for monitoring/UI).
 */
export function getAllCircuitStates(): Record<string, CircuitBreakerState> {
  const store = getCircuitBreakerStore();
  const all = store.getAll();
  const result: Record<string, CircuitBreakerState> = {};

  for (const [name, state] of Object.entries(all)) {
    result[name] = {
      name,
      state: state.state,
      failureCount: state.failureCount,
      successCount: state.successCount,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
      openedAt: state.openedAt,
      halfOpenAt: state.halfOpenAt,
      closedAt: state.closedAt,
      totalRequests: state.totalRequests,
      totalFailures: state.totalFailures,
      totalSuccesses: state.totalSuccesses,
    };
  }

  return result;
}

/**
 * Register default circuit breaker configurations for all known providers.
 */
export function registerDefaultCircuitBreakers(): void {
  for (const config of Object.values(DEFAULT_CIRCUIT_BREAKER_CONFIGS)) {
    registerCircuitBreaker(config);
  }
}

// ─── Error ───────────────────────────────────────────────────────────────────

export class CircuitBreakerOpenError extends Error {
  public readonly providerName: string;
  public readonly circuitState: CircuitState;
  public readonly cooldownRemainingMs: number;

  constructor(providerName: string, circuitState: CircuitState, cooldownRemainingMs: number, message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.providerName = providerName;
    this.circuitState = circuitState;
    this.cooldownRemainingMs = cooldownRemainingMs;
  }
}
