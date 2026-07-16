import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, FileText, Workflow } from 'lucide-react';
import { ReviewForm } from './ReviewForm';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { listAgentCatalog } from '@/lib/data/agents';
import { listTaskReviews } from '@/lib/data/reviews';
import { getTaskById, listTasks } from '@/features/tasks/data/tasks';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { ReviewHistory } from '@/components/reviews/ReviewHistory';
import { TaskResultOutput } from '@/components/tasks/TaskResultOutput';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';

interface ReviewPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const taskId = firstParam(params?.taskId);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;

  const [catalogResult, reviewQueueResult, taskResult, reviewsResult] = await Promise.all([
    listAgentCatalog(supabase),
    workspaceId
      ? listTasks({ workspaceId, status: 'needs_review', limit: 500 }, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
    taskId && workspaceId
      ? getTaskById(taskId, workspaceId, supabase)
      : Promise.resolve({ data: null, error: null, isConfigured: true }),
    taskId && workspaceId
      ? listTaskReviews(taskId, workspaceId, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
  ]);

  const selectedTask = taskResult.data;
  const selectedAgent = selectedTask
    ? catalogResult.data.agents.find((agent) => agent.id === selectedTask.agent_type)
    : null;

  if (taskId) {
    if (!selectedTask) {
      return (
        <EmptyState
          icon={FileText}
          title="Task not found"
          description="The selected task is not available in the active workspace."
          action={
            <Link href="/dashboard/review" className={buttonStyles()}>
              Back to Reviews
            </Link>
          }
        />
      );
    }

    return (
      <div className="space-y-8">
        {(workspaceResult.error || catalogResult.error || taskResult.error || reviewsResult.error) && (
          <Notice tone="warning" title="Review data notice">
            {workspaceResult.error ?? catalogResult.error ?? taskResult.error ?? reviewsResult.error}
          </Notice>
        )}

        <PageHeader
          eyebrow="Quality review"
          title="Review Task"
          description="Review a real task from the active Supabase workspace."
          actions={
            <Link href="/dashboard/review" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Back to Reviews
            </Link>
          }
        />

        {selectedTask.status !== 'needs_review' && (
          <Notice tone="info" title="Task is not waiting for review">
            This task is currently {selectedTask.status}. Review actions are only available for tasks marked needs_review.
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div className="space-y-8">
            <Card>
              <CardHeader title="Task Context" description="Real task details from the active Supabase workspace." />
              <div className="flex min-w-0 items-start gap-3">
                {selectedAgent && <AgentAvatar icon={selectedAgent.icon} color={selectedAgent.color} department={selectedAgent.department} />}
                <div className="min-w-0">
                  <StatusBadge status={selectedTask.status} type="task" size="sm" />
                  <h2 className="mt-3 break-words text-xl font-bold text-black">{selectedTask.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-black/62">{selectedTask.description}</p>
                  <p className="mt-3 text-sm text-black/52">
                    {selectedAgent?.name || selectedTask.agent_type} / {formatDateTime(selectedTask.created_at)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Priority</p>
                  <p className="mt-1 text-sm font-semibold text-black">{selectedTask.priority}</p>
                </div>
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Updated</p>
                  <p className="mt-1 text-sm font-semibold text-black">{formatDateTime(selectedTask.updated_at)}</p>
                </div>
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Workflow</p>
                  <p className="mt-1 text-sm font-semibold text-black">Server callback</p>
                </div>
              </div>
            </Card>

            <TaskResultOutput
              title="Stored Result"
              description="Only real result data from Supabase is shown."
              result={selectedTask.result}
              reportContext={{
                taskTitle: selectedTask.title,
                agentName: selectedAgent?.name,
                department: selectedAgent?.department,
              }}
              emptyState={{
                icon: Workflow,
                title: 'No result yet',
                description: 'Run the task to store a result before review.',
              }}
            />

            <Card>
              <CardHeader title="Review History" description="Saved ratings and feedback for this task." />
              <ReviewHistory reviews={reviewsResult.data} currentUserId={user?.id} />
            </Card>
          </div>

          <Card className="h-fit xl:sticky xl:top-28">
            <CardHeader
              title="Review Decision"
              description={
                selectedTask.status === 'needs_review'
                  ? 'Approve this task or request changes with feedback.'
                  : 'Review actions are unavailable for the current task status.'
              }
            />
            {selectedTask.status === 'needs_review' ? (
              <ReviewForm taskId={selectedTask.id} />
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="No review action available"
                description="Only tasks with needs_review status can be approved or sent back."
              />
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(workspaceResult.error || catalogResult.error || reviewQueueResult.error) && (
        <Notice tone="warning" title="Review data notice">
          {workspaceResult.error ?? catalogResult.error ?? reviewQueueResult.error}
        </Notice>
      )}

      <PageHeader
        eyebrow="Quality review"
        title="Reviews"
        description="Review real tasks marked needs_review in the active workspace."
      />

      {reviewQueueResult.data.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No tasks waiting for review"
          description="Open Tasks to find work that needs follow-up."
          action={
            <Link href="/dashboard/tasks" className={buttonStyles()}>
              View Tasks
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {reviewQueueResult.data.map((task) => {
            const agent = catalogResult.data.agents.find((candidate) => candidate.id === task.agent_type);

            return (
              <Card key={task.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    {agent && <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} />}
                    <div className="min-w-0">
                      <StatusBadge status={task.status} type="task" size="sm" />
                      <h2 className="mt-3 break-words font-semibold text-black">{task.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-black/52">{task.description}</p>
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                        <p className="text-black/52">
                          Priority: <span className="font-semibold text-black/72">{task.priority}</span>
                        </p>
                        <p className="text-black/52">
                          Updated: <span className="font-semibold text-black/72">{formatDateTime(task.updated_at)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-black/52">
                    {agent?.name || task.agent_type} / Created {formatDateTime(task.created_at)}
                  </p>
                  <Link href={`/dashboard/review?taskId=${task.id}`} className={buttonStyles({ size: 'sm' })}>
                    Review Task
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
