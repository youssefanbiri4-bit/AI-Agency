import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { withApiAuth } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { getCachedJson } from '@/lib/cache';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(
  withApiAuth(['usage:read'], async (request, context) => {
    const requestId = getRequestId(request);
    const admin = getSupabaseAdmin();
    if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });
    const ws = context.workspaceId;

    const usage = await getCachedJson(
      `usage:summary:${ws}`,
      async () => {
        const [agents, prompts, keys] = await Promise.all([
          admin.client!
            .from('agent_builder_agents')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws),
          admin.client!
            .from('prompt_library')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws),
          admin.client!
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws),
        ]);

        if (agents.error || prompts.error || keys.error) {
          throw new Error('Failed to read usage.');
        }

        return {
          agents: agents.count ?? 0,
          prompts: prompts.count ?? 0,
          apiKeys: keys.count ?? 0,
        };
      },
      60
    );

    return createApiSuccess({ usage }, { requestId });
  })
);
