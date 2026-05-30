import { describe, it, expect, vi, beforeEach } from 'vitest';

const startStaleProcessingRecoveryMock = vi.fn();
const startTaskQueueEventsMock = vi.fn(() => ({
  close: vi.fn(),
}));

type Listener = (payload?: unknown) => void;

const workerConstructorMock = vi.fn((_queueName?: unknown, _processor?: unknown, _opts?: unknown) => {
  const listeners: Record<string, Array<Listener>> = {};
  return {
    id: 'worker-1',
    removeAllListeners: vi.fn(),
    on: vi.fn((event: string, cb: Listener) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    close: vi.fn(async () => {}),
  };
});

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn((queueName: unknown, processor: unknown, opts: unknown) =>
      workerConstructorMock(queueName, processor, opts)
    ),
  };
});

vi.mock('@/lib/n8n.worker', () => ({
  executeTask: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/queue/redis', () => ({
  redis: {
    quit: vi.fn(async () => {}),
    status: 'ready',
  },
  redisConnection: {
    host: 'localhost',
    port: 6379,
  },
}));

vi.mock('@/lib/queue/events', () => ({
  startTaskQueueEvents: () => startTaskQueueEventsMock(),
}));

vi.mock('@/lib/queue/queues', () => ({
  dlqQueue: {
    add: vi.fn(),
  },
  taskQueue: {},
}));

vi.mock('@/lib/queue/stale-recovery', () => ({
  startStaleProcessingRecovery: (...args: unknown[]) => startStaleProcessingRecoveryMock(...args),
}));

describe('task-worker startup wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    workerConstructorMock.mockClear();
    startTaskQueueEventsMock.mockClear();
    startStaleProcessingRecoveryMock.mockClear();

    process.env.TASK_EXECUTION_ENABLED = 'true';
    process.env.N8N_WEBHOOK_URL = 'https://example.com/webhook';
    process.env.N8N_CALLBACK_SECRET = 'secret';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
  });

  it('calls startStaleProcessingRecovery exactly once across multiple startTaskWorker calls', async () => {
    const mod = await import('./task-worker');

    await mod.startTaskWorker();
    await mod.startTaskWorker();

    expect(startStaleProcessingRecoveryMock).toHaveBeenCalledTimes(1);
  });

  it('constructs BullMQ Worker only once due to didBootstrap guard', async () => {
    const mod = await import('./task-worker');

    await mod.startTaskWorker();
    await mod.startTaskWorker();

    expect(workerConstructorMock).toHaveBeenCalledTimes(1);
  });
});
