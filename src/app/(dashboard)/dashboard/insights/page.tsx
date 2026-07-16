import { PageHeader } from '@/components/ui/PageHeader';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getInsightsSummary } from '@/lib/analytics/insights';
import { InsightsDashboard } from './InsightsDashboard';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  if (!workspaceId) {
    return <div className="p-8">Workspace required to view analytics.</div>;
  }

  const summary = await getInsightsSummary(workspaceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics & Insights"
        eyebrow="Advanced Analytics"
        description="Usage trends and forecasts, churn risk scoring, and team performance — exportable to PDF or CSV."
      />
      <InsightsDashboard data={summary} />
    </div>
  );
}
