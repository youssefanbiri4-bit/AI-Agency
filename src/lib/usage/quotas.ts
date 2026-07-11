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
 */

import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  getUsageCounters,
  incrementUsageCounter,
  getMonthlyUsageByType,
  PLAN_LIMITS,
} from '@/lib/usage/usage-limits';
import type { BillingPlan } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
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

async function getUsageLimits(
  workspaceId: string,
  client?: SupabaseClient<Database>
): Promise<UsageLimit> {
  const supabase = client || (await createSupabaseServerClient());

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
    max_ai_generations_per_month:
      data.max_ai_generations_per_month ?? defaults.max_ai_generations_per_month ?? 20,
    max_tasks: readMetadataNumber(metadata, 'max_tasks') ?? defaults.max_tasks ?? null,
    max_creative_assets: data.max_creative_assets ?? defaults.max_creative_assets ?? 50,
    max_content_items: data.max_content_items ?? defaults.max_content_items ?? 30,
    max_reels_publishes_per_month:
      readMetadataNumber(metadata, 'max_reels_publishes_per_month') ??
      defaults.max_reels_publishes_per_month ??
      null,
    metadata,
  };
}

async function computeCurrentAiGenerations(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await client
    .from('creative_assets')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('asset_type', 'image')
    .gte('created_at', thirtyDaysAgo)
    .eq('source', 'openai');

  if (error) {
    usageLog.warn('Error counting ai generations', { workspaceId, error: error.message });
    return 0;
  }

  return count || 0;
}

async function computeCurrentTasks(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await client
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) return 0;
  return count || 0;
}

async function computeCurrentCreativeAssets(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await client
    .from('creative_assets')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) return 0;
  return count || 0;
}

async function computeCurrentContentItems(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await client
    .from('content_studio_items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) return 0;
  return count || 0;
}

async function computeCurrentContentPublishes(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await client
    .from('content_studio_items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'published');

  if (error) return 0;
  return count || 0;
}

async function computeCurrentReelsPublishes(workspaceId: string, client: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await client
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'published');

  if (error) return 0;
  return count || 0;
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
 * 1. usage_events monthly aggregation (precise, efficient for monthly-tracked types)
 * 2. Metadata counters from usage_limits (fast, may drift)
 * 3. DB COUNT queries (accurate but expensive) as ultimate fallback
 *
 * Using Math.max across all sources ensures we never under-count usage.
 * All quota types recorded via incrementUsageCounter are checked against
 * usage_events for precise monthly aggregation.
 */
export async function getCurrentUsage(workspaceId: string): Promise<CurrentUsage> {
  const supabase = await createSupabaseServerClient();
  const counters = await getUsageCounters(workspaceId);

  // Compute all three sources in parallel for all quota types
  const [
    eventsAiGen, eventsTasks, eventsAssets, eventsContentItems,
    eventsContentPublishes, eventsReels,
    dbAiGen, dbTasks, dbAssets, dbContentItems, dbContentPublishes, dbReels,
  ] = await Promise.all([
    getMonthlyUsageByType(workspaceId, 'ai_generations'),
    getMonthlyUsageByType(workspaceId, 'tasks'),
    getMonthlyUsageByType(workspaceId, 'creative_assets'),
    getMonthlyUsageByType(workspaceId, 'content_items'),
    getMonthlyUsageByType(workspaceId, 'content_publishes'),
    getMonthlyUsageByType(workspaceId, 'reels_publishes'),
    computeCurrentAiGenerations(workspaceId, supabase),
    computeCurrentTasks(workspaceId, supabase),
    computeCurrentCreativeAssets(workspaceId, supabase),
    computeCurrentContentItems(workspaceId, supabase),
    computeCurrentContentPublishes(workspaceId, supabase),
    computeCurrentReelsPublishes(workspaceId, supabase),
  ]);

  // Use max across all sources for conservative (never under-count) estimate
  return {
    ai_generations: Math.max(counters.ai_generations ?? 0, eventsAiGen, dbAiGen),
    tasks: Math.max(counters.tasks ?? 0, eventsTasks, dbTasks),
    creative_assets: Math.max(counters.creative_assets ?? 0, eventsAssets, dbAssets),
    content_items: Math.max(counters.content_items ?? 0, eventsContentItems, dbContentItems),
    content_publishes: Math.max(counters.content_publishes ?? 0, eventsContentPublishes, dbContentPublishes),
    reels_publishes: Math.max(counters.reels_publishes ?? 0, eventsReels, dbReels),
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

export async function incrementUsage(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<void> {
  try {
    await incrementUsageCounter(workspaceId, type, amount);
    usageLog.info('Usage incremented', { workspaceId, type, amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    usageLog.error('incrementUsage failed', { workspaceId, type, amount, error: message });
    throw error;
  }
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