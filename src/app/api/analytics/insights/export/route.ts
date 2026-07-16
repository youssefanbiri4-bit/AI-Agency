/**
 * Analytics Insights Export — CSV
 *
 * GET /api/analytics/insights/export  -> text/csv
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getInsightsSummary, exportInsightsCsv } from '@/lib/analytics/insights';
import { logger } from '@/lib/logger';

const routeLog = logger.child('api:analytics:insights:export');

export async function GET() {
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

    const summary = await getInsightsSummary(workspaceId);
    const csv = exportInsightsCsv(summary);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="insights-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    routeLog.error('Insights CSV export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
