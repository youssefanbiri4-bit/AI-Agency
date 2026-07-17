import { NextResponse, type NextRequest } from 'next/server';
import { handleDashboardEdgeAuth } from '@/lib/auth/dashboard-edge-auth';

/**
 * Bulletproof Next.js Edge Middleware.
 *
 * Backend: dashboard-edge-auth — provides full RBAC enforcement, MFA checks,
 * workspace resolution, and CSP/nonce generation at the edge layer.
 *
 * Safety layers:
 * 1. Environment variable guard — if Supabase env vars are missing, short-circuit
 *    and let the request through (application-level auth will handle access).
 * 2. Top-level try/catch — catches ANY runtime error (import failures, Supabase
 *    client creation, auth lookup, cookie operations) and returns NextResponse.next()
 *    instead of crashing with MIDDLEWARE_INVOCATION_FAILED.
 * 3. No Node.js-only modules — only Web APIs and Edge-compatible exports.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // ── Layer 1: Safe environment variable checks ──────────────────────────
  // If Supabase is not configured, skip all auth/CSP/RBAC logic and let the
  // request through. Application-level requirePageAccess() will handle access.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[middleware] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
        'Skipping edge auth — application-level auth checks will handle access control.',
    );
    return NextResponse.next();
  }

  // ── Layer 2: Core middleware with catch-all error handling ──────────────
  try {
    return await handleDashboardEdgeAuth(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[middleware] Middleware invocation failed:', {
      error: errorMessage,
      stack: errorStack,
      pathname: request.nextUrl.pathname,
      method: request.method,
    });

    // Fail open: return a plain response so the request reaches the application.
    // Normal auth checks in layout/page components will handle unauthenticated users.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
