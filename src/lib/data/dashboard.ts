import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { Agent, Department, Task } from '@/types';
import type { Database, TaskEventRecord } from '@/types/database';
import { getAgentStats, getTaskStats } from '@/lib/stats';
import { listAgentCatalog } from './agents';
import { listTasks } from './tasks';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

const DASHBOARD_DATA_TRACE_PREFIX = '[dashboard-data]';

export interface DashboardData {
  agents: Agent[];
  departments: Department[];
  tasks: Task[];
  events: TaskEventRecord[];
  agentStats: ReturnType<typeof getAgentStats>;
  taskStats: ReturnType<typeof getTaskStats>;
}

function buildDashboardData(
  agents: Agent[] = [],
  departments: Department[] = [],
  tasks: Task[] = [],
  events: TaskEventRecord[] = []
): DashboardData {
  return {
    agents,
    departments,
    tasks,
    events,
    agentStats: getAgentStats(agents),
    taskStats: getTaskStats(tasks),
  };
}

export async function getDashboardData(
  workspaceId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<DashboardData>> {
  const emptyDashboard = buildDashboardData();
  console.info(DASHBOARD_DATA_TRACE_PREFIX, 'start', { workspaceId: workspaceId ?? null });

  if (!isSupabaseConfigured) {
    console.warn(DASHBOARD_DATA_TRACE_PREFIX, 'Supabase is not configured');
    return emptyDataResult(emptyDashboard, false);
  }

  console.info(DASHBOARD_DATA_TRACE_PREFIX, 'before catalog/tasks batch', {
    workspaceId: workspaceId ?? null,
  });
  const [catalogResult, tasksResult] = await Promise.all([
    listAgentCatalog(client),
    listTasks({ workspaceId, limit: 40 }, client),
  ]);
  console.info(DASHBOARD_DATA_TRACE_PREFIX, 'after catalog/tasks batch', {
    catalogError: catalogResult.error,
    tasksError: tasksResult.error,
    taskCount: tasksResult.data.length,
  });

  if (catalogResult.error) {
    return errorDataResult(emptyDashboard, catalogResult.error);
  }

  if (tasksResult.error) {
    return errorDataResult(emptyDashboard, tasksResult.error);
  }

  let eventsQuery = client
    .from('task_events')
    .select('id, workspace_id, task_id, actor_id, event_type, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (workspaceId) {
    eventsQuery = eventsQuery.eq('workspace_id', workspaceId);
  }

  console.info(DASHBOARD_DATA_TRACE_PREFIX, 'before task events query', {
    workspaceId: workspaceId ?? null,
  });
  const { data: events, error: eventsError } = await eventsQuery;
  console.info(DASHBOARD_DATA_TRACE_PREFIX, 'after task events query', {
    workspaceId: workspaceId ?? null,
    eventCount: events?.length ?? 0,
    error: eventsError?.message ?? null,
  });

  if (eventsError) {
    return errorDataResult(emptyDashboard, eventsError.message);
  }

  return emptyDataResult(
    buildDashboardData(
      catalogResult.data.agents,
      catalogResult.data.departments,
      tasksResult.data,
      events ?? []
    ),
    true
  );
}
