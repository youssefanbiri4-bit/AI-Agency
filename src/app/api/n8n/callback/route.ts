import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createTaskEvent,
  mapTaskRecordToTask,
  updateTaskExecutionState,
} from '@/lib/data/tasks';
import { reportAppError } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  markN8nCallbackEvent,
  recordN8nCallback,
  buildN8nCallbackKey,
} from '@/lib/n8n-callback-idempotency';
import type { JsonObject, JsonValue, TaskStatus } from '@/types';
import { genericServerSetupMessage, setupBlockerMessage } from '@/lib/safe-messages';
import { increment } from '@/lib/monitoring/metrics';
import {
  classifyStructuredOutputValidationError,
  validateStructuredOutputFromCallbackResult,
  N8N_STRUCTURED_OUTPUT_SCHEMA_VERSION,
} from '@/lib/n8n-structured-output-validation';

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

// Strict validation for n8n callback payloads.
// Important: we do not change the public callback contract; we only validate required fields.
const n8nCallbackSchema = z
  .object({
    taskId: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    status: z.enum(['completed', 'failed', 'processing']).optional(),
    result: z.unknown().optional(),
    error_message: z.string().optional(),
    correlation_id: z.string().optional(),
  })
  .passthrough();

// Helper: safely extract task id from payload for logging.
function extractTaskId(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const taskId = readString(record, 'taskId') || readString(record, 'task_id');
  return taskId || null;
}

