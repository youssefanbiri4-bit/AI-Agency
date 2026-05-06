import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  buildLinkedInOAuthUrl,
  getLinkedInConfigReadiness,
} from '@/lib/ads/linkedin';

export const runtime = 'nodejs';

const LINKEDIN_OAUTH_STATE_COOKIE = 'agentflow-linkedin-oauth-state';
const STATE_MAX_AGE_SECONDS = 10 * 60;

function redirectToCampaigns(
  request: NextRequest,
  linkedin: string,
  reason?: string
) {
  const url = new URL('/dashboard/campaigns', request.url);
  url.searchParams.set('linkedin', linkedin);

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

  const readiness = getLinkedInConfigReadiness();

  if (!readiness.isConfigured) {
    return redirectToCampaigns(request, 'setup_required', readiness.status);
  }

  const state = crypto.randomBytes(32).toString('base64url');

  try {
    const linkedinOAuthUrl = buildLinkedInOAuthUrl({ state });
    const response = NextResponse.redirect(linkedinOAuthUrl);

    response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return redirectToCampaigns(request, 'setup_required', 'linkedin_env_missing');
  }
}
