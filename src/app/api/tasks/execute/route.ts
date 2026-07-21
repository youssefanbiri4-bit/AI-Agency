import { z } from 'zod';
import { getTaskQueue } from '@/lib/queue/queues';
import { logger } from '@/lib/logger';
import { getWorkspace } from '@/lib/data/workspaces-server';
import { getTaskById, updateTaskExecutionState } from '@/features/tasks/data/tasks';
import { createErrorResponse, AppError, ErrorLevel } from '@/lib/error-handler';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkSlidingWindowRateLimit } from '@/lib/sliding-window-rate-limit';
import { checkPayloadSize, PAYLOAD_LIMITS } from '@/lib/payload-limit';

const jsonValueSchema: z.ZodType<import('@/types').JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

// Accept multiple identifier shapes (task_id, taskId, taskExecutionId) but require workspaceId
const taskExecuteSchema = z.object({
  taskPayload: z.record(z.string(), jsonValueSchema).describe('Task execution payload'),
  // canonical DB id (snake_case)
  task_id: z.string().uuid('Invalid task id format').optional(),
  // alternate camelCase form
  taskId: z.string().uuid('Invalid task id format').optional(),
  // existing execution identifier (may or may not equal tasks.id)
  taskExecutionId: z.string().uuid('Invalid task execution ID format').optional(),
  workspaceId: z.string().uuid('Invalid workspace ID format'),
}).strict();

