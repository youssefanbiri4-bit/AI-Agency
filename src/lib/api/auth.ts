import type { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ApiKeyScope } from '@/types/database';
import {
  getRequestId,
  createApiError,
  type ApiErrorPayload,
} from '@/lib/api-response';
import {
  checkRateLimitComposite,
  getClientIpFromHeaders,
  buildRateLimitExceededHeaders,
  API_KEY_IP_LIMIT,
  API_KEY_IP_WINDOW_MS,
  API_KEY_WORKSPACE_LIMIT,
  API_KEY_WORKSPACE_WINDOW_MS,
} from '@/lib/rate-limit';
import { createSupabaseServerClient, getSupabaseAdmin, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac-client';
import {
  findApiKeyByRawKey,
  isValidApiKeyFormat,
  markApiKeyUsed,
} from '@/lib/data/api-keys';
import { requireApiScopes } from '@/lib/auth/permissions';

export interface ApiAuthContext {
  keyId: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
  rateLimit: number;
  name: string;
  prefix: string;
}

export type ApiHandler = (
  request: Request,
  context: ApiAuthContext,
  routeContext: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

interface AuthOutcome {
  context?: ApiAuthContext;
  error?: NextResponse;
}

async function fail(
  request: Request,
  status: number,
  code: ApiErrorPayload['error'],
  message: string,
  extra?: Partial<ApiErrorPayload>
): Promise<AuthOutcome> {
  return {
    error: createApiError(code, {
      status,
      requestId: getRequestId(request),
      message,
      ...extra,
    }),
  };
}

/**
 * Authenticates a request via an API key (Authorization: Bearer af_pub_... or
 * x-api-key header), enforces status/expiry, and applies per-key rate limiting.
 */
export async function authenticateApiKey(request: Request): Promise<AuthOutcome> {
  const header = request.headers.get('authorization');
  const altHeader = request.headers.get('x-api-key');
  let rawKey: string | null = null;

  if (header?.toLowerCase().startsWith('bearer ')) {
    rawKey = header.slice(7).trim();
  } else if (altHeader) {
    rawKey = altHeader.trim();
  }

  if (!rawKey || !isValidApiKeyFormat(rawKey)) {
    return fail(request, 401, 'UNAUTHORIZED', 'Provide a valid API key via the Authorization: Bearer or x-api-key header.', {
      message: 'Missing or malformed API key.',
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin.client) {
    return fail(request, 503, 'SERVICE_UNAVAILABLE', 'API authentication is not configured.', {
      message: 'Supabase service credentials are missing.',
    });
  }

  const found = await findApiKeyByRawKey(rawKey, admin.client);
  if (found.error || !found.data) {
    return fail(request, 401, 'UNAUTHORIZED', 'Invalid API key.', {
      message: 'The provided API key was not found.',
    });
  }

  const key = found.data;
  if (key.status !== 'active') {
    return fail(request, 401, 'UNAUTHORIZED', 'This API key has been revoked.', {});
  }
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return fail(request, 401, 'UNAUTHORIZED', 'This API key has expired.', {});
  }

  const limiter = await checkRateLimitComposite([
    // 1) Per API key (configured per-key limit).
    { key: `apikey:${key.id}`, limit: key.rate_limit, windowMs: 60_000 },
    // 2) Per client IP (shared abuse protection across all keys).
    {
      key: `apikey-ip:${key.workspace_id}:${getClientIpFromHeaders(request.headers)}`,
      limit: API_KEY_IP_LIMIT,
      windowMs: API_KEY_IP_WINDOW_MS,
    },
    // 3) Per workspace ("user" dimension) across all of its keys.
    {
      key: `apikey-ws:${key.workspace_id}`,
      limit: API_KEY_WORKSPACE_LIMIT,
      windowMs: API_KEY_WORKSPACE_WINDOW_MS,
    },
  ]);
  if (!limiter.allowed) {
    return {
      error: createApiError('RATE_LIMIT_EXCEEDED', {
        status: 429,
        requestId: getRequestId(request),
        message: 'Rate limit exceeded. Try again later.',
        headers: buildRateLimitExceededHeaders(limiter),
        meta: { limit: key.rate_limit, windowMs: 60_000 },
      }),
    };
  }

  void markApiKeyUsed(key.id, admin.client);

  return {
    context: {
      keyId: key.id,
      workspaceId: key.workspace_id,
      scopes: key.scopes as ApiKeyScope[],
      rateLimit: key.rate_limit,
      name: key.name,
      prefix: key.key_prefix,
    },
  };
}

/**
 * Wraps a route handler with API-key auth + scope enforcement.
 * `requiredScopes` are checked against the key's granted scopes.
 */
export function withApiAuth(requiredScopes: string[] = [], handler: ApiHandler) {
  return async function (
    request: Request,
    routeContext: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> {
    const outcome = await authenticateApiKey(request);
    if (outcome.error) return outcome.error;
    const context = outcome.context!;

    if (requiredScopes.length > 0) {
      const missing = requireApiScopes(context.scopes, requiredScopes);
      if (missing.length > 0) {
        return createApiError('FORBIDDEN', {
          status: 403,
          requestId: getRequestId(request),
          message: 'Insufficient API scope.',
          meta: { required: requiredScopes, missing },
        });
      }
    }

    return handler(request, context, routeContext);
  };
}

export interface SessionAdminResult {
  response?: NextResponse;
  supabase?: SupabaseClient<Database>;
  workspaceId?: string;
  userId?: string;
}

/**
 * Session-based guard for API-key management endpoints. Requires an
 * authenticated workspace admin (Cookie/Supabase session, not API key).
 */
export async function requireSessionAdmin(request: Request): Promise<SessionAdminResult> {
  const requestId = getRequestId(request);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: createApiError('UNAUTHORIZED', { status: 401, requestId, message: 'Authentication required.' }) };
  }

  const workspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, workspaceId);
  if (!workspaceResult.data) {
    return { response: createApiError('FORBIDDEN', { status: 403, requestId, message: 'No active workspace.' }) };
  }

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  const role = normalizeWorkspaceRole(membership.data?.role, workspaceResult.data, user.id);
  if (!hasPermission(role, 'admin')) {
    return { response: createApiError('FORBIDDEN', { status: 403, requestId, message: 'Workspace admin role required to manage API keys.' }) };
  }

  return { supabase, workspaceId: workspaceResult.data.id, userId: user.id };
}
