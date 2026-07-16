import type { Job } from 'bullmq';
import { redis } from '@/lib/queue/redis';
import { getDlqQueue } from '@/lib/queue/queues';
import { logger } from '@/lib/logger';
import { increment } from '@/lib/monitoring/metrics';

const log = logger.child('queue:maybe-dlq');

const DLQ_INSERT_TTL_SECONDS = 60 * 24 * 3600; // 60 days

function getFailureReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type MaybeDlqData = {
  taskExecutionId?: string | null;
  task_id?: string | null;
  workspaceId?: string | null;

  // Backward-compat:
  // - requestId previously used
  // - correlation_id is the new canonical field
  requestId?: string | null;
  correlation_id?: string | null;
};

type MaybeJobLike = Job<MaybeDlqData> & {
  queueName?: string;
  attemptsMade?: number;
};

export async function maybeMoveJobToDLQ(job: MaybeJobLike, err: unknown) {
  try {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 0;

    if (!(maxAttempts > 0 && attemptsMade >= maxAttempts)) return;

    const data = job?.data ?? {};
    const taskExecutionId = data.taskExecutionId ?? null;
    const taskId = data.task_id ?? null;
    const workspaceId = data.workspaceId ?? null;
    const requestId = data.requestId ?? null;

    const queueName = job?.queueName ?? 'task-queue';

    // DLQ fallback chain (strict order):
    // correlation_id -> requestId -> jobId
    const correlationId =
      (data as MaybeDlqData).correlation_id ??
      requestId ??
      String(job.id);

    const failureReason = getFailureReason(err);
    const timestamp = new Date().toISOString();

    // Ensure idempotency: only one DLQ insertion per job id (and exec id if present).
    const dlqKey = `dlq:job:${taskExecutionId ?? 'noexec'}:${job.id}`;

    // Explicit retry exhaustion signal
    increment('dlq_retry_exhausted_total', {
      task_id: taskId,
      jobId: job?.id,
      workspace_id: workspaceId,
      request_id: correlationId,
    });

    log.error('retry_exhausted', {
      event: 'retry_exhausted',
      level: 'error',
      queue: queueName,
      jobId: job?.id,
      taskExecutionId,
      task_id: taskId,
      workspaceId,
      requestId: correlationId,
      attemptsMade,
      maxAttempts,
      failureReason,
      timestamp,
    });

    // ioredis typings: use PX for millisecond precision and NX for idempotency.
    const setResult = await redis.set(dlqKey, timestamp, 'PX', DLQ_INSERT_TTL_SECONDS * 1000, 'NX');

    if (!setResult) {
      log.info('DLQ insertion skipped; already recorded', {
        queue: queueName,
        jobId: job?.id,
        taskExecutionId,
        task_id: taskId,
        workspaceId,
        requestId: correlationId,
      });
      return;
    }

    await getDlqQueue().add('failed-job', {
      // Required metadata for DLQ consumers / debugging
      task_id: taskId,
      taskExecutionId,
      workspaceId,

      // Required
      failureReason,
      timestamp,

      // Required idempotency/debug keys
      jobId: job.id,
      queue: queueName,

      // Required retries/debug
      attemptsMade,
      maxAttempts,

      // Required correlation/request context
      correlation_id: correlationId,

      // Backward-compat field (leave in payload; do NOT treat as canonical)
      requestId: correlationId,
    });

    increment('dlq_inserted_total', {
      task_id: taskId,
      jobId: job.id,
      workspace_id: workspaceId,
      request_id: correlationId,
    });

    log.error('Job moved to DLQ', {
      event: 'dlq_inserted',
      level: 'error',
      queue: queueName,
      jobId: job?.id,
      taskExecutionId,
      task_id: taskId,
      workspaceId,
      requestId: correlationId,
      attemptsMade,
      maxAttempts,
      failureReason,
      timestamp,
    });
  } catch (e) {
    log.error('Failed to push job to DLQ', { error: e instanceof Error ? e.message : String(e) });
  }
}

export default maybeMoveJobToDLQ;
