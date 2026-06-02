import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createTaskEvent, mapTaskRecordToTask, updateTaskExecutionState } from '@/lib/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import { reportAppError } from '@/lib/logger';
import { getN8nCallbackSecret } from '@/lib/n8n';
import {
  markN8nCallbackEvent,
  recordN8nCallback,
  buildN8nCallbackKey,
} from '@/lib/n8n-callback-idempotency';
import { genericServerSetupMessage, setupBlockerMessage } from '@/lib/safe-messages';
import { increment } from '@/lib/monitoring/metrics';
import type { JsonObject, JsonValue, TaskStatus } from '@/types';

// Zod schema for validating n8n callback payload
const n8nCallbackSchema = z.object({
  task_id: z.string().uuid('Invalid task ID format'),
  status: z.enum(['completed', 'failed', 'processing']),
  result: z.unknown().optional(), // We'll validate this more specifically if needed
  error_message: z.string().optional(),
  correlation_id: z.string().optional(),
  // Allow additional fields for flexibility
  // We're using .passthrough() to allow extra fields while validating the required ones
}).passthrough();

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

export async function POST(request: Request) {
  try {
    const expectedSecret = getN8nCallbackSecret();

    if (!expectedSecret) {
      return jsonError(setupBlockerMessage({
        missing: 'N8N_CALLBACK_SECRET',
        reason: 'callbacks cannot be trusted without the server-side shared secret',
        next: 'add N8N_CALLBACK_SECRET in Vercel, redeploy, and retry the callback',
      }), 500);
    }

    const callbackSecret = request.headers.get('x-callback-secret')?.trim() ?? '';

    if (!callbackSecret || !safeCompare(callbackSecret, expectedSecret)) {
      return jsonError('Callback blocked: the callback secret is missing or invalid. Next: verify the n8n HTTP Request header without exposing the secret. / تم حظر الكالباك لأن السر غير صحيح.', 401);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return jsonError('Invalid callback payload', 400);
    }

    // Validate the callback payload using Zod schema
    const validationResult = n8nCallbackSchema.safeParse(body);
    if (!validationResult.success) {
      reportAppError('Invalid n8n callback payload', null, {
        errors: validationResult.error.format(),
        payload: body
      });
      return jsonError('Invalid callback payload format', 400);
    }

    const payload = validationResult.data as Record<string, unknown>;
    const taskId = readString(payload, 'task_id') || readString(payload, 'taskId');
    const callbackStatus = readString(payload, 'status');
    const errorMessage = readString(payload, 'error_message') || null;

    const payloadCorrelationId =
      typeof payload.correlation_id === 'string' ? payload.correlation_id : null;

    // Best-effort: emit received once we have a stable task identifier.
    if (taskId) {
      increment('callback_received_total', { task_id: taskId, correlation_id: payloadCorrelationId });
    }

    if (!taskId) {
      return jsonError('Task ID is required', 400);
    }

    const { client: adminClient } = getSupabaseAdmin();

    if (!adminClient) {
      return jsonError(genericServerSetupMessage('Supabase admin'), 500);
    }

    const { data: taskRecord, error: taskError } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      return jsonError('Callback blocked: task lookup failed safely. Next: check Supabase logs and task id, then retry. / تعذر التحقق من المهمة بأمان.', 500);
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
      sourceRoute: '/api/tasks/callback',
      taskId: task.id,
      status: callbackStatus,
      payload,
    });
    const callbackEvent = await recordN8nCallback({
      supabase: adminClient,
      sourceRoute: '/api/tasks/callback',
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

      increment('callback_ignored_total', {
        task_id: task.id,
        workspace_id: taskRecord.workspace_id,
        correlation_id: payloadCorrelationId,
      });

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

    if (callbackEvent.eventId) {
      await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'processed');
    }

    increment('callback_success_total', {
      task_id: task.id,
      workspace_id: taskRecord.workspace_id,
      correlation_id: payloadCorrelationId,
    });

    return NextResponse.json({
      success: true,
      data: {
        task_id: task.id,
        status: nextStatus,
      },
    });
  } catch (error) {
    reportAppError('Task callback webhook error', error);
    return jsonError('Internal server error', 500);
  }
}
