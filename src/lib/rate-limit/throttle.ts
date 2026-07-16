/**
 * Token-Bucket Throttle + Concurrency Limiter (W17-T2)
 *
 * Complements the fixed/sliding-window rate limiters in src/lib/rate-limit.ts
 * with two additional controls suited to expensive or stateful endpoints:
 *
 *  - TokenBucket: smooth, burst-tolerant throttling (tokens refill continuously).
 *    Ideal for AI generation / LLM endpoints where you want a steady throughput
 *    with limited bursts.
 *  - ConcurrencyLimiter: caps the number of in-flight operations per key
 *    (e.g. per workspace) so a single tenant cannot exhaust shared worker
 *    capacity. Prevents one workspace from saturating the queue.
 *
 * Both degrade gracefully to "allow" when Redis is unavailable (no throttle),
 * and use Redis so limits are shared across horizontally-scaled instances.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

const throttleLog = logger.child('throttle');

export interface TokenBucketResult {
  allowed: boolean;
  remaining: number;
  /** ms until the bucket refills enough for one token (0 if allowed now). */
  retryAfterMs: number;
}

export interface TokenBucketOptions {
  /** Unique bucket key (include workspaceId / userId). */
  key: string;
  /** Maximum tokens the bucket can hold (burst ceiling). */
  capacity: number;
  /** Tokens added per second (refill rate). */
  refillPerSecond: number;
  /** Tokens to consume per request (default 1). */
  cost?: number;
}

const TOKEN_SCRIPT = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill = tonumber(ARGV[2])
  local cost = tonumber(ARGV[3])
  local now = tonumber(ARGV[4])
  local ttl = tonumber(ARGV[5])

  local data = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(data[1])
  local ts = tonumber(data[2])
  if tokens == nil then
    tokens = capacity
    ts = now
  end

  local elapsed = (now - ts) / 1000
  tokens = math.min(capacity, tokens + elapsed * refill)
  ts = now

  if tokens < cost then
    local need = cost - tokens
    local wait = math.ceil(need / refill * 1000)
    redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
    redis.call('PEXPIRE', key, ttl)
    return {0, wait}
  end

  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
  redis.call('PEXPIRE', key, ttl)
  return {1, tokens}
`;

/**
 * Token-bucket throttle backed by Redis (Lua script is atomic).
 * Falls back to allowing the request when Redis is unavailable.
 */
export async function tokenBucketThrottle(opts: TokenBucketOptions): Promise<TokenBucketResult> {
  const cost = opts.cost ?? 1;
  const nowMs = Date.now();
  const ttlMs = Math.ceil(((opts.capacity / opts.refillPerSecond) + 5) * 1000);

  const redis = await getRedisClient();
  if (!redis) {
    return { allowed: true, remaining: opts.capacity, retryAfterMs: 0 };
  }

  try {
    const result = (await redis.eval(
      TOKEN_SCRIPT,
      1,
      `af:throttle:${opts.key}`,
      opts.capacity,
      opts.refillPerSecond,
      cost,
      nowMs,
      ttlMs
    )) as [number, number];

    const [ok, remainingOrWait] = result;
    if (ok === 1) {
      return { allowed: true, remaining: Math.floor(remainingOrWait), retryAfterMs: 0 };
    }
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, Math.floor(remainingOrWait)) };
  } catch (err) {
    throttleLog.warn('Token bucket throttle failed; allowing', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, remaining: opts.capacity, retryAfterMs: 0 };
  }
}

/**
 * Concurrency limiter: returns a release function when allowed, or null when the
 * in-flight count for the key is at/above the max. Uses an atomic Redis counter
 * with a generous TTL so a crashed worker cannot leak capacity forever.
 */
export async function acquireConcurrency(
  key: string,
  max: number,
  ttlMs = 60_000
): Promise<(() => Promise<void>) | null> {
  const redisKey = `af:concurrency:${key}`;
  const redis = await getRedisClient();
  if (!redis) {
    return async () => {};
  }

  try {
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.pexpire(redisKey, ttlMs);
    }
    if (current > max) {
      await redis.decr(redisKey);
      return null;
    }
    return async () => {
      try {
        await redis.decr(redisKey);
      } catch {
        // best-effort release
      }
    };
  } catch (err) {
    throttleLog.warn('Concurrency limiter failed; allowing', {
      error: err instanceof Error ? err.message : String(err),
    });
    return async () => {};
  }
}
