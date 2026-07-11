'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/lib/data/tasks';

export async function fetchAgentsPageDataAction(workspaceId: string) {
  const supabase = await createSupabaseServerClient();

  const [catalogResult, tasksResult] = await Promise.all([
    listAgentCatalog(supabase),
    listTasks({ workspaceId }, supabase),
  ]);

  return {
    catalog: catalogResult.data,
    catalogError: catalogResult.error,
    tasks: tasksResult.data,
    tasksError: tasksResult.error,
  };
}