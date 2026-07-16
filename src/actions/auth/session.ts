'use server';

import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { getClientIpFromHeaders, checkRateLimit } from '@/lib/rate-limit';
import {
  evaluateSessionActivity,
  evaluateSessionIpMismatch,
  refreshAuthSession,
  signOutCurrentSession,
} from '@/lib/auth/session-management';
import { clearSessionTrackingCookies, writeSessionActivityCookie } from '@/lib/auth/session-cookie-writer';
import {
  formatIdleTimeoutMinutes,
  SESSION_ACTIVITY_COOKIE,
  SESSION_CLIENT_IP_COOKIE,
} from '@/lib/auth/session-shared';
import { logger } from '@/lib/logger';

const sessionActionLog = logger.child('auth:session-action');

const LOGOUT_RATE_LIMIT = { limit: 10, windowMs: 5 * 60_000 };
const REFRESH_RATE_LIMIT = { limit: 30, windowMs: 5 * 60_000 };

async function enforceSessionRateLimit(action: 'logout' | 'refresh', clientIp: string) {
  const result = await checkRateLimit({
    key: `auth:session:${action}:ip:${clientIp}`,
    limit: action === 'logout' ? LOGOUT_RATE_LIMIT.limit : REFRESH_RATE_LIMIT.limit,
    windowMs: action === 'logout' ? LOGOUT_RATE_LIMIT.windowMs : REFRESH_RATE_LIMIT.windowMs,
  });

  if (!result.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
    };
  }

  return { allowed: true as const };
}

export interface SessionInfoResult {
  success: boolean;
  status: number;
  error?: string;
  idleTimeoutMinutes?: number;
  lastActivityAt?: string | null;
  sessionIp?: string | null;
  isExpired?: boolean;
}

export interface SessionMutationResult {
  success: boolean;
  status: number;
  error?: string;
  retryAfterSeconds?: number;
}

export async function getSessionInfoAction(): Promise<SessionInfoResult> {
  if (!isSupabaseServerConfigured) {
    return { success: false, status: 503, error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: 401, error: 'Not authenticated.' };
  }

  const cookieStore = await cookies();
  const activity = evaluateSessionActivity(cookieStore.get(SESSION_ACTIVITY_COOKIE)?.value);

  return {
    success: true,
    status: 200,
    idleTimeoutMinutes: formatIdleTimeoutMinutes(),
    lastActivityAt: activity.lastActivityMs ? new Date(activity.lastActivityMs).toISOString() : null,
    sessionIp: cookieStore.get(SESSION_CLIENT_IP_COOKIE)?.value ?? null,
    isExpired: activity.expired,
  };
}

export async function touchSessionActivityAction(): Promise<SessionMutationResult> {
  if (!isSupabaseServerConfigured) {
    return { success: false, status: 503, error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: 401, error: 'Not authenticated.' };
  }

  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const cookieStore = await cookies();

  writeSessionActivityCookie(cookieStore, clientIp);
  return { success: true, status: 200 };
}

export async function logoutSessionAction(scope: 'local' | 'global' = 'local'): Promise<SessionMutationResult> {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const rateLimit = await enforceSessionRateLimit('logout', clientIp);

  if (!rateLimit.allowed) {
    return {
      success: false,
      status: 429,
      error: 'Too many logout attempts. Please wait and try again.',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  if (!isSupabaseServerConfigured) {
    return { success: false, status: 503, error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const result = await signOutCurrentSession(supabase, scope);
  const cookieStore = await cookies();
  clearSessionTrackingCookies(cookieStore);

  if (!result.success) {
    return { success: false, status: 400, error: result.error };
  }

  sessionActionLog.info('logout completed', { scope, clientIp });
  return { success: true, status: 200 };
}

export async function logoutAllDevicesAction(): Promise<SessionMutationResult> {
  return logoutSessionAction('global');
}

export async function refreshSessionAction(): Promise<SessionMutationResult> {
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const rateLimit = await enforceSessionRateLimit('refresh', clientIp);

  if (!rateLimit.allowed) {
    return {
      success: false,
      status: 429,
      error: 'Too many session refresh attempts. Please wait and try again.',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  if (!isSupabaseServerConfigured) {
    return { success: false, status: 503, error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: 401, error: 'Not authenticated.' };
  }

  const result = await refreshAuthSession(supabase);

  if (!result.success) {
    await signOutCurrentSession(supabase, 'local');
    const cookieStore = await cookies();
    clearSessionTrackingCookies(cookieStore);
    return { success: false, status: 401, error: result.error ?? 'Session refresh failed.' };
  }

  const cookieStore = await cookies();
  writeSessionActivityCookie(cookieStore, clientIp);
  sessionActionLog.info('session refreshed', { clientIp });

  return { success: true, status: 200 };
}

export async function checkServerSessionHealthAction(): Promise<{
  expired: boolean;
  suspicious: boolean;
  reason?: 'idle_timeout' | 'ip_mismatch';
}> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const activity = evaluateSessionActivity(cookieStore.get(SESSION_ACTIVITY_COOKIE)?.value);

  if (activity.expired) {
    return { expired: true, suspicious: true, reason: 'idle_timeout' };
  }

  const ipMismatch = evaluateSessionIpMismatch(
    cookieStore.get(SESSION_CLIENT_IP_COOKIE)?.value,
    clientIp
  );

  if (ipMismatch) {
    return { expired: false, suspicious: true, reason: 'ip_mismatch' };
  }

  return { expired: false, suspicious: false };
}
