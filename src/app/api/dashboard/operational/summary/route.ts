import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getRBACContext } from '@/lib/auth/rbac';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = request?.headers?.get('X-Request-ID') ?? `req-${crypto.randomUUID().slice(0, 8)}`;
  try {
    const access = await getRBACContext();

    if ('error' in access && access.error) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() }, { status: 401, headers: { 'X-Request-ID': requestId } });
    }

    if (!access.data) return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() }, { status: 401, headers: { 'X-Request-ID': requestId } });

    const { role, workspace } = access.data;
    if (!(role === 'owner' || role === 'admin')) {
      return NextResponse.json({ ok: false, success: false, error: 'Forbidden', requestId, timestamp: new Date().toISOString() }, { status: 403, headers: { 'X-Request-ID': requestId } });
    }

    const supabase = await createSupabaseServerClient();

    // Time windows to avoid expensive scans
    const now = Date.now();
    const STALE_PROCESSING_THRESHOLD_MS = 12 * 60 * 1000; // 12 minutes
    const staleBefore = new Date(now - STALE_PROCESSING_THRESHOLD_MS).toISOString();

    // Keep queries bounded + index-friendly
    const tasksRes = await supabase
      .from('tasks')
      .select('status, updated_at')
      .eq('workspace_id', workspace.id);

    if (tasksRes.error) throw tasksRes.error;

    const tasks = tasksRes.data ?? [];
    const taskCounts = {
      pending: tasks.filter((t) => t.status === 'pending').length,
      processing: tasks.filter((t) => t.status === 'processing').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      needs_review: tasks.filter((t) => t.status === 'needs_review').length,
    };

    const staleTasksCount = tasks.filter(
      (t) => t.status === 'processing' && new Date(t.updated_at ?? 0).toISOString() < staleBefore
    ).length;

    // Callback health: outcomes + latency (derive from n8n_callback_events)
    // Note: callback_events are bounded with a recent window to keep the dashboard fast.
    const CALLBACK_WINDOW_HOURS = 24;
    const callbackSince = new Date(now - CALLBACK_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const callbacksRes = await supabase
      .from('n8n_callback_events')
      .select('outcome, callback_status, received_at, processed_at')
      .eq('workspace_id', workspace.id)
      .gte('received_at', callbackSince);

    if (callbacksRes.error) throw callbacksRes.error;

    const callbacks = callbacksRes.data ?? [];

    const callbackOutcomes = callbacks.reduce(
      (acc, c) => {
        const key = String(c.outcome ?? 'accepted') as keyof typeof acc;
        if (typeof acc[key] === 'number') acc[key] += 1;
        return acc;
      },
      { accepted: 0, processed: 0, duplicate: 0, stale_ignored: 0, failed: 0 } as Record<
        'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed',
        number
      >
    );

    const latenciesMs: number[] = callbacks
      .map((c) => {
        const received = c.received_at ? new Date(c.received_at).getTime() : null;
        const processed = c.processed_at ? new Date(c.processed_at).getTime() : null;
        if (!received || !processed) return null;
        if (processed < received) return null;
        return processed - received;
      })
      .filter((x): x is number => typeof x === 'number');

    const avgCallbackLatencyMs =
      latenciesMs.length === 0 ? null : Math.round(latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length);

    return NextResponse.json({
      ok: true,
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        system: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          provider: {
            // Use existing health helper indirectly by calling /api/health from the backend is not required here.
            // Dashboard summary focuses on derived DB metrics. Detailed provider readiness is shown elsewhere.
            n8n: 'derived-from-callbacks',
          },
          storage: 'unknown',
          database: 'ok',
          callbackHealth: {
            windowHours: CALLBACK_WINDOW_HOURS,
            avgCallbackLatencyMs: avgCallbackLatencyMs,
            callbackOutcomes,
          },
        },
        taskExecution: {
          taskCounts,
          staleTasksCount,
        },
      },
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Operational summary endpoint failed', error);
    return NextResponse.json({ ok: false, success: false, error: 'Internal error', requestId, timestamp: new Date().toISOString() }, { status: 500, headers: { 'X-Request-ID': requestId } });
  }
}
