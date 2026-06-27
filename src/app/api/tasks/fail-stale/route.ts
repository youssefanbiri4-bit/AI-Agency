import { z } from 'zod';
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
import { createNotification } from '@/lib/data/notifications';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { reportAppError } from '@/lib/logger';
import { getRequestId, nowISO } from '@/lib/api-response';
import { checkPayloadSize, PAYLOAD_LIMITS } from '@/lib/payload-limit';

const STALE_PROCESSING_THRESHOLD_MS = 12 * 60 * 1000;
const STALE_PROCESSING_ERROR_MESSAGE = 'The task took too long to complete. Please retry.';

// Zod schema for fail-stale request body
const failStaleSchema = z.object({
  task_id: z.string().uuid('Invalid task ID format').optional(),
  taskId: z.string().uuid('Invalid task ID format').optional(),
}).refine(
  (data) => data.task_id || data.taskId,
  { message: 'Either task_id or taskId is required' }
);

function jsonError(error: string, status: number, requestId: string) {
  return NextResponse.json({ success: false, error, requestId, timestamp: nowISO() }, {
    status,
    headers: { 'X-Request-ID': requestId },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    // Payload size check
    const sizeCheck = await checkPayloadSize(request, PAYLOAD_LIMITS.default);
    if (!sizeCheck.ok) return sizeCheck.response;

    const body = await request.json().catch(() => null);
    
    // Zod validation
    const validation = failStaleSchema.safeParse(body);
    if (!validation.success) {
      return jsonError('Task ID is required', 400, requestId);
    }

    const taskId = validation.data.task_id || validation.data.taskId || '';
    if (!taskId) {
      return jsonError('Task ID is required', 400, requestId);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError('Authentication is required', 401, requestId);
    }

    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

    if (workspaceResult.error) {
      return jsonError(workspaceResult.error, 500, requestId);
    }

    if (!workspaceResult.data) {
      return jsonError('Active workspace is required', 403, requestId);
    }

    const workspaceId = workspaceResult.data.id;
    const taskResult = await getTaskById(taskId, workspaceId, supabase);

    if (taskResult.error) {
      return jsonError(taskResult.error, 500, requestId);
    }

    if (!taskResult.data) {
      return jsonError('Task was not found in the active workspace', 404, requestId);
    }

    const task = taskResult.data;

    if (task.status !== 'processing') {
      return NextResponse.json({
        success: true,
        requestId,
        timestamp: nowISO(),
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      }, {
        headers: { 'X-Request-ID': requestId },
      });
    }

    const updatedAt = Date.parse(task.updated_at);

    if (Number.isNaN(updatedAt)) {
      return jsonError('Task timestamp is unavailable', 500, requestId);
    }

    const staleBefore = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS).toISOString();

    if (updatedAt >= Date.parse(staleBefore)) {
      return NextResponse.json({
        success: true,
        requestId,
        timestamp: nowISO(),
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      }, {
        headers: { 'X-Request-ID': requestId },
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

      return jsonError('Task stale status could not be updated', 500, requestId);
    }

    if (!staleResult.data) {
      return NextResponse.json({
        success: true,
        requestId,
        timestamp: nowISO(),
        data: {
          task_id: task.id,
          status: task.status,
          changed: false,
        },
      }, {
        headers: { 'X-Request-ID': requestId },
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

    try {
      await createNotification(
        {
          workspaceId,
          userId: task.user_id,
          type: 'task_failed',
          title: 'Task failed',
          message: `${task.title} failed after a processing timeout.`,
          metadata: {
            task_id: task.id,
            source: 'stale_processing_timeout',
          },
        },
        supabase
      );
    } catch {
      // Notifications must not affect stale task failure handling.
    }

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: nowISO(),
      data: {
        task_id: task.id,
        status: 'failed',
        changed: true,
      },
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Fail stale processing task API error', error);
    return jsonError('Task stale status could not be checked', 500, requestId);
  }
}
