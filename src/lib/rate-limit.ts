import 'server-only';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitInput {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitStore {
  check(input: RateLimitInput): RateLimitResult | Promise<RateLimitResult>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitBucket>();

  check({ key, limit, windowMs }: RateLimitInput): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt,
      };
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}

const inMemoryRateLimitStore = new InMemoryRateLimitStore();
let activeRateLimitStore: RateLimitStore = inMemoryRateLimitStore;

export function setRateLimitStore(store: RateLimitStore) {
  activeRateLimitStore = store;
}

export function getRateLimitStore() {
  return activeRateLimitStore;
}

export function checkRateLimit(input: RateLimitInput) {
  return activeRateLimitStore.check(input);
}

export function checkInMemoryRateLimit(input: RateLimitInput): RateLimitResult {
  return inMemoryRateLimitStore.check(input);
}
