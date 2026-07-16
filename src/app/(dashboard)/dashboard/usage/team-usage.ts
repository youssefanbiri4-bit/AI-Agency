import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface TeamMemberUsage {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
}

export interface TeamUsageData {
  members: TeamMemberUsage[];
  perUserEvents: Record<string, Partial<Record<string, number>>>;
  hasPerUserData: boolean;
}

export async function getTeamUsageData(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<TeamUsageData> {
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);

  if (!members || members.length === 0) {
    return { members: [], perUserEvents: {}, hasPerUserData: false };
  }

  const userIds = members.map((m) => m.user_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const memberList: TeamMemberUsage[] = members.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      userId: m.user_id,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: m.role,
    };
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from('usage_events')
    .select('user_id, quota_type, amount')
    .eq('workspace_id', workspaceId)
    .not('user_id', 'is', null)
    .gte('created_at', monthStart.toISOString());

  const perUserEvents: Record<string, Partial<Record<string, number>>> = {};
  const hasPerUserData = (events ?? []).length > 0;

  for (const event of events ?? []) {
    if (!event.user_id) continue;
    if (!perUserEvents[event.user_id]) {
      perUserEvents[event.user_id] = {};
    }
    const current = perUserEvents[event.user_id][event.quota_type] ?? 0;
    perUserEvents[event.user_id][event.quota_type] = current + (event.amount ?? 1);
  }

  return { members: memberList, perUserEvents, hasPerUserData };
}
