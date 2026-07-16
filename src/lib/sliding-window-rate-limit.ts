// SPDX-License-Identifier: MIT
// AgentFlow-AI — Sliding Window Rate Limiter
// W9-PERF-T2: Sliding window (not fixed-window) rate limiting for sensitive API routes

if (typeof window !== 'undefined') {
  throw new Error('sliding-window-rate-limit.ts can only be used on the server');
}

import { getRedisClient } from '@/lib/redis';

/**
 * Sliding window rate limit result.
 */
export interface SlidingWindowResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count within the window */
  current: number;
  /** Maximum allowed requests within the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Timestamp when the window started (ms since epoch) */
  windowStart: number;
  /** Timestamp when the window ends (ms since epoch) */
  windowEnd: number;
  /** Remaining requests allowed in this window */
  remaining: number;
  /** Time in ms until the window resets */
  resetInMs: number;
}

/**
 * Sliding window rate limit input.
 */
export interface SlidingWindowInput {
  /** Unique key for the rate limit bucket */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Sliding window rate limit store interface.
 * Redis implementations should implement this for distributed rate limiting.
 */
export interface SlidingWindowStore {
  /**
   * Check and increment a sliding window rate limit.
   * Uses a sliding window algorithm based on request timestamps.
   */
  check(input: SlidingWindowInput): SlidingWindowResult | Promise<SlidingWindowResult>;

  /**
   * Peek at current rate limit state without incrementing.
   */
  peek(input: SlidingWindowInput): SlidingWindowResult | Promise<SlidingWindowResult>;

  /**
   * Reset a rate limit key.
   */
  reset(key: string): void;

  /**
   * Clear all rate limit state (for testing).
   */
  clear(): void;
}

/**
 * In-memory sliding window rate limit store.
 * Uses an array of timestamps per key to implement the sliding window.
 */
export class InMemorySlidingWindowStore implements SlidingWindowStore {
  private windows = new Map<string, number[]>();

