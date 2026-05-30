import { Worker } from 'bullmq';
import { executeTask } from '@/lib/n8n.worker';
import { logger } from '@/lib/logger';
import { redis, redisConnection } from '../redis';
import { startTaskQueueEvents } from '@/lib/queue/events';
import { dlqQueue } from '@/lib/queue/queues';
import { startStaleProcessingRecovery } from '@/lib/queue/stale-recovery';
import type { Job } from 'bullmq';
import type { JsonObject } from '@/types';

type ExecuteTaskJobData = {
  taskExecutionId: string;
  task_id?: string | null;
  workspaceId: string;
  taskPayload: JsonObject;
  requestId: string;
};

const queueName = 'task-queue';
const workerName = 'task-worker:execute-task';
const shutdownTimeoutMsDefault = 15_000;

const log = logger.child(workerName);

let worker: Worker | null = null;
let taskQueueEventsReturn: ReturnType<typeof startTaskQueueEvents> | null = null;
let shuttingDown = false;
let didBootstrap = false;

// Module-level singleton to avoid starting stale recovery multiple times
// within the same process (idempotent in clustered env still depends on distributed strategy).
let didStartStaleRecovery = false;

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function validateEnvOrThrow(): void {
  const taskExecutionEnabled = readEnv('TASK_EXECUTION_ENABLED') === 'true';
  const n8nWebhookUrl = readEnv('N8N_WEBHOOK_URL');
  const n8nCallbackSecret = readEnv('N8N_CALLBACK_SECRET');

  const redisHost = readEnv('REDIS_HOST') || '127.0.0.1';
  const redisPortRaw = readEnv('REDIS_PORT') || '6379';
  const redisPort = Number(redisPortRaw);

  const missing: string[] = [];
  if (!taskExecutionEnabled) missing.push('TASK_EXECUTION_ENABLED=true');
  if (!n8nWebhookUrl) missing.push('N8N_WEBHOOK_URL');
  if (!n8nCallbackSecret) missing.push('N8N_CALLBACK_SECRET');
  if (!redisHost) missing.push('REDIS_HOST');
  if (!Number.isFinite(redisPort) || redisPort <= 0) missing.push('REDIS_PORT');

  if (missing.length) {
    // Fail fast: do not start worker with invalid config
    throw new Error(`Invalid/missing env for worker bootstrap: ${missing.join(', ')}`);
  }
}

