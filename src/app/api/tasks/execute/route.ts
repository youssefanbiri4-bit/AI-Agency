import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getTaskById, createTaskEvent, updateTaskExecutionState } from '@/lib/data/tasks';
import { getAgentById } from '@/lib/data/agents';
import { getLatestTaskRevisionNotes } from '@/lib/data/reviews';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { reportAppError } from '@/lib/logger';
import { getN8nReadiness } from '@/lib/n8n';
import type { JsonObject } from '@/types';

const EXECUTION_SEND_FAILURE_MESSAGE = 'Task could not be sent to n8n. Please retry.';

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function getStringBodyValue(body: unknown, keys: string[]) {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value.trim();
  }

  return '';
}

function getBaseUrl(request: NextRequest) {
  return request.nextUrl.origin;
}

function getCallbackBaseUrl(request: NextRequest) {
  return (process.env.APP_BASE_URL?.trim() || getBaseUrl(request)).replace(/\/+$/, '');
}

async function markTaskExecutionFailed({
  supabase,
  workspaceId,
  taskId,
  actorId,
  message,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  workspaceId: string;
  taskId: string;
  actorId: string;
  message: string;
}) {
  const result: JsonObject = { error_message: message };
  const failedResult = await updateTaskExecutionState(
    {
      taskId,
      workspaceId,
      status: 'failed',
      result,
    },
    supabase
  );

  if (failedResult.error) {
    reportAppError('Task execution failure status update failed', failedResult.error, {
      taskId,
      workspaceId,
    });
  }

  const eventResult = await createTaskEvent(
    {
      workspaceId,
      taskId,
      actorId,
      eventType: 'task_failed_by_n8n',
      message,
    },
    supabase
  );

  if (eventResult.error) {
    reportAppError('Task execution failure event insert failed', eventResult.error, {
      taskId,
      workspaceId,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const n8nReadiness = getN8nReadiness();

    if (!n8nReadiness.canExecute || !n8nReadiness.webhookUrl) {
      return jsonError(n8nReadiness.message, 503);
    }

    const body = await request.json().catch(() => null);
    const taskId = getStringBodyValue(body, ['task_id', 'taskId']);

    if (!taskId) {
      return jsonError('Task ID is required', 400);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError('Authentication is required', 401);
    }

    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

    if (workspaceResult.error) {
      return jsonError(workspaceResult.error, 500);
    }

    if (!workspaceResult.data) {
      return jsonError('Active workspace is required', 403);
    }

    const workspaceId = workspaceResult.data.id;
    const taskResult = await getTaskById(taskId, workspaceId, supabase);

    if (taskResult.error) {
      return jsonError(taskResult.error, 500);
    }

    if (!taskResult.data) {
      return jsonError('Task was not found in the active workspace', 404);
    }

    const task = taskResult.data;

    if (task.status !== 'pending' && task.status !== 'failed') {
      return jsonError('Only pending or failed tasks can be sent to n8n', 409);
    }

    const agentResult = await getAgentById(task.agent_type, supabase);

    if (agentResult.error) {
      return jsonError(`Agent routing information could not be loaded: ${agentResult.error}`, 500);
    }

    if (!agentResult.data) {
      return jsonError('Agent routing information was not found for this task', 500);
    }

    const agent = agentResult.data;
    const revisionNotesResult = await getLatestTaskRevisionNotes(task.id, workspaceId, supabase);

    if (revisionNotesResult.error) {
      return jsonError(`Revision notes could not be loaded: ${revisionNotesResult.error}`, 500);
    }

    const latestRevisionNotes = revisionNotesResult.data;

    const processingResult = await updateTaskExecutionState(
      {
        taskId: task.id,
        workspaceId,
        status: 'processing',
        result: null,
      },
      supabase
    );

    if (processingResult.error) {
      return jsonError(processingResult.error, 500);
    }

    const sentEventResult = await createTaskEvent(
      {
        workspaceId,
        taskId: task.id,
        actorId: user.id,
        eventType: 'task_sent_to_n8n',
        message: 'Task sent to n8n for processing',
      },
      supabase
    );

    if (sentEventResult.error) {
      await markTaskExecutionFailed({
        supabase,
        workspaceId,
        taskId: task.id,
        actorId: user.id,
        message: EXECUTION_SEND_FAILURE_MESSAGE,
      });

      reportAppError('Task sent event insert failed before n8n handoff', sentEventResult.error, {
        taskId: task.id,
        workspaceId,
      });

      return jsonError(EXECUTION_SEND_FAILURE_MESSAGE, 500);
    }

    const callbackBaseUrl = getCallbackBaseUrl(request);
    const callbackUrl = `${callbackBaseUrl}/api/n8n/callback`;

    console.log('APP_BASE_URL:', process.env.APP_BASE_URL);
    console.log('Callback URL:', callbackUrl);
    console.log('N8N_WEBHOOK_URL configured:', Boolean(n8nReadiness.webhookUrl));

    const payload = {
      taskId: task.id,
      workspaceId,
      agentId: task.agent_type,
      agentName: agent.name,
      department: agent.department,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: 'processing',
      callbackUrl,
      task_id: task.id,
      workspace_id: workspaceId,
      agent_type: task.agent_type,
      callback_url: callbackUrl,
      ...(latestRevisionNotes
        ? {
            revisionNotes: latestRevisionNotes,
            revision_notes: latestRevisionNotes,
          }
        : {}),
    };

    console.log('n8n payload revision notes present:', Boolean(latestRevisionNotes));

    const loggedPayload = latestRevisionNotes
      ? {
          ...payload,
          revisionNotes: '[redacted]',
          revision_notes: '[redacted]',
        }
      : payload;

    console.log('n8n task payload:', loggedPayload);

    let response: Response;

    try {
      response = await fetch(n8nReadiness.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      await markTaskExecutionFailed({
        supabase,
        workspaceId,
        taskId: task.id,
        actorId: user.id,
        message: EXECUTION_SEND_FAILURE_MESSAGE,
      });

      reportAppError('n8n webhook request failed before response', error, {
        taskId: task.id,
        workspaceId,
      });

      return jsonError(EXECUTION_SEND_FAILURE_MESSAGE, 502);
    }

    if (!response.ok) {
      const message = `n8n webhook request failed with status ${response.status}`;
      await markTaskExecutionFailed({
        supabase,
        workspaceId,
        taskId: task.id,
        actorId: user.id,
        message,
      });

      return jsonError(message, 502);
    }

    return NextResponse.json({
      success: true,
      data: {
        task_id: task.id,
        status: 'processing',
      },
    });
  } catch (error) {
    reportAppError('Task execution API error', error);
    return jsonError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