  check(input: SlidingWindowInput): SlidingWindowResult {
    const now = Date.now();
    const windowStart = now - input.windowMs;

    // Get existing timestamps and filter out expired ones
    let timestamps = this.windows.get(input.key) ?? [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Current count within the window
    const current = timestamps.length;

    if (current >= input.limit) {
      // Rate limited
      const oldestTimestamp = timestamps[0] ?? now;
      const windowEnd = oldestTimestamp + input.windowMs;
      const resetInMs = Math.max(0, windowEnd - now);

      return {
        allowed: false,
        current,
        limit: input.limit,
        windowMs: input.windowMs,
        windowStart: Math.max(windowStart, oldestTimestamp),
        windowEnd,
        remaining: 0,
        resetInMs,
      };
    }

    // Add current timestamp
    timestamps.push(now);
    this.windows.set(input.key, timestamps);

    const windowEnd = now + input.windowMs;

    return {
      allowed: true,
      current: current + 1,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart,
      windowEnd,
      remaining: input.limit - (current + 1),
      resetInMs: input.windowMs,
    };
  }

  peek(input: SlidingWindowInput): SlidingWindowResult {
    const now = Date.now();
    const windowStart = now - input.windowMs;

    let timestamps = this.windows.get(input.key) ?? [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const current = timestamps.length;

    const oldestTimestamp = timestamps[0] ?? now;
    const windowEnd = Math.max(oldestTimestamp + input.windowMs, now + input.windowMs);
    const resetInMs = Math.max(0, windowEnd - now);

    return {
      allowed: current < input.limit,
      current,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart: Math.max(windowStart, oldestTimestamp),
      windowEnd,
      remaining: Math.max(0, input.limit - current),
      resetInMs,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  clear(): void {
    this.windows.clear();
  }
}

// ─── Redis-backed sliding window store ───────────────────────────────────────

/**
 * Redis-backed sliding window rate limit store using sorted sets.
 *
 * Algorithm:
 *   Each request adds its timestamp as a member of a sorted set (ZADD).
 *   Old entries outside the window are removed (ZREMRANGEBYSCORE).
 *   The count within the window is obtained via ZCOUNT.
 *
 * Key format: `agentflow:sw:{key}`
 *
 * This provides accurate sliding window semantics across distributed instances.
 * Falls back to in-memory if getRedisClient() returns null.
 */
export class RedisSlidingWindowStore implements SlidingWindowStore {
  private fallback: InMemorySlidingWindowStore | null = null;
  private redisPromise: Promise<import('ioredis').Redis | null> | null = null;

  private async getRedis(): Promise<import('ioredis').Redis | null> {
    if (this.redisPromise === null) {
      this.redisPromise = getRedisClient();
    }
    const redis = await this.redisPromise;
    if (!redis) {
      // Fall back to in-memory if Redis is not available
      if (!this.fallback) this.fallback = new InMemorySlidingWindowStore();
    }
    return redis;
  }

  private getFallback(): InMemorySlidingWindowStore {
    if (!this.fallback) this.fallback = new InMemorySlidingWindowStore();
    return this.fallback;
  }

  async check(input: SlidingWindowInput): Promise<SlidingWindowResult> {
    const redis = await this.getRedis();
    if (!redis) return this.getFallback().check(input);

    const now = Date.now();
    const key = `agentflow:sw:${input.key}`;
    const windowStart = now - input.windowMs;

    // Pipeline: remove old entries, add current entry, count remaining, TTL
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zadd(key, now, String(now));
    pipeline.zcount(key, windowStart, '+inf');
    pipeline.pexpire(key, input.windowMs);
    const results = await pipeline.exec();

    if (!results) {
      // Pipeline failed — fall back
      return this.getFallback().check(input);
    }

    // Parse the ZCOUNT result (3rd command at index 2)
    const countResult = results[2]?.[1];
    const count = typeof countResult === 'number' ? countResult : (Number(countResult) || 0);

    if (count > input.limit) {
      // We already added this entry, so we need to remove it if over limit
      await redis.zrem(key, String(now));

      // Re-count after removal
      const actualCount = Number(await redis.zcount(key, windowStart, '+inf')) || 0;
      const oldestTimestamp = Number(await redis.zrange(key, 0, 0, 'WITHSCORES').then(r => r[1] || now)) || now;
      const windowEnd = oldestTimestamp + input.windowMs;
      const resetInMs = Math.max(0, windowEnd - now);

      return {
        allowed: false,
        current: actualCount,
        limit: input.limit,
        windowMs: input.windowMs,
        windowStart: Math.max(windowStart, oldestTimestamp),
        windowEnd,
        remaining: 0,
        resetInMs,
      };
    }

    // Get the oldest timestamp for window boundaries
    const oldestTimestamp = Number(await redis.zrange(key, 0, 0, 'WITHSCORES').then(r => r[1] || now)) || now;
    const windowEnd = oldestTimestamp + input.windowMs;
    const resetInMs = Math.max(0, windowEnd - now);

    return {
      allowed: true,
      current: count,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart: Math.max(windowStart, oldestTimestamp),
      windowEnd,
      remaining: Math.max(0, input.limit - count),
      resetInMs,
    };
  }

  async peek(input: SlidingWindowInput): Promise<SlidingWindowResult> {
    const redis = await this.getRedis();
    if (!redis) return this.getFallback().peek(input);

    const now = Date.now();
    const key = `agentflow:sw:${input.key}`;
    const windowStart = now - input.windowMs;

    // Pipeline: remove old entries (cleanup), count remaining
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcount(key, windowStart, '+inf');
    const results = await pipeline.exec();

    if (!results) {
      return this.getFallback().peek(input);
    }

    const countResult = results[1]?.[1];
    const count = typeof countResult === 'number' ? countResult : (Number(countResult) || 0);

    const oldestTimestamp = count > 0
      ? (Number(await redis.zrange(key, 0, 0, 'WITHSCORES').then(r => r[1] || now)) || now)
      : now;
    const windowEnd = Math.max(oldestTimestamp + input.windowMs, now + input.windowMs);
    const resetInMs = Math.max(0, windowEnd - now);

    return {
      allowed: count < input.limit,
      current: count,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart: Math.max(windowStart, oldestTimestamp),
      windowEnd,
      remaining: Math.max(0, input.limit - count),
      resetInMs,
    };
  }

  async reset(key: string): Promise<void> {
    const redis = await this.getRedis();
    if (redis) {
      await redis.del(`agentflow:sw:${key}`);
    } else {
      this.getFallback().reset(key);
    }
  }

  async clear(): Promise<void> {
    const redis = await this.getRedis();
    if (redis) {
      // Scan and delete all agentflow:sw:* keys
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'agentflow:sw:*', 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } else {
      this.getFallback().clear();
    }
  }
}

// ─── Global singleton ────────────────────────────────────────────────────────

let defaultStore: SlidingWindowStore | null = null;
let activeStore: SlidingWindowStore | null = null;

export function setSlidingWindowStore(store: SlidingWindowStore): void {
  activeStore = store;
}

export function getSlidingWindowStore(): SlidingWindowStore {
  if (activeStore) return activeStore;
  if (!defaultStore) {
    // Auto-detect: if Redis is available (via env check without connecting), use Redis
    const host = process.env.REDIS_HOST?.trim();
    if (host) {
      defaultStore = new RedisSlidingWindowStore();
    } else {
      defaultStore = new InMemorySlidingWindowStore();
    }
  }
  return defaultStore;
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

/**
 * Build a workspace-scoped rate limit key.
 * Format: `sw:ws:{workspaceId}:{action}`
 */
export function buildWorkspaceRateLimitKey(workspaceId: string, action: string): string {
  return `sw:ws:${workspaceId}:${action}`;
}

/**
 * Build a user-scoped rate limit key.
 * Format: `sw:user:{userId}:{action}`
 */
export function buildUserRateLimitKey(userId: string, action: string): string {
  return `sw:user:${userId}:${action}`;
}

/**
 * Build a workspace+user scoped rate limit key.
 * Format: `sw:ws:{workspaceId}:user:{userId}:{action}`
 */
export function buildWorkspaceUserRateLimitKey(workspaceId: string, userId: string, action: string): string {
  return `sw:ws:${workspaceId}:user:${userId}:${action}`;
}

/**
 * Build an IP-based rate limit key.
 * Format: `sw:ip:{ip}:{action}`
 */
export function buildIpRateLimitKey(ip: string, action: string): string {
  return `sw:ip:${ip}:${action}`;
}

// ─── Convenience API ─────────────────────────────────────────────────────────

/**
 * Check a sliding window rate limit.
 * This is the main entry point for rate limiting sensitive operations.
 *
 * @example
 * ```ts
 * const result = await checkSlidingWindowRateLimit({
 *   key: buildWorkspaceRateLimitKey(workspaceId, 'content:publish'),
 *   limit: 10,
 *   windowMs: 60_000, // 10 requests per minute
 * });
 *
 * if (!result.allowed) {
 *   throw new RateLimitError('Too many publish requests');
 * }
 * ```
 */
export async function checkSlidingWindowRateLimit(input: SlidingWindowInput): Promise<SlidingWindowResult> {
  try {
    return await getSlidingWindowStore().check(input);
  } catch {
    // On store error, allow the request but log
    const now = Date.now();
    return {
      allowed: true,
      current: 0,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart: now,
      windowEnd: now + input.windowMs,
      remaining: input.limit,
      resetInMs: input.windowMs,
    };
  }
}

/**
 * Peek at the current rate limit state without incrementing the counter.
 */
export async function peekSlidingWindowRateLimit(input: SlidingWindowInput): Promise<SlidingWindowResult> {
  try {
    return await getSlidingWindowStore().peek(input);
  } catch {
    const now = Date.now();
    return {
      allowed: true,
      current: 0,
      limit: input.limit,
      windowMs: input.windowMs,
      windowStart: now,
      windowEnd: now + input.windowMs,
      remaining: input.limit,
      resetInMs: input.windowMs,
    };
  }
}

/**
 * Reset a sliding window rate limit key.
 */
export function resetSlidingWindowRateLimit(key: string): void {
  getSlidingWindowStore().reset(key);
}

/**
 * Clear all sliding window rate limit state.
 */
export function clearSlidingWindowRateLimits(): void {
  getSlidingWindowStore().clear();
}

// ─── Predefined rate limit actions ───────────────────────────────────────────

export const RATE_LIMIT_ACTIONS = {
  CONTENT_PUBLISH: 'content:publish',
  CONTENT_GENERATE: 'content:generate',
  CONTENT_SAVE: 'content:save',
  REPORT_GENERATE: 'report:generate',
  REPORT_EXPORT_PDF: 'report:export-pdf',
  TASK_EXECUTE: 'task:execute',
  TASK_CREATE: 'task:create',
  AI_CHAT: 'ai:chat',
  AI_GENERATE_TEXT: 'ai:generate-text',
  AI_GENERATE_IMAGE: 'ai:generate-image',
  AD_SYNC: 'ad:sync',
  USAGE_READ: 'usage:read',
  SETTINGS_UPDATE: 'settings:update',
  BULK_OPERATION: 'bulk:operation',
} as const;

export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS];

// ─── Default limits per action ───────────────────────────────────────────────

export interface RateLimitDefaults {
  limit: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitDefaults> = {
  [RATE_LIMIT_ACTIONS.CONTENT_PUBLISH]: { limit: 20, windowMs: 60_000 },   // 20/min per user
  [RATE_LIMIT_ACTIONS.CONTENT_GENERATE]: { limit: 10, windowMs: 60_000 },  // 10/min per user
  [RATE_LIMIT_ACTIONS.CONTENT_SAVE]: { limit: 60, windowMs: 60_000 },      // 60/min per user
  [RATE_LIMIT_ACTIONS.REPORT_GENERATE]: { limit: 5, windowMs: 60_000 },    // 5/min per user
  [RATE_LIMIT_ACTIONS.REPORT_EXPORT_PDF]: { limit: 3, windowMs: 60_000 },  // 3/min per user
  [RATE_LIMIT_ACTIONS.TASK_EXECUTE]: { limit: 30, windowMs: 60_000 },      // 30/min per user
  [RATE_LIMIT_ACTIONS.TASK_CREATE]: { limit: 20, windowMs: 60_000 },       // 20/min per user
  [RATE_LIMIT_ACTIONS.AI_CHAT]: { limit: 30, windowMs: 60_000 },           // 30/min per user
  [RATE_LIMIT_ACTIONS.AI_GENERATE_TEXT]: { limit: 10, windowMs: 60_000 },  // 10/min per user
  [RATE_LIMIT_ACTIONS.AI_GENERATE_IMAGE]: { limit: 5, windowMs: 60_000 },  // 5/min per user
  [RATE_LIMIT_ACTIONS.AD_SYNC]: { limit: 5, windowMs: 60_000 },            // 5/min per user
  [RATE_LIMIT_ACTIONS.USAGE_READ]: { limit: 30, windowMs: 60_000 },        // 30/min per user
  [RATE_LIMIT_ACTIONS.SETTINGS_UPDATE]: { limit: 10, windowMs: 60_000 },   // 10/min per user
  [RATE_LIMIT_ACTIONS.BULK_OPERATION]: { limit: 3, windowMs: 60_000 },     // 3/min per user
};

// ─── Higher-level wrapper ────────────────────────────────────────────────────

/**
 * Convenience wrapper for checking workspace-scoped rate limits with defaults.
 * Uses the sliding window algorithm for more accurate rate limiting.
 *
 * @example
 * ```ts
 * const result = await checkWorkspaceRateLimit(workspaceId, 'content:publish');
 * if (!result.allowed) {
 *   // Handle rate limit
 * }
 * ```
 */
export async function checkWorkspaceRateLimit(
  workspaceId: string,
  action: string,
  options?: { limit?: number; windowMs?: number }
): Promise<SlidingWindowResult> {
  const defaults = DEFAULT_RATE_LIMITS[action] ?? { limit: 60, windowMs: 60_000 };

  return checkSlidingWindowRateLimit({
    key: buildWorkspaceRateLimitKey(workspaceId, action),
    limit: options?.limit ?? defaults.limit,
    windowMs: options?.windowMs ?? defaults.windowMs,
  });
}

/**
 * Convenience wrapper for checking user-scoped rate limits with defaults.
 */
export async function checkUserRateLimit(
  userId: string,
  action: string,
  options?: { limit?: number; windowMs?: number }
): Promise<SlidingWindowResult> {
  const defaults = DEFAULT_RATE_LIMITS[action] ?? { limit: 60, windowMs: 60_000 };

  return checkSlidingWindowRateLimit({
    key: buildUserRateLimitKey(userId, action),
    limit: options?.limit ?? defaults.limit,
    windowMs: options?.windowMs ?? defaults.windowMs,
  });
}

/**
 * Convenience wrapper for checking combined workspace + user rate limits.
 */
export async function checkWorkspaceUserRateLimit(
  workspaceId: string,
  userId: string,
  action: string,
  options?: { limit?: number; windowMs?: number }
): Promise<SlidingWindowResult> {
  const defaults = DEFAULT_RATE_LIMITS[action] ?? { limit: 60, windowMs: 60_000 };

  return checkSlidingWindowRateLimit({
    key: buildWorkspaceUserRateLimitKey(workspaceId, userId, action),
    limit: options?.limit ?? defaults.limit,
    windowMs: options?.windowMs ?? defaults.windowMs,
  });
}

/**
 * Error thrown when a sliding window rate limit is exceeded.
 */
export class SlidingWindowRateLimitError extends Error {
  public readonly result: SlidingWindowResult;
  public readonly key: string;

  constructor(key: string, result: SlidingWindowResult) {
    super(
      `Rate limit exceeded for "${key}": ${result.current}/${result.limit} requests. ` +
      `Retry after ${Math.ceil(result.resetInMs / 1000)}s.`
    );
    this.name = 'SlidingWindowRateLimitError';
    this.key = key;
    this.result = result;
  }
}
