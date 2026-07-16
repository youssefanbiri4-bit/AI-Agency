import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  createNonce,
} from '@/lib/security/security-headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROXY_AUTH_TIMEOUT_MS = 4_000;

function createTimeoutFetch(timeoutMs = PROXY_AUTH_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Proxy auth request timed out after ${timeoutMs}ms`));
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

function buildLoginUrl(request: NextRequest) {
  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set(
    'redirectTo',
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return loginUrl;
}

export async function proxy(request: NextRequest) {
  const startedAt = Date.now();
  // Check if the request accepts HTML (we only need CSP/nonce for HTML responses)
  const acceptHeader = request.headers.get('accept') || '';
  const isHtmlRequest = acceptHeader.includes('text/html');

  let nonce: string | undefined;
  let csp: string | undefined;
  const requestHeaders = new Headers(request.headers);

  if (isHtmlRequest) {
    // Generate a random nonce for HTML requests
    nonce = createNonce();
    requestHeaders.set('x-nonce', nonce);
    csp = buildContentSecurityPolicy(nonce);
  }

  // Create response early so we can use it in cookie callbacks
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');
  const isAuthFormRoute = pathname === '/auth/login' || pathname === '/auth/signup';
  logger.info('request start', {
    pathname,
    isProtectedRoute,
    isAuthFormRoute,
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute) {
      const loginUrl = buildLoginUrl(request);
      loginUrl.searchParams.set('message', 'Supabase is not configured yet');
      logger.warn('redirect login: Supabase not configured', {
        pathname,
        durationMs: Date.now() - startedAt,
      });
      return applySecurityHeaders(NextResponse.redirect(loginUrl), csp);
    }

    // For non-protected routes or when Supabase is not configured, continue without auth
    logger.info('request pass without Supabase config', {
      pathname,
      durationMs: Date.now() - startedAt,
    });
    return applySecurityHeaders(response, csp);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
    },
    global: {
      fetch: createTimeoutFetch(),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        } catch (error) {
          logger.error('Error setting cookies in proxy', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  });

  logger.info('before auth getUser', { pathname });
  const {
    data: { user },
  } = await supabase.auth.getUser().catch((error: unknown) => {
    logger.warn('auth lookup failed', { error: error instanceof Error ? error.message : String(error) });
    return { data: { user: null } };
  });
  logger.info('after auth getUser', {
    pathname,
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    durationMs: Date.now() - startedAt,
  });

  if (!user && isProtectedRoute) {
    logger.warn('redirect login: no user', {
      pathname,
      durationMs: Date.now() - startedAt,
    });
    return applySecurityHeaders(NextResponse.redirect(buildLoginUrl(request)), csp);
  }

  if (user && isAuthFormRoute) {
    logger.info('redirect dashboard: authenticated auth route', {
      pathname,
      durationMs: Date.now() - startedAt,
    });
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/dashboard', request.url)),
      csp
    );
  }

  logger.info('request pass', {
    pathname,
    durationMs: Date.now() - startedAt,
  });
  return applySecurityHeaders(response, csp);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
