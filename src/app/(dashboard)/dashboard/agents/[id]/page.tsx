import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Play,
  Settings,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getAgentById, listAgents } from '@/lib/data/agents';
import { listTasks } from '@/features/tasks/data/tasks';
import { getTaskStats } from '@/lib/stats';
import type { AgentType } from '@/types';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TaskTable } from '@/components/ui/TaskTable';
import { getN8nReadiness } from '@/lib/n8n';
import { getAgentDisplayMetadata } from '@/lib/agents/agent-display';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agentId = id as AgentType;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const [agentResult, agentsResult, tasksResult] = await Promise.all([
    getAgentById(agentId, supabase),
    listAgents(supabase),
    listTasks({ workspaceId, agentType: agentId }, supabase),
  ]);
  const agent = agentResult.data;
  const relatedTasks = tasksResult.data;
  const taskStats = getTaskStats(relatedTasks);
  const resultCount = relatedTasks.filter((task) => task.result).length;
  const n8nReadiness = await getN8nReadiness();

  if (!agent) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Agent not found"
        description="The requested agent is not part of the active Supabase catalog."
        action={
          <Link href="/dashboard/agents" className={buttonStyles({ variant: 'primary' })}>
            Back to Agents
          </Link>
        }
      />
    );
  }

  const display = getAgentDisplayMetadata(agent);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={agent.department}
        title={agent.name}
        description={display.whenToUse}
        actions={
          <Link href="/dashboard/agents" className={buttonStyles({ variant: 'outline' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Link>
        }
      />

      {(workspaceResult.error || agentResult.error || tasksResult.error) && (
        <Notice tone="warning" title="Agent data notice">
          {workspaceResult.error ?? agentResult.error ?? tasksResult.error}
        </Notice>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-black/8 premium-surface p-5 sm:p-7">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
              <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={agent.status} type="agent" />
                  <span className="max-w-full rounded-full border border-white bg-white/80 px-2.5 py-1 text-xs font-bold leading-5 text-black/62">
                    {agent.role}
                  </span>
                </div>
                <h2 className="mt-4 break-words text-2xl font-black text-black sm:text-3xl">{agent.name}</h2>
                <p className="mt-1 text-sm font-black text-[#F7CBCA]">{display.alias}</p>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-black/72">{display.role}</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-black/62">{display.whenToUse}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={`/dashboard/create-task?agent=${agent.id}`} className={buttonStyles()}>
                <Play className="h-4 w-4" />
                Create Task
              </Link>
              <Link
                href="/dashboard/settings"
                aria-label={`Open settings for ${agent.name}`}
                className={buttonStyles({ variant: 'secondary', size: 'icon' })}
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-7">
          <StatCard
            title="Task History"
            value={taskStats.total}
            icon={FileText}
            tone="neutral"
            subtitle={taskStats.total === 0 ? 'Create a task to begin' : 'Real assigned tasks'}
          />
          <StatCard
            title="Pending"
            value={taskStats.pending}
            icon={Database}
            tone="accent"
            subtitle="Saved in Supabase"
          />
          <StatCard
            title="Stored Results"
            value={resultCount}
            icon={Workflow}
            tone="brand"
            subtitle="Real callback results"
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="When to Use" description="The moment this agent is most helpful." />
          <p className="text-sm leading-6 text-black/64">{display.whenToUse}</p>
        </Card>
        <Card>
          <CardHeader title="Expected Output" description="What the manager should expect back." />
          <p className="text-sm leading-6 text-black/64">{display.expectedOutput}</p>
        </Card>
        <Card>
          <CardHeader title="Task Writing Tip" description="What to include in the brief." />
          <p className="text-sm leading-6 text-black/64">{display.taskTip}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Capabilities"
            description="Core responsibilities this agent is configured to support."
          />
          <ul className="space-y-3">
            {agent.capabilities.map((capability) => (
              <li key={capability} className="muted-panel flex items-start gap-3 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F7CBCA]" />
                <span className="text-sm leading-6 text-black/68">{capability}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Best Use Cases"
            description="Practical ways this agent can help the agency."
          />
          <ul className="space-y-3">
            {display.bestUseCases.map((useCase) => (
              <li key={useCase} className="muted-panel flex items-start gap-3 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F7CBCA]" />
                <span className="text-sm leading-6 text-black/68">{useCase}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Recommended Task Starters"
            description="Use these as structured starting points for real workspace tasks."
          />
          <div className="space-y-3">
            {agent.exampleTasks.map((task) => (
              <Link
                key={task}
                href={`/dashboard/create-task?agent=${agent.id}&example=${encodeURIComponent(task)}`}
                className="group flex items-center justify-between gap-3 rounded-lg border border-black/8 bg-white p-4 shadow-sm hover:border-[#F7CBCA]/24 hover:bg-[#D5E5E5]/45"
              >
                <span className="min-w-0 break-words text-sm font-bold text-black/68 group-hover:text-[#F7CBCA]">{task}</span>
                <Play className="h-4 w-4 shrink-0 text-black/34 group-hover:text-[#F7CBCA]" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Notice tone="info" title="Automation readiness">
        Tasks for this agent are saved to Supabase. Run Task is disabled until n8n is fully connected on the server.
        {' '}
        Current n8n status: {n8nReadiness.statusLabel}.
      </Notice>

      <section>
        <CardHeader
          title="Recent Tasks"
          description="Real task records assigned to this agent in the active workspace."
          action={
            <Link href="/dashboard/tasks" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              View All Tasks
            </Link>
          }
        />
        <TaskTable
          tasks={relatedTasks}
          agents={agentsResult.data}
          emptyAction={
            <Link
              href={`/dashboard/create-task?agent=${agent.id}`}
              className={buttonStyles({ variant: 'primary' })}
            >
              Create First Task
            </Link>
          }
        />
      </section>

      <Card>
        <CardHeader title="Activity Log" description="Execution logs will remain empty until real automation is connected." />
        <EmptyState
          icon={ShieldCheck}
          title="No execution activity"
          description="Run a connected task to add execution events."
        />
      </Card>
    </div>
  );
}
