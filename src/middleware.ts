import type { NextRequest } from 'next/server';
import { handleDashboardEdgeAuth } from '@/lib/auth/dashboard-edge-auth';

/**
 * Edge route protection for /dashboard/* (audit H9).
 * Shared helpers: `@/lib/auth/require-page-access`.
 */
export async function middleware(request: NextRequest) {
  return handleDashboardEdgeAuth(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};