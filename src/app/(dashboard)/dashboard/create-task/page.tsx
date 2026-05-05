import Link from 'next/link';
import { ArrowLeft, Database } from 'lucide-react';
import { CreateTaskForm } from './CreateTaskForm';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgents } from '@/lib/data/agents';
import type { AgentType } from '@/types';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreateTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const agentsResult = await listAgents(supabase);
  const initialAgent = getStringParam(params.agent);
  const initialExample = getStringParam(params.example) ?? '';
  const initialAgentId = agentsResult.data.some((agent) => agent.id === initialAgent)
    ? (initialAgent as AgentType)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Task builder"
        title="Create New Task"
        description="Create a real pending task inside the active Supabase workspace, then run it from the task details page."
        actions={
          <Link href="/dashboard/tasks" className={buttonStyles({ variant: 'outline' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Link>
        }
      />

      {agentsResult.error && (
        <Notice tone="danger" title="Agent catalog unavailable">
          {agentsResult.error}
        </Notice>
      )}

      {!agentsResult.error && agentsResult.data.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No agents available"
          description="Seed the agent catalog, then return to create a task."
        />
      ) : (
        <CreateTaskForm
          agents={agentsResult.data}
          initialAgentId={initialAgentId}
          initialTitle={initialExample}
          initialDescription={initialExample}
        />
      )}
    </div>
  );
}
