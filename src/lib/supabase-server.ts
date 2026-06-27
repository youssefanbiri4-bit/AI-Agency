import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/data/workspaces';
import { logger } from '@/lib/logger';

const supabaseLog = logger.child('supabase-server');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8_000;

// Cache for the default admin client to avoid creating a new one on every call
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseAnonKey);

interface SupabaseServerClientOptions {
  fetchTimeoutMs?: number;
}

function createTimeoutFetch(timeoutMs = DEFAULT_SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    const startedAt = Date.now();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const safeUrl = (() => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return url;
      }
    })();

    supabaseLog.debug('before fetch', {
      url: safeUrl,
      timeoutMs,
    });

    if (timeoutMs <= 0) {
      const response = await fetch(input, init);
      supabaseLog.debug('after fetch', {
        url: safeUrl,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
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
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      supabaseLog.debug('after fetch', {
        url: safeUrl,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      supabaseLog.warn('fetch failed', {
        url: safeUrl,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  supabaseLog.debug('before cookies for server client');
  const cookieStore = await cookies();
  supabaseLog.debug('after cookies for server client');

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
  supabaseLog.debug('before active workspace cookie read');
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  supabaseLog.debug('after active workspace cookie read', {
    workspaceId,
  });
  return workspaceId;
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

  // If the requested timeout is the default, use the cached client
  if (fetchTimeoutMs === DEFAULT_SUPABASE_FETCH_TIMEOUT_MS) {
    if (!adminClient) {
      adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
        global: {
          fetch: createTimeoutFetch(fetchTimeoutMs),
        },
      });
    }
    return { client: adminClient, error: null };
  }

  // For non-default timeouts, create a new client (not cached)
  return {
    client: createClient<Database>(supabaseUrl, serviceRoleKey, {
      global: {
        fetch: createTimeoutFetch(fetchTimeoutMs),
      },
    }),
    error: null,
  };
}
