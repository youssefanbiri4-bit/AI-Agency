import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { completePinterestOAuthConnection } from '@/lib/ads/pinterest-publishing';

export const runtime = 'nodejs';

const PINTEREST_OAUTH_STATE_COOKIE = 'agentflow-pinterest-oauth-state';
const PINTEREST_OAUTH_RETURN_COOKIE = 'agentflow-pinterest-oauth-return';

function buildCampaignsRedirect(
  request: NextRequest,
  pinterest: string,
  reason?: string
) {
  const returnTo = request.cookies.get(PINTEREST_OAUTH_RETURN_COOKIE)?.value;
  const url = new URL(returnTo === 'settings' ? '/dashboard/settings' : '/dashboard/campaigns', request.url);
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
  response.cookies.set(PINTEREST_OAUTH_RETURN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export async function GET(request: NextRequest) {
  const queryState = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(PINTEREST_OAUTH_STATE_COOKIE)?.value;

  if (!queryState || !cookieState || queryState !== cookieState) {
    return redirectToCampaigns(request, 'error', 'invalid_state');
  }

  if (request.nextUrl.searchParams.get('error')) {
    return redirectToCampaigns(request, 'error', 'oauth_denied');
  }

  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
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

  try {
    await completePinterestOAuthConnection({
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      code,
    });

    return redirectToCampaigns(request, 'connected');
  } catch (error) {
    return redirectToCampaigns(
      request,
      'error',
      error instanceof Error && error.message.toLowerCase().includes('missing')
        ? 'pinterest_env_missing'
        : 'token_exchange_failed'
    );
  }
}
