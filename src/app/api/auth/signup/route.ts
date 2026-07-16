import { signUpWithPasswordAction } from '@/actions/auth/signup';
import { buildRateLimitExceededHeaders } from '@/lib/rate-limit';
import { getRequestId, createApiError, createApiSuccess } from '@/lib/api-response';

export async function POST(request: Request) {
  const requestId = getRequestId(request);

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
    return createApiError(result.error ?? 'Signup failed', {
      status: result.status,
      requestId,
    });
  }

  return createApiSuccess(null, {
    requestId,
    message: 'Signup successful',
    extra: { requiresEmailConfirmation: result.requiresEmailConfirmation ?? false },
  });
}