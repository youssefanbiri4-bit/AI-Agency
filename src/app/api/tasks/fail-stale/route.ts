import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  createTaskEvent,
  getTaskById,
  markStaleProcessingTaskFailed,
} from '@/lib/data/tasks';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { reportAppError } from '@/lib/logger';

const STALE_PROCESSING_THRESHOLD_MS = 12 * 60 * 1000;
const STALE_PROCESSING_ERROR_MESSAGE = 'The task took too long to complete. Please retry.';

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

export async function POST(request: NextRequest) {
  try {
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

    if (task.status !== 'processing') {
      return NextResponse.json({
        success: true,
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      });
    }

    const updatedAt = Date.parse(task.updated_at);

    if (Number.isNaN(updatedAt)) {
      return jsonError('Task timestamp is unavailable', 500);
    }

    const staleBefore = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS).toISOString();

    if (updatedAt >= Date.parse(staleBefore)) {
      return NextResponse.json({
        success: true,
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      });
    }

    const staleResult = await markStaleProcessingTaskFailed(
      {
        taskId: task.id,
        workspaceId,
        staleBefore,
        errorMessage: STALE_PROCESSING_ERROR_MESSAGE,
      },
      supabase
    );

    if (staleResult.error) {
      reportAppError('Stale processing task failure update failed', staleResult.error, {
        taskId: task.id,
        workspaceId,
      });

      return jsonError('Task stale status could not be updated', 500);
    }

    if (!staleResult.data) {
      return NextResponse.json({
        success: true,
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      });
    }

    const eventResult = await createTaskEvent(
      {
        workspaceId,
        taskId: task.id,
        actorId: user.id,
        eventType: 'task_failed_by_n8n',
        message: 'Task failed after processing timeout',
      },
      supabase
    );

    if (eventResult.error) {
      reportAppError('Stale processing task event insert failed', eventResult.error, {
        taskId: task.id,
        workspaceId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        task_id: task.id,
        status: 'failed',
        changed: true,
      },
    });
  } catch (error) {
    reportAppError('Fail stale processing task API error', error);
    return jsonError('Task stale status could not be checked', 500);
  }
}
