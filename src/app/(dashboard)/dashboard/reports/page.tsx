import Link from 'next/link';
import { BarChart3, Database, FileText, Users, Workflow } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTasks } from '@/lib/data/tasks';
import { buildReportSummary, getReportSummary } from '@/lib/data/reports';
import { getDepartmentMetrics } from '@/lib/stats';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDepartmentBrandColor } from '@/lib/brand';
import { getN8nReadiness } from '@/lib/n8n';

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  const [catalogResult, tasksResult, reportResult] = await Promise.all([
    listAgentCatalog(supabase),
    workspaceId
      ? listTasks({ workspaceId }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    workspaceId
      ? getReportSummary(workspaceId, supabase)
      : Promise.resolve({ data: buildReportSummary([]), error: null, isConfigured: true }),
  ]);

  const departments = getDepartmentMetrics(
    catalogResult.data.departments,
    catalogResult.data.agents,
    tasksResult.data
  );
  const taskStats = reportResult.data.taskStats;
  const n8nReadiness = getN8nReadiness();

  return (
    <div className="space-y-8">
      {(workspaceResult.error || catalogResult.error || tasksResult.error || reportResult.error) && (
        <Notice tone="warning" title="Report data notice">
          {workspaceResult.error ?? catalogResult.error ?? tasksResult.error ?? reportResult.error}
        </Notice>
      )}

      <PageHeader
        eyebrow="Performance"
        title="Reports"
        description="Reporting remains empty until real task, review, and workflow data is connected."
        actions={
          <Link href="/dashboard/tasks" className={buttonStyles({ size: 'lg' })}>
            <FileText className="h-5 w-5" />
            View Tasks
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Agent Catalog"
          value={catalogResult.data.agents.length}
          icon={BarChart3}
          tone="brand"
          subtitle={`Across ${catalogResult.data.departments.length} departments`}
        />
        <StatCard
          title="Departments"
          value={catalogResult.data.departments.length}
          icon={Users}
          tone="brand"
          subtitle="Configured in Supabase"
        />
        <StatCard
          title="Task Reporting"
          value={taskStats.total}
          icon={Database}
          tone="neutral"
          subtitle={taskStats.total === 0 ? 'Create tasks to populate' : 'Real workspace tasks'}
        />
        <StatCard
          title="Review Records"
          value={reportResult.data.reviewCount}
          icon={FileText}
          tone="neutral"
          subtitle={reportResult.data.reviewCount === 0 ? 'Review completed tasks' : 'Stored in Supabase'}
        />
        <StatCard
          title="Workflow Reporting"
          value={n8nReadiness.canExecute ? 'Connected' : 'Guarded'}
          icon={Workflow}
          tone="accent"
          subtitle="Execution events only"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader
            title="Department Reporting Readiness"
            description="Department counts are generated only from real workspace task records."
          />

          <div className="space-y-4">
            {departments.map((department) => (
              <div key={department.id} className="muted-panel p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: getDepartmentBrandColor(department.name) }}
                    />
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-black">{department.name}</h3>
                      <p className="text-sm text-black/52">
                        {department.agentsCount} configured agents
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-black">{department.taskRecords} tasks</p>
                    <p className="text-xs font-medium text-black/52">
                      {department.activeTasks} pending or processing
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Integration Status"
            description="Backend services are prepared for real task execution and callback reporting."
          />

          <div className="space-y-4">
            <div className="muted-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-black/70">Supabase</span>
                <StatusBadge status="Ready" type="system" size="sm" />
              </div>
              <p className="mt-2 text-sm leading-6 text-black/52">
                Database persistence is configured for authenticated workspace data.
              </p>
            </div>

            <div className="muted-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-black/70">n8n</span>
                <StatusBadge status={n8nReadiness.statusLabel} type="system" size="sm" />
              </div>
              <p className="mt-2 text-sm leading-6 text-black/52">
                Run Task remains disabled until server-side n8n execution is fully configured.
              </p>
            </div>

            <div className="muted-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-black/70">Task Events</span>
                <StatusBadge status={reportResult.data.eventCount === 0 ? 'Awaiting Data' : 'Ready'} type="system" size="sm" />
              </div>
              <p className="mt-2 text-sm leading-6 text-black/52">
                Activity reporting uses only task events created in Supabase. Stored events: {reportResult.data.eventCount}.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Workload Snapshot"
          description="Status distribution is generated only from stored task records."
        />
        {tasksResult.data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Reports are waiting for activity"
            description="Create tasks and reviews to populate reporting."
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
    </div>
  );
}
