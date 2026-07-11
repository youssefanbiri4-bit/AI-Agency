'use server';

import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { getClientIpFromHeaders } from '@/lib/rate-limit';
import {
  buildAuthRateLimitMessage,
  checkAuthBruteForce,
  clearAuthFailures,
  recordAuthAttempt,
  recordAuthFailure,
} from '@/lib/auth/auth-brute-force';
import { getMfaAssuranceState } from '@/lib/auth/mfa';
import { writeSessionActivityCookie } from '@/lib/auth/session-cookie-writer';
import { logger } from '@/lib/logger';

const authLoginLog = logger.child('auth:login');

export interface LoginActionInput {
  email: string;
  password: string;
}

export interface LoginActionResult {
  success: boolean;
  status: number;
  error?: string;
  retryAfterSeconds?: number;
  requiresMfa?: boolean;
}

export async function loginWithPasswordAction(
  input: LoginActionInput
): Promise<LoginActionResult> {
  const email = input.email?.trim() ?? '';
  const password = input.password ?? '';

  if (!email || !password) {
    return { success: false, status: 400, error: 'Please fill in all fields' };
  }

  if (!isSupabaseServerConfigured) {
    return {
      success: false,
      status: 503,
      error: 'Supabase is not configured yet. Sign in will activate after environment setup.',
    };
  }

  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  const bruteForceCheck = await checkAuthBruteForce('login', clientIp, email);
  if (!bruteForceCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: buildAuthRateLimitMessage(bruteForceCheck.reason ?? 'rate_limit', bruteForceCheck.retryAfterSeconds),
      retryAfterSeconds: bruteForceCheck.retryAfterSeconds,
    };
  }

  await recordAuthAttempt('login', clientIp, email);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAuthFailure('login', clientIp, email);
    authLoginLog.warn('login failed', {
      clientIp,
      email,
      error: error.message,
    });

    return { success: false, status: 401, error: error.message };
  }

  await clearAuthFailures('login', clientIp, email);

  const assurance = await getMfaAssuranceState(supabase);
  if (assurance.requiresVerification) {
    authLoginLog.info('login password step succeeded — mfa required', { clientIp, email });
    return { success: true, status: 200, requiresMfa: true };
  }

  const cookieStore = await cookies();
  writeSessionActivityCookie(cookieStore, clientIp);

  authLoginLog.info('login succeeded', { clientIp, email });
  return { success: true, status: 200, requiresMfa: false };
}