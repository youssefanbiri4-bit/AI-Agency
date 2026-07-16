import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis } from '@/lib/queue/redis';
import { maybeMoveJobToDLQ } from '@/lib/queue/workers/maybe-dlq';

const dlqAddMock = vi.fn();

vi.mock('@/lib/queue/queues', () => ({
  getDlqQueue: () => ({
    add: (...args: unknown[]) => dlqAddMock(...args),
  }),
}));

vi.mock('@/lib/queue/redis', () => ({
  redis: {
    set: vi.fn(),
  },
}));

describe('DLQ handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dlqAddMock.mockReset();
  });

  it('pushes job to DLQ when attempts exhausted and idempotent', async () => {
    dlqAddMock.mockResolvedValue({ id: 'dlq-job-1' });

    const job = {
      id: 'job-1',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        taskExecutionId: 'exec-1',
        task_id: 'task-1',
        workspaceId: 'ws-1',
        requestId: 'r-1',
      },
    } as unknown as Parameters<typeof maybeMoveJobToDLQ>[0];

    // first call: redis.set returns 'OK'
    vi.mocked(redis.set).mockResolvedValueOnce('OK');

    await maybeMoveJobToDLQ(job, new Error('boom'));

    expect(redis.set).toHaveBeenCalled();
    expect(dlqAddMock).toHaveBeenCalledTimes(1);

    // second call: redis.set returns null (already exists)
    vi.mocked(redis.set).mockResolvedValueOnce(null);
    dlqAddMock.mockReset();

    await maybeMoveJobToDLQ(job, new Error('boom'));

    expect(dlqAddMock).not.toHaveBeenCalled(); // unchanged
  });
});
