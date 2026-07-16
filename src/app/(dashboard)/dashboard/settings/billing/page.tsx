/**
 * Usage & Limits Settings Page
 *
 * Full-featured usage management page:
 * - Current plan display with usage bars
 * - Plan comparison cards with upgrade/downgrade
 * - Seat-based info
 * - Hard limits enforcement status (soft only)
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import {
  loadBillingPageData,
  changePlanAction,
  type BillingPageData,
} from './actions';
import type { BillingPlan } from '@/types/database';
import { PLANS } from '@/lib/billing/plans';

export default function BillingPage() {
  const [data, setData] = useState<BillingPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlan | null>(null);

  const [changeState, changeAction, isChanging] = useActionState(changePlanAction, null);

  useEffect(() => {
    let mounted = true;

    loadBillingPageData()
      .then((result) => {
        if (!mounted) return;
        if ('error' in result) {
          setError(result.error);
        } else {
          setData(result);
          setSelectedPlanId(result.subscription.plan?.id as BillingPlan ?? 'free');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load usage data.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (changeState) {
      if (changeState.success) {
        toast.success(changeState.message);
        loadBillingPageData().then((result) => {
          if (!('error' in result)) {
            setData(result);
            setSelectedPlanId(result.subscription.plan?.id as BillingPlan ?? 'free');
          }
        });
      } else {
        toast.error(changeState.message);
      }
    }
  }, [changeState]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading Usage & Limits"
        description="Fetching subscription data and usage information."
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Usage & Limits"
          title="Usage & Limits"
          description="Manage your workspace plan and view usage."
        />
        <Notice tone="danger" title="Could not load data">
          {error}
        </Notice>
      </div>
    );
  }

  if (!data) return null;

  const {
    subscription: sub,
    quotas,
    currentUsage,
    availablePlans,
    planLimits,
  } = data;

  const currentPlanId = (sub.plan?.id as BillingPlan) ?? 'free';
  const currentPlan = sub.plan ?? PLANS.free;
  const memberCount = sub.memberCount;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Usage & Limits"
        title="Usage & Limits"
        description="Manage your workspace plan, view usage, and compare plans."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/dashboard/billing'}
            >
              <BarChart3 className="h-4 w-4" />
              Usage Dashboard
            </Button>
          </div>
        }
      />

      {/* ===== Current Plan Banner ===== */}
      <CurrentPlanBanner
        plan={currentPlan}
        memberCount={memberCount}
        pricing={sub.pricing}
      />

      {/* ===== Plan Comparison ===== */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Available Plans</h2>
            <p className="text-sm text-foreground-muted">
              Compare features and choose the right plan for your workspace.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {availablePlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const canUpgrade = plan.sortOrder > (currentPlan.sortOrder ?? 0);
            const canDowngrade = plan.sortOrder < currentPlan.sortOrder && plan.id !== 'free';

            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                memberCount={memberCount}
                isCurrent={isCurrent}
                canUpgrade={canUpgrade || (!isCurrent && !canDowngrade)}
                canDowngrade={canDowngrade && !isCurrent}
                isDisabled={plan.id === 'starter' || plan.id === 'agency'}
                onSelect={() => {
                  if (!isCurrent) setSelectedPlanId(plan.id);
                }}
              />
            );
          })}
        </div>
      </section>

      {/* ===== Upgrade/Downgrade Confirmation ===== */}
      {selectedPlanId && selectedPlanId !== currentPlanId && (
        <PlanChangeConfirmation
          currentPlanId={currentPlanId}
          targetPlanId={selectedPlanId}
          memberCount={memberCount}
          isChanging={isChanging}
          changeState={changeState}
          onConfirm={() => {
            const formData = new FormData();
            formData.set('plan', selectedPlanId);
            changeAction(formData);
          }}
          onCancel={() => setSelectedPlanId(null)}
        />
      )}

      {/* ===== Usage Summary ===== */}
      <UsageSummarySection
        quotas={quotas}
        currentUsage={currentUsage}
        currentPlanId={currentPlanId}
        planLimits={planLimits}
      />

      {/* ===== Seat-Based Info ===== */}
      <SeatBillingInfo memberCount={memberCount} currentPlanId={currentPlanId} />

      {/* ===== Enforcement ===== */}
      <HardLimitsSection currentPlanId={currentPlanId} />

      <div className="text-xs text-foreground-muted">
        This is an internal platform. Usage information is for cost-awareness and planning purposes only.
      </div>
    </div>
  );
}

