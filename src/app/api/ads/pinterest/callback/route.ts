import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getPinterestConfigReadiness } from '@/lib/ads/pinterest';

export const runtime = 'nodejs';

const PINTEREST_OAUTH_STATE_COOKIE = 'agentflow-pinterest-oauth-state';

function buildCampaignsRedirect(
  request: NextRequest,
  pinterest: string,
  reason?: string
) {
  const url = new URL('/dashboard/campaigns', request.url);
  url.searchParams.set('pinterest', pinterest);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url;
}

function redirectToCampaigns(
  request: NextRequest,
  pinterest: string,
  reason?: string
) {
  const response = NextResponse.redirect(
    buildCampaignsRedirect(request, pinterest, reason)
  );

  response.cookies.set(PINTEREST_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export async function GET(request: NextRequest) {
  const readiness = getPinterestConfigReadiness();

  if (!readiness.isConfigured) {
    return redirectToCampaigns(request, 'setup_required', readiness.status);
  }

  const queryState = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(PINTEREST_OAUTH_STATE_COOKIE)?.value;

  if (!queryState || !cookieState || queryState !== cookieState) {
    return redirectToCampaigns(request, 'error', 'invalid_state');
  }

  if (request.nextUrl.searchParams.get('error')) {
    return redirectToCampaigns(request, 'error', 'oauth_denied');
  }

  if (!request.nextUrl.searchParams.get('code')) {
    return redirectToCampaigns(request, 'error', 'missing_code');
  }

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

  return redirectToCampaigns(
    request,
    'storage_not_ready',
    'provider_migration_required'
  );
}
