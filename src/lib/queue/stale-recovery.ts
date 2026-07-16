import { logger } from '@/lib/logger';
import { listTasks, markStaleProcessingTaskFailed } from '@/features/tasks/data/tasks';
import { increment } from '@/lib/monitoring/metrics';
import type { Task } from '@/types';

/**
 * Task extended with optional workspace_id from Supabase queries that include it.
 * The base Task type does not declare workspace_id, but listTasks queries select it.
 */
type TaskWithWorkspace = Task & { workspace_id?: string };

/**
 * Detect and fail tasks stuck in 'processing' status beyond the threshold.
 *
 * Queries all tasks with status='processing', checks their updated_at timestamp,
 * and marks any that exceed `thresholdMs` (default 10 min) as failed via
 * markStaleProcessingTaskFailed. Emits stale_detected_total metric per task.
 *
 * @returns Count of tasks changed and any error encountered.
 */

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
          const typed = t as TaskWithWorkspace;
          const workspaceId = typed.workspace_id ?? '';

          // correlation_id fallback for stale recovery:
          // MUST NOT set correlation_id = task_id directly.
          // Use a safe deterministic fallback that clearly indicates stale recovery context.
          const correlation_id = `stale-${t.id}`;

          increment('stale_detected_total', {
            task_id: t.id,
            workspace_id: workspaceId,
            correlation_id,
          });

          log.info('Stale processing task detected', {
            task_id: t.id,
            workspaceId: workspaceId,
            correlation_id,
          });

          const staleBefore = new Date(now - thresholdMs).toISOString();
          const res = await markStaleProcessingTaskFailed({
            taskId: t.id,
            workspaceId,
            staleBefore,
            errorMessage: 'Stale processing task auto-failed by recovery worker',
          });

          if (!res.error && res.data) {
            changed += 1;
            increment('stale_marked_total', { task_id: t.id, workspace_id: workspaceId, correlation_id });
            log.info('Stale processing task marked failed', {
              task_id: t.id,
              workspaceId: workspaceId,
              correlation_id,
            });
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
