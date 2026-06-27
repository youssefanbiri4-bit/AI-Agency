import { describe, it, expect, vi, beforeEach } from 'vitest';

const startStaleProcessingRecoveryMock = vi.fn();
const startTaskQueueEventsMock = vi.fn(() => ({
  close: vi.fn(),
}));

type Listener = (payload?: unknown) => void;

// Mock Worker: vitest v4 vi.fn() cannot be used with `new`, so we use a real class.
class MockWorker {
  id = 'worker-1';
  queueName: unknown;
  processor: unknown;
  opts: unknown;
  private listeners: Record<string, Array<Listener>> = {};
  removeAllListeners = vi.fn();
  on = vi.fn((event: string, cb: Listener) => {
    this.listeners[event] = this.listeners[event] ?? [];
    this.listeners[event].push(cb);
  });
  close = vi.fn(async () => {});

  constructor(queueName: unknown, processor: unknown, opts: unknown) {
    this.queueName = queueName;
    this.processor = processor;
    this.opts = opts;
  }
}

vi.mock('bullmq', () => {
  return {
    Worker: MockWorker,
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
  startStaleProcessingRecovery: (...args: unknown[]) =>
    startStaleProcessingRecoveryMock(...args),
}));

describe('task-worker startup wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    startTaskQueueEventsMock.mockClear();
    startStaleProcessingRecoveryMock.mockClear();

    process.env.TASK_EXECUTION_ENABLED = 'true';
    process.env.N8N_WEBHOOK_URL = 'https://example.com/webhook';
    process.env.N8N_CALLBACK_SECRET = 'secret';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
  });

  it('creates a BullMQ Worker when createTaskWorker is called', async () => {
    const mod = await import('./task-worker');

    const worker = mod.createTaskWorker() as unknown as MockWorker;
    expect(worker).toBeDefined();
    expect(worker).toBeInstanceOf(MockWorker);
    expect(worker.queueName).toBe('task-queue');
    expect(typeof worker.processor).toBe('function');
    expect(worker.opts).toMatchObject({ concurrency: 5 });
  });

  it('creates Worker with correct queue name and processor', async () => {
    const mod = await import('./task-worker');
    const worker = mod.createTaskWorker() as unknown as MockWorker;

    expect(worker.queueName).toBe('task-queue');
    expect(typeof worker.processor).toBe('function');
  });
});
