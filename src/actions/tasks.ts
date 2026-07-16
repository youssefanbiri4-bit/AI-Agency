/**
 * Centralized Task Actions with Production Gate + RBAC
 * (Created to satisfy production gate integration requirement)
 */

import 'server-only';
import { assertProductionGate } from '@/lib/production/gate';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { taskService } from '@/features/tasks/service/task-service';
import {
  createTask as dataCreateTask,
  updateTaskExecutionState,
  updateTaskReviewStatus,
  bulkDeleteTasks as dataBulkDeleteTasks,
  bulkDuplicateTasks as dataBulkDuplicateTasks,
  bulkAssignTasks as dataBulkAssignTasks,
  type CreateTaskDraftInput,
} from '@/features/tasks/data/tasks';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { enforceQuota, incrementUsage } from '@/lib/usage/quotas';
import { escapeCsvField } from '@/lib/csv-utils';
import type { AgentType, TaskStatus } from '@/types';

export async function gatedCreateTask(input: unknown) {
  // H7: RBAC check — editor role minimum + department access
  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbacCheck.ok) {
    throw new Error(rbacCheck.error || 'Editor role required to create tasks');
  }

  const workspaceId = rbacCheck.context?.workspace.id;
  if (!workspaceId) {
    throw new Error('Workspace access required');
  }

  const userId = rbacCheck.context?.user?.id;

  // Hard limit enforcement before creation
  await enforceQuota(workspaceId, 'tasks');

  await assertProductionGate(workspaceId);

  const result = await dataCreateTask(input as CreateTaskDraftInput);

  if (result.data) {
    await incrementUsage(workspaceId, 'tasks', 1, userId);
  }

  return result;
}

export async function gatedExecuteTask(taskId: string, workspaceId: string) {
  // H7: RBAC check — operator role minimum
  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbacCheck.ok) {
    throw new Error(rbacCheck.error || 'Operator role required to execute tasks');
  }

  const userId = rbacCheck.context?.user?.id;

  await assertProductionGate(workspaceId);

  await enforceQuota(workspaceId, 'ai_generations');

  const result = await taskService.executeTask(taskId, workspaceId);

  if (result.data) {
    await incrementUsage(workspaceId, 'ai_generations', 1, userId);
  }

  return result;
}

export interface BulkSetTaskStatusResult {
  ok: boolean;
  updated: number;
  failed: number;
  message?: string;
}

const EXECUTION_STATUSES: ReadonlySet<string> = new Set(['processing', 'needs_review', 'failed']);
const REVIEW_STATUSES: ReadonlySet<string> = new Set(['pending', 'completed']);

/**
 * Bulk-update the status of many tasks in one call. Reuses the existing
 * task-state transitions (execution state vs review state) so each write
 * still goes through the data layer's rules.
 */
export async function bulkSetTaskStatus(
  taskIds: string[],
  status: TaskStatus,
): Promise<BulkSetTaskStatusResult> {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No tasks selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Operator role required.' };
  }

  const workspaceId = rbacCheck.context.workspace.id;

  let updated = 0;
  let failed = 0;

  for (const taskId of taskIds) {
    try {
      if (EXECUTION_STATUSES.has(status)) {
        await updateTaskExecutionState({
          taskId,
          workspaceId,
          status: status as 'processing' | 'needs_review' | 'failed',
          expectedCurrentStatus: undefined,
        });
      } else if (REVIEW_STATUSES.has(status)) {
        await updateTaskReviewStatus({
          taskId,
          workspaceId,
          status: status as 'pending' | 'completed',
          completedAt: status === 'completed' ? new Date().toISOString() : null,
        });
      } else {
        failed += 1;
        continue;
      }
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: failed === 0, updated, failed };
}

export interface BulkActionResult {
  ok: boolean;
  updated: number;
  failed: number;
  message?: string;
}

/**
 * Bulk-delete tasks with RBAC (operator+) and security audit logging.
 */
