import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  buildPinterestPublishingOAuthUrl,
  getPinterestPublishingReadiness,
} from '@/lib/ads/pinterest-publishing';

export const runtime = 'nodejs';

const PINTEREST_OAUTH_STATE_COOKIE = 'agentflow-pinterest-oauth-state';
const PINTEREST_OAUTH_RETURN_COOKIE = 'agentflow-pinterest-oauth-return';
const STATE_MAX_AGE_SECONDS = 10 * 60;

function redirectToCampaigns(
  request: NextRequest,
  pinterest: string,
  reason?: string
) {
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  const url = new URL(returnTo === 'settings' ? '/dashboard/settings' : '/dashboard/campaigns', request.url);
  url.searchParams.set('pinterest', pinterest);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth/login?redirectTo=/dashboard/campaigns', request.url)
    );
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  const currentRole = normalizeWorkspaceRole(membership.data?.role, workspaceResult.data, user.id);

  if (!hasPermission(currentRole, 'admin')) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'provider_settings',
      message: 'Blocked Pinterest OAuth connect.',
      metadata: { role: currentRole, provider: 'pinterest' },
    });

    return redirectToCampaigns(request, 'error', 'access_denied');
  }

  const readiness = await getPinterestPublishingReadiness({
    workspaceId: workspaceResult.data.id,
    userId: user.id,
  });

  const envMissing = readiness.missing.some((missing) => missing.startsWith('PINTEREST_'));

  if (readiness.state === 'setup_required' && envMissing) {
    return redirectToCampaigns(request, 'setup_required', 'pinterest_env_missing');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const returnTo = request.nextUrl.searchParams.get('returnTo') === 'settings' ? 'settings' : 'campaigns';

  try {
    const pinterestOAuthUrl = buildPinterestPublishingOAuthUrl({ state });
    const response = NextResponse.redirect(pinterestOAuthUrl);

    response.cookies.set(PINTEREST_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_MAX_AGE_SECONDS,
    });
    response.cookies.set(PINTEREST_OAUTH_RETURN_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return redirectToCampaigns(request, 'setup_required', 'pinterest_env_missing');
  }
}
