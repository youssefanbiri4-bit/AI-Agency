import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface LimitChangeEvent {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  eventType: 'quota_limits_updated' | 'quota_limits_reset' | 'usage_limits_updated';
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getLimitChangeEvents(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  limit = 20
): Promise<LimitChangeEvent[]> {
  const eventTypes = ['quota_limits_updated', 'quota_limits_reset', 'usage_limits_updated'];

  const { data: events, error } = await supabase
    .from('security_audit_logs')
    .select('id, user_id, event_type, message, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .in('event_type', eventTypes)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !events || events.length === 0) {
    return [];
  }

  const userIds = [...new Set(events.map((e) => e.user_id).filter(Boolean))] as string[];

  const profileMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.id, { name: p.full_name, email: p.email });
    }
  }

  return events.map((e) => {
    const profile = e.user_id ? profileMap.get(e.user_id) : undefined;
    return {
      id: e.id,
      userId: e.user_id,
      userName: profile?.name ?? null,
      userEmail: profile?.email ?? null,
      eventType: e.event_type as LimitChangeEvent['eventType'],
      message: e.message,
      metadata: e.metadata as Record<string, unknown>,
      createdAt: e.created_at,
    };
  });
}

export function formatChangeSummary(metadata: Record<string, unknown>): string {
  const parts: string[] = [];

  const overrides = metadata.overrides as Record<string, unknown> | undefined;
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const label = key.replace(/_/g, ' ');
      parts.push(`${label}: ${value}`);
    }
  }

  for (const key of ['max_ai_generations_per_month', 'max_tasks', 'max_creative_assets', 'max_content_items', 'max_reels_publishes_per_month']) {
    const value = metadata[key];
    if (typeof value === 'number') {
      const label = key.replace(/_/g, ' ');
      parts.push(`${label}: ${value}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '';
}
