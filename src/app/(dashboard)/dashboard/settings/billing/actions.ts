/**
 * Usage & Limits Server Actions
 *
 * Server-side data loading and mutations for the Usage & Limits page.
 * Internal platform — no payment processing.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { requirePageAccess } from '@/lib/auth/rbac';
import { getCurrentUsage, getAllQuotas } from '@/lib/usage/quotas';
import { PLAN_LIMITS } from '@/lib/usage/usage-limits';
import {
  getSubscription,
  changePlan,
} from '@/lib/billing/billing-service';
import { PLANS, ACTIVE_PLANS, calculateMonthlyCost } from '@/lib/billing/plans';
import type { BillingPlan } from '@/types/database';
import { logger } from '@/lib/logger';

const billingActionLog = logger.child('billing:actions');

export interface BillingPageData {
  subscription: Awaited<ReturnType<typeof getSubscription>>;
  quotas: Record<string, Awaited<ReturnType<typeof getAllQuotas>>[keyof typeof getAllQuotas]>;
  currentUsage: Awaited<ReturnType<typeof getCurrentUsage>>;
  availablePlans: typeof ACTIVE_PLANS;
  planLimits: typeof PLAN_LIMITS;
  upgradeCosts: Array<{
    planId: BillingPlan;
    monthlyCost: number;
    memberCount: number;
  }>;
}

/**
 * Load all usage and plan data for the settings page.
 */
export async function loadBillingPageData(): Promise<BillingPageData | { error: string }> {
  try {
    const pageAccess = await requirePageAccess('/dashboard/settings/billing');
    if (!pageAccess.ok) {
      redirect(`/dashboard?access_denied=1&from=/dashboard/settings/billing`);
    }

    const supabase = await createSupabaseServerClient();
    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    const workspaceId = workspaceResult.data?.id;

    if (!workspaceId) {
      return { error: 'Workspace required to view usage & limits.' };
    }

    const [subscription, currentUsage, quotas] =
      await Promise.all([
        getSubscription(workspaceId),
        getCurrentUsage(workspaceId),
        getAllQuotas(workspaceId),
      ]);

    const memberCount = subscription.memberCount;
    const upgradeCosts = ACTIVE_PLANS.map((plan) => ({
      planId: plan.id,
      monthlyCost: calculateMonthlyCost(plan.id, memberCount),
      memberCount,
    }));

    return {
      subscription,
      quotas,
      currentUsage,
      availablePlans: ACTIVE_PLANS,
      planLimits: PLAN_LIMITS,
      upgradeCosts,
    };
  } catch (error) {
    billingActionLog.error('Failed to load billing page data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: 'Failed to load usage & limits data. Please try again.' };
  }
}

export interface PlanChangeActionState {
  success: boolean;
  message: string;
  newPlan?: BillingPlan;
  previousPlan?: BillingPlan;
}

/**
 * Change the workspace plan (upgrade or downgrade).
 * Only workspace owners and admins can change the plan.
 */
export async function changePlanAction(
  prevState: PlanChangeActionState | null,
  formData: FormData
): Promise<PlanChangeActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    const workspaceId = workspaceResult.data?.id;

    if (!workspaceId) {
      return { success: false, message: 'Workspace required.' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    const callerUserId = user?.id ?? null;

    const newPlan = formData.get('plan') as BillingPlan;

    if (!newPlan || !PLANS[newPlan]) {
      return { success: false, message: 'Invalid plan selected.' };
    }

    const result = await changePlan(workspaceId, newPlan, 'monthly', callerUserId);

    revalidatePath('/dashboard/settings/billing');
    revalidatePath('/dashboard/billing');

    return {
      success: result.success,
      message: result.message,
      newPlan: result.newPlan,
      previousPlan: result.previousPlan,
    };
  } catch (error) {
    billingActionLog.error('Failed to change plan', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: 'Failed to change plan. Please try again.' };
  }
}
