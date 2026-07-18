'use client';

import { BarChart3, Users, Zap, Info } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/utils';
import type { BillingPlan } from '@/types/database';
import type { PLAN_LIMITS } from '@/lib/usage/usage-limits';

interface UsageDashboardProps {
  plan: string;
  planId: BillingPlan;
  memberCount: number;
  currentUsage: {
    ai_generations: number;
    tasks: number;
    creative_assets: number;
    content_items: number;
    reels_publishes: number;
  };
  quotas: Record<string, { current: number; limit: number | null }>;
  planLimits: typeof PLAN_LIMITS;
}

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function UsageDashboard({
  plan,
  planId,
  memberCount,
  currentUsage,
  planLimits,
}: UsageDashboardProps) {
  const limits = planLimits[planId];

  const quotaTypes: Array<{
    key: string;
    label: string;
    current: number;
    limit: number | null;
  }> = [
    { key: 'ai_generations', label: 'AI Generations', current: currentUsage.ai_generations, limit: limits?.max_ai_generations_per_month ?? null },
    { key: 'tasks', label: 'Tasks', current: currentUsage.tasks, limit: limits?.max_tasks ?? null },
    { key: 'creative_assets', label: 'Creative Assets', current: currentUsage.creative_assets, limit: limits?.max_creative_assets ?? null },
    { key: 'content_items', label: 'Content Items', current: currentUsage.content_items, limit: limits?.max_content_items ?? null },
    { key: 'reels_publishes', label: 'Reel Publishes', current: currentUsage.reels_publishes, limit: limits?.max_reels_publishes_per_month ?? null },
  ];

  const totalUsed = quotaTypes.reduce((sum, q) => sum + q.current, 0);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Current Plan"
          value={plan}
          icon={<Zap className="h-5 w-5" />}
          tone="primary"
          subtitle={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
        />
        <StatCard
          title="Total Operations"
          value={String(totalUsed)}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="success"
          subtitle="This period"
        />
        <StatCard
          title="Team Size"
          value={String(memberCount)}
          icon={<Users className="h-5 w-5" />}
          tone="neutral"
          subtitle="Active members"
        />
        <StatCard
          title="Enforcement"
          value="Soft"
          icon={<Info className="h-5 w-5" />}
          tone="neutral"
          subtitle="No hard limits"
        />
      </div>

      {/* Usage bars */}
      <Card>
        <CardHeader
          title="Monthly Usage"
          description={`Current usage against ${plan} plan limits — soft warnings only, operations are never blocked.`}
        />
        <div className="space-y-6">
          {quotaTypes.map(({ key, label, current, limit }) => {
            const percent = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
            const displayLimit = limit ?? '∞';

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground/80">{label}</span>
                  <span className="text-xs text-foreground-muted">
                    {current} / {displayLimit}
                  </span>
                </div>
                {limit ? (
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className={cn('h-2.5 rounded-full transition-all duration-500', getBarColor(percent))}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-2.5 rounded-full bg-emerald-300" style={{ width: '15%' }} />
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
      </Card>

      <Notice tone="info" title="Internal platform — no hard enforcement">
        This platform is internal only. Usage is tracked for cost awareness, but operations are
        never blocked. All quotas use soft warnings only.
      </Notice>
    </div>
  );
}
