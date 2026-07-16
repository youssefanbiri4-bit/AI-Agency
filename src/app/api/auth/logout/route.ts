import { logoutSessionAction } from '@/actions/auth/session';
import { buildRateLimitExceededHeaders } from '@/lib/rate-limit';
import { getRequestId, createApiError, createApiSuccess } from '@/lib/api-response';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const body = (await request.json().catch(() => ({}))) as { scope?: 'local' | 'global' };
  const scope = body.scope === 'global' ? 'global' : 'local';

  const result = await logoutSessionAction(scope);

  if (result.status === 429) {
    const retryAfterSeconds = result.retryAfterSeconds ?? 60;
    const resetAt = Date.now() + retryAfterSeconds * 1000;

    return createApiError(result.error ?? 'Rate limit exceeded', {
      status: 429,
      requestId,
      headers: buildRateLimitExceededHeaders({
        allowed: false,
        remaining: 0,
        resetAt,
      }),
      meta: { retryAfter: retryAfterSeconds },
    });
  }

  if (!result.success) {
    return createApiError(result.error ?? 'Logout failed', {
      status: result.status,
      requestId,
    });
  }

  return createApiSuccess(null, {
    requestId,
    message: 'Logout successful',
    extra: { scope },
  });
}