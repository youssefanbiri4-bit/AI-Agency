import { Worker } from 'bullmq';
import { redis } from '../redis';
import { executeTask } from '@/lib/n8n.worker';
import { maybeMoveJobToDLQ } from './maybe-dlq';
import { logger } from '@/lib/logger';

const log = logger.child('worker:task-queue');

export function createTaskWorker() {
  const worker = new Worker(
    'task-queue',
    async (job) => {
      const { taskPayload, taskExecutionId, workspaceId, task_id, requestId, correlation_id } =
        job.data ?? {};

      log.info('Processing job', {
        jobId: job.id,
        taskExecutionId,
        taskId: task_id,
        workspaceId,
        requestId,
        correlation_id,
      });

      if (!taskPayload || !workspaceId) {
        throw new Error('Invalid job data: missing taskPayload or workspaceId');
      }

      const result = await executeTask(
        taskPayload,
        taskExecutionId ?? null,
        workspaceId,
        task_id ?? null,
        correlation_id ?? null
      );

      if (!result.success) {
        throw new Error(result.error ?? 'Task execution failed');
      }

      return result;
    },
    {
      connection: redis as unknown as import('bullmq').ConnectionOptions,
      concurrency: 5,
      lockDuration: 60_000,
      maxStalledCount: 3,
    }
  );

  worker.on('completed', (job) => {
    log.info('Job completed', { jobId: job.id });
  });

  worker.on('failed', async (job, err) => {
    log.error('Job failed', { jobId: job?.id, error: err.message });

    if (job) {
      await maybeMoveJobToDLQ(job, err);
    }
  });

  worker.on('error', (err) => {
    log.error('Worker error', { error: err.message });
  });

  log.info('Task worker started', { concurrency: 5, lockDuration: 60000 });
  return worker;
}
