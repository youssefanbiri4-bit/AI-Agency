import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { Agent, Department, Task } from '@/types';
import type { Database, TaskEventRecord } from '@/types/database';
import { getAgentStats, getTaskStats } from '@/lib/stats';
import { listAgentCatalog } from './agents';
import { listTasks } from './tasks';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

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

  if (!isSupabaseConfigured) {
    return emptyDataResult(emptyDashboard, false);
  }

  const [catalogResult, tasksResult] = await Promise.all([
    listAgentCatalog(client),
    listTasks({ workspaceId }, client),
  ]);

  if (catalogResult.error) {
    return errorDataResult(emptyDashboard, catalogResult.error);
  }

  if (tasksResult.error) {
    return errorDataResult(emptyDashboard, tasksResult.error);
  }

  let eventsQuery = client
    .from('task_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (workspaceId) {
    eventsQuery = eventsQuery.eq('workspace_id', workspaceId);
  }

  const { data: events, error: eventsError } = await eventsQuery;

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
