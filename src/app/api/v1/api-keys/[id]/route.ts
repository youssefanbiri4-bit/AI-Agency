import { NextResponse } from 'next/server';
import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { requireSessionAdmin } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { revokeApiKey } from '@/lib/data/api-keys';

export const dynamic = 'force-dynamic';

export const DELETE = withApiHandler(async (
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  if (!id) {
    return createApiError('VALIDATION_ERROR', { status: 400, requestId, message: 'Missing API key id.' });
  }

  const session = await requireSessionAdmin(request);
  if (session.response) return session.response;

  const result = await revokeApiKey(id, session.workspaceId!, session.supabase!);
  if (result.error) {
    return createApiError('DATABASE_ERROR', { status: 500, requestId, message: result.error });
  }

  return createApiSuccess({ id, status: 'revoked' }, { requestId, message: 'API key revoked.' });
});
