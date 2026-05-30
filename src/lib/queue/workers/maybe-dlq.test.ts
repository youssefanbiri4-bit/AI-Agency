import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => {
  const logger = {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };

  return { logger: logger, Logger: class {} };
});

const redisSetMock = vi.fn();
const dlqAddMock = vi.fn();

vi.mock('@/lib/queue/redis', () => ({
  redis: {
    set: (...args: unknown[]) => redisSetMock(...args),
  },
}));

vi.mock('@/lib/queue/queues', () => ({
  dlqQueue: {
    add: (...args: unknown[]) => dlqAddMock(...args),
  },
  taskQueue: {},
}));

describe('maybeMoveJobToDLQ', () => {
  beforeEach(() => {
    redisSetMock.mockReset();
    dlqAddMock.mockReset();
  });

  it('retry exhaustion → DLQ insertion with full metadata', async () => {
    redisSetMock.mockResolvedValue('OK');
    dlqAddMock.mockResolvedValue({ id: 'dlq-job-1' });

    const { maybeMoveJobToDLQ } = await import('./maybe-dlq');

    const job = {
      id: 'bullmq-job-1',
      attemptsMade: 3,
      queueName: 'task-queue',
      opts: { attempts: 3 },
      data: {
        taskExecutionId: 'task-exec-1',
        task_id: 'task-1',
        workspaceId: 'workspace-1',
        requestId: 'req-1',
      },
    } as unknown as Parameters<typeof maybeMoveJobToDLQ>[0];

    const err = new Error('boom');

    await maybeMoveJobToDLQ(job, err);

    expect(redisSetMock).toHaveBeenCalledTimes(1);
    expect(redisSetMock.mock.calls[0][0]).toMatch(/^dlq:job:task-exec-1:bullmq-job-1$/);

    expect(dlqAddMock).toHaveBeenCalledTimes(1);
    const [, payload] = dlqAddMock.mock.calls[0];

    // Metadata correctness (contract)
    expect(payload.task_id).toBe('task-1');
    expect(payload.taskExecutionId).toBe('task-exec-1');
    expect(payload.workspaceId).toBe('workspace-1');

    expect(payload.jobId).toBe('bullmq-job-1');
    expect(payload.queue).toBe('task-queue');

    expect(payload.failureReason).toBe('boom');
    expect(payload.attemptsMade).toBe(3);
    expect(payload.maxAttempts).toBe(3);

    expect(payload.requestId).toBe('req-1');
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('duplicate DLQ suppression: does not enqueue when NX set returns falsy', async () => {
    redisSetMock.mockResolvedValue(null);
    dlqAddMock.mockResolvedValue({ id: 'dlq-job-ignored' });

    const { maybeMoveJobToDLQ } = await import('./maybe-dlq');

    const job = {
      id: 'bullmq-job-dup',
      attemptsMade: 5,
      queueName: 'task-queue',
      opts: { attempts: 5 },
      data: {
        taskExecutionId: 'task-exec-dup',
        task_id: 'task-dup',
        workspaceId: 'workspace-dup',
        requestId: 'req-dup',
      },
    } as unknown as Parameters<typeof maybeMoveJobToDLQ>[0];

    await maybeMoveJobToDLQ(job, new Error('boom-dup'));

    expect(redisSetMock).toHaveBeenCalledTimes(1);
    expect(dlqAddMock).not.toHaveBeenCalled();
  });
});
