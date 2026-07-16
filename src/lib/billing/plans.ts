/**
 * Billing Plans Configuration
 *
 * Defines Free, Pro, and Enterprise plans with:
 * - Seat-based pricing (per-member cost)
 * - Usage-based pricing (overage per unit)
 * - Feature flags
 * - Soft limits enforcement (internal platform — no hard blocks)
 */

import type {
  BillingPlan,
  PlanDefinition,
  PlanFeature,
  SeatPricing,
} from '@/types/database';

// ===== Shared Helpers =====

function feature(
  key: string,
  label: string,
  included: boolean,
  limit?: string | number
): PlanFeature {
  return { key, label, included, limit };
}

function seat(
  perSeatMonth: number,
  minSeats: number,
  maxSeats: number | null,
  includedSeats: number
): SeatPricing {
  return { perSeatMonth, minSeats, maxSeats, includedSeats };
}

// ===== Plan Definitions =====

export const PLANS: Record<BillingPlan, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with essential AI agent orchestration and task management.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    sortOrder: 0,
    color: '#6B7280',
    hardLimits: false,
    isUpgradeTarget: true,
    seatPricing: null,
    usagePricing: {
      ai_generations: { includedUnits: 20, overagePerUnit: 0, unitLabel: 'generations/mo' },
      tasks: { includedUnits: 40, overagePerUnit: 0, unitLabel: 'tasks/mo' },
      creative_assets: { includedUnits: 50, overagePerUnit: 0, unitLabel: 'assets' },
      content_items: { includedUnits: 30, overagePerUnit: 0, unitLabel: 'items' },
      reels_publishes: { includedUnits: 10, overagePerUnit: 0, unitLabel: 'publishes/mo' },
    },
    features: [
      feature('seats', 'Up to 2 team members', true, '2'),
      feature('ai_generations', 'AI generations', true, '20/mo'),
      feature('tasks', 'Task executions', true, '40/mo'),
      feature('creative_assets', 'Creative assets storage', true, '50'),
      feature('content_items', 'Content items', true, '30'),
      feature('reels_publishes', 'Reels publishes', true, '10/mo'),
      feature('n8n_automation', 'n8n automation', false),
      feature('analytics', 'Basic analytics', true),
      feature('reports_pdf', 'PDF reports', false),
      feature('premium_support', 'Premium support', false),
      feature('custom_branding', 'Custom branding', false),
      feature('api_access', 'API access', false),
    ],
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing teams that need more capacity, automation, and insights.',
    monthlyPrice: 49,
    yearlyPrice: 490,
    sortOrder: 1,
    color: '#8B5CF6',
    hardLimits: false,
    isUpgradeTarget: true,
    seatPricing: seat(10, 3, 20, 5),
    usagePricing: {
      ai_generations: { includedUnits: 500, overagePerUnit: 0.02, unitLabel: 'generations/mo' },
      tasks: { includedUnits: 1000, overagePerUnit: 0.01, unitLabel: 'tasks/mo' },
      creative_assets: { includedUnits: 1000, overagePerUnit: 0, unitLabel: 'assets' },
      content_items: { includedUnits: 500, overagePerUnit: 0, unitLabel: 'items' },
      reels_publishes: { includedUnits: 200, overagePerUnit: 0, unitLabel: 'publishes/mo' },
    },
    features: [
      feature('seats', 'Up to 20 team members', true, '20'),
      feature('ai_generations', 'AI generations', true, '500/mo'),
      feature('tasks', 'Task executions', true, '1,000/mo'),
      feature('creative_assets', 'Creative assets storage', true, '1,000'),
      feature('content_items', 'Content items', true, '500'),
      feature('reels_publishes', 'Reels publishes', true, '200/mo'),
      feature('n8n_automation', 'n8n automation', true),
      feature('analytics', 'Advanced analytics', true),
      feature('reports_pdf', 'PDF reports', true),
      feature('premium_support', 'Priority support', true),
      feature('custom_branding', 'Custom branding', false),
      feature('api_access', 'API access', true),
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited capacity, full customization, and dedicated support for large operations.',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    sortOrder: 2,
    color: '#DC2626',
    hardLimits: false,
    isUpgradeTarget: true,
    seatPricing: seat(15, 10, null, 20),
    usagePricing: {
      ai_generations: { includedUnits: 5000, overagePerUnit: 0.01, unitLabel: 'generations/mo' },
      tasks: { includedUnits: 10000, overagePerUnit: 0.005, unitLabel: 'tasks/mo' },
      creative_assets: { includedUnits: 10000, overagePerUnit: 0, unitLabel: 'assets' },
      content_items: { includedUnits: 5000, overagePerUnit: 0, unitLabel: 'items' },
      reels_publishes: { includedUnits: 2000, overagePerUnit: 0, unitLabel: 'publishes/mo' },
    },
    features: [
      feature('seats', 'Unlimited team members', true, '∞'),
      feature('ai_generations', 'AI generations', true, '5,000/mo'),
      feature('tasks', 'Task executions', true, '10,000/mo'),
      feature('creative_assets', 'Creative assets storage', true, '10,000'),
      feature('content_items', 'Content items', true, '5,000'),
      feature('reels_publishes', 'Reels publishes', true, '2,000/mo'),
      feature('n8n_automation', 'n8n automation', true),
      feature('analytics', 'Real-time analytics', true),
      feature('reports_pdf', 'PDF reports', true),
      feature('premium_support', 'Dedicated support', true),
      feature('custom_branding', 'Custom branding & SSO', true),
      feature('api_access', 'Full API access', true),
    ],
  },

  // Legacy plans kept for backward compatibility but not shown as upgrade targets
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Legacy plan — migrated to Pro.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    sortOrder: 10,
    color: '#6B7280',
    hardLimits: false,
    isUpgradeTarget: false,
    seatPricing: null,
    usagePricing: {
      ai_generations: { includedUnits: 100, overagePerUnit: 0, unitLabel: 'generations/mo' },
      tasks: { includedUnits: 200, overagePerUnit: 0, unitLabel: 'tasks/mo' },
      creative_assets: { includedUnits: 200, overagePerUnit: 0, unitLabel: 'assets' },
      content_items: { includedUnits: 100, overagePerUnit: 0, unitLabel: 'items' },
      reels_publishes: { includedUnits: 50, overagePerUnit: 0, unitLabel: 'publishes/mo' },
    },
    features: [
      feature('seats', 'Up to 5 members', true, '5'),
      feature('ai_generations', 'AI generations', true, '100/mo'),
      feature('tasks', 'Tasks', true, '200/mo'),
      feature('creative_assets', 'Assets', true, '200'),
      feature('content_items', 'Content items', true, '100'),
      feature('reels_publishes', 'Reels publishes', true, '50/mo'),
    ],
  },

  agency: {
    id: 'agency',
    name: 'Agency',
    description: 'Legacy plan — migrated to Enterprise.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    sortOrder: 11,
    color: '#DC2626',
    hardLimits: false,
    isUpgradeTarget: false,
    seatPricing: null,
    usagePricing: {
      ai_generations: { includedUnits: 999999, overagePerUnit: 0, unitLabel: 'generations/mo' },
      tasks: { includedUnits: 999999, overagePerUnit: 0, unitLabel: 'tasks/mo' },
      creative_assets: { includedUnits: 999999, overagePerUnit: 0, unitLabel: 'assets' },
      content_items: { includedUnits: 999999, overagePerUnit: 0, unitLabel: 'items' },
      reels_publishes: { includedUnits: 999999, overagePerUnit: 0, unitLabel: 'publishes/mo' },
    },
    features: [
      feature('seats', 'Unlimited', true, '∞'),
      feature('ai_generations', 'AI generations', true, 'Unlimited'),
      feature('tasks', 'Tasks', true, 'Unlimited'),
      feature('creative_assets', 'Assets', true, 'Unlimited'),
      feature('content_items', 'Content items', true, 'Unlimited'),
      feature('reels_publishes', 'Reels publishes', true, 'Unlimited'),
    ],
  },
};