// ===== Sub-components =====

function CurrentPlanBanner({
  plan,
  memberCount,
  pricing,
}: {
  plan: NonNullable<BillingPageData['subscription']['plan']>;
  memberCount: number;
  pricing: NonNullable<BillingPageData['subscription']['pricing']>;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary-light/20 premium-surface p-6 shadow-[0_18px_48px_rgba(61,90,90,0.07)]">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary-light/5 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-foreground/8">
            <Zap className="h-7 w-7 text-primary-light" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-foreground">
                {plan.name}
              </h2>
              <span
                className="rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${plan.color}18`,
                  color: plan.color,
                }}
              >
                Current Plan
              </span>
            </div>
            <p className="mt-1 max-w-lg text-sm text-foreground-muted">
              {plan.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
                <Users className="h-4 w-4" />
                <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <span>${pricing.totalMonthly.toFixed(2)}/mo</span>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <div className="text-right">
            <p className="text-2xl font-black text-foreground">
              ${plan.monthlyPrice}
            </p>
            <p className="text-xs text-foreground-muted">
              base price / month
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  memberCount,
  isCurrent,
  canUpgrade,
  canDowngrade,
  isDisabled,
  onSelect,
}: {
  plan: NonNullable<BillingPageData['subscription']['plan']>;
  memberCount: number;
  isCurrent: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  const isEnterprise = plan.id === 'enterprise';
  const isPro = plan.id === 'pro';

  return (
    <div
      className={`relative flex flex-col rounded-xl border shadow-sm transition-all duration-200 ${
        isCurrent
          ? 'border-primary-light/30 bg-white ring-2 ring-primary-light/20'
          : 'border-border bg-surface-elevated hover:border-primary-light/20 hover:shadow-md hover:-translate-y-0.5'
      } ${isDisabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
      onClick={onSelect}
    >
      {isPro && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary-light px-4 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Recommended
          </span>
        </div>
      )}

      {isEnterprise && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-red-500 px-4 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            Best Value
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3
              className="text-lg font-black text-foreground"
              style={{ color: plan.color }}
            >
              {plan.name}
            </h3>
            {isCurrent && (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </div>
          <span className="text-xl font-black text-foreground">
            ${plan.monthlyPrice}
          </span>
        </div>
        <p className="text-xs text-foreground-muted">{plan.description}</p>

        {plan.seatPricing && (
          <div className="rounded-lg bg-foreground/5 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Base price</span>
              <span className="font-semibold text-foreground">${plan.monthlyPrice}/mo</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">
                Seats ({plan.seatPricing.includedSeats} incl.)
              </span>
              <span className="font-semibold text-foreground">
                ${plan.seatPricing.perSeatMonth}/seat
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2 text-sm">
              <span className="text-foreground-muted">Estimated total</span>
              <span className="font-bold text-foreground">
                ${(plan.monthlyPrice + (memberCount > plan.seatPricing.includedSeats
                  ? (memberCount - plan.seatPricing.includedSeats) * plan.seatPricing.perSeatMonth
                  : 0)).toFixed(0)}
                /mo
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2">
          {plan.features.slice(0, 8).map((feature) => (
            <div key={feature.key} className="flex items-start gap-2">
              {feature.included ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-foreground/30" />
              )}
              <span className={`text-xs ${feature.included ? 'text-foreground/80' : 'text-foreground/40'}`}>
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {isCurrent ? (
          <Button variant="outline" disabled className="w-full">
            <Check className="h-4 w-4" />
            Current Plan
          </Button>
        ) : canUpgrade ? (
          <Button className="w-full" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <Zap className="h-4 w-4" />
            Upgrade
          </Button>
        ) : canDowngrade ? (
          <Button variant="secondary" className="w-full" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <ChevronDown className="h-4 w-4" />
            Downgrade
          </Button>
        ) : (
          <Button variant="outline" disabled className="w-full">
            {isDisabled ? 'Legacy Plan' : 'Unavailable'}
          </Button>
        )}
      </div>
    </div>
  );
}

function PlanChangeConfirmation({
  currentPlanId,
  targetPlanId,
  memberCount,
  isChanging,
  changeState,
  onConfirm,
  onCancel,
}: {
  currentPlanId: BillingPlan;
  targetPlanId: BillingPlan;
  memberCount: number;
  isChanging: boolean;
  changeState: { success: boolean; message: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const currentPlan = PLANS[currentPlanId];
  const targetPlan = PLANS[targetPlanId];
  const isUpgrade = targetPlan.sortOrder > currentPlan.sortOrder;

  if (!targetPlan) return null;

  const targetCost = targetPlan.monthlyPrice + (targetPlan.seatPricing && memberCount > targetPlan.seatPricing.includedSeats
    ? (memberCount - targetPlan.seatPricing.includedSeats) * targetPlan.seatPricing.perSeatMonth
    : 0);

  return (
    <Card className="border-primary-light/20">
      <CardHeader
        title={isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
        description={
          isUpgrade
            ? `You are upgrading from ${currentPlan.name} to ${targetPlan.name}.`
            : `You are downgrading from ${currentPlan.name} to ${targetPlan.name}.`
        }
        action={
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 text-foreground-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        }
      />

      {changeState?.success && (
        <Notice tone="success" title="Plan changed">
          {changeState.message}
        </Notice>
      )}

      {changeState && !changeState.success && (
        <Notice tone="danger" title="Plan change failed">
          {changeState.message}
        </Notice>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-foreground/5 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Plan</span>
              <span className="font-semibold text-foreground">
                {targetPlan.name} (${targetPlan.monthlyPrice}/mo)
              </span>
            </div>
            {targetPlan.seatPricing && memberCount > targetPlan.seatPricing.includedSeats && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">
                  Extra seats ({memberCount - targetPlan.seatPricing.includedSeats} × ${targetPlan.seatPricing.perSeatMonth})
                </span>
                <span className="font-semibold text-foreground">
                  ${((memberCount - targetPlan.seatPricing.includedSeats) * targetPlan.seatPricing.perSeatMonth).toFixed(0)}/mo
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-foreground/10 pt-2 text-sm font-bold">
              <span className="text-foreground">Estimated total</span>
              <span className="text-lg">
                ${targetCost.toFixed(0)}
                <span className="text-xs font-normal text-foreground-muted">/mo</span>
              </span>
            </div>
          </div>

          {!isUpgrade && (
            <Notice tone="warning" title="Downgrade notice" className="mt-4">
              Some features and limits will be reduced. Current usage may exceed the new plan limits.
            </Notice>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isChanging}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isChanging}>
            {isChanging ? 'Changing...' : isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function UsageSummarySection({
  currentUsage,
  currentPlanId,
  planLimits,
}: {
  quotas: BillingPageData['quotas'];
  currentUsage: BillingPageData['currentUsage'];
  currentPlanId: BillingPlan;
  planLimits: BillingPageData['planLimits'];
}) {
  const plan = PLANS[currentPlanId] ?? PLANS.free;

  const quotaTypes: Array<{
    key: string;
    label: string;
    current: number;
    limit: number | null;
  }> = [
    { key: 'ai_generations', label: 'AI Generations', current: currentUsage.ai_generations, limit: planLimits[currentPlanId]?.max_ai_generations_per_month ?? null },
    { key: 'tasks', label: 'Tasks', current: currentUsage.tasks, limit: planLimits[currentPlanId]?.max_tasks ?? null },
    { key: 'creative_assets', label: 'Creative Assets', current: currentUsage.creative_assets, limit: planLimits[currentPlanId]?.max_creative_assets ?? null },
    { key: 'content_items', label: 'Content Items', current: currentUsage.content_items, limit: planLimits[currentPlanId]?.max_content_items ?? null },
    { key: 'reels_publishes', label: 'Reel Publishes', current: currentUsage.reels_publishes, limit: planLimits[currentPlanId]?.max_reels_publishes_per_month ?? null },
  ];

  function getBarColor(percent: number): string {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <Card>
      <CardHeader
        title="Monthly Usage"
        description={`Current period usage against ${plan.name} plan limits.`}
        action={
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            Soft Limits
          </span>
        }
      />
      <div className="space-y-4">
        {quotaTypes.map(({ key, label, current, limit }) => {
          const percent = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
          const displayLimit = limit ?? '∞';

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground/80">{label}</span>
                <span className="text-xs text-foreground-muted">
                  {current} / {displayLimit}
                </span>
              </div>
              {limit ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getBarColor(percent)}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              ) : (
                <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-2 rounded-full bg-emerald-300" style={{ width: '30%' }} />
                </div>
              )}
              <div className="flex justify-between text-xs text-foreground-muted">
                <span>{percent > 0 ? `${percent}% used` : 'No usage yet'}</span>
                {percent >= 80 && (
                  <span className="font-bold text-amber-600">Approaching soft limit</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Notice tone="info" title="Soft limits only" className="mt-6">
        This platform uses soft limits only — operations are never blocked. Usage is monitored
        for cost awareness.
      </Notice>
    </Card>
  );
}

function SeatBillingInfo({
  memberCount,
  currentPlanId,
}: {
  memberCount: number;
  currentPlanId: BillingPlan;
}) {
  const plan = PLANS[currentPlanId];

  if (!plan?.seatPricing) {
    return (
      <Card>
        <CardHeader
          title="Team Seats"
          description="Member-based information."
        />
        <div className="flex items-center gap-3 rounded-lg border border-border bg-foreground/5 p-4">
          <Users className="h-8 w-8 text-primary-light" />
          <div>
            <p className="font-semibold text-foreground">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </p>
            <p className="text-sm text-foreground-muted">
              {plan.name} plan does not use seat-based pricing.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const extraSeats = Math.max(0, memberCount - plan.seatPricing.includedSeats);
  const includedLabel = plan.id === 'enterprise' ? 'Enterprise' : plan.name;

  return (
    <Card>
      <CardHeader
        title="Seat-Based Info"
        description={`${includedLabel} plan: ${plan.seatPricing.includedSeats} seats included, $${plan.seatPricing.perSeatMonth}/seat for additional members.`}
        action={
          <span className="flex items-center gap-1 text-sm text-foreground-muted">
            <Users className="h-4 w-4" />
            {memberCount} / {plan.seatPricing.maxSeats ?? '∞'} seats
          </span>
        }
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-foreground/5 p-3">
          <span className="text-sm text-foreground-muted">Included seats</span>
          <span className="font-semibold text-foreground">{plan.seatPricing.includedSeats}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-foreground/5 p-3">
          <span className="text-sm text-foreground-muted">Current members</span>
          <span className="font-semibold text-foreground">{memberCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-foreground/5 p-3">
          <span className="text-sm text-foreground-muted">Extra seats</span>
          <span className="font-semibold text-foreground">
            {extraSeats > 0 ? `${extraSeats} × $${plan.seatPricing.perSeatMonth}/mo` : 'None'}
          </span>
        </div>
      </div>
    </Card>
  );
}

function HardLimitsSection(_props: { currentPlanId: BillingPlan }) {
  const limits = [
    { label: 'AI Generations', description: 'Soft warning at threshold — never blocked' },
    { label: 'Tasks', description: 'Soft warning at threshold — never blocked' },
    { label: 'Creative Assets', description: 'Soft warning at threshold — never blocked' },
  ];

  return (
    <Card>
      <CardHeader
        title="Enforcement Status"
        description="This platform uses soft limits only. Usage is tracked for awareness but operations are never blocked."
        action={
          <ShieldCheck className="h-5 w-5 text-primary-light" />
        }
      />
      <div className="space-y-3">
        {limits.map((limit) => (
          <div
            key={limit.label}
            className="flex items-center justify-between rounded-lg border border-border bg-foreground/5 p-3"
          >
            <div>
              <span className="text-sm font-semibold text-foreground">{limit.label}</span>
              <p className="text-xs text-foreground-muted">{limit.description}</p>
            </div>
            <StatusBadge status="Ready" type="system" size="sm" />
          </div>
        ))}
      </div>

      <Notice tone="info" title="No hard limits" className="mt-4">
        All quotas use soft warnings only. Operations are never blocked, regardless of plan.
      </Notice>
    </Card>
  );
}
