import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { withApiAuth } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(withApiAuth(['prompts:read'], async (request, context, routeContext) => {
  const requestId = getRequestId(request);
  const { id } = await routeContext.params;
  if (!id) return createApiError('VALIDATION_ERROR', { status: 400, requestId, message: 'Missing prompt id.' });

  const admin = getSupabaseAdmin();
  if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });

  const { data, error } = await admin.client
    .from('prompt_library')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', context.workspaceId)
    .maybeSingle();

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });
  if (!data) return createApiError('NOT_FOUND', { status: 404, requestId, message: 'Prompt not found.' });

  return createApiSuccess({ prompt: data }, { requestId });
}));
