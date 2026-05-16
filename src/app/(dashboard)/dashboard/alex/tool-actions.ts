'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { createTask } from '@/lib/data/tasks';
import type { JsonObject } from '@/types';
import type { TaskPriority } from '@/types/database';

export interface ConfirmAlexTaskDraftInput {
  title: string;
  description: string;
  priority?: TaskPriority;
  approvedByUser: boolean;
}

export interface ConfirmAlexTaskDraftResult {
  error: string | null;
  taskId?: string | null;
  message?: string;
}

function cleanText(value: unknown, limit: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizePriority(value: unknown): TaskPriority {
  return value === 'Low' || value === 'High' ? value : 'Normal';
}

export async function createPendingTaskFromAlexToolAction(
  input: ConfirmAlexTaskDraftInput
): Promise<ConfirmAlexTaskDraftResult> {
  if (input.approvedByUser !== true) {
    return { error: 'Explicit confirmation is required before creating a pending task.' };
  }

  const title = cleanText(input.title, 140);
  const description = cleanText(input.description, 4000);

  if (!title || !description) {
    return { error: 'Task title and description are required.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Sign in before creating a pending task.' };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (workspaceResult.error || !workspaceResult.data) {
    return { error: workspaceResult.error ?? 'No active workspace found.' };
  }

  const inputData: JsonObject = {
    source: 'alex_tool_action',
    execution_mode: 'draft_only',
    approved_by_user: true,
    safety_note:
      'Created as a pending draft task only. This action does not run n8n, publish, schedule, spend money, send email, delete data, write to GitHub, or change providers.',
  };

  const taskResult = await createTask({
    workspaceId: workspaceResult.data.id,
    userId: user.id,
    agentType: 'analytics_report',
    title,
    description,
    priority: normalizePriority(input.priority),
    inputData,
  }, supabase);

  if (taskResult.error || !taskResult.data) {
    return { error: taskResult.error ?? 'Could not create pending task.' };
  }

  revalidatePath('/dashboard/alex');
  revalidatePath('/dashboard/tasks');

  return {
    error: null,
    taskId: taskResult.data.id,
    message: `${taskResult.data.title} was created as a pending draft task.`,
  };
}
