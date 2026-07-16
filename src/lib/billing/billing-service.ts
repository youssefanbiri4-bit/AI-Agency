import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, BillingPlan, BillingPeriod } from '@/types/database';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { PLANS, calculateMonthlyCost, getPlanPricingDescription } from '@/lib/billing/plans';
import { syncUsageLimitsFromPlan } from '@/lib/usage/usage-limits';

const billingLog = logger.child('billing:service');

function getAdminClient(): SupabaseClient<Database> {
  const { client, error } = getSupabaseAdmin();
  if (!client) {
    throw new Error(error ?? 'Supabase admin client is not configured');
  }
  return client;
}

export interface SubscriptionWithDetails {
  plan: (typeof PLANS)[BillingPlan] | null;
  memberCount: number;
  pricing: ReturnType<typeof getPlanPricingDescription>;
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionWithDetails> {
  const planId = await getWorkspacePlan(workspaceId);
  const plan = PLANS[planId] ?? PLANS.free;
  const memberCount = await getMemberCount(workspaceId);
  const pricing = getPlanPricingDescription(planId, memberCount);

  return { plan, memberCount, pricing };
}

export async function getWorkspacePlan(workspaceId: string): Promise<BillingPlan> {
  try {
    const supabase = getAdminClient();
    const { data } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    return (data?.plan as BillingPlan) ?? 'free';
  } catch {
    return 'free';
  }
}

export async function getMemberCount(workspaceId: string): Promise<number> {
  try {
    const supabase = getAdminClient();

    const { count, error } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (error) {
      billingLog.warn('Failed to count workspace members', { workspaceId, error: error.message });
      return 1;
    }

    return count ?? 1;
  } catch {
    return 1;
  }
}

export interface PlanChangeResult {
  success: boolean;
  previousPlan: BillingPlan;
  newPlan: BillingPlan;
  message: string;
  requiresSync: boolean;
}

export async function changePlan(
  workspaceId: string,
  newPlan: BillingPlan,
  _period?: BillingPeriod,
  userId?: string | null
): Promise<PlanChangeResult> {
  const supabase = getAdminClient();

  if (userId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return {
        success: false,
        previousPlan: 'free',
        newPlan,
        message: 'You are not a member of this workspace.',
        requiresSync: false,
      };
    }

    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(membership.role)) {
      return {
        success: false,
        previousPlan: 'free',
        newPlan,
        message: `Only workspace owners and admins can change the plan. Your role: ${membership.role}.`,
        requiresSync: false,
      };
    }
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const previousPlan: BillingPlan = (existing?.plan as BillingPlan) ?? 'free';

  if (previousPlan === newPlan) {
    return {
      success: true,
      previousPlan,
      newPlan,
      message: `Already on the ${PLANS[newPlan].name} plan.`,
      requiresSync: false,
    };
  }

  const targetPlan = PLANS[newPlan];
  if (!targetPlan) {
    return {
      success: false,
      previousPlan,
      newPlan,
      message: `Invalid plan: ${newPlan}.`,
      requiresSync: false,
    };
  }

  const memberCount = await getMemberCount(workspaceId);
  if (targetPlan.seatPricing && targetPlan.seatPricing.maxSeats !== null) {
    if (memberCount > targetPlan.seatPricing.maxSeats) {
      return {
        success: false,
        previousPlan,
        newPlan,
        message: `Cannot downgrade to ${targetPlan.name}: workspace has ${memberCount} members, but plan allows max ${targetPlan.seatPricing.maxSeats}. Remove members first.`,
        requiresSync: false,
      };
    }
  }

  const now = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error: upsertError } = await supabase.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      plan: newPlan,
      status: 'active',
      current_period_start: now,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      metadata: {
        previous_plan: previousPlan,
        changed_at: now,
        member_count_at_change: memberCount,
      },
    },
    { onConflict: 'workspace_id' }
  );

  if (upsertError) {
    billingLog.error('Failed to update subscription', {
      workspaceId,
      previousPlan,
      newPlan,
      error: upsertError.message,
    });
    return {
      success: false,
      previousPlan,
      newPlan,
      message: 'Failed to update subscription. Please try again.',
      requiresSync: false,
    };
  }

  try {
    await syncUsageLimitsFromPlan(workspaceId, newPlan);
  } catch (syncError) {
    billingLog.warn('Plan changed but usage limits sync failed', {
      workspaceId,
      previousPlan,
      newPlan,
      error: syncError instanceof Error ? syncError.message : String(syncError),
    });
  }

  billingLog.info('Plan changed successfully', {
    workspaceId,
    previousPlan,
    newPlan,
    memberCount,
  });

  const isUpgrade = targetPlan.sortOrder > (PLANS[previousPlan]?.sortOrder ?? 0);

  return {
    success: true,
    previousPlan,
    newPlan,
    message: isUpgrade
      ? `Upgraded to ${targetPlan.name} successfully! New limits are active.`
      : `Downgraded to ${targetPlan.name}. Some features may be restricted.`,
    requiresSync: true,
  };
}

export async function ensureSubscription(workspaceId: string): Promise<void> {
  const supabase = getAdminClient();

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('subscriptions').insert({
    workspace_id: workspaceId,
    plan: 'free',
    status: 'active',
    cancel_at_period_end: false,
    metadata: {},
  });

  if (error) {
    billingLog.error('Failed to ensure subscription', { workspaceId, error: error.message });
  }
}

export async function getEstimatedMonthlyCost(workspaceId: string, planId: BillingPlan): Promise<{
  basePrice: number;
  seatCost: number;
  total: number;
  memberCount: number;
}> {
  const memberCount = await getMemberCount(workspaceId);
  const total = calculateMonthlyCost(planId, memberCount);

  const plan = PLANS[planId];
  const basePrice = plan?.monthlyPrice ?? 0;
  let seatCost = 0;

  if (plan?.seatPricing && memberCount > plan.seatPricing.includedSeats) {
    seatCost = (memberCount - plan.seatPricing.includedSeats) * plan.seatPricing.perSeatMonth;
  }

  return { basePrice, seatCost, total, memberCount };
}
