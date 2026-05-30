import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/data/tasks', () => ({
  listTasks: vi.fn(),
  markStaleProcessingTaskFailed: vi.fn(),
}));

import { runStaleProcessingRecoveryOnce } from '@/lib/queue/stale-recovery';
import { listTasks, markStaleProcessingTaskFailed } from '@/lib/data/tasks';

const mockedList = vi.mocked(listTasks);
const mockedMark = vi.mocked(markStaleProcessingTaskFailed);

describe('stale processing recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks stale processing tasks as failed and ignores active ones', async () => {
    const now = Date.now();
    const old = new Date(now - 20 * 60 * 1000).toISOString(); // 20 minutes ago
    const recent = new Date(now - 2 * 60 * 1000).toISOString(); // 2 minutes ago

    mockedList.mockResolvedValue({ data: [
      { id: 't-old', workspace_id: 'w-1', updated_at: old },
      { id: 't-recent', workspace_id: 'w-1', updated_at: recent },
    ], error: null, isConfigured: true } as any);

    mockedMark.mockResolvedValue({ data: { id: 't-old' }, error: null } as any);

    const res = await runStaleProcessingRecoveryOnce({ thresholdMs: 10 * 60 * 1000 });

    expect(mockedList).toHaveBeenCalled();
    expect(mockedMark).toHaveBeenCalledTimes(1);
    expect(res.changed).toBe(1);
  });
});
