import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

import { redirect } from 'next/navigation';
import { getCurrentUsage, checkQuota, getUsageLimits } from '@/lib/usage/quotas';
import { getEstimatedTotalCostForWorkspace } from '@/lib/usage/cost-tracking';
import { getUsageAnalyticsSummary } from '@/lib/usage/analytics';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { requirePageAccess, normalizeWorkspaceRole, hasPermission } from '@/lib/auth/rbac';
import { AdjustLimitsForm } from './AdjustLimitsForm';
import { getTeamUsageData } from './team-usage';
import { TeamUsageSection } from './TeamUsageSection';
import { getUsageHistory } from './usage-history';
import { UsageHistorySection } from './UsageHistorySection';
import { getLimitChangeEvents } from './limit-changes';
import { LimitChangesSection } from './LimitChangesSection';
import { UsageAnalyticsDashboard } from './UsageAnalyticsDashboard';

export const dynamic = 'force-dynamic';

interface QuotaDisplay {
  type: string;
  current: number;
  limit: number | null;
  percent: number;
  label: string;
}

async function getUsageData(workspaceId: string) {
  const [usage, costUsd] = await Promise.all([
    getCurrentUsage(workspaceId),
    getEstimatedTotalCostForWorkspace(workspaceId),
  ]);

  const types: Array<{
    type: 'ai_generations' | 'tasks' | 'creative_assets' | 'content_items' | 'content_publishes' | 'reels_publishes';
    label: string;
  }> = [
    { type: 'ai_generations', label: 'AI Generations (30d)' },
    { type: 'tasks', label: 'Tasks' },
    { type: 'creative_assets', label: 'Creative Assets' },
    { type: 'content_items', label: 'Content Items' },
    { type: 'content_publishes', label: 'Content Publishes' },
    { type: 'reels_publishes', label: 'Reel Publishes' },
  ];

  const quotas: QuotaDisplay[] = await Promise.all(
    types.map(async ({ type, label }) => {
      const q = await checkQuota(workspaceId, type);
      return {
        type,
        current: q.current,
        limit: q.limit,
        percent: q.percentUsed,
        label,
      };
    })
  );

  return { quotas, costUsd: costUsd || 0, rawUsage: usage };
}

export default async function UsagePage() {
  const pageAccess = await requirePageAccess('/dashboard/usage');
  if (!pageAccess.ok) {
    redirect(`/dashboard?access_denied=1&from=/dashboard/usage`);
  }

  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  if (!workspaceId) {
    return <div className="p-8">Workspace required to view usage.</div>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const membershipResult = user ? await getCurrentWorkspaceMembership(supabase, workspaceId, user.id) : null;
  const role = normalizeWorkspaceRole(membershipResult?.data?.role, workspaceResult.data, user?.id ?? '');
  const isAdmin = hasPermission(role, 'admin');

  const [usageData, analyticsSummary] = await Promise.all([
    getUsageData(workspaceId),
    getUsageAnalyticsSummary(workspaceId),
  ]);

  const { quotas, costUsd } = usageData;
  const currentLimits = await getUsageLimits(workspaceId);
  const teamUsage = isAdmin ? await getTeamUsageData(supabase, workspaceId) : null;
  const history7 = await getUsageHistory(supabase, workspaceId, 7);
  const history30 = await getUsageHistory(supabase, workspaceId, 30);
  const limitChanges = isAdmin ? await getLimitChangeEvents(supabase, workspaceId) : [];

  function getColor(percent: number) {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usage & Analytics"
        description="Track monthly consumption, per-member usage, and alerts. Hard limits block operations when exceeded — admins can adjust limits below."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {quotas.map((q) => (
          <Card key={q.type}>
            <CardHeader title={q.label} description={`${q.current} / ${q.limit ?? '∞'} used`} />
            <div className="p-4 pt-0">
              <div className="h-3 w-full rounded bg-black/10 overflow-hidden">
                <div
                  className={`h-3 rounded ${getColor(q.percent)}`}
                  style={{ width: `${Math.min(q.percent, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-foreground-muted">
                <span>{q.percent.toFixed(0)}% used</span>
                {q.percent >= 80 && q.percent < 95 && (
                  <span className="text-amber-600 font-bold">80% used — nearing the limit. Ask an admin to raise the cap.</span>
                )}
                {q.percent >= 95 && (
                  <span className="text-red-600 font-bold">95% used — nearly at the hard limit. New operations will be blocked.</span>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Card>
          <CardHeader
            title="Estimated Spend (USD)"
            description="Estimated AI provider and automation costs (last 30 days)"
          />
          <div className="p-4 pt-0 text-4xl font-black tabular-nums">
            ${costUsd.toFixed(2)}
            <span className="text-sm font-normal text-foreground-muted ml-1">USD</span>
          </div>
          <div className="px-4 pb-4 text-xs text-foreground-muted">
            Cost tracking is approximate. Full details available in reports.
            {costUsd > 15 && <span className="block mt-1 text-amber-600">High spend detected — review usage.</span>}
          </div>
        </Card>
      </div>

      <UsageAnalyticsDashboard data={analyticsSummary} />

      <div className="rounded-xl border border-divider bg-surface/60 p-4 text-sm leading-6 text-foreground-muted">
        Want forecasts, churn risk, and team performance? Open{' '}
        <Link href="/dashboard/insights" className="font-bold text-[#F7CBCA] hover:underline">
          Analytics &amp; Insights
        </Link>{' '}
        for usage trends with 14-day projections, per-member churn scoring, and a team performance dashboard — all exportable to PDF/CSV.
      </div>

      <UsageHistorySection data={history7} days={7} />
      <UsageHistorySection data={history30} days={30} />

      {isAdmin ? (
        <>
          <AdjustLimitsForm current={currentLimits} />
          <TeamUsageSection data={teamUsage!} />
          <LimitChangesSection events={limitChanges} />
        </>
      ) : (
        <div className="rounded-xl border border-divider bg-surface/60 p-4 text-xs leading-6 text-foreground-muted">
          Usage resets monthly per your workspace plan. Hard limits prevent overage and are configured by workspace admins in the <strong>Adjust Limits</strong> section above (admin only).
        </div>
      )}
    </div>
  );
}
