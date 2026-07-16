'use server';

import { headers } from 'next/headers';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { getClientIpFromHeaders } from '@/lib/rate-limit';
import {
  buildAuthRateLimitMessage,
  checkAuthBruteForce,
  clearAuthFailures,
  recordAuthAttempt,
  recordAuthFailure,
} from '@/lib/auth/auth-brute-force';
import { validateSignupEmail } from '@/actions/auth/validate-signup';
import { getRequestOrigin } from '@/lib/auth/auth-request-origin';
import { logger } from '@/lib/logger';
import { sendWelcomeEmail } from '@/lib/marketing/email-service';

const authSignupLog = logger.child('auth:signup');

export interface SignUpActionInput {
  email: string;
  password: string;
  fullName: string;
}

export interface SignUpActionResult {
  success: boolean;
  status: number;
  error?: string;
  retryAfterSeconds?: number;
  requiresEmailConfirmation?: boolean;
}

export async function signUpWithPasswordAction(
  input: SignUpActionInput
): Promise<SignUpActionResult> {
  const email = input.email?.trim() ?? '';
  const password = input.password ?? '';
  const fullName = input.fullName?.trim() ?? '';

  if (!email || !password || !fullName) {
    return { success: false, status: 400, error: 'Please fill in all fields' };
  }

  if (password.length < 6) {
    return { success: false, status: 400, error: 'Password must be at least 6 characters' };
  }

  if (!isSupabaseServerConfigured) {
    return {
      success: false,
      status: 503,
      error: 'Supabase is not configured yet. Account creation will activate after environment setup.',
    };
  }

  const allowlist = await validateSignupEmail(email);
  if (!allowlist.allowed) {
    return {
      success: false,
      status: 403,
      error: allowlist.error ?? 'Registration is restricted.',
    };
  }

  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  const bruteForceCheck = await checkAuthBruteForce('signup', clientIp, email);
  if (!bruteForceCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: buildAuthRateLimitMessage(bruteForceCheck.reason ?? 'rate_limit', bruteForceCheck.retryAfterSeconds),
      retryAfterSeconds: bruteForceCheck.retryAfterSeconds,
    };
  }

  await recordAuthAttempt('signup', clientIp, email);

  const origin = getRequestOrigin(headersList);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    await recordAuthFailure('signup', clientIp, email);
    authSignupLog.warn('signup failed', {
      clientIp,
      email,
      error: error.message,
    });

    return { success: false, status: 400, error: error.message };
  }

  await clearAuthFailures('signup', clientIp, email);
  authSignupLog.info('signup succeeded', { clientIp, email, hasSession: Boolean(data.session) });

  // Send welcome email (non-blocking — don't fail signup if email fails)
  if (email) {
    const dashboardUrl = `${origin}/dashboard`;
    sendWelcomeEmail(email, {
      fullName,
      dashboardUrl,
    }).catch((err) => {
      authSignupLog.warn('Failed to send welcome email (non-blocking)', {
        error: err instanceof Error ? err.message : String(err),
        email,
      });
    });
  }

  return {
    success: true,
    status: 200,
    requiresEmailConfirmation: !data.session,
  };
}