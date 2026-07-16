import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { requireSessionAdmin } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { listApiKeys, createApiKey } from '@/lib/data/api-keys';
import { API_SCOPES, scopesForRole, isApiScope } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(API_SCOPES.length),
  rateLimit: z.number().int().min(1).max(1000).optional(),
});

export const GET = withApiHandler(async (request: Request): Promise<NextResponse> => {
  const requestId = getRequestId(request);
  const session = await requireSessionAdmin(request);
  if (session.response) return session.response;

  const result = await listApiKeys(session.workspaceId!, session.supabase!);
  if (result.error) {
    return createApiError('DATABASE_ERROR', { status: 500, requestId, message: result.error });
  }

  return createApiSuccess(
    {
      apiKeys: result.data.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.key_prefix,
        scopes: k.scopes,
        rateLimit: k.rate_limit,
        status: k.status,
        expiresAt: k.expires_at,
        lastUsedAt: k.last_used_at,
        createdAt: k.created_at,
      })),
    },
    { requestId }
  );
});

export const POST = withApiHandler(async (request: Request): Promise<NextResponse> => {
  const requestId = getRequestId(request);
  const session = await requireSessionAdmin(request);
  if (session.response) return session.response;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return createApiError('INVALID_JSON', { status: 400, requestId, message: 'Request body must be valid JSON.' });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createApiError('VALIDATION_ERROR', {
      status: 400,
      requestId,
      message: 'Invalid request payload.',
      meta: { issues: parsed.error.issues },
    });
  }

  const invalidScope = parsed.data.scopes.find((s) => !isApiScope(s));
  if (invalidScope) {
    return createApiError('VALIDATION_ERROR', {
      status: 400,
      requestId,
      message: `Unknown scope: ${invalidScope}`,
      meta: { allowed: API_SCOPES },
    });
  }

  const allowedScopes = scopesForRole('admin');
  const forbidden = parsed.data.scopes.filter((s) => !allowedScopes.includes(s as never));
  if (forbidden.length > 0) {
    return createApiError('FORBIDDEN', {
      status: 403,
      requestId,
      message: 'Requested scope exceeds your role permissions.',
      meta: { forbidden },
    });
  }

  const created = await createApiKey(
    {
      workspaceId: session.workspaceId!,
      userId: session.userId!,
      name: parsed.data.name,
      scopes: parsed.data.scopes as never,
      rateLimit: parsed.data.rateLimit,
    },
    session.supabase!
  );
  if (created.error) {
    return createApiError('DATABASE_ERROR', { status: 500, requestId, message: created.error });
  }

  return createApiSuccess(
    {
      apiKey: {
        id: created.data.record.id,
        name: created.data.record.name,
        keyPrefix: created.data.record.key_prefix,
        scopes: created.data.record.scopes,
        rateLimit: created.data.record.rate_limit,
        status: created.data.record.status,
        createdAt: created.data.record.created_at,
      },
      // Raw key is only returned once, at creation time.
      secret: created.data.rawKey,
    },
    { status: 201, requestId, message: 'API key created. Store the secret; it will not be shown again.' }
  );
});
