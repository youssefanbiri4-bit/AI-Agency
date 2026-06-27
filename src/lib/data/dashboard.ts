import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { Agent, Department, Task } from '@/types';
import type { Database, TaskEventRecord } from '@/types/database';
import { getAgentStats, getTaskStats } from '@/lib/stats';
import { listAgentCatalog } from './agents';
import { listTasks } from './tasks';
import { emptyDataResult, errorDataResult, type DataResult } from './types';
import { logger } from '@/lib/logger';

const dashboardLog = logger.child('data:dashboard');

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
  dashboardLog.info('start', { workspaceId: workspaceId ?? null });

  if (!isSupabaseConfigured) {
    dashboardLog.warn('Supabase is not configured');
    return emptyDataResult(emptyDashboard, false);
  }

  dashboardLog.info('before catalog/tasks batch', {
    workspaceId: workspaceId ?? null,
  });
  const [catalogResult, tasksResult] = await Promise.allSettled([
    listAgentCatalog(client),
    listTasks({ workspaceId, limit: 40 }, client),
  ]);
  dashboardLog.info('after catalog/tasks batch', {
    catalogStatus: catalogResult.status,
    tasksStatus: tasksResult.status,
    catalogError: catalogResult.status === 'rejected' ? (catalogResult.reason as Error).message : null,
    tasksError: tasksResult.status === 'rejected' ? (tasksResult.reason as Error).message : null,
    agentCount: catalogResult.status === 'fulfilled' ? catalogResult.value.data.agents.length : 0,
  });

  // Handle errors from Promise.allSettled
  if (catalogResult.status === 'rejected') {
    const errorMsg = (catalogResult.reason as Error).message || 'Failed to load agent catalog';
    return errorDataResult(emptyDashboard, errorMsg);
  }
  
  if (catalogResult.status === 'fulfilled' && catalogResult.value.error) {
    return errorDataResult(emptyDashboard, catalogResult.value.error);
  }

  if (tasksResult.status === 'rejected') {
    const errorMsg = (tasksResult.reason as Error).message || 'Failed to load tasks';
    return errorDataResult(emptyDashboard, errorMsg);
  }
  
  if (tasksResult.status === 'fulfilled' && tasksResult.value.error) {
    return errorDataResult(emptyDashboard, tasksResult.value.error);
  }
    
  // Assuming catalogResult and tasksResult are fulfilled and have data

  let eventsQuery = client
    .from('task_events')
    .select('id, workspace_id, task_id, actor_id, event_type, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (workspaceId) {
    eventsQuery = eventsQuery.eq('workspace_id', workspaceId);
  }

  dashboardLog.info('before task events query', {
    workspaceId: workspaceId ?? null,
  });
  const { data: events, error: eventsError } = await eventsQuery;
  dashboardLog.info('after task events query', {
    workspaceId: workspaceId ?? null,
    eventCount: events?.length ?? 0,
    error: eventsError?.message ?? null,
  });

  if (eventsError) {
    return errorDataResult(emptyDashboard, eventsError.message);
  }

  return emptyDataResult(
    buildDashboardData(
      catalogResult.value.data.agents,
      catalogResult.value.data.departments,
      tasksResult.value.data,
      events ?? []
    ),
    true
  );
}
