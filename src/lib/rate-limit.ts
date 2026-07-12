if (typeof window !== 'undefined') {
  // Prevent accidental bundling/execution in client runtimes.
  throw new Error('rate-limit.ts can only be used on the server');
}

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

export const AUTH_BRUTE_FORCE_LIMIT = 5;
export const AUTH_BRUTE_FORCE_WINDOW_MS = 5 * 60_000;
export const AUTH_LOCKOUT_WINDOW_MS = 15 * 60_000;

/**
 * Extracts the most likely client IP from common proxy headers.
 * - x-forwarded-for: first IP in the comma-separated list
 * - cf-connecting-ip
 * - x-real-ip
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  const cf = headers.get('cf-connecting-ip');
  const xri = headers.get('x-real-ip');

  const candidate =
    xff?.split(',')[0]?.trim() ||
    cf?.trim() ||
    xri?.trim() ||
    '';

  // Keep return type stable; downstream code expects a string key.
  return candidate || '0.0.0.0';
}

export function buildRateLimitExceededHeaders(opts: {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((opts.resetAt - Date.now()) / 1000)
  );

  return {
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Remaining': String(opts.remaining),
    'X-RateLimit-Reset': String(Math.floor(opts.resetAt / 1000)),
    'X-RateLimit-Allowed': String(opts.allowed),
  };
}

export async function checkRateLimitLockout(key: string): Promise<RateLimitResult> {
  // Lockout is a binary state with an expiration time.
  // If key has a positive TTL => allowed=false, remaining=0.
  // NOTE: This CREATES the lockout bucket. Used only by setRateLimitLockout / recordAuthFailure.
  // For read-only lockout checks, use peekRateLimitLockout instead.
  return checkRateLimit({ key: `agentflow:lockout:${key}`, limit: 1, windowMs: AUTH_LOCKOUT_WINDOW_MS });
}

export async function peekRateLimitLockout(key: string): Promise<RateLimitResult> {
  // Read-only lockout check: does NOT create or mutate the lockout bucket.
  // Uses peekRateLimit with the same key format as checkRateLimitLockout.
  return peekRateLimit({
    key: `agentflow:lockout:${key}`,
    limit: 1,
    windowMs: AUTH_LOCKOUT_WINDOW_MS,
  });
}

export async function setRateLimitLockout(key: string, windowMs: number): Promise<void> {
  // Use check() once to create the bucket and rely on PEXPIRE/TTL behavior.
  await checkRateLimit({ key: `agentflow:lockout:${key}`, limit: 1, windowMs });
}

export async function clearRateLimitKey(key: string): Promise<void> {
  const safeKey = `agentflow:rate-limit:${key}`;

  if (process.env.RATE_LIMIT_STORE === 'upstash') {
    // Best-effort clear for persistent store.
    try {
      const store = getRateLimitStore() as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        command?: (c: any) => Promise<any>;
      };
      // no-op: command is private; fallback to not clearing in upstash mode
    } catch {
      // ignore
    }
  }

  // In-memory: we can only clear if the store is in-memory mode.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const mode = getRateLimitStoreMode();
  if (mode === 'memory') {
    // Use active store if set by tests, otherwise fall back to module-level store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (activeRateLimitStore ?? inMemoryRateLimitStore) as any;
    const buckets: Map<string, RateLimitBucket> | undefined = mem.buckets;
    if (buckets) buckets.delete(safeKey.replace('agentflow:rate-limit:', ''));
  }
}

export async function peekRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  // In-memory: do not mutate buckets.
  const mode = getRateLimitStoreMode();
  if (mode === 'memory') {
    // Use active store if set by tests, otherwise fall back to module-level store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (activeRateLimitStore ?? inMemoryRateLimitStore) as any;
    const buckets: Map<string, RateLimitBucket> | undefined = mem.buckets;
    if (!buckets) {
      return inMemoryRateLimitStore.check(input);
    }
    const bucket = buckets.get(input.key);
    const now = Date.now();

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + input.windowMs;
      return { allowed: true, remaining: Math.max(0, input.limit - 1), resetAt };
    }

    return {
      allowed: bucket.count < input.limit,
      remaining: Math.max(0, input.limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  // Upstash: peek via PTTL only (no INCR).
  const safeKey = `agentflow:rate-limit:${input.key}`;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!upstashUrl || !upstashToken) {
    return inMemoryRateLimitStore.check(input);
  }

  const response = await fetch(`${upstashUrl.replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['PTTL', safeKey]]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Persistent rate limit store peek failed.');
  }

  const payload = (await response.json()) as Array<{ result?: number; error?: string }>;
  const first = payload[0];
  if (!first || first.error) {
    throw new Error('Persistent rate limit store peek command failed.');
  }

  const ttlMs = Number(first.result ?? 0);
  const now = Date.now();
  const resetAt = now + Math.max(ttlMs, 0);

  // Treat presence as "used": since we don't know the current count without INCR,
  // approximate allowed=true only when TTL<=0 (i.e., key absent/expired).
  const allowed = ttlMs <= 0;
  return {
    allowed,
    remaining: allowed ? Math.max(0, input.limit - 1) : 0,
    resetAt,
  };
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
