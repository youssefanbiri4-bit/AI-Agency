import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, TaskStatus } from '@/types';

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

    const processingStatus: TaskStatus = 'processing';

    const oldTask: Task = {
      id: 't-old',
      user_id: 'u-1',
      agent_type: 'strategy_planner',
      title: 'T1',
      description: 'D1',
      input_data: {},
      status: processingStatus,
      priority: 'Normal',
      result: null,
      n8n_execution_id: null,
      created_at: old,
      updated_at: old,
      completed_at: null,
    };

    const recentTask: Task = {
      id: 't-recent',
      user_id: 'u-1',
      agent_type: 'strategy_planner',
      title: 'T2',
      description: 'D2',
      input_data: {},
      status: processingStatus,
      priority: 'Normal',
      result: null,
      n8n_execution_id: null,
      created_at: recent,
      updated_at: recent,
      completed_at: null,
    };

    mockedList.mockResolvedValue({
      data: [oldTask, recentTask],
      error: null,
      isConfigured: true,
    });

    mockedMark.mockResolvedValue({
      data: oldTask,
      error: null,
      isConfigured: true,
    });

    const res = await runStaleProcessingRecoveryOnce({ thresholdMs: 10 * 60 * 1000 });

    expect(mockedList).toHaveBeenCalled();
    expect(mockedMark).toHaveBeenCalledTimes(1);
    expect(res.changed).toBe(1);
  });
});