// ===== Active plans (shown in upgrade UI) =====

export const ACTIVE_PLANS: PlanDefinition[] = [
  PLANS.free,
  PLANS.pro,
  PLANS.enterprise,
];

// ===== Helper Functions =====

/**
 * Calculate the monthly cost for a plan given a number of seats.
 */
export function calculateMonthlyCost(planId: BillingPlan, seatCount: number): number {
  const plan = PLANS[planId];
  if (!plan) return 0;

  let cost = plan.monthlyPrice;

  if (plan.seatPricing) {
    const billableSeats = Math.max(0, seatCount - plan.seatPricing.includedSeats);
    cost += billableSeats * plan.seatPricing.perSeatMonth;
  }

  return cost;
}

/**
 * Get the effective monthly cost description for a plan.
 */
export function getPlanPricingDescription(planId: BillingPlan, memberCount: number): {
  basePrice: number;
  seatCost: number;
  totalMonthly: number;
  seatBreakdown: string | null;
} {
  const plan = PLANS[planId];
  const basePrice = plan?.monthlyPrice ?? 0;
  let seatCost = 0;
  let seatBreakdown: string | null = null;

  if (plan?.seatPricing && memberCount > plan.seatPricing.includedSeats) {
    const extraSeats = memberCount - plan.seatPricing.includedSeats;
    seatCost = extraSeats * plan.seatPricing.perSeatMonth;
    seatBreakdown = `${memberCount} members (${plan.seatPricing.includedSeats} included + ${extraSeats} extra × $${plan.seatPricing.perSeatMonth}/seat)`;
  } else if (plan?.seatPricing) {
    seatBreakdown = `${memberCount} members (${plan.seatPricing.includedSeats} included)`;
  }

  return {
    basePrice,
    seatCost,
    totalMonthly: basePrice + seatCost,
    seatBreakdown,
  };
}

/**
 * Get the plan limits if the workspace is on an enterprise plan with no hard limits.
 */
export function hasUnlimitedLimits(planId: BillingPlan): boolean {
  return planId === 'enterprise' || planId === 'agency';
}
