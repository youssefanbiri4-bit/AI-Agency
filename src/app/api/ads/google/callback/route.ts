import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { encryptToken } from '@/lib/ads/encryption';
import {
  exchangeGoogleCodeForTokens,
  getGoogleAdsConfigReadiness,
  getGoogleAdsReadOnlyScopes,
} from '@/lib/ads/google-ads';
import { upsertGoogleAdsConnection } from '@/lib/data/ad-connections';
import type { JsonObject } from '@/types';

export const runtime = 'nodejs';

const GOOGLE_ADS_OAUTH_STATE_COOKIE = 'agentflow-google-ads-oauth-state';

function buildCampaignsRedirect(
  request: NextRequest,
  googleAds: string,
  reason?: string
) {
  const url = new URL('/dashboard/campaigns', request.url);
  url.searchParams.set('google_ads', googleAds);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url;
}

function redirectToCampaigns(
  request: NextRequest,
  googleAds: string,
  reason?: string
) {
  const response = NextResponse.redirect(
    buildCampaignsRedirect(request, googleAds, reason)
  );

  response.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

function buildTokenExpiresAt(expiresIn: number | null) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function getGrantedScopes(scope: string | null) {
  if (!scope) {
    return [];
  }

  return scope
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const readiness = getGoogleAdsConfigReadiness();

  if (!readiness.isConfigured) {
    return redirectToCampaigns(request, 'setup_required', readiness.status);
  }

  const queryState = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(GOOGLE_ADS_OAUTH_STATE_COOKIE)?.value;

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
    const token = await exchangeGoogleCodeForTokens(code);

    if (!token.refreshToken) {
      return redirectToCampaigns(request, 'error', 'missing_refresh_token');
    }

    const metadata: JsonObject = {
      connected_via: 'google_ads_oauth',
      token_type: token.tokenType,
      granted_scopes: getGrantedScopes(token.scope),
      has_refresh_token: true,
    };
    const connectionResult = await upsertGoogleAdsConnection({
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      encryptedAccessToken: encryptToken(token.accessToken),
      encryptedRefreshToken: encryptToken(token.refreshToken),
      tokenExpiresAt: buildTokenExpiresAt(token.expiresIn),
      scopes: [...getGoogleAdsReadOnlyScopes()],
      metadata,
    });

    if (connectionResult.error) {
      return redirectToCampaigns(request, 'error', 'connection_store_failed');
    }

    return redirectToCampaigns(request, 'connected');
  } catch {
    return redirectToCampaigns(request, 'error', 'token_exchange_failed');
  }
}
