import { logoutSessionAction } from '@/actions/auth/session';
import { buildRateLimitExceededHeaders } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { scope?: 'local' | 'global' };
  const scope = body.scope === 'global' ? 'global' : 'local';

  const result = await logoutSessionAction(scope);

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
    return Response.json({ error: result.error ?? 'Logout failed' }, { status: result.status });
  }

  return Response.json({ success: true, scope });
}