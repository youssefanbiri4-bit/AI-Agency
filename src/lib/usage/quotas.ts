/**
 * Usage Quotas System
 *
 * Provides quota checking, usage incrementing, and current usage retrieval
 * for workspaces based on plan limits in usage_limits table.
 *
 * Types supported: ai_generations, tasks, creative_assets, content_items,
 * content_publishes, reels_publishes, paid_ads_spend, cost_usd
 *
 * Integrates with production gate and RBAC where needed.
 * Hard limits block operations when exceeded.
 * Quota alerts are sent when thresholds are crossed (80% warning, 95% critical).
 */

import 'server-only';

import {
  getUsageCounters,
  incrementUsageCounter,
  getMonthlyUsageByType,
  getUsageCountersFromTable,
  PLAN_LIMITS,
} from '@/lib/usage/usage-limits';
import { checkAndSendQuotaAlert } from '@/lib/usage/quota-alerts';
import type { BillingPlan } from '@/types/database';
import type { JsonObject } from '@/types';
import { logger } from '@/lib/logger';

const usageLog = logger.child('usage:quotas');

export type QuotaType =
  | 'ai_generations'
  | 'tasks'
  | 'creative_assets'
  | 'content_items'
  | 'content_publishes'
  | 'reels_publishes'
  | 'paid_ads_spend'
  | 'cost_usd';

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  percentUsed: number;
  message?: string;
}

export interface CurrentUsage {
  ai_generations: number;
  tasks: number;
  creative_assets: number;
  content_items: number;
  content_publishes: number;
  reels_publishes: number;
  estimated_cost_usd: number;
  last_reset?: string;
}

export interface UsageLimit {
  plan: string;
  max_ai_generations_per_month: number | null;
  max_tasks: number | null;
  max_creative_assets: number | null;
  max_content_items: number | null;
  max_reels_publishes_per_month: number | null;
  metadata?: Record<string, unknown>;
}

const DEFAULT_LIMITS: Record<string, UsageLimit> = {
  free: {
    plan: 'free',
    max_ai_generations_per_month: PLAN_LIMITS.free.max_ai_generations_per_month,
    max_tasks: PLAN_LIMITS.free.max_tasks,
    max_creative_assets: PLAN_LIMITS.free.max_creative_assets,
    max_content_items: PLAN_LIMITS.free.max_content_items,
    max_reels_publishes_per_month: PLAN_LIMITS.free.max_reels_publishes_per_month,
  },
  starter: {
    plan: 'starter',
    max_ai_generations_per_month: PLAN_LIMITS.starter.max_ai_generations_per_month,
    max_tasks: PLAN_LIMITS.starter.max_tasks,
    max_creative_assets: PLAN_LIMITS.starter.max_creative_assets,
    max_content_items: PLAN_LIMITS.starter.max_content_items,
    max_reels_publishes_per_month: PLAN_LIMITS.starter.max_reels_publishes_per_month,
  },
  pro: {
    plan: 'pro',
    max_ai_generations_per_month: PLAN_LIMITS.pro.max_ai_generations_per_month,
    max_tasks: PLAN_LIMITS.pro.max_tasks,
    max_creative_assets: PLAN_LIMITS.pro.max_creative_assets,
    max_content_items: PLAN_LIMITS.pro.max_content_items,
    max_reels_publishes_per_month: PLAN_LIMITS.pro.max_reels_publishes_per_month,
  },
  agency: {
    plan: 'agency',
    max_ai_generations_per_month: PLAN_LIMITS.agency.max_ai_generations_per_month,
    max_tasks: PLAN_LIMITS.agency.max_tasks,
    max_creative_assets: PLAN_LIMITS.agency.max_creative_assets,
    max_content_items: PLAN_LIMITS.agency.max_content_items,
    max_reels_publishes_per_month: PLAN_LIMITS.agency.max_reels_publishes_per_month,
  },
};

