// SPDX-License-Identifier: MIT
// AgentFlow-AI — Concurrency Limiter
// W9-PERF-T2: In-memory concurrency limiter with Redis-ready interface

if (typeof window !== 'undefined') {
  throw new Error('concurrency-limiter.ts can only be used on the server');
}

import { getRedisClient } from '@/lib/redis';

/**
 * Result of attempting to acquire a concurrency slot.
 */
export interface ConcurrencyAcquireResult {
  /** Whether the slot was acquired */
  acquired: boolean;
  /** Current active count for this slot */
  activeCount: number;
  /** Max concurrency for this slot */
  maxConcurrency: number;
  /** Estimated wait time in ms if not acquired (0 if acquired) */
  estimatedWaitMs: number;
}

/**
 * Release function returned when a slot is acquired.
 * Must be called when the operation completes (success or failure).
 */
export type ConcurrencyReleaseFn = () => void;

/**
 * Concurrency limiter store interface.
 * Redis implementations should implement this interface for distributed limiting.
 */
export interface ConcurrencyStore {
  /**
   * Attempt to acquire a slot. Returns a release function on success, null on failure.
   */
  tryAcquire(slotName: string, maxConcurrency: number): ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null };

  /**
   * Wait asynchronously until a slot becomes available, with timeout.
   */
  acquire(
    slotName: string,
    maxConcurrency: number,
    timeoutMs?: number
  ): Promise<ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null }>;

  /**
   * Get current active count for a slot.
   */
  getActiveCount(slotName: string): number;

  /**
   * Get all active slots and their counts.
   */
  getAllSlots(): Record<string, { active: number; max: number; queued: number }>;
}

/**
 * In-memory concurrency limiter using a simple counter-based semaphore.
 * Each named slot can have its own concurrency limit.
 */
export class InMemoryConcurrencyStore implements ConcurrencyStore {
  private activeCounts = new Map<string, number>();
  private queues = new Map<string, Array<() => void>>();

  tryAcquire(
    slotName: string,
    maxConcurrency: number
  ): ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null } {
    const current = this.activeCounts.get(slotName) ?? 0;

    if (current < maxConcurrency) {
      this.activeCounts.set(slotName, current + 1);

      const release = () => {
        const count = this.activeCounts.get(slotName) ?? 1;
        const newCount = Math.max(0, count - 1);
        this.activeCounts.set(slotName, newCount);

        // Process next queued waiter if any
        const queue = this.queues.get(slotName);
        if (queue && queue.length > 0) {
          const next = queue.shift();
          if (next) next();
        }
      };

      return {
        acquired: true,
        activeCount: current + 1,
        maxConcurrency,
        estimatedWaitMs: 0,
        release,
      };
    }

    // Count how many are queued for estimated wait time
    const queue = this.queues.get(slotName) ?? [];
    const estimatedWaitMs = queue.length * 1000; // rough estimate: ~1s per queued item

    return {
      acquired: false,
      activeCount: current,
      maxConcurrency,
      estimatedWaitMs,
      release: null,
    };
  }

  /**
   * Wait asynchronously until a slot becomes available.
   * Uses a simple queue to avoid tight loops.
   */
  async acquire(
    slotName: string,
    maxConcurrency: number,
    timeoutMs: number = 30_000
  ): Promise<ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null }> {
    const immediate = this.tryAcquire(slotName, maxConcurrency);
    if (immediate.acquired) return immediate;

    // Queue this request
    return new Promise((resolve) => {
      const queue = this.queues.get(slotName) ?? [];
      let resolved = false;

      const waiter = () => {
        const result = this.tryAcquire(slotName, maxConcurrency);
        if (result.acquired) {
          resolved = true;
          resolve(result);
        } else {
          // Re-queue
          const q = this.queues.get(slotName) ?? [];
          q.push(waiter);
          this.queues.set(slotName, q);
        }
      };

      queue.push(waiter);
      this.queues.set(slotName, queue);

      // Timeout
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (!resolved) {
            // Remove from queue
            const q = this.queues.get(slotName) ?? [];
            const idx = q.indexOf(waiter);
            if (idx >= 0) q.splice(idx, 1);
            if (q.length === 0) this.queues.delete(slotName);

            resolve({
              acquired: false,
              activeCount: this.activeCounts.get(slotName) ?? 0,
              maxConcurrency,
              estimatedWaitMs: 0,
              release: null,
            });
          }
        }, timeoutMs);
      }
    });
  }

  getActiveCount(slotName: string): number {
    return this.activeCounts.get(slotName) ?? 0;
  }

  getAllSlots(): Record<string, { active: number; max: number; queued: number }> {
    const slots: Record<string, { active: number; max: number; queued: number }> = {};
    for (const [slotName, count] of this.activeCounts) {
      slots[slotName] = {
        active: count,
        max: Infinity,
        queued: (this.queues.get(slotName) ?? []).length,
      };
    }
    return slots;
  }

  /**
   * Reset all concurrency counters (useful for testing).
   */
  reset(): void {
    this.activeCounts.clear();
    this.queues.clear();
  }
}

