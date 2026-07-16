/**
 * Analytics Insights Export — PDF
 *
 * GET /api/analytics/insights/export-pdf -> application/pdf (or text/html fallback)
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getInsightsSummary } from '@/lib/analytics/insights';
import { generateInsightsReportPdf } from '@/lib/analytics/pdf-export';
import { logger } from '@/lib/logger';

const routeLog = logger.child('api:analytics:insights:export-pdf');

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
    const workspaceName = workspaceResult.data?.name ?? 'Workspace';
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace required' }, { status: 400 });
    }

    const summary = await getInsightsSummary(workspaceId);
    const { buffer, contentType } = await generateInsightsReportPdf(summary);

    const ext = contentType === 'application/pdf' ? 'pdf' : 'html';
    const filename = `insights-report-${workspaceName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${ext}`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    routeLog.error('Insights PDF export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