export async function POST(req: Request) {
  const requestIdHeader = req.headers.get('X-Request-ID');
  const requestId = requestIdHeader ?? `req-${Math.random().toString(36).substring(2, 10)}`;
  const correlationId = requestIdHeader ?? `corr-${crypto.randomUUID()}`;
  const log = logger.child(requestId);

  try {
    // Payload size check
    const sizeCheck = await checkPayloadSize(req, PAYLOAD_LIMITS.taskExecute);
    if (!sizeCheck.ok) return sizeCheck.response;
    const safeReq = sizeCheck.request;

    const body = await safeReq.json();
    const validation = taskExecuteSchema.safeParse(body);

    // Rate limiting check (must happen before workspace resolution/business logic)
    const clientIp =
      req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    // Build a stable limiter key. If payload is invalid, fall back to IP-only key.
    const workspaceIdForRateLimit =
      validation.success ? validation.data.workspaceId : null;

    const rateLimitKey = workspaceIdForRateLimit
      ? `api:tasks:execute:${clientIp}:${workspaceIdForRateLimit}`
      : `api:tasks:execute:${clientIp}`;

    const rateLimitResult = await checkRateLimit({
      key: rateLimitKey,
      limit: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimitResult.allowed) {
      log.warn('Rate limit exceeded for task execution (fixed window)', {
        clientIp,
        workspaceId: workspaceIdForRateLimit,
      });

      throw new AppError(
        'Rate limit exceeded',
        429,
        ErrorLevel.LOW,
        {
          retryAfterSeconds: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        }
      );
    }

    // Sliding window rate limit check (additional granularity with IP scoping)
    const slidingResult = await checkSlidingWindowRateLimit({
      key: `sw:api:tasks:execute:${clientIp}:${workspaceIdForRateLimit ?? 'unknown'}`,
      limit: 30,
      windowMs: 60_000, // 30 requests per minute per IP + workspace
    });

    if (!slidingResult.allowed) {
      log.warn('Sliding window rate limit exceeded for task execution', {
        clientIp,
        workspaceId: workspaceIdForRateLimit,
      });

      throw new AppError(
        'Too many task execution requests. Please wait before retrying.',
        429,
        ErrorLevel.LOW,
        {
          retryAfterSeconds: Math.ceil(slidingResult.resetInMs / 1000),
          resetAt: new Date(slidingResult.windowEnd).toISOString(),
          limit: slidingResult.limit,
          remaining: slidingResult.remaining,
        }
      );
    }

    if (!validation.success) {
      log.warn('Invalid task execution payload', {
        errors: validation.error.flatten(),
      });
      throw new AppError(
        'Invalid payload format',
        400,
        ErrorLevel.LOW,
        { errors: validation.error.flatten() }
      );
    }

    const { taskPayload, taskExecutionId, workspaceId } = validation.data;

    // Resolve canonical `taskId` (DB primary key) according to resolution order:
    // A) task_id
    // B) taskId
    // C) taskExecutionId (only if a tasks row exists whose id matches it)
    let taskId: string | null = null;
    // prefer snake_case task_id
    taskId = validation.data.task_id ?? validation.data.taskId ?? null;

    // If still not resolved, we'll attempt to use taskExecutionId as the canonical id
    // only if it maps to an existing tasks row. We do this by attempting the
    // optimistic transition using updateTaskExecutionState and rejecting when it
    // fails. This avoids a separate DB lookup and keeps the operation atomic.
    if (!taskId && taskExecutionId) {
      // Resolve the candidate execution identifier to the canonical DB id first.
      const candidate = await getTaskById(taskExecutionId, workspaceId);

      if (candidate.error || !candidate.data) {
        // No task found matching the provided execution identifier.
        throw new AppError('Task cannot be processed at this time', 409, ErrorLevel.MEDIUM, {
          detail: candidate.error ?? 'taskExecutionId_not_found',
        });
      }

      // Use the canonical DB primary key for all subsequent transitions.
      taskId = candidate.data.id;

      // Attempt to mark the canonical task as processing. Failures should prevent enqueue.
      const tentativeMark = await updateTaskExecutionState({
        taskId,
        workspaceId,
        status: 'processing',
        expectedCurrentStatus: 'pending',
      });

      if (tentativeMark.error || !tentativeMark.data) {
        throw new AppError('Task cannot be processed at this time', 409, ErrorLevel.MEDIUM, {
          detail: tentativeMark.error ?? 'failed_to_mark_processing',
        });
      }
      // candidate matched and has been transitioned; avoid re-marking later.
    }

    if (!taskId) {
      // No recognizable identifier provided
      throw new AppError('Task identifier is required', 400, ErrorLevel.LOW);
    }


    // NOTE: use request-context workspace getter for API consistency
    // (tests mock this dependency)
    const existingWorkspace = await getWorkspace(workspaceId);
    if (!existingWorkspace?.data) {
      log.warn('Workspace not found', { workspaceId });
      throw new AppError('Workspace context not available', 400, ErrorLevel.MEDIUM);
    }

    log.info('Received task execution request', {
      workspaceId,
      taskExecutionId,
      payloadKeys: Object.keys(taskPayload),
    });


    // Workspace ID validation
    if (existingWorkspace.data.id !== workspaceId) {
      log.warn('Workspace ID mismatch', {
        requestedWorkspaceId: workspaceId,
        contextWorkspaceId: existingWorkspace.data.id,
      });
      throw new AppError('Workspace ID mismatch', 400, ErrorLevel.LOW);
    }

    log.info('Task validated, marking processing and enqueueing job', {
      workspaceId,
      taskExecutionId,
      taskId,
      payloadKeys: Object.keys(taskPayload),
    });

    // If we reached here and the task wasn't already transitioned by the
    // tentative path above (i.e., we had a canonical task_id/taskId), perform
    // the processing transition now.
    let markResult: { data: unknown | null; error: unknown | null } = { data: null, error: null };
    if (!validation.data.taskExecutionId || validation.data.task_id || validation.data.taskId) {
      markResult = await updateTaskExecutionState({
        taskId: taskId as string,
        workspaceId,
        status: 'processing',
        expectedCurrentStatus: 'pending',
      });

      if (markResult.error || !markResult.data) {
        // Do not enqueue if we cannot transition the task to processing.
        throw new AppError('Task cannot be processed at this time', 409, ErrorLevel.MEDIUM, {
          detail: markResult.error ?? 'failed_to_mark_processing',
        });
      }
    }

    const job = await getTaskQueue().add('execute-task', {
      taskExecutionId: taskExecutionId ?? null,
      // canonical DB id
      task_id: taskId,
      workspaceId,
      taskPayload,
      requestId,
      correlation_id: correlationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        requestId,
        timestamp: new Date().toISOString(),
        jobId: job.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
      }
    );
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/tasks/execute',
      requestId,
      metadata: { action: 'executeTask' },
    });
  }
}