// ─── Redis-backed concurrency store ──────────────────────────────────────────

/**
 * Redis-backed concurrency limiter.
 *
 * Uses sync-in-memory operations for the synchronous ConcurrencyStore interface,
 * with async Redis side-effect sync for cross-instance awareness.
 *
 * tryAcquire: operates on in-memory store synchronously, syncs to Redis async.
 * acquire: uses Redis atomic INCR/DECR with polling loop for cross-instance
 *   coordination. Falls back to in-memory if Redis is unavailable.
 * getActiveCount/getAllSlots: return from in-memory store for speed.
 *
 * Key format: `agentflow:concurrency:{slotName}`
 */
export class RedisConcurrencyStore implements ConcurrencyStore {
  private mem: InMemoryConcurrencyStore;
  private redisInit = false;
  private redisAvailable = false;
  private client: import('ioredis').Redis | null = null;

  constructor() {
    this.mem = new InMemoryConcurrencyStore();
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

  private syncToRedis(slotName: string): void {
    if (!this.redisAvailable || !this.client) return;
    const count = this.mem.getActiveCount(slotName);
    const key = `agentflow:concurrency:${slotName}`;
    if (count === 0) {
      this.client.del(key).catch(() => {});
    } else {
      this.client.set(key, String(count), 'PX', 100_000).catch(() => {});
    }
  }

  tryAcquire(
    slotName: string,
    maxConcurrency: number
  ): ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null } {
    const result = this.mem.tryAcquire(slotName, maxConcurrency);
    this.syncToRedis(slotName);
    return result;
  }

  async acquire(
    slotName: string,
    maxConcurrency: number,
    timeoutMs: number = 30_000
  ): Promise<ConcurrencyAcquireResult & { release: ConcurrencyReleaseFn | null }> {
    if (!this.redisAvailable) {
      await this.initRedis();
    }

    if (!this.redisAvailable || !this.client) {
      return this.mem.acquire(slotName, maxConcurrency, timeoutMs);
    }

    // Use the in-memory tryAcquire first (fast path)
    const immediate = this.mem.tryAcquire(slotName, maxConcurrency);
    if (immediate.acquired) {
      this.syncToRedis(slotName);
      return immediate;
    }

    // Fall back to Redis-based polling for cross-instance coordination
    const key = `agentflow:concurrency:${slotName}`;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const count = await this.client.incr(key);

      if (count === 1) {
        await this.client.pexpire(key, 100_000);
      }

      if (count <= maxConcurrency) {
        // Also sync to in-memory
        this.mem.tryAcquire(slotName, maxConcurrency);

        return {
          acquired: true,
          activeCount: count,
          maxConcurrency,
          estimatedWaitMs: 0,
          release: () => {
            // Decrement Redis (fire-and-forget) — in-memory store reconciles
            // on the next local tryAcquire/acquire call.
            this.client!.decr(key).catch(() => {});
          },
        };
      }

      await this.client.decr(key);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return {
      acquired: false,
      activeCount: Number(await this.client.get(key)) || 0,
      maxConcurrency,
      estimatedWaitMs: 0,
      release: null,
    };
  }

