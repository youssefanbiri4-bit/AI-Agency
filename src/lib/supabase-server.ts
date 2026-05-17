import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/data/workspaces';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8_000;

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseAnonKey);

interface SupabaseServerClientOptions {
  fetchTimeoutMs?: number;
}

function createTimeoutFetch(timeoutMs = DEFAULT_SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    if (timeoutMs <= 0) {
      return fetch(input, init);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Supabase request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => {
      controller.abort(upstreamSignal?.reason);
    };

    if (upstreamSignal?.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl || 'https://example.supabase.co',
    supabaseAnonKey || 'anon-key-not-configured',
    {
      auth: {
        flowType: 'pkce',
      },
      global: {
        fetch: createTimeoutFetch(options.fetchTimeoutMs),
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
export function getSupabaseAdmin(fetchTimeoutMs = DEFAULT_SUPABASE_FETCH_TIMEOUT_MS) {
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
    client: createClient<Database>(supabaseUrl, serviceRoleKey, {
      global: {
        fetch: createTimeoutFetch(fetchTimeoutMs),
      },
    }),
    error: null,
  };
}
