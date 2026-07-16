/**
 * Tiered Rate Limiting
 *
 * Provides role-based rate limit tiers so that owner/admin roles get higher
 * limits than operators/editors/viewers. Also supports per-API-key and
 * per-workspace rate limit tiers.
 *
 * Usage:
 *   const tier = getRateLimitTier('owner');
 *   const result = await checkTieredRateLimit(workspaceId, tier, 'ai:chat');
 */

import 'server-only';

import {
  checkRateLimit,
  type RateLimitResult,
} from '@/lib/rate-limit';
import {
  checkSlidingWindowRateLimit,
  buildWorkspaceUserRateLimitKey,
  type SlidingWindowResult,
} from '@/lib/sliding-window-rate-limit';

// ─── Rate Limit Tiers ───────────────────────────────────────────────────────

export type RateLimitTier = 'enterprise' | 'power' | 'standard' | 'basic' | 'restricted';

export interface TierConfig {
  /** Multiplier applied to default rate limits */
  multiplier: number;
  /** Label for display */
  label: string;
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, TierConfig> = {
  enterprise: { multiplier: 5.0, label: 'Enterprise (5x limit)' },
  power:      { multiplier: 2.5, label: 'Power (2.5x limit)' },
  standard:   { multiplier: 1.0, label: 'Standard (1x limit)' },
  basic:      { multiplier: 0.5, label: 'Basic (0.5x limit)' },
  restricted: { multiplier: 0.25, label: 'Restricted (0.25x limit)' },
};

// ─── Tier Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the rate limit tier from a workspace role.
 *
 * @param role - The user's workspace role (owner, admin, operator, editor, viewer)
 * @returns The corresponding rate limit tier
 */
export function getRateLimitTier(role?: string | null): RateLimitTier {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'enterprise';
    case 'operator':
      return 'power';
    case 'editor':
      return 'standard';
    case 'viewer':
      return 'basic';
    default:
      return 'standard';
  }
}

/**
 * Resolve the rate limit tier from an API key's rate_limit field.
 *
 * The API key table has a `rate_limit` column (requests per minute).
 * We map this to a tier:
 *   >= 300  → enterprise
 *   >= 150  → power
 *   >= 60   → standard
 *   >= 30   → basic
 *   < 30    → restricted
 */
export function getApiKeyRateLimitTier(rateLimit: number): RateLimitTier {
  if (rateLimit >= 300) return 'enterprise';
  if (rateLimit >= 150) return 'power';
  if (rateLimit >= 60) return 'standard';
  if (rateLimit >= 30) return 'basic';
  return 'restricted';
}

/**
 * Get the effective limit for a given base limit and tier.
 */
export function applyTierMultiplier(baseLimit: number, tier: RateLimitTier): number {
  const config = RATE_LIMIT_TIERS[tier] ?? RATE_LIMIT_TIERS.standard;
  return Math.max(1, Math.round(baseLimit * config.multiplier));
}

// ─── Tiered Rate Limit Checks ──────────────────────────────────────────────

/**
 * Check a tiered fixed-window rate limit.
 * The base limit is multiplied by the tier factor.
 */
export async function checkTieredRateLimit(
  key: string,
  tier: RateLimitTier,
  baseLimit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const effectiveLimit = applyTierMultiplier(baseLimit, tier);
  return checkRateLimit({ key, limit: effectiveLimit, windowMs });
}

/**
 * Check a tiered sliding-window rate limit.
 * The base limit is multiplied by the tier factor.
 */
export async function checkTieredSlidingRateLimit(
  workspaceId: string,
  userId: string,
  tier: RateLimitTier,
  action: string,
  baseLimit: number,
  windowMs: number
): Promise<SlidingWindowResult> {
  const effectiveLimit = applyTierMultiplier(baseLimit, tier);
  const key = buildWorkspaceUserRateLimitKey(workspaceId, userId, action);

  return checkSlidingWindowRateLimit({
    key,
    limit: effectiveLimit,
    windowMs,
  });
}

// ─── Preset Tiers for Common Actions ────────────────────────────────────────

/**
 * Default rate limits per action (base values before tier multiplier).
 */
export const TIERED_RATE_LIMIT_DEFAULTS: Record<string, { limit: number; windowMs: number }> = {
  'content:publish':       { limit: 20,  windowMs: 60_000 },
  'content:generate':      { limit: 10,  windowMs: 60_000 },
  'content:save':          { limit: 60,  windowMs: 60_000 },
  'report:generate':       { limit: 5,   windowMs: 60_000 },
  'report:export-pdf':     { limit: 3,   windowMs: 60_000 },
  'task:execute':          { limit: 30,  windowMs: 60_000 },
  'task:create':           { limit: 20,  windowMs: 60_000 },
  'ai:chat':               { limit: 30,  windowMs: 60_000 },
  'ai:generate-text':      { limit: 10,  windowMs: 60_000 },
  'ai:generate-image':     { limit: 5,   windowMs: 60_000 },
  'ad:sync':               { limit: 5,   windowMs: 60_000 },
  'usage:read':            { limit: 30,  windowMs: 60_000 },
  'settings:update':       { limit: 10,  windowMs: 60_000 },
  'bulk:operation':        { limit: 3,   windowMs: 60_000 },
  'auth:login':            { limit: 5,   windowMs: 300_000 },   // 5 per 5 min
  'auth:signup':           { limit: 3,   windowMs: 300_000 },   // 3 per 5 min
  'api:endpoint':          { limit: 60,  windowMs: 60_000 },    // 60 per min
};

/**
 * Convenience wrapper: check a tiered sliding rate limit for a workspace user.
 *
 * @example
 * ```ts
 * const result = await checkTieredUserRateLimit(workspaceId, userId, 'owner', 'ai:chat');
 * if (!result.allowed) {
 *   // Handle rate limit
 * }
 * ```
 */
export async function checkTieredUserRateLimit(
  workspaceId: string,
  userId: string,
  role: string | null | undefined,
  action: string
): Promise<SlidingWindowResult> {
  const tier = getRateLimitTier(role);
  const defaults = TIERED_RATE_LIMIT_DEFAULTS[action] ?? { limit: 60, windowMs: 60_000 };

  return checkTieredSlidingRateLimit(
    workspaceId,
    userId,
    tier,
    action,
    defaults.limit,
    defaults.windowMs
  );
}
