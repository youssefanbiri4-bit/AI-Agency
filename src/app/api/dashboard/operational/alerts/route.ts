import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getRBACContext } from '@/lib/auth/rbac';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

type AlertRow = {
  id: string;
  severity: AlertSeverity;
  title: string;
  details: string;
};

export async function GET(request: Request) {
  const requestId = request?.headers?.get('X-Request-ID') ?? `req-${crypto.randomUUID().slice(0, 8)}`;
  try {
    const access = await getRBACContext();
    if ('error' in access && access.error) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() }, { status: 401, headers: { 'X-Request-ID': requestId } });
    }
    if (!access.data) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() }, { status: 401, headers: { 'X-Request-ID': requestId } });
    }

    const { role, workspace } = access.data;
    if (!(role === 'owner' || role === 'admin')) {
      return NextResponse.json({ ok: false, success: false, error: 'Forbidden', requestId, timestamp: new Date().toISOString() }, { status: 403, headers: { 'X-Request-ID': requestId } });
    }

    const url = new URL(request.url);
    const WINDOW_HOURS =
      Number.parseInt(url.searchParams.get('windowHours') ?? '24', 10) || 24;

    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const supabase = await createSupabaseServerClient();

    // Repeated failures: task_failed_by_n8n events in time window
    const eventsRes = await supabase
      .from('task_events')
      .select('event_type, message, created_at, task_id')
      .eq('workspace_id', workspace.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (eventsRes.error) throw eventsRes.error;

    const events = eventsRes.data ?? [];
    const callbackFailureEvents = events.filter((e) => e.event_type === 'task_failed_by_n8n');
    const callbackFailureCount = callbackFailureEvents.length;

    // Stale task spikes: processing tasks older than 12 minutes (bounded)
    const staleThresholdMs = 12 * 60 * 1000;
    const staleBefore = new Date(Date.now() - staleThresholdMs).toISOString();

    const staleRes = await supabase
      .from('tasks')
      .select('id, updated_at')
      .eq('workspace_id', workspace.id)
      .eq('status', 'processing')
      .lt('updated_at', staleBefore)
      .limit(500);

    if (staleRes.error) throw staleRes.error;

    const staleTasks = staleRes.data ?? [];

    // Provider instability proxy: callback outcome failures over window (bounded)
    const callbacksRes = await supabase
      .from('n8n_callback_events')
      .select('outcome')
      .eq('workspace_id', workspace.id)
      .gte('received_at', since)
      .limit(5000);

    if (callbacksRes.error) throw callbacksRes.error;

    const callbacks = callbacksRes.data ?? [];
    const failedCallbacks = callbacks.filter((c) => c.outcome === 'failed').length;

    // Suspicious execution patterns heuristic: duplicates in callback window (bounded)
    const duplicates = callbacks.filter((c) => c.outcome === 'duplicate').length;

    const alerts: AlertRow[] = [];

    if (callbackFailureCount >= 10) {
      alerts.push({
        id: 'repeated-callback-failures',
        severity: callbackFailureCount >= 25 ? 'critical' : 'high',
        title: 'Repeated callback failures',
        details: `Detected ${callbackFailureCount} task failure events by n8n in the last ${WINDOW_HOURS}h.`,
      });
    }

    if (staleTasks.length >= 5) {
      alerts.push({
        id: 'stale-processing-spike',
        severity: staleTasks.length >= 15 ? 'critical' : 'high',
        title: 'Stale task processing spike',
        details: `Found ${staleTasks.length} tasks stuck in processing (older than 12 minutes).`,
      });
    }

    if (failedCallbacks >= 10) {
      alerts.push({
        id: 'provider-instability',
        severity: failedCallbacks >= 25 ? 'critical' : 'medium',
        title: 'Provider instability (callback failures)',
        details: `${failedCallbacks} callback failures received in the last ${WINDOW_HOURS}h.`,
      });
    }

    if (duplicates >= 10 && callbackFailureCount < 10) {
      alerts.push({
        id: 'suspicious-execution-patterns',
        severity: 'medium',
        title: 'Suspicious execution pattern (callback duplicates)',
        details: `${duplicates} duplicate callback outcomes in the last ${WINDOW_HOURS}h. Verify idempotency & replay safety.`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'no-alerts',
        severity: 'low',
        title: 'No operational alerts detected',
        details: `Within the last ${WINDOW_HOURS}h window, no thresholds were crossed.`,
      });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        windowHours: WINDOW_HOURS,
        alerts,
      },
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Operational alerts endpoint failed', error);
    return NextResponse.json({ ok: false, success: false, error: 'Internal error', requestId, timestamp: new Date().toISOString() }, { status: 500, headers: { 'X-Request-ID': requestId } });
  }
}
