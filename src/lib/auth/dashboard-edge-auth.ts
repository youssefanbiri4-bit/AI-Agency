import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/data/workspaces';
import {
  RBAC_DEPT_COOKIE,
  PATHNAME_HEADER,
  buildAccessDeniedUrl,
  buildPageAccessContext,
  evaluatePageAccess,
  isDashboardRoute,
} from '@/lib/auth/require-page-access';
import { isDepartment } from '@/types/auth';
import { logger } from '@/lib/logger';
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  createNonce,
} from '@/lib/security/security-headers';
import { getMfaEnforcementRedirect, isMfaEnforcementRoute } from '@/lib/auth/mfa-enforcement';

const edgeLog = logger.child('auth:dashboard-edge');
const EDGE_AUTH_TIMEOUT_MS = 4_000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createTimeoutFetch(timeoutMs = EDGE_AUTH_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Edge auth request timed out after ${timeoutMs}ms`));
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

async function resolveWorkspaceId(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  preferredWorkspaceId?: string | null
): Promise<string | null> {
  if (preferredWorkspaceId) {
    const { data } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', preferredWorkspaceId)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

export async function handleDashboardEdgeAuth(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const acceptHeader = request.headers.get('accept') || '';
  const isHtmlRequest = acceptHeader.includes('text/html');

  let nonce: string | undefined;
  let csp: string | undefined;
  const requestHeaders = new Headers(request.headers);

  if (isHtmlRequest) {
    nonce = createNonce();
    requestHeaders.set('x-nonce', nonce);
    csp = buildContentSecurityPolicy(nonce);
  }

  const pathname = request.nextUrl.pathname;
  requestHeaders.set(PATHNAME_HEADER, pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');
  const isAuthFormRoute = pathname === '/auth/login' || pathname === '/auth/signup';

  edgeLog.info('request start', {
    pathname,
    isProtectedRoute,
    isAuthFormRoute,
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute) {
      const loginUrl = buildLoginUrl(request);
      loginUrl.searchParams.set('message', 'Supabase is not configured yet');
      return applySecurityHeaders(NextResponse.redirect(loginUrl), csp);
    }

    return applySecurityHeaders(response, csp);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
    global: { fetch: createTimeoutFetch() },
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
          edgeLog.error('Error setting cookies in edge auth', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser().catch((error: unknown) => {
    edgeLog.warn('auth lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { data: { user: null } };
  });

  if (!user && isProtectedRoute) {
    return applySecurityHeaders(NextResponse.redirect(buildLoginUrl(request)), csp);
  }

  if (user && isAuthFormRoute) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL('/dashboard', request.url)),
      csp
    );
  }

  if (user && isDashboardRoute(pathname)) {
    const preferredWorkspaceId = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
    const workspaceId = await resolveWorkspaceId(supabase, user.id, preferredWorkspaceId);

    if (!workspaceId) {
      if (pathname !== '/dashboard' && !pathname.startsWith('/onboarding')) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/onboarding', request.url)),
          csp
        );
      }
    } else {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role, department')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/onboarding', request.url)),
          csp
        );
      }

      const accessCtx = buildPageAccessContext({
        role: membership.role,
        assignedDepartment: isDepartment(membership.department) ? membership.department : null,
        cookieDepartment: request.cookies.get(RBAC_DEPT_COOKIE)?.value,
      });

      if (accessCtx) {
        const access = evaluatePageAccess(pathname, accessCtx);

        if (!access.allowed) {
          edgeLog.warn('dashboard route denied', {
            pathname,
            area: access.area,
            role: accessCtx.role,
            department: accessCtx.effectiveDepartment,
            durationMs: Date.now() - startedAt,
          });

          return applySecurityHeaders(
            NextResponse.redirect(buildAccessDeniedUrl(request.url, pathname)),
            csp
          );
        }

        response.headers.set('x-rbac-role', accessCtx.role);
        if (accessCtx.effectiveDepartment) {
          response.headers.set('x-rbac-dept', accessCtx.effectiveDepartment);
        }

        // MFA enforcement check for owner/admin roles
        if (!isMfaEnforcementRoute(pathname) && membership.role) {
          try {
            const mfaRedirect = await getMfaEnforcementRedirect(
              supabase,
              workspaceId,
              user.id,
              membership.role
            );

            if (mfaRedirect) {
              edgeLog.warn('mfa enforcement triggered redirect', {
                pathname,
                role: membership.role,
                durationMs: Date.now() - startedAt,
              });

              return applySecurityHeaders(
                NextResponse.redirect(new URL(mfaRedirect, request.url)),
                csp
              );
            }
          } catch (err) {
            // MFA enforcement is best-effort; don't block access on errors
            edgeLog.warn('mfa enforcement check failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
  }

  edgeLog.info('request pass', {
    pathname,
    durationMs: Date.now() - startedAt,
  });

  return applySecurityHeaders(response, csp);
}

export const edgeAuthMatcher = [
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
];