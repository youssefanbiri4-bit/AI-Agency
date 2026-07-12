import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getRBACContext } from '@/lib/auth/rbac';
import { reportAppError } from '@/lib/logger';
import { getRequestId, nowISO } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type QueryParams = {
  page?: string;
  pageSize?: string;
  status?: string;
  taskId?: string;
};

function parseIntOr(value: string | undefined, fallback: number, max?: number) {
  const n = value ? Number.parseInt(value, 10) : fallback;
  const safe = Number.isFinite(n) && n > 0 ? n : fallback;
  return typeof max === 'number' ? Math.min(safe, max) : safe;
}

type TaskListRow = {
  id: string;
  status: string;
  priority: string | null;
  updated_at: string | null;
  created_at: string | null;
  completed_at: string | null;
  n8n_execution_id: string | null;
  result: Record<string, unknown> | null;
  agent_type: string | null;
  user_id: string | null;
};

type TaskEventRow = {
  task_id: string | null;
  event_type: string;
  message: unknown;
  created_at: string | null;
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const access = await getRBACContext();
    if ('error' in access && access.error) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: nowISO() }, { status: 401, headers: { 'X-Request-ID': requestId } });
    }
    if (!access.data) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: nowISO() }, { status: 401, headers: { 'X-Request-ID': requestId } });
    }

    const { role, workspace } = access.data;
    if (!(role === 'owner' || role === 'admin')) {
      return NextResponse.json({ ok: false, success: false, error: 'Forbidden', requestId, timestamp: nowISO() }, { status: 403, headers: { 'X-Request-ID': requestId } });
    }

    const url = new URL(request.url);
    const params: QueryParams = Object.fromEntries(url.searchParams.entries()) as QueryParams;

    const page = parseIntOr(params.page, 1, 50);
    const pageSize = parseIntOr(params.pageSize, 25, 100);
    const status = params.status;
    const taskId = params.taskId;

    const offset = (page - 1) * pageSize;

    const supabase = await createSupabaseServerClient();

    // Bounded status list (avoid accidental full scans)
    const allowedStatuses = new Set([
      'pending',
      'processing',
      'failed',
      'completed',
      'needs_review',
      'draft',
    ]);

    // PERFORMANCE FIX: Use a single count query instead of a second full table query.
    // This avoids scanning all task rows twice.
    const countQuery = supabase
      .from('tasks')
      .select('status', { count: 'exact', head: false })
      .eq('workspace_id', workspace.id);

    if (taskId) countQuery.eq('id', taskId);
    if (status && allowedStatuses.has(status)) {
      const statusFilter = status as
        | 'pending'
        | 'processing'
        | 'failed'
        | 'completed'
        | 'needs_review'
        | 'draft';
      countQuery.eq('status', statusFilter);
    }

    const countRes = await countQuery;
    if (countRes.error) throw countRes.error;

    const allRowsForCounts = (countRes.data ?? []) as Array<{ status: string }>;
    const totalCount = countRes.count ?? 0;

    const taskCounts = {
      pending: allRowsForCounts.filter((t) => t.status === 'pending').length,
      processing: allRowsForCounts.filter((t) => t.status === 'processing').length,
      failed: allRowsForCounts.filter((t) => t.status === 'failed').length,
      completed: allRowsForCounts.filter((t) => t.status === 'completed').length,
      needs_review: allRowsForCounts.filter((t) => t.status === 'needs_review').length,
    };

    // Paginated data query (only selected columns)
    const STALE_PROCESSING_THRESHOLD_MS = 12 * 60 * 1000;

    const tasksQuery = supabase
      .from('tasks')
      .select(
        'id, status, priority, updated_at, created_at, completed_at, n8n_execution_id, result, agent_type'
      )
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (taskId) tasksQuery.eq('id', taskId);
    if (status && allowedStatuses.has(status)) {
      const statusFilter = status as
        | 'pending'
        | 'processing'
        | 'failed'
        | 'completed'
        | 'needs_review'
        | 'draft';
      tasksQuery.eq('status', statusFilter);
    }

    const tasksRes = await tasksQuery;
    if (tasksRes.error) throw tasksRes.error;

    const tasks = (tasksRes.data ?? []) as TaskListRow[];

    // Derive stuck workflows from the paginated data directly
    const stuckWorkflowIds = tasks
      .filter(
        (t) =>
          t.status === 'processing' &&
          Boolean(t.updated_at) &&
          new Date(t.updated_at as string).getTime() < Date.now() - STALE_PROCESSING_THRESHOLD_MS
      )
      .map((t) => t.id)
      .slice(0, 50);

    // Retry count: derive from task_events entries (bounded to last 7d)
    const taskEventsWindowDays = 7;
    const eventsSince = new Date(
      Date.now() - taskEventsWindowDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const taskIds = new Set(tasks.map((t) => t.id));

    const eventsRes = await supabase
      .from('task_events')
      .select('task_id, event_type, message, created_at')
      .eq('workspace_id', workspace.id)
      .gte('created_at', eventsSince)
      .in('task_id', Array.from(taskIds.values()));

    if (eventsRes.error) throw eventsRes.error;

    const events = (eventsRes.data ?? []) as TaskEventRow[];

    const failureReasonsByTask = new Map<string, string[]>();
    const retryCountsByTask = new Map<string, number>();

    for (const ev of events) {
      const tid = ev.task_id;
      if (!tid) continue;

      if (ev.event_type === 'task_sent_to_n8n') {
        retryCountsByTask.set(tid, (retryCountsByTask.get(tid) ?? 0) + 1);
      }

      if (ev.event_type === 'task_failed_by_n8n') {
        const prev = failureReasonsByTask.get(tid) ?? [];
        const msg =
          typeof ev.message === 'string' && ev.message.trim()
            ? ev.message.trim()
            : 'Unknown failure reason';
        prev.push(msg);
        failureReasonsByTask.set(tid, prev);
      }
    }

    const results = tasks.map((t) => {
      const errorMessage =
        t.result && typeof t.result === 'object' && typeof t.result.error_message === 'string'
          ? (t.result.error_message as string)
          : null;

      const derivedReasons = failureReasonsByTask.get(t.id) ?? [];
      const failureReason = errorMessage ?? derivedReasons[0] ?? null;
      const retryCount = retryCountsByTask.get(t.id) ?? 0;

      return {
        taskId: t.id,
        status: t.status,
        priority: t.priority ?? null,
        agentType: t.agent_type ?? null,
        n8nExecutionId: t.n8n_execution_id ?? null,
        createdAt: t.created_at ?? null,
        updatedAt: t.updated_at ?? null,
        completedAt: t.completed_at ?? null,
        retryCount,
        failureReason,
        isStuck:
          t.status === 'processing' &&
          Boolean(t.updated_at) &&
          new Date(t.updated_at as string).getTime() < Date.now() - STALE_PROCESSING_THRESHOLD_MS,
      };
    });

    return NextResponse.json({
      ok: true,
      success: true,
      requestId,
      timestamp: nowISO(),
      data: {
        taskCounts,
        totalCount,
        staleProcessingThresholdMs: STALE_PROCESSING_THRESHOLD_MS,
        results,
        stuckWorkflows: stuckWorkflowIds,
        pagination: { page, pageSize, returned: results.length, total: totalCount },
      },
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Operational execution endpoint failed', error);
    return NextResponse.json({ ok: false, success: false, error: 'Internal error', requestId, timestamp: nowISO() }, { status: 500, headers: { 'X-Request-ID': requestId } });
  }
}
