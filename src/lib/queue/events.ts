import { QueueEvents, type QueueEventsOptions } from 'bullmq';
import { redisConnection } from './redis';
import { logger } from '@/lib/logger';

const queueName = 'task-queue';

const queueEventsOptions: QueueEventsOptions = {
  connection: redisConnection,
};

let eventsInstance: QueueEvents | null = null;
let didAttachListeners = false;

export const startTaskQueueEvents = (): QueueEvents => {
  if (eventsInstance) return eventsInstance;

  eventsInstance = new QueueEvents(queueName, queueEventsOptions);

  if (!didAttachListeners) {
    didAttachListeners = true;

    eventsInstance.on('completed', (payload: { jobId: string | number }) => {
      logger.info('Queue job completed', { queue: queueName, jobId: payload.jobId });
    });

    eventsInstance.on(
      'failed',
      (payload: { jobId: string | number; failedReason?: string | undefined }) => {
        logger.error('Queue job failed', {
          queue: queueName,
          jobId: payload.jobId,
          failedReason: payload.failedReason,
        });
      }
    );

    // BullMQ emits stalled events depending on worker/lock configuration
    eventsInstance.on('stalled', (payload: { jobId: string | number }) => {
      logger.warn('Queue job stalled', { queue: queueName, jobId: payload.jobId });
    });

    // 'progress' is emitted when worker calls job.updateProgress(...)
    eventsInstance.on(
      'progress',
      (payload: { jobId: string | number; data?: unknown }) => {
        logger.info('Queue job progress', {
          queue: queueName,
          jobId: payload.jobId,
          data: payload.data,
        });
      }
    );

    logger.info('Queue events started', { queue: queueName });
  }

  return eventsInstance;
};

// Optional helper so callers can cleanly reset after shutdown
export const stopTaskQueueEvents = async (): Promise<void> => {
  if (!eventsInstance) return;

  const instance = eventsInstance;
  eventsInstance = null;

  try {
    await instance.close();
    logger.info('Queue events closed', { queue: queueName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Queue events close failed', { queue: queueName, error: message });
  }
};
