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
  type CreateTaskDraftInput,
  bulkDeleteTasks as dataBulkDeleteTasks,
  bulkDuplicateTasks as dataBulkDuplicateTasks,
  bulkAssignTasks as dataBulkAssignTasks,
} from '@/features/tasks/data/tasks';
import { checkQuota, incrementUsage } from '@/lib/usage/quotas';
import type { TaskStatus } from '@/types';

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

  // Quota check before creation
  const quota = await checkQuota(workspaceId, 'tasks');
  if (!quota.allowed) {
    throw new Error(quota.message || 'Task quota exceeded. Please upgrade your plan.');
  }

  await assertProductionGate(workspaceId);

  const result = await dataCreateTask(input as CreateTaskDraftInput);

  if (result.data) {
    await incrementUsage(workspaceId, 'tasks', 1);
  }

  return result;
}

export async function gatedExecuteTask(taskId: string, workspaceId: string) {
  // H7: RBAC check — operator role minimum
  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'operator' });
  if (!rbacCheck.ok) {
    throw new Error(rbacCheck.error || 'Operator role required to execute tasks');
  }

  await assertProductionGate(workspaceId);

  const quota = await checkQuota(workspaceId, 'ai_generations');
  if (!quota.allowed) {
    throw new Error(quota.message || 'AI generation quota exceeded.');
  }

  const result = await taskService.executeTask(taskId, workspaceId);

  if (result.data) {
    await incrementUsage(workspaceId, 'ai_generations', 1);
  }

  return result;
}

// ── Bulk Operations ──────────────────────────────────────────────────

interface BulkActionResult {
  ok: boolean;
  updated: number;
  failed: number;
  message?: string;
}

interface BulkExportResult {
  ok: boolean;
  data?: string;
  filename?: string;
  message?: string;
}

export async function bulkSetTaskStatus(taskIds: string[], status: TaskStatus): Promise<BulkActionResult> {
  try {
    const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbacCheck.ok) {
      return { ok: false, updated: 0, failed: taskIds.length, message: rbacCheck.error || 'Editor role required' };
    }
    const workspaceId = rbacCheck.context?.workspace.id;
    if (!workspaceId) return { ok: false, updated: 0, failed: taskIds.length, message: 'Workspace access required' };

    const supabase = await (await import('@/lib/supabase-server')).createSupabaseServerClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .in('id', taskIds)
      .eq('workspace_id', workspaceId)
      .select('id');

    if (error) return { ok: false, updated: 0, failed: taskIds.length, message: error.message };
    const updated = data?.length ?? 0;
    return { ok: updated === taskIds.length, updated, failed: taskIds.length - updated };
  } catch (err) {
    return { ok: false, updated: 0, failed: taskIds.length, message: err instanceof Error ? err.message : 'Bulk status update failed' };
  }
}

export async function bulkDeleteTasks(taskIds: string[]): Promise<BulkActionResult> {
  try {
    const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbacCheck.ok) {
      return { ok: false, updated: 0, failed: taskIds.length, message: rbacCheck.error || 'Editor role required' };
    }
    const workspaceId = rbacCheck.context?.workspace.id;
    if (!workspaceId) return { ok: false, updated: 0, failed: taskIds.length, message: 'Workspace access required' };

    const supabase = await (await import('@/lib/supabase-server')).createSupabaseServerClient();
    const result = await dataBulkDeleteTasks(taskIds, workspaceId, supabase);
    if (result.error) return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
    const deleted = result.data?.deleted ?? 0;
    return { ok: deleted === taskIds.length, updated: deleted, failed: taskIds.length - deleted };
  } catch (err) {
    return { ok: false, updated: 0, failed: taskIds.length, message: err instanceof Error ? err.message : 'Bulk delete failed' };
  }
}

export async function bulkDuplicateTasks(taskIds: string[]): Promise<BulkActionResult> {
  try {
    const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbacCheck.ok) {
      return { ok: false, updated: 0, failed: taskIds.length, message: rbacCheck.error || 'Editor role required' };
    }
    const workspaceId = rbacCheck.context?.workspace.id;
    const userId = rbacCheck.context?.user.id;
    if (!workspaceId || !userId) return { ok: false, updated: 0, failed: taskIds.length, message: 'Workspace access required' };

    const supabase = await (await import('@/lib/supabase-server')).createSupabaseServerClient();
    const result = await dataBulkDuplicateTasks(taskIds, workspaceId, userId, supabase);
    if (result.error) return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
    const duplicated = result.data?.duplicated ?? 0;
    return { ok: duplicated === taskIds.length, updated: duplicated, failed: taskIds.length - duplicated };
  } catch (err) {
    return { ok: false, updated: 0, failed: taskIds.length, message: err instanceof Error ? err.message : 'Bulk duplicate failed' };
  }
}

export async function bulkAssignTasks(taskIds: string[], agentType: string): Promise<BulkActionResult> {
  try {
    const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbacCheck.ok) {
      return { ok: false, updated: 0, failed: taskIds.length, message: rbacCheck.error || 'Editor role required' };
    }
    const workspaceId = rbacCheck.context?.workspace.id;
    if (!workspaceId) return { ok: false, updated: 0, failed: taskIds.length, message: 'Workspace access required' };

    const supabase = await (await import('@/lib/supabase-server')).createSupabaseServerClient();
    const result = await dataBulkAssignTasks(taskIds, workspaceId, agentType as import('@/types').AgentType, supabase);
    if (result.error) return { ok: false, updated: 0, failed: taskIds.length, message: result.error };
    const updated = result.data?.updated ?? 0;
    return { ok: updated === taskIds.length, updated, failed: taskIds.length - updated };
  } catch (err) {
    return { ok: false, updated: 0, failed: taskIds.length, message: err instanceof Error ? err.message : 'Bulk assign failed' };
  }
}

export async function bulkExportTasks(taskIds: string[], format: 'csv' | 'json'): Promise<BulkExportResult> {
  try {
    const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (!rbacCheck.ok) {
      return { ok: false, message: rbacCheck.error || 'Viewer role required' };
    }
    const workspaceId = rbacCheck.context?.workspace.id;
    if (!workspaceId) return { ok: false, message: 'Workspace access required' };

    const supabase = await (await import('@/lib/supabase-server')).createSupabaseServerClient();
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, agent_type, created_at, updated_at')
      .in('id', taskIds)
      .eq('workspace_id', workspaceId);

    if (error) return { ok: false, message: error.message };
    if (!tasks || tasks.length === 0) return { ok: false, message: 'No tasks found' };

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return { ok: true, data: JSON.stringify(tasks, null, 2), filename: `tasks-export-${timestamp}.json` };
    }

    const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Agent Type', 'Created At', 'Updated At'];
    const escapeCsv = (v: unknown) => `\"${String(v ?? '').replace(/"/g, '""')}\"`;
    const csvRows = tasks.map((t) => headers.map((h) => escapeCsv(t[h.toLowerCase().replace(/ /g, '_') as keyof typeof t] ?? '')).join(','));
    return { ok: true, data: `${headers.join(',')}\n${csvRows.join('\n')}`, filename: `tasks-export-${timestamp}.csv` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Bulk export failed' };
  }
}
