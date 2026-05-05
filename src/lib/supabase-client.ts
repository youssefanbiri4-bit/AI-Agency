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

// Type for Supabase
export type { Session, User as SupabaseUser } from '@supabase/supabase-js';