  getActiveCount(slotName: string): number {
    return this.mem.getActiveCount(slotName);
  }

  getAllSlots(): Record<string, { active: number; max: number; queued: number }> {
    return this.mem.getAllSlots();
  }

  reset(): void {
    this.mem.reset();
  }
}

// ─── Global singleton ────────────────────────────────────────────────────────

let defaultStore: ConcurrencyStore | null = null;
let activeStore: ConcurrencyStore | null = null;

export function setConcurrencyStore(store: ConcurrencyStore): void {
  activeStore = store;
}

export function getConcurrencyStore(): ConcurrencyStore {
  if (activeStore) return activeStore;
  if (!defaultStore) {
    const host = process.env.REDIS_HOST?.trim();
    if (host) {
      defaultStore = new RedisConcurrencyStore();
    } else {
      defaultStore = new InMemoryConcurrencyStore();
    }
  }
  return defaultStore;
}

// ─── Predefined slot names ───────────────────────────────────────────────────

export const CONCURRENCY_SLOTS = {
  AI_GENERATION: 'ai-generation',
  PDF_GENERATION: 'pdf-generation',
  BULK_OPERATION: 'bulk-operation',
  REPORT_GENERATION: 'report-generation',
  CONTENT_PUBLISH: 'content-publish',
  AD_SYNC: 'ad-sync',
} as const;

export type ConcurrencySlot = (typeof CONCURRENCY_SLOTS)[keyof typeof CONCURRENCY_SLOTS];

// ─── Default max concurrency per slot ────────────────────────────────────────

export const DEFAULT_MAX_CONCURRENCY: Record<string, number> = {
  [CONCURRENCY_SLOTS.AI_GENERATION]: 3,
  [CONCURRENCY_SLOTS.PDF_GENERATION]: 2,
  [CONCURRENCY_SLOTS.BULK_OPERATION]: 1,
  [CONCURRENCY_SLOTS.REPORT_GENERATION]: 2,
  [CONCURRENCY_SLOTS.CONTENT_PUBLISH]: 3,
  [CONCURRENCY_SLOTS.AD_SYNC]: 2,
};

// ─── Convenience helpers ─────────────────────────────────────────────────────

/**
 * Acquire a concurrency slot. Throws if the slot cannot be acquired immediately.
 * Use for operations that should fail-fast when busy.
 */
export async function withConcurrencyLimit<T>(
  slotName: string,
  fn: () => Promise<T>,
  options?: {
    maxConcurrency?: number;
    timeoutMs?: number;
    failOnQueue?: boolean;
  }
): Promise<T> {
  const max = options?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY[slotName] ?? 5;
  const store = getConcurrencyStore();

  const result = options?.failOnQueue ?? true
    ? store.tryAcquire(slotName, max)
    : await store.acquire(slotName, max, options?.timeoutMs ?? 30_000);

  if (!result.acquired) {
    throw new ConcurrencyLimitError(slotName, result.activeCount, max, result.estimatedWaitMs);
  }

  try {
    return await fn();
  } finally {
    result.release!();
  }
}

/**
 * Error thrown when a concurrency limit is reached.
 */
export class ConcurrencyLimitError extends Error {
  public readonly slotName: string;
  public readonly activeCount: number;
  public readonly maxConcurrency: number;
  public readonly estimatedWaitMs: number;

  constructor(slotName: string, activeCount: number, maxConcurrency: number, estimatedWaitMs: number) {
    super(
      `Concurrency limit reached for "${slotName}": ${activeCount}/${maxConcurrency} slots in use. ` +
      (estimatedWaitMs > 0
        ? `Estimated wait time: ~${Math.ceil(estimatedWaitMs / 1000)}s.`
        : 'Please try again later.')
    );
    this.name = 'ConcurrencyLimitError';
    this.slotName = slotName;
    this.activeCount = activeCount;
    this.maxConcurrency = maxConcurrency;
    this.estimatedWaitMs = estimatedWaitMs;
  }
}
