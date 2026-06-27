import { NextResponse } from 'next/server';
import { runContentStudioScheduler } from '@/lib/content-studio/scheduler';
import { reportAppError } from '@/lib/logger';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { checkRateLimit } from '@/lib/rate-limit';
import { canRunScheduler, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { getRequestId, nowISO } from '@/lib/api-response';

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function handleRunScheduler(request?: Request) {
  const requestId = getRequestId(request);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Authentication is required', 401);
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (workspaceResult.error) {
    return jsonError(workspaceResult.error, 500);
  }

  if (!workspaceResult.data) {
    return jsonError('Active workspace is required', 403);
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  if (membershipResult.error) {
    return jsonError(membershipResult.error, 500);
  }

  const currentRole = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  if (!canRunScheduler(currentRole)) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'scheduler',
      message: 'Blocked manual scheduler run.',
      metadata: { role: currentRole },
    });

    return jsonError('Scheduler controls are restricted to workspace owners and admins.', 403);
  }

  const limiter = await checkRateLimit({
    key: `manual-scheduler:${workspaceResult.data.id}:${user.id}`,
    limit: 3,
    windowMs: 60 * 1000,
  });

  if (!limiter.allowed) {
    return jsonError('Manual scheduler run rate limit reached. Try again shortly.', 429);
  }

  try {
    const summary = await runContentStudioScheduler();

    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'scheduler_manually_run',
      entityType: 'scheduler',
      message: 'Manual scheduler run completed.',
      metadata: {
        scanned: summary.scanned,
        executed: summary.executed,
        succeeded: summary.succeeded,
        failed: summary.failed,
      },
    });

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: nowISO(),
      data: summary,
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Manual content studio scheduler run failed', error, {
      workspaceId: workspaceResult.data.id,
      userId: user.id,
    });

    return NextResponse.json({
      success: false,
      error: setupBlockerMessage({
        missing: 'completed scheduler run',
        reason: 'the server could not safely complete the manual scheduler operation',
        next: 'check server logs, provider readiness, and scheduler configuration, then retry',
      }),
      requestId,
      timestamp: nowISO(),
    }, {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    });
  }
}

export async function POST(request: Request) {
  return handleRunScheduler(request);
}

export async function GET(request: Request) {
  return jsonError('Scheduler controls are only available from the dashboard.', 403);
}
