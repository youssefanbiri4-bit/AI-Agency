import type { Job } from 'bullmq';
import { redis } from '@/lib/queue/redis';
import { dlqQueue } from '@/lib/queue/queues';
import { logger } from '@/lib/logger';

const log = logger.child('queue:maybe-dlq');

const DLQ_INSERT_TTL_SECONDS = 60 * 24 * 3600; // 60 days

function getFailureReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type MaybeDlqData = {
  taskExecutionId?: string | null;
  task_id?: string | null;
  workspaceId?: string | null;
  requestId?: string | null;
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
    const correlationId = requestId ?? null;

    const failureReason = getFailureReason(err);
    const timestamp = new Date().toISOString();

    // Ensure idempotency: only one DLQ insertion per job id (and exec id if present).
    const dlqKey = `dlq:job:${taskExecutionId ?? 'noexec'}:${job.id}`;

    // Explicit retry exhaustion signal
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

    await dlqQueue.add('failed-job', {
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
      requestId: correlationId,
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