function readMetadataNumber(metadata: JsonObject, key: string): number | null {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Read an override value from metadata.overrides, then fall back to a DB column, then to defaults.
 * This implements the override > DB > plan default > hardcoded fallback chain.
 */
function resolveLimit(
  metadata: JsonObject,
  overrideKey: string,
  dbValue: number | null | undefined,
  planDefault: number | null,
  hardcodedFallback: number
): number | null {
  // 1. Check admin override in metadata.overrides
  const overrides = metadata.overrides as JsonObject | undefined;
  if (overrides) {
    const overrideVal = readMetadataNumber(overrides, overrideKey);
    if (overrideVal !== null) {
      return overrideVal;
    }
  }

  // 2. Check dedicated DB column
  if (dbValue !== null && dbValue !== undefined) {
    return dbValue;
  }

  // 3. Check plan default
  if (planDefault !== null && planDefault !== undefined) {
    return planDefault;
  }

  // 4. Hardcoded fallback
  return hardcodedFallback;
}

export async function getUsageLimits(workspaceId: string): Promise<UsageLimit> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-server');
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return { ...DEFAULT_LIMITS.free, plan: 'free' };
  }

  const { data, error } = await supabase
    .from('usage_limits')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    usageLog.warn('Failed to load usage_limits, using defaults', { workspaceId, error: error.message });
  }

  if (!data) {
    return { ...DEFAULT_LIMITS.free, plan: 'free' };
  }

  const plan = (data.plan || 'free') as BillingPlan;
  const defaults = DEFAULT_LIMITS[plan] ?? DEFAULT_LIMITS.free;
  const metadata = (data.metadata as JsonObject) ?? {};

  return {
    plan,
    max_ai_generations_per_month: resolveLimit(
      metadata,
      'max_ai_generations_per_month',
      data.max_ai_generations_per_month,
      defaults.max_ai_generations_per_month,
      20
    ),
    max_tasks: resolveLimit(
      metadata,
      'max_tasks',
      readMetadataNumber(metadata, 'max_tasks'),
      defaults.max_tasks,
      40
    ),
    max_creative_assets: resolveLimit(
      metadata,
      'max_creative_assets',
      data.max_creative_assets,
      defaults.max_creative_assets,
      50
    ),
    max_content_items: resolveLimit(
      metadata,
      'max_content_items',
      data.max_content_items,
      defaults.max_content_items,
      30
    ),
    max_reels_publishes_per_month: resolveLimit(
      metadata,
      'max_reels_publishes_per_month',
      readMetadataNumber(metadata, 'max_reels_publishes_per_month'),
      defaults.max_reels_publishes_per_month,
      10
    ),
    metadata,
  };
}

function resolveUsageValue(counter: number | undefined, fallback: number): number {
  if (typeof counter === 'number' && Number.isFinite(counter)) {
    return Math.max(counter, fallback);
  }

  return fallback;
}

/**
 * Get the most accurate current usage for a workspace.
 *
 * Strategy: use the maximum (most conservative) value from three sources:
 * 1. usage_counters table (pre-computed by DB triggers, fast + accurate)
 * 2. Metadata counters from usage_limits (fast, may drift)
 * 3. usage_events monthly aggregation (precise, efficient for monthly-tracked types)
 *
 * Using Math.max across all sources ensures we never under-count usage.
 */
export async function getCurrentUsage(workspaceId: string): Promise<CurrentUsage> {
  const [counters, tableCounters, eventsSummary] = await Promise.all([
    getUsageCounters(workspaceId),
    getUsageCountersFromTable(workspaceId),
    getMonthlyUsageByType(workspaceId, 'ai_generations'),
  ]);

  // Use max across all sources for conservative (never under-count) estimate
  return {
    ai_generations: Math.max(
      counters.ai_generations ?? 0,
      tableCounters.ai_generations ?? 0,
      eventsSummary,
    ),
    tasks: Math.max(counters.tasks ?? 0, tableCounters.tasks ?? 0),
    creative_assets: Math.max(counters.creative_assets ?? 0, tableCounters.creative_assets ?? 0),
    content_items: Math.max(counters.content_items ?? 0, tableCounters.content_items ?? 0),
    content_publishes: Math.max(counters.content_publishes ?? 0, tableCounters.content_publishes ?? 0),
    reels_publishes: Math.max(counters.reels_publishes ?? 0, tableCounters.reels_publishes ?? 0),
    estimated_cost_usd: resolveUsageValue(counters.cost_usd, 0),
  };
}

function buildQuotaMessage(type: QuotaType, current: number, limit: number, percentUsed: number): string | undefined {
  if (current >= limit) {
    return `Quota exceeded for ${type}. Used ${current}/${limit}.`;
  }

  if (percentUsed >= 80) {
    return `Approaching limit for ${type} (${percentUsed}%).`;
  }

  return undefined;
}

