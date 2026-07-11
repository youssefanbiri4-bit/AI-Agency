/**
 * Centralized Task Actions with Production Gate + RBAC
 * (Created to satisfy production gate integration requirement)
 */

import 'server-only';
import { assertProductionGate } from '@/lib/production/gate';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { taskService } from '@/lib/tasks/task-service';
import { createTask as dataCreateTask } from '@/lib/data/tasks';
import { checkQuota, incrementUsage } from '@/lib/usage/quotas';

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

  const result = await dataCreateTask(input);

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
