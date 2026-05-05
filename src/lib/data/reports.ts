import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { Task } from '@/types';
import type { Database } from '@/types/database';
import { getTaskStats } from '@/lib/stats';
import { listTasks } from './tasks';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface ReportSummary {
  taskStats: ReturnType<typeof getTaskStats>;
  reviewCount: number;
  eventCount: number;
}

export function buildReportSummary(tasks: Task[], reviewCount = 0, eventCount = 0): ReportSummary {
  return {
    taskStats: getTaskStats(tasks),
    reviewCount,
    eventCount,
  };
}

export async function getReportSummary(
  workspaceId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReportSummary>> {
  const emptySummary = buildReportSummary([]);

  if (!isSupabaseConfigured) {
    return emptyDataResult(emptySummary, false);
  }

  const tasksResult = await listTasks({ workspaceId }, client);

  if (tasksResult.error) {
    return errorDataResult(emptySummary, tasksResult.error);
  }

  let reviewQuery = client.from('task_reviews').select('id', { count: 'exact', head: true });
  let eventQuery = client.from('task_events').select('id', { count: 'exact', head: true });

  if (workspaceId) {
    reviewQuery = reviewQuery.eq('workspace_id', workspaceId);
    eventQuery = eventQuery.eq('workspace_id', workspaceId);
  }

  const [reviewResult, eventResult] = await Promise.all([reviewQuery, eventQuery]);

  if (reviewResult.error) {
    return errorDataResult(emptySummary, reviewResult.error.message);
  }

  if (eventResult.error) {
    return errorDataResult(emptySummary, eventResult.error.message);
  }

  return emptyDataResult(
    buildReportSummary(tasksResult.data, reviewResult.count ?? 0, eventResult.count ?? 0),
    true
  );
}
