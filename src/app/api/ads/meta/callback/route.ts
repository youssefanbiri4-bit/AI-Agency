import { NextResponse, type NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { encryptToken } from '@/lib/ads/encryption';
import {
  exchangeForLongLivedToken,
  exchangeMetaCodeForShortLivedToken,
  getMetaConnectionScopes,
  getMetaTokenDebugInfo,
} from '@/lib/ads/meta';
import { upsertMetaConnection } from '@/lib/data/ad-connections';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestId, nowISO } from '@/lib/api-response';
import type { JsonObject } from '@/types';

export const runtime = 'nodejs';

const META_OAUTH_STATE_COOKIE = 'agentflow-meta-oauth-state';

function buildCampaignsRedirect(request: NextRequest, meta: string, reason?: string) {
  const url = new URL('/dashboard/campaigns', request.url);
  url.searchParams.set('meta', meta);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url;
}

function redirectToCampaigns(request: NextRequest, meta: string, reason?: string) {
  const response = NextResponse.redirect(buildCampaignsRedirect(request, meta, reason));

  response.cookies.set(META_OAUTH_STATE_COOKIE, '', {
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

export async function GET(request: NextRequest) {
  // Rate limiting: 20 OAuth callback requests per IP per minute
  const clientIp =
    request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitResult = await checkRateLimit({
    key: `api:ads:meta:callback:${clientIp}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimitResult.allowed) {
    // Rate limited — redirect with error
    return redirectToCampaigns(request, 'error', 'rate_limited');
  }

  const queryState = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(META_OAUTH_STATE_COOKIE)?.value;

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
    const shortLivedToken = await exchangeMetaCodeForShortLivedToken(code);
    let selectedToken = shortLivedToken;
    let tokenKind = 'short_lived';

    try {
      selectedToken = await exchangeForLongLivedToken(shortLivedToken.accessToken);
      tokenKind = 'long_lived';
    } catch {
      selectedToken = shortLivedToken;
    }

    let debugMetadata: JsonObject = {};
    let grantedScopes: string[] = [];
    let scopeVerificationWarning: string | null = null;

    try {
      const debugInfo = await getMetaTokenDebugInfo(selectedToken.accessToken);
      grantedScopes = debugInfo.scopes;

      debugMetadata = {
        meta_app_id: debugInfo.appId,
        meta_token_type: debugInfo.tokenType,
        meta_application: debugInfo.application,
        meta_user_id: debugInfo.userId,
        meta_token_is_valid: debugInfo.isValid,
        meta_token_issued_at: debugInfo.issuedAt,
        meta_token_expires_at: debugInfo.expiresAt,
        granted_scopes: debugInfo.scopes,
      };
    } catch {
      scopeVerificationWarning =
        'Meta granted scopes could not be verified during OAuth callback.';
      debugMetadata = {
        scope_verification_warning: scopeVerificationWarning,
      };
    }

    const encryptedAccessToken = encryptToken(selectedToken.accessToken);
    const connectionResult = await upsertMetaConnection({
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      encryptedAccessToken,
      tokenExpiresAt: buildTokenExpiresAt(selectedToken.expiresIn),
      scopes: grantedScopes,
      metadata: {
        ...debugMetadata,
        token_kind: tokenKind,
        token_type: selectedToken.tokenType,
        connected_via: 'meta_oauth',
        requested_scopes: getMetaConnectionScopes(),
        scopes_verified: grantedScopes.length > 0,
        ...(scopeVerificationWarning ? { scope_warning: scopeVerificationWarning } : {}),
      },
    });

    if (connectionResult.error) {
      return redirectToCampaigns(request, 'error', 'connection_store_failed');
    }

    return redirectToCampaigns(request, 'connected');
  } catch {
    return redirectToCampaigns(request, 'error', 'token_exchange_failed');
  }
}
