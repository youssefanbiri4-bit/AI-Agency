import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface DailyUsageRow {
  date: string;
  ai_generations: number;
  tasks: number;
  creative_assets: number;
  content_items: number;
  content_publishes: number;
  reels_publishes: number;
}

const QUOTA_TYPES: (keyof DailyUsageRow & string)[] = [
  'ai_generations',
  'tasks',
  'creative_assets',
  'content_items',
  'content_publishes',
  'reels_publishes',
];

export async function getUsageHistory(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  days: number = 7
): Promise<DailyUsageRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('usage_events')
    .select('quota_type, amount, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  const dailyMap = new Map<string, Partial<Record<string, number>>>();

  for (const event of data) {
    const date = event.created_at.split('T')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {});
    }
    const row = dailyMap.get(date)!;
    const qt = event.quota_type;
    row[qt] = (row[qt] ?? 0) + (event.amount ?? 1);
  }

  const sortedDates = Array.from(dailyMap.keys()).sort().reverse();

  return sortedDates.map((date) => {
    const raw = dailyMap.get(date)!;
    const row: Record<string, number | string> = { date, ai_generations: 0, tasks: 0, creative_assets: 0, content_items: 0, content_publishes: 0, reels_publishes: 0 };
    for (const qt of QUOTA_TYPES) {
      row[qt] = raw[qt] ?? 0;
    }
    return row as unknown as DailyUsageRow;
  });
}
