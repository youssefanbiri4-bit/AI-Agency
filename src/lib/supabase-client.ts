import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { reportAppError } from '@/lib/logger';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Client-side Supabase client. This uses only public anon configuration.
export const supabase = createBrowserClient<Database>(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'anon-key-not-configured',
  {
    auth: {
      flowType: 'pkce',
    },
  }
);

// Helper to check auth
export async function getAuthSession() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    reportAppError('Error getting auth session', error);
    return null;
  }
}

// Helper to get current user
export async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    reportAppError('Error getting current user', error);
    return null;
  }
}

// Logout helper
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    reportAppError('Error signing out', error);
    throw error;
  }
}

/**
 * Client-only check: exposes NEXT_PUBLIC_SUPABASE env status in browser.
 * Returns { ok: true } if both URL and anon key are configured.
 * Returns { ok: false, message } with a descriptive warning if not.
 */
export function getBrowserSupabaseEnvStatus(): { ok: boolean; message?: string } {
  if (!supabaseUrl) {
    return {
      ok: false,
      message:
        'NEXT_PUBLIC_SUPABASE_URL is not set. Auth, database, and real-time features will not work until this is configured in your deployment environment.',
    };
  }

  if (!supabaseAnonKey) {
    return {
      ok: false,
      message:
        'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Auth, database, and real-time features will not work until this is configured in your deployment environment.',
    };
  }

  return { ok: true };
}

// Type for Supabase
export type { Session, User as SupabaseUser } from '@supabase/supabase-js';
