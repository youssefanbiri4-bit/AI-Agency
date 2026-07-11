import { refreshSessionAction } from '@/actions/auth/session';
import { buildRateLimitExceededHeaders } from '@/lib/rate-limit';

export async function POST() {
  const result = await refreshSessionAction();

  if (result.status === 429) {
    const retryAfterSeconds = result.retryAfterSeconds ?? 60;
    const resetAt = Date.now() + retryAfterSeconds * 1000;

    return new Response(
      JSON.stringify({
        error: result.error ?? 'Rate limit exceeded',
        retryAfter: retryAfterSeconds,
      }),
      {
        status: 429,
        headers: buildRateLimitExceededHeaders({
          allowed: false,
          remaining: 0,
          resetAt,
        }),
      }
    );
  }

  if (!result.success) {
    return Response.json({ error: result.error ?? 'Refresh failed' }, { status: result.status });
  }

  return Response.json({ success: true });
}