'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { createTask } from '@/lib/data/tasks';
import type { AgentType } from '@/types';
import type { TaskPriority } from '@/types/database';

const allowedPriorities: TaskPriority[] = ['Low', 'Normal', 'High'];

export interface CreateTaskState {
  error: string | null;
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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/create-task');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
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
      workspaceId: workspaceResult.data.id,
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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/agents');
  revalidatePath(`/dashboard/agents/${agentType}`);
  revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

  redirect(`/dashboard/tasks/${taskResult.data.id}`);
}
