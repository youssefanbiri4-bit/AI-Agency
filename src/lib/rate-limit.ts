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

export type RateLimitStoreMode = 'memory' | 'upstash';

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

class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  private async command<T>(command: unknown[]): Promise<T> {
    const response = await fetch(`${this.url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command]),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Persistent rate limit store request failed.');
    }

    const payload = (await response.json()) as Array<{ result?: T; error?: string }>;
    const first = payload[0];

    if (!first || first.error) {
      throw new Error('Persistent rate limit store command failed.');
    }

    return first.result as T;
  }

  async check({ key, limit, windowMs }: RateLimitInput): Promise<RateLimitResult> {
    const safeKey = `agentflow:rate-limit:${key}`;
    const now = Date.now();
    const count = Number(await this.command<number>(['INCR', safeKey]));

    if (count === 1) {
      await this.command<number>(['PEXPIRE', safeKey, windowMs]);
    }

    const ttl = Number(await this.command<number>(['PTTL', safeKey]));
    const resetAt = now + Math.max(ttl, 0);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }
}

const inMemoryRateLimitStore = new InMemoryRateLimitStore();
let activeRateLimitStore: RateLimitStore | null = null;
let activeRateLimitStoreMode: RateLimitStoreMode = 'memory';

function createConfiguredRateLimitStore() {
  if (process.env.RATE_LIMIT_STORE === 'upstash') {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (url && token) {
      activeRateLimitStoreMode = 'upstash';
      return new UpstashRateLimitStore(url, token);
    }
  }

  activeRateLimitStoreMode = 'memory';
  return inMemoryRateLimitStore;
}

export function setRateLimitStore(store: RateLimitStore) {
  activeRateLimitStore = store;
}

export function getRateLimitStore() {
  if (!activeRateLimitStore) {
    activeRateLimitStore = createConfiguredRateLimitStore();
  }

  return activeRateLimitStore;
}

export function getRateLimitStoreMode() {
  getRateLimitStore();
  return activeRateLimitStoreMode;
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  try {
    return await getRateLimitStore().check(input);
  } catch {
    if (process.env.RATE_LIMIT_STORE === 'upstash') {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + input.windowMs,
      };
    }

    return inMemoryRateLimitStore.check(input);
  }
}

export function checkInMemoryRateLimit(input: RateLimitInput): RateLimitResult {
  return inMemoryRateLimitStore.check(input);
}
