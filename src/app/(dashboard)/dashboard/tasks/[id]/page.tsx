import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ClipboardCheck, CopyPlus, ExternalLink, FileText, GitBranch, Workflow, Zap } from 'lucide-react';
import { RunTaskButton } from './RunTaskButton';
import { TaskProcessingPoller } from './TaskProcessingPoller';
import { ReviewForm } from '../../review/ReviewForm';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getTaskById } from '@/lib/data/tasks';
import { listAgents } from '@/lib/data/agents';
import { listTaskReviews } from '@/lib/data/reviews';
import { ReviewHistory } from '@/components/reviews/ReviewHistory';
import { TaskResultOutput } from '@/components/tasks/TaskResultOutput';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getN8nReadiness } from '@/lib/n8n';
import { formatDateTime } from '@/lib/utils';

export default async function TaskDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: taskId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const workspaceId = workspaceResult.data?.id;
  const [taskResult, agentsResult, reviewsResult] = await Promise.all([
    getTaskById(taskId, workspaceId, supabase),
    listAgents(supabase),
    workspaceId
      ? listTaskReviews(taskId, workspaceId, supabase)
      : Promise.resolve({ data: [], error: null, isConfigured: true }),
  ]);
  const task = taskResult.data;

  if (!task) {
    return (
      <EmptyState
        icon={Zap}
        title="Task not found"
        description="This task record is not available in the active workspace."
        action={
          <Link href="/dashboard/tasks" className={buttonStyles()}>
            Back to Tasks
          </Link>
        }
      />
    );
  }

  const agent = agentsResult.data.find((item) => item.id === task.agent_type);
  const inputEntries = Object.entries(task.input_data || {});
  const n8nReadiness = await getN8nReadiness();
  const githubInput =
    task.input_data?.source === 'github_issue' &&
    task.input_data.github &&
    typeof task.input_data.github === 'object' &&
    !Array.isArray(task.input_data.github)
      ? (task.input_data.github as Record<string, unknown>)
      : null;
  const pullRequestInput =
    task.input_data?.source === 'pull_request_review' &&
    task.input_data.github &&
    typeof task.input_data.github === 'object' &&
    !Array.isArray(task.input_data.github)
      ? (task.input_data.github as Record<string, unknown>)
      : null;
  const taskErrorMessage =
    task.status === 'failed'
      ? typeof task.result?.error_message === 'string'
        ? task.result.error_message
        : 'This task failed during execution. You can retry it from the Execution panel.'
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Task details"
        title={task.title}
        description={task.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/tasks" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link
              href={`/dashboard/create-task?agent=${task.agent_type}`}
              className={buttonStyles({ variant: 'secondary' })}
            >
              <CopyPlus className="h-4 w-4" />
              Create Similar
            </Link>
          </div>
        }
      />

      {(workspaceResult.error || taskResult.error || agentsResult.error || reviewsResult.error) && (
        <Notice tone="warning" title="Workspace notice">
          {workspaceResult.error ?? taskResult.error ?? agentsResult.error ?? reviewsResult.error}
        </Notice>
      )}

      {task.status === 'completed' && (
        <Notice tone="success" title="Task completed">
          This task has been approved and completed
          {task.completed_at ? ` on ${formatDateTime(task.completed_at)}` : ''}.
        </Notice>
      )}

      {task.status === 'failed' && taskErrorMessage && (
        <Notice tone="danger" title="Task failed">
          {taskErrorMessage}
        </Notice>
      )}

      {githubInput ? (
        <Notice tone="info" title={`GitHub issue #${String(githubInput.issue_number ?? '')}`}>
          <span className="inline-flex flex-wrap items-center gap-2">
            This task was imported from a GitHub issue and remains an AgentFlow task only.
            {typeof githubInput.issue_url === 'string' ? (
              <a href={githubInput.issue_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-[#F7CBCA] underline">
                <GitBranch className="h-4 w-4" />
                Open issue
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </span>
        </Notice>
      ) : null}

      {pullRequestInput ? (
        <Notice tone="info" title={`Pull request #${String(pullRequestInput.pr_number ?? '')}`}>
          <span className="inline-flex flex-wrap items-center gap-2">
            This task was created from a read-only PR review and remains an AgentFlow task only.
            {typeof pullRequestInput.pr_url === 'string' ? (
              <a href={pullRequestInput.pr_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-[#F7CBCA] underline">
                <GitBranch className="h-4 w-4" />
                Open PR
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </span>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
        <div className="space-y-8">
          <Card>
            <CardHeader title="Task Summary" description="Core assignment details and current execution status." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="muted-panel min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Assigned Agent</p>
                <div className="mt-3 flex items-center gap-3">
                  {agent && <AgentAvatar icon={agent.icon} color={agent.color} department={agent.department} size="sm" />}
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-black">{agent?.name || task.agent_type}</p>
                    <p className="text-sm text-black/52">{agent?.department || 'Unassigned'}</p>
                  </div>
                </div>
              </div>
              <div className="muted-panel min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Status</p>
                <div className="mt-3">
                  <StatusBadge status={task.status} type="task" />
                </div>
              </div>
              <div className="muted-panel min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Priority</p>
                <p className="mt-3 font-semibold text-black">{task.priority}</p>
              </div>
              <div className="muted-panel min-w-0 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Created</p>
                <p className="mt-3 font-semibold text-black">{formatDateTime(task.created_at)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Task Parameters" description="Structured input stored with this task." />
            {inputEntries.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {inputEntries.map(([key, value]) => (
                  <div key={key} className="muted-panel p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold text-black/72">{String(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No extra input data"
                description="Add structured fields when creating future tasks."
              />
            )}
          </Card>

          <TaskResultOutput
            title="Result"
            description="Real n8n callback output appears here after processing."
            result={task.result}
            errorMessage={taskErrorMessage}
            reportContext={{
              taskTitle: task.title,
              agentName: agent?.name,
              department: agent?.department,
            }}
            emptyState={
              task.status === 'processing'
                ? {
                    icon: Workflow,
                    title: 'Waiting for n8n result',
                    description: 'This task has been sent to n8n and will update after the callback is received.',
                  }
                : {
                    icon: FileText,
                    title: 'No result yet',
                    description: 'Run the task after n8n is connected to store output.',
                  }
            }
          />

          <Card>
            <CardHeader title="Review History" description="Real ratings and feedback saved for this task." />
            <ReviewHistory reviews={reviewsResult.data} currentUserId={user?.id} />
          </Card>
        </div>

        <div className="space-y-8">
          {task.status === 'needs_review' && (
            <Card className="h-fit">
              <CardHeader title="Review Actions" description="Approve this task or request changes with feedback." />
              <ReviewForm taskId={task.id} />
            </Card>
          )}

          {task.status === 'completed' && (
            <Card className="h-fit">
              <CardHeader title="Review State" description="This task has completed the review step." />
              <div className="flex items-center gap-3 rounded-lg border border-black/12 bg-black p-4 text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-black shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Completed</p>
                  <p className="text-sm text-white/68">
                    {task.completed_at ? formatDateTime(task.completed_at) : 'Completion time unavailable'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {task.status !== 'needs_review' && task.status !== 'completed' && (
            <Card className="h-fit">
              <CardHeader title="Review Actions" description="Review actions are unavailable for this status." />
              <EmptyState
                icon={ClipboardCheck}
                title="Not ready for review"
                description="Approve and request-change actions only appear for tasks with needs_review status."
              />
            </Card>
          )}

          <Card className="h-fit xl:sticky xl:top-28">
            <CardHeader
              title="Execution"
              description={
                n8nReadiness.canExecute
                  ? 'Send this task through the connected server-side n8n webhook pipeline.'
                  : 'Run Task is guarded until n8n is fully connected on the server.'
              }
            />
            {task.status === 'pending' || task.status === 'failed' ? (
              <RunTaskButton
                taskId={task.id}
                mode={task.status === 'failed' ? 'retry' : 'run'}
                disabled={!n8nReadiness.canExecute}
                disabledReason={!n8nReadiness.canExecute ? n8nReadiness.message : undefined}
              />
            ) : task.status === 'processing' ? (
              <TaskProcessingPoller taskId={task.id} updatedAt={task.updated_at} />
            ) : (
              <Notice tone="info" title="Execution unavailable">
                Run Task is only available for pending or failed tasks.
              </Notice>
            )}
            <div className="muted-panel mt-5 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
                  <Workflow className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black">Automation status</p>
                  <p className="text-sm text-black/52">
                    {task.status === 'processing'
                      ? 'Waiting for callback'
                      : n8nReadiness.canExecute
                        ? 'Connected server-side webhook'
                        : 'n8n guarded'}
                  </p>
                </div>
                <StatusBadge status={n8nReadiness.statusLabel} type="system" size="sm" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
