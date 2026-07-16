import { createSupabaseServerClient } from '@/lib/supabase-server';
import { reportAppError } from '@/lib/logger';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';
import { snapshotSystemHealth } from '@/lib/health/system-health-check';

/** Check whether the incoming request carries a valid user session. */
async function isAuthenticated(_req: Request): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return !!data?.user;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const startTime = Date.now();
  const requestId = getRequestId(req);

  // Lightweight rate limiting: 60 req/min per IP
  const clientIp =
    req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitResult = await checkRateLimit({
    key: `api:health:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimitResult.allowed) {
    return createApiError('Rate limit exceeded', {
      status: 429,
      requestId,
      extra: {
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
    });
  }

  const timestamp = new Date().toISOString();

  try {
    const authenticated = await isAuthenticated(req);

    if (authenticated) {
      // Authenticated: return full detailed health including service statuses.
      // snapshotSystemHealth persists a best-effort snapshot and fires a
      // debounced degradation alert when unhealthy.
      const { detailed } = await snapshotSystemHealth();
      const allOk = detailed.status === 'ok';

      return createApiSuccess(detailed, {
        requestId,
        status: allOk ? 200 : 503,
        headers: { 'X-Response-Time': `${Date.now() - startTime}ms` },
      });
    }

    // Public: return minimal safe status (no internal details)
    return createApiSuccess(
      { status: 'ok', timestamp },
      {
        requestId,
        status: 200,
        headers: { 'X-Response-Time': `${Date.now() - startTime}ms` },
      }
    );
  } catch (caughtError) {
    reportAppError('Health check endpoint failed', caughtError);

    // Never leak internal details to any caller
    return createApiError('Health check failed', {
      status: 500,
      requestId,
      extra: {
        status: 'error',
        timestamp,
      },
    });
  }
}
