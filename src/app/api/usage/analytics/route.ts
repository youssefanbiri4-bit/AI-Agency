/**
 * Usage Analytics API Route
 *
 * GET /api/usage/analytics — returns full usage analytics summary
 * GET /api/usage/analytics/export — exports usage data as CSV
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getUsageAnalyticsSummary, exportUsageCsv, getConsumptionTrends, getMemberAnalytics, getDailyConsumption } from '@/lib/usage/analytics';
import { logger } from '@/lib/logger';

const routeLog = logger.child('api:usage:analytics');

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    const workspaceId = workspaceResult.data?.id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const isExport = url.pathname.endsWith('/export');

    if (isExport) {
      const [trends, memberAnalytics, dailyConsumption] = await Promise.all([
        getConsumptionTrends(workspaceId),
        getMemberAnalytics(workspaceId),
        getDailyConsumption(workspaceId, 30),
      ]);

      const csv = exportUsageCsv(trends, memberAnalytics, dailyConsumption);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usage-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    const summary = await getUsageAnalyticsSummary(workspaceId);

    return NextResponse.json(summary);
  } catch (error) {
    routeLog.error('Usage analytics API error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
