import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/data/workspaces';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl || 'https://example.supabase.co',
    supabaseAnonKey || 'anon-key-not-configured',
    {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can read cookies but cannot always write them.
            // Proxy and Server Actions handle session cookie updates.
          }
        },
      },
    }
  );
}

export async function getActiveWorkspaceIdFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

export async function setActiveWorkspaceIdCookie(workspaceId: string) {
  const cookieStore = await cookies();

  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

// SERVER ONLY: this helper reads SUPABASE_SERVICE_ROLE_KEY and must never be
// imported into client components. Use src/lib/supabase-client.ts in browsers.
export function getSupabaseAdmin() {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase admin client cannot be created in the browser');
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      client: null,
      error: 'Supabase server credentials are not configured',
    };
  }

  return {
    client: createClient<Database>(supabaseUrl, serviceRoleKey),
    error: null,
  };
}
