import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { canManageProviders, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  buildGoogleAdsOAuthUrl,
  getGoogleAdsConfigReadiness,
} from '@/lib/ads/google-ads';

export const runtime = 'nodejs';

const GOOGLE_ADS_OAUTH_STATE_COOKIE = 'agentflow-google-ads-oauth-state';
const STATE_MAX_AGE_SECONDS = 10 * 60;

function redirectToCampaigns(
  request: NextRequest,
  googleAds: string,
  reason?: string
) {
  const url = new URL('/dashboard/campaigns', request.url);
  url.searchParams.set('google_ads', googleAds);

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

  if (!canManageProviders(currentRole)) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'provider_settings',
      message: 'Blocked Google Ads OAuth connect.',
      metadata: { role: currentRole, provider: 'google_ads' },
    });

    return redirectToCampaigns(request, 'setup_required', 'access_denied');
  }

  const readiness = getGoogleAdsConfigReadiness();

  if (!readiness.isConfigured) {
    return redirectToCampaigns(request, 'setup_required', readiness.status);
  }

  const state = crypto.randomBytes(32).toString('base64url');

  try {
    const googleAdsOAuthUrl = buildGoogleAdsOAuthUrl({ state });
    const response = NextResponse.redirect(googleAdsOAuthUrl);

    response.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return redirectToCampaigns(request, 'setup_required', 'google_ads_env_missing');
  }
}
