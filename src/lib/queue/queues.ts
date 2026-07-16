import { Queue } from 'bullmq';
import { redisConnection } from './redis';
import { logger } from '@/lib/logger';

const log = logger.child('queue:queues');

export function getTaskQueue(): Queue {
  const queue = new Queue('task-queue', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: 500,
    },
  });
  log.info('Queue initialized', { queue: 'task-queue' });
  return queue;
}

export function getDlqQueue(): Queue {
  const queue = new Queue('task-dead-letter-queue', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
  log.info('Queue initialized', { queue: 'task-dead-letter-queue' });
  return queue;
}
