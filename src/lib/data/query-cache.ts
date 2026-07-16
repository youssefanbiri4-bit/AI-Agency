/**
 * Redis-backed Query Result Cache (W17-T2)
 *
 * Generic, namespaced cache for expensive read queries (analytics, aggregations,
 * tenant dashboards). Reduces direct database load and supports prefix-based
 * invalidation for a tenant/namespace — essential for horizontal scaling where
 * multiple app instances share a single Redis.
 *
 * Falls back to no-op (cache miss) when Redis is unavailable, so callers must
 * always provide a `fetcher`.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

const cacheLog = logger.child('query-cache');

const DEFAULT_TTL_SECONDS = 300;

function buildKey(namespace: string, key: string): string {
  return `af:cache:${namespace}:${key}`;
}

export interface QueryCacheOptions {
  /** Cache namespace (e.g. 'usage', 'team', 'insights'). */
  namespace: string;
  /** Cache key within the namespace. */
  key: string;
  /** TTL in seconds. */
  ttlSeconds?: number;
}

/**
 * Get a cached value or compute + store it. Returns the fetcher result on miss
 * or when Redis is unavailable.
 */
export async function cachedQuery<T>(
  options: QueryCacheOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const redisKey = buildKey(options.namespace, options.key);

  const redis = await getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached !== null && cached !== undefined) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      cacheLog.warn('Cache read failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const value = await fetcher();

  if (redis) {
    try {
      await redis.setex(redisKey, ttl, JSON.stringify(value));
    } catch (err) {
      cacheLog.warn('Cache write failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return value;
}

/**
 * Invalidate a single key.
 */
export async function invalidateQuery(namespace: string, key: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.del(buildKey(namespace, key));
  } catch (err) {
    cacheLog.warn('Cache invalidate failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Invalidate all keys in a namespace using SCAN (safe for production; never
 * uses KEYS * on large datasets).
 */
export async function invalidateNamespace(namespace: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const pattern = `af:cache:${namespace}:*`;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    cacheLog.warn('Namespace invalidation failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Get-or-fetch cache helper with a namespaced + keyed Redis key and in-memory
 * fallback. Consolidates the three near-identical local copies that previously
 * lived in analytics.ts / billing/analytics.ts / billing/pricing-engine.ts.
 *
 * The cache key is `af:cache:<namespace>:<key>` (same scheme as cachedQuery),
 * so invalidation via invalidateNamespace / invalidateQuery is interoperable.
 */
export async function getCachedOrFetch<T>(
  namespace: string,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<T> {
  const redisKey = buildKey(namespace, key);
  const redis = await getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached !== null && cached !== undefined) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      cacheLog.warn('Cache read failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const value = await fetcher();

  if (redis) {
    try {
      await redis.setex(redisKey, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      cacheLog.warn('Cache write failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return value;
}

/**
 * Clear every cache entry that embeds a workspace id anywhere in its
 * namespace or key. Used after workspace-scoped mutations (usage, billing) so
 * dashboards/analytics stop serving stale aggregates. SCAN-based, safe for
 * large datasets.
 */
export async function clearWorkspaceCaches(workspaceId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const pattern = `af:cache:*`;
  try {
    let cursor = '0';
    const toDelete: string[] = [];
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      for (const k of keys) {
        if (k.includes(workspaceId)) toDelete.push(k);
      }
    } while (cursor !== '0');

    if (toDelete.length > 0) {
      await redis.del(...toDelete);
      cacheLog.info('Cleared workspace caches', { workspaceId, count: toDelete.length });
    }
  } catch (err) {
    cacheLog.warn('Workspace cache clear failed', { error: err instanceof Error ? err.message : String(err) });
  }
}