export async function checkQuota(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<QuotaCheckResult> {
  const limits = await getUsageLimits(workspaceId);
  const usage = await getCurrentUsage(workspaceId);

  let current = 0;
  let limit: number | null = null;

  switch (type) {
    case 'ai_generations':
      current = usage.ai_generations;
      limit = limits.max_ai_generations_per_month;
      break;
    case 'tasks':
      current = usage.tasks;
      limit = limits.max_tasks;
      break;
    case 'creative_assets':
      current = usage.creative_assets;
      limit = limits.max_creative_assets;
      break;
    case 'content_items':
      current = usage.content_items;
      limit = limits.max_content_items;
      break;
    case 'content_publishes':
      current = usage.content_publishes;
      limit = limits.max_content_items;
      break;
    case 'reels_publishes':
      current = usage.reels_publishes;
      limit = limits.max_reels_publishes_per_month ?? limits.max_content_items;
      break;
    case 'cost_usd':
      current = usage.estimated_cost_usd;
      limit = null;
      break;
    default:
      return { allowed: true, current: 0, limit: null, percentUsed: 0 };
  }

  if (limit === null) {
    return {
      allowed: true,
      current,
      limit: null,
      percentUsed: 0,
    };
  }

  const percentUsed = Math.min(100, Math.round((current / limit) * 100));
  const allowed = current + amount <= limit;

  return {
    allowed,
    current,
    limit,
    percentUsed,
    message: buildQuotaMessage(type, current, limit, percentUsed),
  };
}

/**
 * Error thrown when a hard usage limit would be exceeded.
 * Carries the quota context so callers/UI can surface accurate details.
 */
export class QuotaExceededError extends Error {
  readonly quotaType: QuotaType;
  readonly current: number;
  readonly limit: number | null;
  readonly percentUsed: number;

  constructor(type: QuotaType, result: QuotaCheckResult) {
    super(result.message || `Quota exceeded for ${type}. Used ${result.current}/${result.limit ?? '∞'}.`);
    this.name = 'QuotaExceededError';
    this.quotaType = type;
    this.current = result.current;
    this.limit = result.limit;
    this.percentUsed = result.percentUsed;
  }
}

/**
 * Enforce a hard usage limit before an operation runs.
 * Throws {@link QuotaExceededError} when the operation would exceed the limit.
 * Returns the quota check result (e.g. for surfacing near-limit warnings).
 */
export async function enforceQuota(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<QuotaCheckResult> {
  const result = await checkQuota(workspaceId, type, amount);

  if (!result.allowed) {
    usageLog.warn('Hard limit blocked operation', {
      workspaceId,
      type,
      current: result.current,
      limit: result.limit,
    });
    throw new QuotaExceededError(type, result);
  }

  return result;
}

export async function incrementUsage(
  workspaceId: string,
  type: QuotaType,
  amount = 1,
  userId?: string | null
): Promise<void> {
  try {
    await incrementUsageCounter(workspaceId, type, amount, userId);
    usageLog.info('Usage incremented', { workspaceId, type, amount });

    // Check and send quota alerts asynchronously (non-blocking)
    // We catch errors here so alert failures don't break the increment operation
    checkAndSendQuotaAlertWithLimits(workspaceId, type, amount).catch((err) => {
      usageLog.warn('Quota alert check failed (non-critical)', {
        workspaceId,
        type,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    usageLog.error('incrementUsage failed', { workspaceId, type, amount, error: message });
    throw error;
  }
}

/**
 * Internal helper to check and send quota alerts after an increment.
 * Fetches the current usage and limit, then delegates to checkAndSendQuotaAlert.
 */
async function checkAndSendQuotaAlertWithLimits(
  workspaceId: string,
  type: QuotaType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- amount reserved for future alert granularity
  amount: number
): Promise<void> {
  const limits = await getUsageLimits(workspaceId);
  const usage = await getCurrentUsage(workspaceId);

  let current = 0;
  let limit: number | null = null;

  switch (type) {
    case 'ai_generations':
      current = usage.ai_generations;
      limit = limits.max_ai_generations_per_month;
      break;
    case 'tasks':
      current = usage.tasks;
      limit = limits.max_tasks;
      break;
    case 'creative_assets':
      current = usage.creative_assets;
      limit = limits.max_creative_assets;
      break;
    case 'content_items':
      current = usage.content_items;
      limit = limits.max_content_items;
      break;
    case 'content_publishes':
      current = usage.content_publishes;
      limit = limits.max_content_items;
      break;
    case 'reels_publishes':
      current = usage.reels_publishes;
      limit = limits.max_reels_publishes_per_month ?? limits.max_content_items;
      break;
    default:
      return; // No alerts for cost_usd or other types
  }

  await checkAndSendQuotaAlert(workspaceId, type, current, limit);
}

export async function getQuotaForType(workspaceId: string, type: QuotaType) {
  return checkQuota(workspaceId, type);
}

export async function getAllQuotas(workspaceId: string) {
  const types: QuotaType[] = [
    'ai_generations',
    'tasks',
    'creative_assets',
    'content_items',
    'content_publishes',
    'reels_publishes',
  ];
  const results = await Promise.all(types.map((t) => checkQuota(workspaceId, t)));

  return Object.fromEntries(types.map((t, i) => [t, results[i]]));
}