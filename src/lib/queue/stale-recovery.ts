import { logger } from '@/lib/logger';
import { listTasks, markStaleProcessingTaskFailed } from '@/lib/data/tasks';

const log = logger.child('queue:stale-recovery');

export async function runStaleProcessingRecoveryOnce(options?: { thresholdMs?: number }) {
  const thresholdMs = options?.thresholdMs ?? 10 * 60 * 1000; // default 10 minutes
  const now = Date.now();

  try {
    const tasksRes = await listTasks({ status: 'processing' });
    if (tasksRes.error) {
      log.error('Failed to list processing tasks', { error: tasksRes.error });
      return { changed: 0, error: tasksRes.error };
    }

    const tasks = tasksRes.data ?? [];
    let changed = 0;

    for (const t of tasks) {
      try {
        const updatedAt = Date.parse(t.updated_at);
        if (Number.isNaN(updatedAt)) continue;

        if (updatedAt < now - thresholdMs) {
          log.info('Stale processing task detected', { task_id: t.id, workspaceId: t.workspace_id });

          const staleBefore = new Date(now - thresholdMs).toISOString();
          const res = await markStaleProcessingTaskFailed({
            taskId: t.id,
            workspaceId: t.workspace_id,
            staleBefore,
            errorMessage: 'Stale processing task auto-failed by recovery worker',
          });

          if (!res.error && res.data) {
            changed += 1;
            log.info('Stale processing task marked failed', { task_id: t.id, workspaceId: t.workspace_id });
          } else {
            log.warn('Failed to mark stale task as failed', { task_id: t.id, error: res.error });
          }
        }
      } catch (e) {
        log.error('Error processing task for stale recovery', { task_id: t.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return { changed };
  } catch (error) {
    log.error('Stale processing recovery failed', { error: error instanceof Error ? error.message : String(error) });
    return { changed: 0, error: String(error) };
  }
}

export function startStaleProcessingRecovery(intervalMs = 5 * 60 * 1000, thresholdMs?: number) {
  // Run immediately, then schedule
  void runStaleProcessingRecoveryOnce({ thresholdMs });

  const id = setInterval(() => {
    void runStaleProcessingRecoveryOnce({ thresholdMs });
  }, intervalMs);

  return () => clearInterval(id);
}
