import { getRequestId, createApiSuccess, createApiError } from '@/lib/api-response';
import { withApiAuth } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(withApiAuth(['team:read'], async (request, context) => {
  const requestId = getRequestId(request);
  const admin = getSupabaseAdmin();
  if (!admin.client) return createApiError('SERVICE_UNAVAILABLE', { status: 503, requestId });

  const { data: members, error } = await admin.client
    .from('workspace_members')
    .select('user_id,role,department,permissions,created_at')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: true });

  if (error) return createApiError('DATABASE_ERROR', { status: 500, requestId, message: error.message });

  const userIds = (members ?? []).map((m) => m.user_id);
  const profilesById = new Map<string, { fullName: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.client
      .from('profiles')
      .select('id,full_name,email')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      profilesById.set(p.id, { fullName: p.full_name ?? null, email: p.email ?? null });
    }
  }

  return createApiSuccess(
    {
      members: (members ?? []).map((m) => {
        const profile = profilesById.get(m.user_id);
        return {
          userId: m.user_id,
          role: m.role,
          department: m.department ?? null,
          permissions: m.permissions ?? {},
          fullName: profile?.fullName ?? null,
          email: profile?.email ?? null,
          joinedAt: m.created_at,
        };
      }),
    },
    { requestId }
  );
}));
