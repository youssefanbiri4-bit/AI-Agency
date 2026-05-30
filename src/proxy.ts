import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROXY_AUTH_TIMEOUT_MS = 4_000;

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildContentSecurityPolicy(nonce: string) {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.openai.com https://graph.facebook.com https://graph.instagram.com https://oauth2.googleapis.com https://googleads.googleapis.com https://api.pinterest.com https://api.github.com",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ];

  return directives.join('; ');
}

function applySecurityHeaders(response: NextResponse, contentSecurityPolicy: string | undefined) {
  // Set security headers that should always be present
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  // Hide powered by header
  response.headers.set('X-Powered-By', '');
   
  // Only set CSP if provided (for HTML requests)
  if (contentSecurityPolicy) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  }
   
  return response;
}

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