export async function bulkDeleteTasks(
  taskIds: string[],
): Promise<BulkActionResult> {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No tasks selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Operator role required.' };
  }

  const { workspace, user } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const result = await dataBulkDeleteTasks(
    taskIds,
    workspace.id,
    supabase,
  );

  if (result.error) {
    return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: workspace.id,
    userId: user.id,
    eventType: 'bulk_delete',
    severity: 'info',
    entityType: 'task',
    message: `Bulk deleted ${result.data.deleted} task(s).`,
    metadata: { taskIds, count: result.data.deleted },
  }).catch(() => {});

  const failed = taskIds.length - result.data.deleted;
  return { ok: failed === 0, updated: result.data.deleted, failed };
}

/**
 * Bulk-duplicate tasks with RBAC (editor+) and quota enforcement.
 */
export async function bulkDuplicateTasks(
  taskIds: string[],
): Promise<BulkActionResult> {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No tasks selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Editor role required.' };
  }

  const { workspace, user } = rbacCheck.context;

  // Hard limit enforcement before duplication
  await enforceQuota(workspace.id, 'tasks');

  const supabase = await createSupabaseServerClient();

  const result = await dataBulkDuplicateTasks(
    taskIds,
    workspace.id,
    user.id,
    supabase,
  );

  if (result.error) {
    return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
  }

  await incrementUsage(workspace.id, 'tasks', result.data.duplicated, user.id).catch(() => {});

  const failed = taskIds.length - result.data.duplicated;
  return { ok: failed === 0, updated: result.data.duplicated, failed };
}

/**
 * Bulk-assign tasks to a different agent type with RBAC (operator+).
 */
export async function bulkAssignTasks(
  taskIds: string[],
  agentType: string,
): Promise<BulkActionResult> {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No tasks selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Operator role required.' };
  }

  const { workspace, user } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const result = await dataBulkAssignTasks(
    taskIds,
    workspace.id,
    agentType as AgentType,
    supabase,
  );

  if (result.error) {
    return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: workspace.id,
    userId: user.id,
    eventType: 'bulk_assign',
    severity: 'info',
    entityType: 'task',
    message: `Bulk assigned ${result.data.updated} task(s) to ${agentType}.`,
    metadata: { taskIds, agentType, count: result.data.updated },
  }).catch(() => {});

  const failed = taskIds.length - result.data.updated;
  return { ok: failed === 0, updated: result.data.updated, failed };
}

/**
 * Bulk-export tasks as CSV or JSON.
 * Returns the formatted string which the client can trigger as a download.
 */
export async function bulkExportTasks(
  taskIds: string[],
  format: 'csv' | 'json',
): Promise<{ ok: boolean; data?: string; filename?: string; message?: string }> {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, message: 'No tasks selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, message: rbacCheck.error || 'Viewer role required.' };
  }

  const { workspace } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, agent_type, title, description, status, priority, created_at, updated_at, completed_at')
    .in('id', taskIds)
    .eq('workspace_id', workspace.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!tasks || tasks.length === 0) {
    return { ok: false, message: 'No tasks found.' };
  }

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    return {
      ok: true,
      data: JSON.stringify(tasks, null, 2),
      filename: `tasks-export-${timestamp}.json`,
    };
  }

  // CSV format
  const headers = ['ID', 'Agent Type', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
  const csvRows = [
    headers.join(','),
    ...tasks.map((task) =>
      [
        task.id,
        escapeCsvField(task.agent_type),
        escapeCsvField(task.title),
        escapeCsvField(task.description),
        task.status,
        task.priority,
        task.created_at ?? '',
        task.updated_at ?? '',
        task.completed_at ?? '',
      ].join(','),
    ),
  ];

  return {
    ok: true,
    data: csvRows.join('\n'),
    filename: `tasks-export-${timestamp}.csv`,
  };
}