const isExecuteTaskJobData = (value: unknown): value is ExecuteTaskJobData => {
  if (!value || typeof value !== 'object') return false;

  const maybeRecord = value as Record<string, unknown>;
  const taskExecutionId = maybeRecord.taskExecutionId;
  const workspaceId = maybeRecord.workspaceId;
  const taskPayload = maybeRecord.taskPayload;
  const requestId = maybeRecord.requestId;
  const task_id = maybeRecord.task_id;

  if (typeof taskExecutionId !== 'string') return false;
  if (typeof workspaceId !== 'string') return false;
  if (typeof requestId !== 'string') return false;

  if (task_id !== undefined && typeof task_id !== 'string' && task_id !== null) return false;

  if (!taskPayload || typeof taskPayload !== 'object') return false;
  if (Array.isArray(taskPayload)) return false;

  return true;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`shutdown_timeout_exceeded_${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function attachWorkerListenersOnce(w: Worker): void {
  // Prevent duplicate listeners if bootstrap is called twice inadvertently.
  // BullMQ Worker supports `removeAllListeners`, but we keep it minimal.
  w.removeAllListeners('completed');
  w.removeAllListeners('failed');
  w.removeAllListeners('error');
  w.removeAllListeners('active');

  w.on('completed', (job) => {
    log.info('Queue job completed', { jobId: job.id });
  });

  w.on('failed', (job, err) => {
    if (!job) return;
    log.error('Queue job failed', {
      jobId: job?.id,
      error: err instanceof Error ? err.message : String(err),
    });

    // Delegate to helper which is testable and idempotent.
    // Do not await here; fire-and-forget best-effort insertion to DLQ.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import('./maybe-dlq')
      .then(({ maybeMoveJobToDLQ }) => maybeMoveJobToDLQ(job, err))
      .catch((e) => {
        log.error('Error invoking DLQ helper', { error: e instanceof Error ? e.message : String(e) });
      });
  });

  w.on('error', (err) => {
    log.error('Worker error', { error: err instanceof Error ? err.message : String(err) });
  });

  w.on('active', (job) => {
    log.info('Queue job active', { jobId: job.id });
  });
}

async function runWorker(): Promise<void> {
  if (worker) return;
  if (didBootstrap) return;
  didBootstrap = true;

  // Validate env early (fail fast)
  validateEnvOrThrow();

  log.info('Task worker bootstrapping', {
    queue: queueName,
    worker: workerName,
    redisHost: redisConnection.host,
    redisPort: redisConnection.port,
  });

  taskQueueEventsReturn = startTaskQueueEvents();

  // Start stale processing recovery once per worker process lifecycle.
  if (!didStartStaleRecovery) {
    didStartStaleRecovery = true;

    const intervalMs = Number(process.env.STALE_PROCESSING_RECOVERY_INTERVAL_MS ?? 5 * 60 * 1000);
    const thresholdMsEnv = process.env.STALE_PROCESSING_RECOVERY_THRESHOLD_MS;
    const thresholdMs = thresholdMsEnv ? Number(thresholdMsEnv) : undefined;

    log.info('Starting stale processing recovery', {
      intervalMs,
      thresholdMs: thresholdMs ?? null,
    });

    startStaleProcessingRecovery(intervalMs, thresholdMs);
  }

  worker = new Worker(
    queueName,
    async (job) => {
      const jobName = typeof job.name === 'string' ? job.name : undefined;
      if (jobName !== 'execute-task') {
        log.warn('Ignoring job with unexpected name', { jobName, jobId: job.id });
        return;
      }

      const data = job.data;
      if (!isExecuteTaskJobData(data)) {
        log.error('Job data validation failed', { jobId: job.id });
        throw new Error('Invalid job data');
      }

      const { taskExecutionId, task_id, workspaceId, taskPayload, requestId } = data as ExecuteTaskJobData;

      log.info('Job started', { jobId: job.id, taskExecutionId, workspaceId, requestId });

      const result = await executeTask(taskPayload, taskExecutionId, workspaceId, task_id ?? null);

      if (result.error) {
        log.error('Job execution failed', {
          jobId: job.id,
          taskExecutionId,
          workspaceId,
          requestId,
          error: result.error,
        });
        throw new Error('Task execution failed');
      }

      log.info('Job completed', { jobId: job.id, taskExecutionId, workspaceId, requestId });
      return result;
    },
    {
      connection: redisConnection,
    }
  );

  attachWorkerListenersOnce(worker);

  log.info('Task worker started', {
    queue: queueName,
    worker: workerName,
  });
}

export const startTaskWorker = async (): Promise<void> => {
  await runWorker();
  // Important: BullMQ keeps the process alive naturally; no infinite promise.
  log.info('Worker is running and waiting for jobs', { queue: queueName });
};

export const stopTaskWorker = async (signal?: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  const timeoutMs = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? shutdownTimeoutMsDefault);

  log.warn('Graceful shutdown initiated', { signal, timeoutMs });

  const shutdownPromises: Array<Promise<void>> = [];

  shutdownPromises.push(
    withTimeout(
      (async () => {
        if (worker) {
          await worker.close();
          log.info('Worker closed');
        }
      })(),
      timeoutMs
    ).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'unknown_worker_close_error';
      log.error('Error while closing worker', { message });
    })
  );

  shutdownPromises.push(
    withTimeout(
      (async () => {
        if (taskQueueEventsReturn) {
          await taskQueueEventsReturn.close();
          log.info('Queue events closed');
        }
      })(),
      timeoutMs
    ).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'unknown_queue_events_close_error';
      log.error('Error while closing queue events', { message });
    })
  );

  shutdownPromises.push(
    withTimeout(
      (async () => {
        await redis.quit();
        log.info('Redis connection closed');
      })(),
      timeoutMs
    ).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'unknown_redis_quit_error';
      log.error('Error while quitting redis', { message });
    })
  );

  await Promise.allSettled(shutdownPromises);

  worker = null;
  taskQueueEventsReturn = null;

  log.info('Graceful shutdown completed', { signal });
};

function setupProcessSignalHandlers(): void {
  // Ensure handlers are registered only once.
  const existing = (globalThis as unknown as { __bb_task_worker_hooks?: boolean }).__bb_task_worker_hooks;
  if (existing) return;
  (globalThis as unknown as { __bb_task_worker_hooks?: boolean }).__bb_task_worker_hooks = true;

  process.on('SIGINT', () => {
    void stopTaskWorker('SIGINT');
  });

  process.on('SIGTERM', () => {
    void stopTaskWorker('SIGTERM');
  });

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err instanceof Error ? err.message : String(err) });
    void stopTaskWorker('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    log.error('Unhandled rejection', { error: message });
    void stopTaskWorker('unhandledRejection');
  });
}

setupProcessSignalHandlers();

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  void startTaskWorker();
}

