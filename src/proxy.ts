import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

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
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');
  const isAuthFormRoute = pathname === '/auth/login' || pathname === '/auth/signup';

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute) {
      const loginUrl = buildLoginUrl(request);
      loginUrl.searchParams.set('message', 'Supabase is not configured yet');
      return NextResponse.redirect(loginUrl);
    }

    return response;
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
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser().catch((error: unknown) => {
    console.warn('[proxy] auth lookup failed', error);
    return { data: { user: null } };
  });

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  if (user && isAuthFormRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