export async function POST(request: NextRequest) {
  const callbackReceiveAt = Date.now();
  const rawPayloadForLogs = { headers: null as unknown, task_id: null as unknown, status: null as unknown };
  try {
    const incomingSecret = request.headers.get('x-n8n-callback-secret')?.trim();
    const expectedSecret = process.env.N8N_CALLBACK_SECRET?.trim();

    if (!expectedSecret) {
      return jsonError(
        setupBlockerMessage({
          missing: 'N8N_CALLBACK_SECRET',
          reason: 'callbacks cannot be trusted without the server-side shared secret',
          next: 'add N8N_CALLBACK_SECRET in Vercel, redeploy, and retry the callback',
        }),
        500
      );
    }

    if (!incomingSecret || !safeCompare(incomingSecret, expectedSecret)) {
      reportAppError('n8n callback authentication failure', null, {
        remoteIp: request.headers.get('x-forwarded-for') ?? null,
      });

      return jsonError(
        'Callback blocked: the callback secret is missing or invalid. Next: verify the n8n HTTP Request header without exposing the secret. / تم حظر الكالباك لأن السر غير صحيح.',
        401
      );
    }

    const body = await request.json().catch(() => null);

    const inferredTaskId = extractTaskId(body);
    rawPayloadForLogs.task_id = inferredTaskId;

    const inferredCorrelationId =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)['correlation_id']
        : undefined;

    const correlation_id =
      typeof inferredCorrelationId === 'string' ? inferredCorrelationId : null;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      reportAppError('n8n callback invalid payload shape', null, {
        task_id: inferredTaskId,
      });

      return jsonError('Invalid callback payload', 400);
    }

    const validationResult = n8nCallbackSchema.safeParse(body);
    if (!validationResult.success) {
      reportAppError('n8n callback invalid payload schema', null, {
        task_id: inferredTaskId,
        errors: validationResult.error.format(),
      });

      return jsonError('Invalid callback payload format', 400);
    }

    const payload = validationResult.data as Record<string, unknown>;
    const normalizedTaskId = (readString(payload, 'taskId') || readString(payload, 'task_id')).trim();

    if (!normalizedTaskId) {
      reportAppError('n8n callback missing task id after validation', null, {
        task_id: inferredTaskId,
      });
      return jsonError('Task ID is required', 400);
    }

    const callbackStatus = readString(payload, 'status');
    rawPayloadForLogs.status = callbackStatus;

    const payloadCorrelationId =
      typeof payload.correlation_id === 'string' ? payload.correlation_id : correlation_id;

    if (normalizedTaskId) {
      increment('callback_received_total', {
        task_id: normalizedTaskId,
        correlation_id: payloadCorrelationId,
      });
    }

    // Basic suspicious callback detection: explicit failed/completed without expected fields.
    const errorMessage = readString(payload, 'error_message') || null;
    if (callbackStatus === 'failed' && !errorMessage) {
      reportAppError('n8n callback suspicious: failed without error_message', null, {
        task_id: normalizedTaskId,
      });
    }

    const { client: adminClient } = getSupabaseAdmin();

    if (!adminClient) {
      return jsonError(genericServerSetupMessage('Supabase admin'), 500);
    }

    const { data: taskRecord, error: taskError } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', normalizedTaskId)
      .maybeSingle();

    if (taskError) {
      return jsonError('Callback blocked: task lookup failed safely. Next: check Supabase logs and task id, then retry. / تعذر التحقق من المهمة بأمان.', 500);
    }

    if (!taskRecord) {
      return jsonError('Task was not found', 404);
    }

    const task = mapTaskRecordToTask(taskRecord);
    const processStartAt = Date.now();
    const failed = Boolean(errorMessage) || callbackStatus === 'failed';
    let nextStatus: Extract<TaskStatus, 'needs_review' | 'failed'> = failed
      ? 'failed'
      : 'needs_review';

    const result = toResultObject(payload.result, errorMessage);

    const { executionIdentifier } = buildN8nCallbackKey({
      sourceRoute: '/api/n8n/callback',
      taskId: task.id,
      status: callbackStatus,
      payload,
    });

    // Safe compatibility mode validation: additive + non-destructive.
    // Only augment tasks.result when a structuredOutput candidate exists but fails schema validation.
    const structuredValidation = validateStructuredOutputFromCallbackResult(payload.result);
    if (!structuredValidation.ok) {
      const classification = classifyStructuredOutputValidationError(structuredValidation);
      const timestamp = new Date().toISOString();

      reportAppError('n8n structuredOutput validation failed', null, {
        timestamp,
        task_id: task.id,
        workspace_id: taskRecord.workspace_id,
        correlation_id: payloadCorrelationId,
        schemaVersion: structuredValidation.schemaVersion,
        validation: structuredValidation.error ?? null,
        validationCategory: classification.validationCategory,
      });

      increment('callback_structured_output_validation_failed_total', {
        task_id: task.id,
        workspace_id: taskRecord.workspace_id,
        correlation_id: payloadCorrelationId,
        schema_version: structuredValidation.schemaVersion,
        error_code: structuredValidation.error?.code ?? 'unknown',
      });

      increment('callback_structured_output_malformed_frequency_total', {
        error_code: structuredValidation.error?.code ?? 'unknown',
      });

      // Preserve raw payload for debugging, while augmenting tasks.result with internal keys.
      (result as Record<string, JsonValue>).rawcallbackjson =
        payload.result as unknown as JsonValue;

      (result as Record<string, JsonValue>).validationError =
        structuredValidation.error as unknown as JsonValue;

      (result as Record<string, JsonValue>).validationMeta = {
        schemaVersion: structuredValidation.schemaVersion,
        timestamp,
        callbackStatus,
        correlation_id: payloadCorrelationId,
        originalResultType: payload.result === null ? 'null' : typeof payload.result,
      };

      // Validation failures should not silently discard data.
      nextStatus = 'failed';
    }

    const callbackEvent = await recordN8nCallback({
      supabase: adminClient,
      sourceRoute: '/api/n8n/callback',
      taskId: task.id,
      workspaceId: taskRecord.workspace_id,
      status: callbackStatus,
      payload,
    });

    if (callbackEvent.error) {
      reportAppError('n8n callback could not be recorded', null, {
        task_id: task.id,
        error: callbackEvent.error,
      });
      return jsonError('Callback could not be recorded', 500);
    }

    if (callbackEvent.duplicate) {
      reportAppError('n8n callback duplicate detected', null, {
        task_id: task.id,
      });

      return NextResponse.json({
        ok: true,
        success: true,
        duplicate: true,
        message: 'Callback already processed',
      });
    }

    // Safe state transition enforcement:
    // - only accept transition when current status is processing
    // - prevents completed/failed -> needs_review/failed overwrites.
    if (task.status !== 'processing') {
      if (callbackEvent.eventId) {
        await markN8nCallbackEvent(
          adminClient,
          callbackEvent.eventId,
          'stale_ignored'
        );
      }

      increment('callback_ignored_total', {
        task_id: task.id,
        workspace_id: taskRecord.workspace_id,
        correlation_id: payloadCorrelationId,
      });

      const callbackLatencyMs = Date.now() - callbackReceiveAt;
      reportAppError('n8n callback stale ignored', null, {
        task_id: task.id,
        task_status: task.status,
        callbackLatencyMs,
        processingDurationMs: Date.now() - processStartAt,
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

      reportAppError('n8n callback failed to update task state', null, {
        task_id: task.id,
        nextStatus,
        updateError: updateResult.error ?? null,
        callbackLatencyMs: Date.now() - callbackReceiveAt,
        processingDurationMs: Date.now() - processStartAt,
      });

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

      reportAppError('n8n callback failed to create task event', null, {
        task_id: task.id,
        eventType,
        callbackLatencyMs: Date.now() - callbackReceiveAt,
        processingDurationMs: Date.now() - processStartAt,
      });

      return jsonError(eventResult.error, 500);
    }

    if (callbackEvent.eventId) {
      await markN8nCallbackEvent(adminClient, callbackEvent.eventId, 'processed');
    }

    const callbackLatencyMs = Date.now() - callbackReceiveAt;
    reportAppError('n8n callback processed', null, {
      task_id: task.id,
      nextStatus,
      callbackLatencyMs,
      processingDurationMs: Date.now() - processStartAt,
    });

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
    reportAppError('n8n callback webhook error', error);
    return jsonError('Internal server error', 500);
  }
}
