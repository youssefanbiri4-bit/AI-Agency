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

interface LockoutEntry {
  until: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitBucket>();
  private lockouts = new Map<string, LockoutEntry>();

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

  peek({ key, limit, windowMs }: RateLimitInput): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      return { allowed: true, remaining: limit, resetAt: now + windowMs };
    }

    return {
      allowed: bucket.count < limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  clearKey(key: string): void {
    this.buckets.delete(key);
    this.lockouts.delete(key);
  }

  setLockout(key: string, windowMs: number): void {
    this.lockouts.set(key, { until: Date.now() + windowMs });
  }

  checkLockout(key: string): RateLimitResult {
    const entry = this.lockouts.get(key);
    const now = Date.now();

    if (!entry || entry.until <= now) {
      this.lockouts.delete(key);
      return { allowed: true, remaining: 1, resetAt: now };
    }

    return { allowed: false, remaining: 0, resetAt: entry.until };
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

// ── Client IP extraction ───────────────────────────────────────────

/**
 * Extracts the client IP address from request headers.
 * Checks common proxy headers in order: x-forwarded-for, x-real-ip, cf-connecting-ip.
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

// ── Auth brute-force constants ──────────────────────────────────────

export const AUTH_BRUTE_FORCE_LIMIT = 5;
export const AUTH_BRUTE_FORCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const AUTH_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// ── Peek (read without incrementing) ────────────────────────────────

export async function peekRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  // In-memory only; auth brute-force uses local state for speed and reliability.
  return inMemoryRateLimitStore.peek(input);
}

// ── Clear a rate limit key ─────────────────────────────────────────

export async function clearRateLimitKey(key: string): Promise<void> {
  // In-memory only; auth brute-force uses local state for speed and reliability.
  inMemoryRateLimitStore.clearKey(key);
}

// ── Lockout management ─────────────────────────────────────────────

export async function checkRateLimitLockout(key: string): Promise<RateLimitResult> {
  try {
    return inMemoryRateLimitStore.checkLockout(key);
  } catch {
    return { allowed: true, remaining: 1, resetAt: Date.now() };
  }
}

export async function setRateLimitLockout(key: string, windowMs: number): Promise<void> {
  try {
    inMemoryRateLimitStore.setLockout(key, windowMs);
  } catch {
    // Best-effort; lockout is a safety net, not a guarantee
  }
}

// ── Composite rate limit check ────────────────────────────────────

/**
 * Check multiple rate limits at once and return the strictest (most restrictive) result.
 * Used for API key authentication where per-key, per-IP, and per-workspace limits
 * must all be enforced simultaneously.
 */
export async function checkRateLimitComposite(
  inputs: RateLimitInput[]
): Promise<RateLimitResult> {
  if (inputs.length === 0) {
    return { allowed: true, remaining: Infinity, resetAt: Date.now() };
  }

  const results = await Promise.all(inputs.map((input) => checkRateLimit(input)));

  let strictest: RateLimitResult = results[0];
  for (let i = 1; i < results.length; i++) {
    const current = results[i];
    // A denied result is always stricter than an allowed one
    if (!current.allowed && strictest.allowed) {
      strictest = current;
    } else if (!current.allowed && !strictest.allowed) {
      // Both denied: pick the one with the later reset (longer wait)
      if (current.resetAt > strictest.resetAt) {
        strictest = current;
      }
    } else if (current.allowed && strictest.allowed) {
      // Both allowed: pick the one with fewer remaining requests
      if (current.remaining < strictest.remaining) {
        strictest = current;
      }
    }
    // If current is allowed and strictest is denied, keep strictest
  }

  return strictest;
}

// ── API Key rate limit constants ───────────────────────────────────

/** Per-IP rate limit for API key usage (100 requests per minute per IP). */
export const API_KEY_IP_LIMIT = 100;

/** Window duration for per-IP API key rate limit (1 minute). */
export const API_KEY_IP_WINDOW_MS = 60_000;

/** Per-workspace rate limit for API key usage (1000 requests per minute per workspace). */
export const API_KEY_WORKSPACE_LIMIT = 1000;

/** Window duration for per-workspace API key rate limit (1 minute). */
export const API_KEY_WORKSPACE_WINDOW_MS = 60_000;

// ── Build HTTP rate-limit response headers ─────────────────────────

export function buildRateLimitExceededHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
    'X-RateLimit-Limit': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
