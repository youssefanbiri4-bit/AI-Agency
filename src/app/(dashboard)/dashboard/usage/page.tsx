import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

import { redirect } from 'next/navigation';
import { getCurrentUsage, checkQuota } from '@/lib/usage/quotas';
import { getEstimatedTotalCostForWorkspace } from '@/lib/usage/cost-tracking';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { requirePageAccess } from '@/lib/auth/rbac';

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

  const { quotas, costUsd } = await getUsageData(workspaceId);

  function getColor(percent: number) {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usage & Quotas"
        description="Monitor your workspace consumption. Hard limits will block operations when reached."
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
              <div className="mt-2 flex justify-between text-xs text-black/60">
                <span>{q.percent.toFixed(0)}% used</span>
                {q.percent >= 80 && (
                  <span className="text-amber-600 font-bold">Near limit — contact your admin</span>
                )}
                {q.percent >= 95 && (
                  <span className="text-red-600 font-bold">Limit reached — actions may be blocked</span>
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Cost tracking card */}
        <Card>
          <CardHeader
            title="Estimated Spend (USD)"
            description="OpenAI + n8n estimated costs (last 30 days)"
          />
          <div className="p-4 pt-0 text-4xl font-black tabular-nums">
            ${costUsd.toFixed(2)}
            <span className="text-sm font-normal text-black/50 ml-1">USD</span>
          </div>
          <div className="px-4 pb-4 text-xs text-black/60">
            Cost tracking is approximate. Full details available in reports.
            {costUsd > 15 && <span className="block mt-1 text-amber-600">High spend detected — review usage.</span>}
          </div>
        </Card>
      </div>

      <div className="text-xs text-black/50">
        Quotas reset monthly based on your workspace plan. Hard limits prevent overage. Contact your workspace admin to adjust limits.
      </div>
    </div>
  );
}
