import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createTaskEvent, mapTaskRecordToTask, updateTaskExecutionState } from '@/lib/data/tasks';
import { reportAppError } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  markN8nCallbackEvent,
  recordN8nCallback,
  buildN8nCallbackKey,
} from '@/lib/n8n-callback-idempotency';
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
    const incomingSecret = request.headers.get("x-n8n-callback-secret")?.trim();
    const expectedSecret = process.env.N8N_CALLBACK_SECRET?.trim();

    if (!expectedSecret) {
      return jsonError('Server missing N8N_CALLBACK_SECRET', 500);
    }

    if (!incomingSecret || !safeCompare(incomingSecret, expectedSecret)) {
      return jsonError('Invalid callback secret', 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError('Invalid callback payload', 400);
    }

    const taskId = body.taskId || body.task_id;

    if (typeof taskId !== 'string' || !taskId.trim()) {
      return jsonError('Task ID is required', 400);
    }

    const payload = body as Record<string, unknown>;
    const normalizedTaskId = taskId.trim();
    const callbackStatus = readString(payload, 'status');
    const errorMessage = readString(payload, 'error_message') || null;
    const { client: adminClient, error: adminError } = getSupabaseAdmin();

    if (!adminClient) {
      return jsonError(adminError ?? 'Supabase admin client is not configured', 500);
    }

    const { data: taskRecord, error: taskError } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', normalizedTaskId)
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
    const { executionIdentifier } = buildN8nCallbackKey({
      sourceRoute: '/api/n8n/callback',
      taskId: task.id,
      status: callbackStatus,
      payload,
    });
    const callbackEvent = await recordN8nCallback({
      supabase: adminClient,
      sourceRoute: '/api/n8n/callback',
      taskId: task.id,
      workspaceId: taskRecord.workspace_id,
      status: callbackStatus,
      payload,
    });

    if (callbackEvent.error) {
      return jsonError('Callback could not be recorded', 500);
    }

    if (callbackEvent.duplicate) {
      return NextResponse.json({
        ok: true,
        success: true,
        duplicate: true,
        message: 'Callback already processed',
      });
    }

    if (task.status !== 'processing') {
      if (callbackEvent.eventId) {
        await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'stale_ignored');
      }

      return NextResponse.json({
        ok: true,
        success: true,
        duplicate: false,
        ignored: true,
        message: 'Callback ignored because task is no longer processing',
        data: {
          task_id: task.id,
          status: task.status,
        },
      });
    }

    const updateResult = await updateTaskExecutionState(
      {
        taskId: task.id,
        workspaceId: taskRecord.workspace_id,
        status: nextStatus,
        result,
        n8nExecutionId: executionIdentifier,
        expectedCurrentStatus: 'processing',
      },
      adminClient
    );

    if (updateResult.error || !updateResult.data) {
      if (callbackEvent.eventId) {
        await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'failed');
      }

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
      if (callbackEvent.eventId) {
        await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'failed');
      }

      return jsonError(eventResult.error, 500);
    }

    if (callbackEvent.eventId) {
      await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'processed');
    }

    return NextResponse.json({
      success: true,
      data: {
        task_id: task.id,
        status: nextStatus,
      },
    });
  } catch (error) {
    reportAppError('n8n callback webhook error', error);
    return jsonError('Internal server error', 500);
  }
}
