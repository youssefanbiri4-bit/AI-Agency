import { getRedisClient } from '@/lib/redis';

/**
 * Shared JSON cache helper built on the repo's Redis client.
 *
 * Promotes the private `getCachedOrFetch` pattern from the usage analytics
 * engine into a single, reusable utility so every read path (API routes,
 * server components) applies the same caching + serialization contract.
 */

export async function getCachedJson<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const redis = await getRedisClient();
  if (!redis) return fetcher();

  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Cache read failure is non-critical — fall through to the fetcher.
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
    // Cache write failure is non-critical.
  }

  return data;
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Cache write failure is non-critical.
  }
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Cache invalidation failure is non-critical.
  }
}
