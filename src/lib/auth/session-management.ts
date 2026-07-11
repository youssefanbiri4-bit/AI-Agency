import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import {
  evaluateSessionActivity,
  evaluateSessionIpMismatch,
  SESSION_ACTIVITY_COOKIE,
  SESSION_CLIENT_IP_COOKIE,
} from '@/lib/auth/session-shared';

export {
  buildSuspiciousLogoutMessage,
  evaluateSessionActivity,
  evaluateSessionIpMismatch,
} from '@/lib/auth/session-shared';

const sessionLog = logger.child('auth:session');

export async function invalidateOtherSessions(
  supabase: SupabaseClient<Database>,
  reason: string
): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });

  if (error) {
    sessionLog.warn('failed to invalidate other sessions', { reason, error: error.message });
    return;
  }

  sessionLog.info('invalidated other sessions', { reason });
}

export async function signOutCurrentSession(
  supabase: SupabaseClient<Database>,
  scope: 'local' | 'global' = 'local'
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signOut({ scope });

  if (error) {
    sessionLog.warn('sign out failed', { scope, error: error.message });
    return { success: false, error: error.message };
  }

  sessionLog.info('sign out succeeded', { scope });
  return { success: true };
}

export async function refreshAuthSession(
  supabase: SupabaseClient<Database>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    sessionLog.warn('session refresh failed', { error: error?.message });
    return { success: false, error: error?.message ?? 'Session refresh failed.' };
  }

  sessionLog.info('session refreshed');
  return { success: true };
}

export const SESSION_COOKIES_TO_CLEAR = [SESSION_ACTIVITY_COOKIE, SESSION_CLIENT_IP_COOKIE] as const;