import { TasksClient } from './TasksClient';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/lib/data/tasks';
import { Notice } from '@/components/ui/Notice';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialSearch = firstParam(params?.q) ?? '';
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  const [catalogResult, tasksResult] = await Promise.all([
    listAgentCatalog(supabase),
    listTasks({ workspaceId, limit: 100 }, supabase),
  ]);

  return (
    <div className="space-y-6">
      {(workspaceResult.error || catalogResult.error || tasksResult.error) && (
        <Notice tone="danger" title="Workspace data unavailable">
          {workspaceResult.error ?? catalogResult.error ?? tasksResult.error}
        </Notice>
      )}

      <TasksClient
        tasks={tasksResult.data}
        agents={catalogResult.data.agents}
        departments={catalogResult.data.departments}
        initialSearch={initialSearch}
      />
    </div>
  );
}
