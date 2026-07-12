import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getRBACContext } from '@/lib/auth/rbac';
import { getProviderReadinessFromCache } from '@/lib/data/provider-readiness';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

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
    const provider = url.searchParams.get('provider') ?? '';
    const onlyProvider = provider.trim() ? provider.trim() : null;

    const providersToCheck = onlyProvider
      ? [onlyProvider]
      : ['n8n', 'openai', 'meta', 'google_ads', 'pinterest', 'scheduler'];

    const CALLBACK_WINDOW_HOURS = 24;
    const callbackSince = new Date(Date.now() - CALLBACK_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const supabase = await createSupabaseServerClient();

    const callbacksRes = await supabase
      .from('n8n_callback_events')
      .select('outcome, received_at, processed_at, callback_status')
      .eq('workspace_id', workspace.id)
      .gte('received_at', callbackSince);

    if (callbacksRes.error) throw callbacksRes.error;

    const callbacks = callbacksRes.data ?? [];

    const failedCount = callbacks.filter((c) => c.outcome === 'failed').length;
    const duplicateCount = callbacks.filter((c) => c.outcome === 'duplicate').length;
    const processedCount = callbacks.filter((c) => c.outcome === 'processed').length;

    const latencies: number[] = callbacks
      .map((c) => {
        if (!c.received_at || !c.processed_at) return null;
        const r = new Date(c.received_at).getTime();
        const p = new Date(c.processed_at).getTime();
        if (!Number.isFinite(r) || !Number.isFinite(p) || p < r) return null;
        return p - r;
      })
      .filter((x): x is number => typeof x === 'number');

    const avgCallbackLatencyMs =
      latencies.length === 0 ? null : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    const readinessEntries = await Promise.all(
      providersToCheck.map(async (p) => {
        if (p === 'n8n') {
          return {
            provider: 'n8n',
            readiness_state: 'unknown',
            message: 'Use /api/health for full n8n readiness; this view derives callback window health.',
            missing: [],
            last_checked_at: null,
            expires_at: null,
          };
        }

        const res = await getProviderReadinessFromCache(workspace.id, p, supabase);
        return {
          provider: p,
          readiness_state: res.data?.readiness_state ?? 'unknown',
          message: res.data?.message ?? null,
          missing: res.data?.missing ?? [],
          last_checked_at: res.data?.last_checked_at ?? null,
          expires_at: res.data?.expires_at ?? null,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        callbackWindowHours: CALLBACK_WINDOW_HOURS,
        n8n: {
          failedCount,
          duplicateCount,
          processedCount,
          avgCallbackLatencyMs,
        },
        providerReadiness: readinessEntries,
      },
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Operational provider endpoint failed', error);
    return NextResponse.json({ ok: false, success: false, error: 'Internal error', requestId, timestamp: new Date().toISOString() }, { status: 500, headers: { 'X-Request-ID': requestId } });
  }
}
