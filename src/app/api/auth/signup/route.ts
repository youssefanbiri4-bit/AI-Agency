import { signUpWithPasswordAction } from '@/actions/auth/signup';
import { buildRateLimitExceededHeaders } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; fullName?: string }
    | null;

  const result = await signUpWithPasswordAction({
    email: body?.email ?? '',
    password: body?.password ?? '',
    fullName: body?.fullName ?? '',
  });

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
    return Response.json(
      { error: result.error ?? 'Signup failed' },
      { status: result.status }
    );
  }

  return Response.json({
    success: true,
    requiresEmailConfirmation: result.requiresEmailConfirmation ?? false,
  });
}