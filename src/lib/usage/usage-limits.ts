/**
 * Usage limits and metered counters — plan defaults, counter sync, usage_events.
 * All mutations use the Supabase service role (server-only).
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, BillingPlan } from '@/types/database';
import type { JsonObject } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type { QuotaType } from '@/lib/usage/quotas';

const usageLog = logger.child('usage:limits');

export type PlanLimits = {
  plan: BillingPlan;
  max_ai_generations_per_month: number | null;
  max_creative_assets: number | null;
  max_content_items: number | null;
  max_tasks: number | null;
  max_reels_publishes_per_month: number | null;
};

export const PLAN_LIMITS: Record<BillingPlan, PlanLimits> = {
  free: {
    plan: 'free',
    max_ai_generations_per_month: 20,
    max_creative_assets: 50,
    max_content_items: 30,
    max_tasks: 40,
    max_reels_publishes_per_month: 10,
  },
  starter: {
    plan: 'starter',
    max_ai_generations_per_month: 100,
    max_creative_assets: 200,
    max_content_items: 100,
    max_tasks: 200,
    max_reels_publishes_per_month: 50,
  },
  pro: {
    plan: 'pro',
    max_ai_generations_per_month: 500,
    max_creative_assets: 1000,
    max_content_items: 500,
    max_tasks: 1000,
    max_reels_publishes_per_month: 200,
  },
  agency: {
    plan: 'agency',
    max_ai_generations_per_month: null,
    max_creative_assets: null,
    max_content_items: null,
    max_tasks: null,
    max_reels_publishes_per_month: null,
  },
};

function getAdminClient(): SupabaseClient<Database> {
  const { client, error } = getSupabaseAdmin();
  if (!client) {
    throw new Error(error ?? 'Supabase admin client is not configured');
  }
  return client;
}

export async function ensureUsageLimitsRow(workspaceId: string, plan: BillingPlan = 'free') {
  const limits = PLAN_LIMITS[plan];
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('usage_limits')
    .upsert(
      {
        workspace_id: workspaceId,
        plan: limits.plan,
        max_ai_generations_per_month: limits.max_ai_generations_per_month,
        max_creative_assets: limits.max_creative_assets,
        max_content_items: limits.max_content_items,
        metadata: {
          max_tasks: limits.max_tasks,
          max_reels_publishes_per_month: limits.max_reels_publishes_per_month,
        },
      },
      { onConflict: 'workspace_id', ignoreDuplicates: true }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    usageLog.error('Failed to ensure usage_limits row', { workspaceId, error: error.message });
    throw new Error('Failed to initialize usage limits');
  }

  return data;
}

export async function syncUsageLimitsFromPlan(workspaceId: string, plan: BillingPlan) {
  const limits = PLAN_LIMITS[plan];
  const supabase = getAdminClient();

  const { data: existing, error: readError } = await supabase
    .from('usage_limits')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (readError) {
    usageLog.error('Failed to read usage_limits before plan sync', {
      workspaceId,
      plan,
      error: readError.message,
    });
    throw new Error('Failed to sync usage limits');
  }

  const metadata: JsonObject = {
    ...((existing?.metadata as JsonObject) ?? {}),
    max_tasks: limits.max_tasks,
    max_reels_publishes_per_month: limits.max_reels_publishes_per_month,
  };

  const { error } = await supabase
    .from('usage_limits')
    .upsert(
      {
        workspace_id: workspaceId,
        plan: limits.plan,
        max_ai_generations_per_month: limits.max_ai_generations_per_month,
        max_creative_assets: limits.max_creative_assets,
        max_content_items: limits.max_content_items,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    );

  if (error) {
    usageLog.error('Failed to sync usage limits from plan', { workspaceId, plan, error: error.message });
    throw new Error('Failed to sync usage limits');
  }
}

export async function getUsageCounters(
  workspaceId: string
): Promise<Partial<Record<QuotaType, number>>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('usage_limits')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    usageLog.warn('Failed to load usage counters', { workspaceId, error: error.message });
    return {};
  }

  const metadata = (data?.metadata as JsonObject) ?? {};
  const counters: Partial<Record<QuotaType, number>> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!key.startsWith('current_') || typeof value !== 'number') {
      continue;
    }

    const type = key.replace('current_', '') as QuotaType;
    counters[type] = value;
  }

  return counters;
}

export async function incrementUsageCounter(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<void> {
  const supabase = getAdminClient();

  const { data: existing, error: readError } = await supabase
    .from('usage_limits')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (readError) {
    usageLog.error('Failed to read usage_limits for increment', {
      workspaceId,
      type,
      error: readError.message,
    });
    throw new Error('Failed to read usage counters');
  }

  if (!existing) {
    await ensureUsageLimitsRow(workspaceId);
  }

  const metadata: JsonObject = { ...((existing?.metadata as JsonObject) ?? {}) };
  const counterKey = `current_${type}`;
  const current = typeof metadata[counterKey] === 'number' ? (metadata[counterKey] as number) : 0;

  metadata[counterKey] = current + amount;
  metadata.last_updated = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('usage_limits')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId);

  if (updateError) {
    usageLog.error('Failed to increment usage counter', {
      workspaceId,
      type,
      amount,
      error: updateError.message,
    });
    throw new Error('Failed to increment usage counter');
  }

  usageLog.info('Usage counter incremented', { workspaceId, type, amount });

  try {
    await recordUsageEvent({
      workspaceId,
      eventType: `${type}_increment`,
      quotaType: type,
      amount,
      metadata: { counter_source: 'metadata' },
    });
  } catch (eventError) {
    usageLog.warn('Failed to record usage event for monthly aggregation', {
      workspaceId,
      type,
      error: eventError instanceof Error ? eventError.message : String(eventError),
    });
  }
}

export async function recordUsageEvent(input: {
  workspaceId: string;
  userId?: string | null;
  eventType: string;
  quotaType: QuotaType;
  amount?: number;
  metadata?: JsonObject;
}): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.from('usage_events').insert({
    workspace_id: input.workspaceId,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    quota_type: input.quotaType,
    amount: input.amount ?? 1,
    metadata: (input.metadata ?? {}) as JsonObject,
  });

  if (error) {
    usageLog.error('Failed to record usage event', {
      workspaceId: input.workspaceId,
      quotaType: input.quotaType,
      error: error.message,
    });
    throw new Error('Failed to record usage event');
  }

  usageLog.debug('Usage event recorded', {
    workspaceId: input.workspaceId,
    quotaType: input.quotaType,
    amount: input.amount,
  });
}

export async function getMonthlyUsageByType(
  workspaceId: string,
  quotaType: QuotaType
): Promise<number> {
  const supabase = getAdminClient();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const { data, error } = await supabase
    .from('usage_events')
    .select('amount')
    .eq('workspace_id', workspaceId)
    .eq('quota_type', quotaType)
    .gte('created_at', monthStart.toISOString());

  if (error) {
    usageLog.warn('Failed to query monthly usage events', {
      workspaceId,
      quotaType,
      error: error.message,
    });
    return 0;
  }

  return data.reduce((sum, row) => sum + (row.amount || 0), 0);
}

export async function getMonthlyUsageSummary(
  workspaceId: string
): Promise<Partial<Record<QuotaType, number>>> {
  const supabase = getAdminClient();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const { data, error } = await supabase
    .from('usage_events')
    .select('quota_type, amount')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart.toISOString());

  if (error || !data) {
    usageLog.warn('Failed to query monthly usage summary', {
      workspaceId,
      error: error?.message,
    });
    return {};
  }

  const summary: Partial<Record<QuotaType, number>> = {};
  for (const row of data) {
    const qt = row.quota_type as unknown as QuotaType;
    summary[qt] = (summary[qt] ?? 0) + (row.amount ?? 0);
  }

  return summary;
}