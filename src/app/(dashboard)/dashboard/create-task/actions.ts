'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createTask } from '@/lib/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import { canCreateTasks, getWorkspaceAccessContext } from '@/lib/workspace-permissions';
import type { AgentType } from '@/types';
import type { TaskPriority } from '@/types/database';

const allowedPriorities: TaskPriority[] = ['Low', 'Normal', 'High'];

export interface CreateTaskState {
  error: string | null;
  message?: string | null;
  taskId?: string | null;
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isTaskPriority(value: string): value is TaskPriority {
  return allowedPriorities.includes(value as TaskPriority);
}

export async function createTaskAction(
  _state: CreateTaskState,
  formData: FormData
): Promise<CreateTaskState> {
  const agentType = readField(formData, 'agentType') as AgentType;
  const title = readField(formData, 'title');
  const description = readField(formData, 'description');
  const priorityValue = readField(formData, 'priority');
  const priority = isTaskPriority(priorityValue) ? priorityValue : 'Normal';

  if (!agentType) {
    return { error: 'Choose an agent before creating the task.' };
  }

  if (title.length < 2) {
    return { error: 'Task title must be at least 2 characters.' };
  }

  if (description.length < 5) {
    return { error: 'Task description must be at least 5 characters.' };
  }

  const access = await getWorkspaceAccessContext();

  if (!access.data && access.error === 'Authentication is required.') {
    redirect('/auth/login?redirectTo=/dashboard/create-task');
  }

  if (!access.data && access.error === 'Active workspace is required.') {
    redirect('/onboarding');
  }

  if (!access.data) {
    return { error: access.error };
  }

  const { supabase, user, workspace, role } = access.data;

  if (!canCreateTasks(role)) {
    return { error: 'ما عندكش صلاحية لإنشاء المهام. Task creation is restricted for your workspace role.' };
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentType)
    .eq('is_active', true)
    .maybeSingle();

  if (agentError) {
    return { error: agentError.message };
  }

  if (!agent) {
    return { error: 'The selected agent is not available.' };
  }

  const taskResult = await createTask(
    {
      workspaceId: workspace.id,
      userId: user.id,
      agentType,
      title,
      description,
      priority,
    },
    supabase
  );

  if (taskResult.error || !taskResult.data) {
  return {
      error: taskResult.error ?? 'Task could not be created.',
    };
  }

  try {
    await createNotification(
      {
        workspaceId: workspace.id,
        userId: user.id,
        type: 'task_created',
        severity: 'info',
        title: 'Task created',
        message: `${taskResult.data.title} was created and is ready to run.`,
        relatedEntityType: 'task',
        relatedEntityId: taskResult.data.id,
        relatedUrl: `/dashboard/tasks/${taskResult.data.id}`,
        metadata: {
          category: 'task',
          task_id: taskResult.data.id,
          agent_type: agentType,
          priority,
        },
      },
      supabase
    );
  } catch {
    // Notifications are best-effort and must not block task creation.
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/agents');
  revalidatePath(`/dashboard/agents/${agentType}`);
  revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

  return {
    error: null,
    message: 'Task created.',
    taskId: taskResult.data.id,
  };
}
