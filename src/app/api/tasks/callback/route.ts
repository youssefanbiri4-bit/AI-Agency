import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createTaskEvent, mapTaskRecordToTask, updateTaskExecutionState } from '@/lib/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import { reportAppError } from '@/lib/logger';
import { getN8nCallbackSecret } from '@/lib/n8n';
import type { JsonObject, JsonValue, TaskStatus } from '@/types';

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toResultObject(result: unknown, errorMessage: string | null): JsonObject {
  if (errorMessage) {
    return { error_message: errorMessage };
  }

  if (isJsonObject(result)) {
    return result as JsonObject;
  }

  if (result === null || typeof result === 'undefined') {
    return {};
  }

  return { value: result as JsonValue };
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = getN8nCallbackSecret();

    if (!expectedSecret) {
      return jsonError('n8n callback secret is not configured', 500);
    }

    const callbackSecret = request.headers.get('x-callback-secret')?.trim() ?? '';

    if (!callbackSecret || !safeCompare(callbackSecret, expectedSecret)) {
      return jsonError('Invalid callback secret', 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return jsonError('Invalid callback payload', 400);
    }

    const payload = body as Record<string, unknown>;
    const taskId = readString(payload, 'task_id') || readString(payload, 'taskId');
    const callbackStatus = readString(payload, 'status');
    const errorMessage = readString(payload, 'error_message') || null;

    if (!taskId) {
      return jsonError('Task ID is required', 400);
    }

    const { client: adminClient, error: adminError } = getSupabaseAdmin();

    if (!adminClient) {
      return jsonError(adminError ?? 'Supabase admin client is not configured', 500);
    }

    const { data: taskRecord, error: taskError } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      return jsonError(taskError.message, 500);
    }

    if (!taskRecord) {
      return jsonError('Task was not found', 404);
    }

    const task = mapTaskRecordToTask(taskRecord);
    const failed = Boolean(errorMessage) || callbackStatus === 'failed';
    const nextStatus: Extract<TaskStatus, 'needs_review' | 'failed'> = failed
      ? 'failed'
      : 'needs_review';
    const result = toResultObject(payload.result, errorMessage);

    const updateResult = await updateTaskExecutionState(
      {
        taskId: task.id,
        workspaceId: taskRecord.workspace_id,
        status: nextStatus,
        result,
      },
      adminClient
    );

    if (updateResult.error || !updateResult.data) {
      return jsonError(updateResult.error ?? 'Task could not be updated', 500);
    }

    const eventType = failed ? 'task_failed_by_n8n' : 'task_completed_by_n8n';
    const message = failed
      ? `Task failed by n8n${errorMessage ? `: ${errorMessage}` : ''}`
      : 'Task completed by n8n';
    const eventResult = await createTaskEvent(
      {
        workspaceId: taskRecord.workspace_id,
        taskId: task.id,
        actorId: null,
        eventType,
        message,
      },
      adminClient
    );

    if (eventResult.error) {
      return jsonError(eventResult.error, 500);
    }

    try {
      await createNotification(
        {
          workspaceId: taskRecord.workspace_id,
          userId: taskRecord.user_id,
          type: failed ? 'task_failed' : 'task_needs_review',
          title: failed ? 'Task failed' : 'Task needs review',
          message: failed
            ? `${task.title} failed during automation.`
            : `${task.title} is ready for review.`,
          metadata: {
            task_id: task.id,
            source: 'n8n_callback',
          },
        },
        adminClient
      );
    } catch {
      // Notifications must never block the stable n8n callback response.
    }

    return NextResponse.json({
      success: true,
      data: {
        task_id: task.id,
        status: nextStatus,
      },
    });
  } catch (error) {
    reportAppError('Task callback webhook error', error);
    return jsonError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
