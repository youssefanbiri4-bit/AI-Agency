import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Plus,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getDashboardData } from '@/lib/data/dashboard';
import { getDepartmentMetrics } from '@/lib/stats';
import { AgentCard } from '@/components/ui/AgentCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { DepartmentCard } from '@/components/ui/DepartmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TaskTable } from '@/components/ui/TaskTable';
import { buttonStyles } from '@/components/ui/Button';
import { getN8nReadiness } from '@/lib/n8n';
import { formatTimeAgo } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const dashboardResult = await getDashboardData(workspaceResult.data?.id, supabase);
  const { agents, departments, tasks, events, agentStats, taskStats } = dashboardResult.data;
  const departmentMetrics = getDepartmentMetrics(departments, agents, tasks);
  const featuredAgents = agents.slice(0, 4);
  const recentTasks = tasks.slice(0, 4);
  const n8nReadiness = getN8nReadiness();

  return (
    <div className="space-y-8">
      {(workspaceResult.error || dashboardResult.error) && (
        <Notice tone="warning" title="Dashboard data notice">
          {workspaceResult.error ?? dashboardResult.error}
        </Notice>
      )}

      <section className="section-fade rounded-lg border border-black/8 premium-surface p-4 shadow-[0_18px_50px_rgba(139,60,222,0.10)] sm:p-7">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#8B3CDE]/18 bg-white/80 px-3 py-1 text-xs font-black uppercase leading-5 tracking-[0.16em] text-[#8B3CDE]">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="truncate">AgentFlow AI Command Center</span>
            </div>
            <h1 className="max-w-4xl break-words text-3xl font-black tracking-normal text-black sm:text-4xl">
              Run specialized AI teams from one polished operations dashboard.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-black/62 sm:text-base">
              Manage the configured agent catalog, create real workspace tasks, and keep n8n workflow execution clearly marked as a future connection.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg', className: 'w-full sm:w-auto' })}>
                <Plus className="h-5 w-5" />
                Create Task
              </Link>
              <Link href="/dashboard/agents" className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full sm:w-auto' })}>
                View Agents
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="min-w-0 rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm">
              <p className="text-sm font-semibold text-black/52">Agent catalog</p>
              <p className="mt-1 text-3xl font-black text-black">{agentStats.total}</p>
              <p className="mt-1 text-xs font-bold text-[#8B3CDE]">Across {departments.length} departments</p>
            </div>
            <div className="min-w-0 rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm">
              <p className="text-sm font-semibold text-black/52">Workspace tasks</p>
              <p className="mt-1 text-3xl font-black text-black">{taskStats.total}</p>
              <p className="mt-1 text-xs font-bold text-[#F55477]">
                {taskStats.total === 0 ? 'Ready for first task' : 'Stored in Supabase'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm">
              <p className="text-sm font-semibold text-black/52">Automation</p>
              <p className="mt-1 break-words text-3xl font-black text-black">
                {n8nReadiness.canExecute ? 'Connected' : 'Guarded'}
              </p>
              <p className="mt-1 text-xs font-bold text-[#8B3CDE]">n8n webhook route</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Tasks" value={taskStats.total} icon={FileText} tone="neutral" subtitle={taskStats.total === 0 ? 'Create a task to begin' : 'Real workspace tasks'} />
        <StatCard title="Pending" value={taskStats.pending} icon={Clock} tone="accent" />
        <StatCard title="Processing" value={taskStats.processing} icon={Zap} tone="brand" />
        <StatCard title="Needs Review" value={taskStats.needsReview} icon={AlertCircle} tone="accent" />
        <StatCard title="Completed" value={taskStats.completed} icon={CheckCircle2} tone="dark" />
        <StatCard title="Failed" value={taskStats.failed} icon={AlertCircle} tone="accent" />
      </div>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-black">Department Overview</h2>
            <p className="mt-1 text-sm text-black/52">Real task counts are scoped to the active workspace.</p>
          </div>
          <Link href="/dashboard/agents" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
            View all agents
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {departmentMetrics.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
              agentsCount={department.agentsCount}
              taskRecords={department.taskRecords}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-black">Configured Agents</h2>
            <p className="mt-1 text-sm text-black/52">Agents are loaded from the Supabase catalog.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {featuredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} compact />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section>
          <CardHeader
            title="Recent Tasks"
            description="Latest real tasks created in this workspace."
            action={
              <Link href="/dashboard/tasks" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                View Tasks
              </Link>
            }
          />
          <TaskTable tasks={recentTasks} agents={agents} />
        </section>

        <Card>
          <CardHeader title="Recent Activity" description="Only real task events are shown here." />
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="muted-panel p-4">
                  <p className="text-sm font-semibold text-black">{event.message}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-black/38">
                    {event.event_type} / {formatTimeAgo(event.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Database}
              title="No activity recorded"
              description="Create or run a task to add activity events."
            />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Task Status Distribution"
          description="Counts are computed only from real Supabase task records."
          action={
            <Link href="/dashboard/create-task" className={buttonStyles({ size: 'sm' })}>
              <Plus className="h-4 w-4" />
              New Task
            </Link>
          }
        />
        {tasks.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No status distribution"
            description="Create a task to populate this chart."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Pending', taskStats.pending],
              ['Processing', taskStats.processing],
              ['Needs Review', taskStats.needsReview],
              ['Completed', taskStats.completed],
              ['Failed', taskStats.failed],
            ].map(([label, value]) => (
              <div key={label} className="muted-panel p-4">
                <p className="text-sm font-semibold text-black/62">{label}</p>
                <p className="mt-2 text-2xl font-bold text-black">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="border-[#8B3CDE]/16 bg-[#F0DBEF]/48">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#8B3CDE] shadow-sm">
              <Workflow className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-black">Integration readiness</h2>
              <p className="mt-1 text-sm leading-6 text-black/62">
                Supabase task storage is live. Run Task stays disabled until the n8n webhook and callback secret are configured server-side.
              </p>
            </div>
          </div>
          <StatusBadge status={n8nReadiness.statusLabel} type="system" size="sm" />
          <Link href="/dashboard/settings" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            Review Settings
          </Link>
        </div>
      </Card>
    </div>
  );
}
