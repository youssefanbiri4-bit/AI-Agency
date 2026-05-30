import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/queue/queues', () => ({
  dlqQueue: {
    add: vi.fn(),
  },
}));

vi.mock('@/lib/queue/redis', () => ({
  redis: {
    set: vi.fn(),
  },
}));

import { dlqQueue } from '@/lib/queue/queues';
import { redis } from '@/lib/queue/redis';
import { maybeMoveJobToDLQ } from '@/lib/queue/workers/maybe-dlq';

describe('DLQ handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes job to DLQ when attempts exhausted and idempotent', async () => {
    // simulate job
    const job: any = {
      id: 'job-1',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { taskExecutionId: 'exec-1', task_id: 'task-1', workspaceId: 'ws-1', requestId: 'r-1' },
    };

    // first call: redis.set returns 'OK'
    (redis.set as any).mockResolvedValueOnce('OK');

    await maybeMoveJobToDLQ(job, new Error('boom'));

    expect(redis.set).toHaveBeenCalled();
    expect(dlqQueue.add).toHaveBeenCalledTimes(1);

    // second call: redis.set returns null (already exists)
    (redis.set as any).mockResolvedValueOnce(null);

    await maybeMoveJobToDLQ(job, new Error('boom'));

    expect(dlqQueue.add).toHaveBeenCalledTimes(1); // unchanged
  });
});
