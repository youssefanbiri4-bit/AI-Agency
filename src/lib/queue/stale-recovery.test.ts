import { describe, it, expect, vi, beforeEach } from 'vitest';

const listTasksMock = vi.fn();
const markStaleProcessingTaskFailedMock = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/features/tasks/data/tasks', () => ({
  listTasks: (...args: unknown[]) => listTasksMock(...args),
  markStaleProcessingTaskFailed: (...args: unknown[]) => markStaleProcessingTaskFailedMock(...args),
}));

describe('stale processing recovery', () => {
  beforeEach(() => {
    listTasksMock.mockReset();
    markStaleProcessingTaskFailedMock.mockReset();
  });

  it('marks stale processing tasks as failed', async () => {
    const now = Date.now();
    listTasksMock.mockResolvedValue({
      error: null,
      data: [
        {
          id: 'task-1',
          workspace_id: 'ws-1',
          updated_at: new Date(now - 20 * 60 * 1000).toISOString(), // stale for default 10min threshold
        },
      ],
    });

    markStaleProcessingTaskFailedMock.mockResolvedValue({ error: null, data: { ok: true } });

    const { runStaleProcessingRecoveryOnce } = await import('./stale-recovery');

    const result = await runStaleProcessingRecoveryOnce({ thresholdMs: 10 * 60 * 1000 });

    expect(result.changed).toBe(1);
    expect(markStaleProcessingTaskFailedMock).toHaveBeenCalledTimes(1);

    const args = markStaleProcessingTaskFailedMock.mock.calls[0]?.[0] as {
      taskId: string;
      workspaceId: string;
      errorMessage: string;
      staleBefore: string;
    };

    expect(args.taskId).toBe('task-1');
    expect(args.workspaceId).toBe('ws-1');
    expect(args.errorMessage).toContain('auto-failed');
    expect(args.staleBefore).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not mark non-stale tasks', async () => {
    const now = Date.now();
    listTasksMock.mockResolvedValue({
      error: null,
      data: [
        {
          id: 'task-2',
          workspace_id: 'ws-2',
          updated_at: new Date(now - 2 * 60 * 1000).toISOString(), // not stale
        },
      ],
    });

    const { runStaleProcessingRecoveryOnce } = await import('./stale-recovery');

    const result = await runStaleProcessingRecoveryOnce({ thresholdMs: 10 * 60 * 1000 });

    expect(result.changed).toBe(0);
    expect(markStaleProcessingTaskFailedMock).not.toHaveBeenCalled();
  });
});
