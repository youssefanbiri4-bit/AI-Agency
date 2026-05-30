import { Queue } from 'bullmq';
import { redisConnection } from './redis';
import { logger } from '@/lib/logger';

const log = logger.child('queue:queues');

export const taskQueue = new Queue('task-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    // Retain failed jobs for operational debugging and DLQ processing.
    // Keep 500 failed job records by default in Redis.
    removeOnFail: 500,
  },
});

export const dlqQueue = new Queue('task-dead-letter-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    // Keep DLQ entries long-lived; they represent permanently failed work
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Startup log for operational visibility (does not change behavior)
log.info('Queue initialized', { queue: 'task-queue' });
