'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { createTaskReview } from '@/lib/data/reviews';
import {
  createTaskEvent,
  getTaskById,
  updateTaskReviewStatus,
} from '@/lib/data/tasks';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';

export interface ReviewTaskState {
  error: string | null;
}

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readRating(formData: FormData) {
  const rating = Number(readField(formData, 'rating'));

  if (!Number.isInteger(rating)) return 1;
  if (rating < 1) return 1;
  if (rating > 5) return 5;
  return rating;
}

export async function reviewTaskAction(
  _state: ReviewTaskState,
  formData: FormData
): Promise<ReviewTaskState> {
  const taskId = readField(formData, 'taskId');
  const intent = readField(formData, 'intent');
  const feedback = readField(formData, 'feedback');
  const rating = readRating(formData);

  if (!taskId) {
    return { error: 'A task is required before saving a review.' };
  }

  if (intent !== 'approve' && intent !== 'request_changes') {
    return { error: 'Choose whether to approve or request changes.' };
  }

  if (intent === 'request_changes' && feedback.length < 1) {
    return { error: 'Feedback is required when requesting changes.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/dashboard/review?taskId=${taskId}`)}`);
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const workspaceId = workspaceResult.data.id;
  const taskResult = await getTaskById(taskId, workspaceId, supabase);

  if (taskResult.error) {
    return { error: taskResult.error };
  }

  if (!taskResult.data) {
    return { error: 'This task is not available in the active workspace.' };
  }

  if (taskResult.data.status !== 'needs_review') {
    return { error: 'Only tasks waiting for review can be approved or sent back.' };
  }

  const reviewResult = await createTaskReview(
    {
      workspaceId,
      taskId,
      reviewerId: user.id,
      rating,
      feedback,
    },
    supabase
  );

  if (reviewResult.error || !reviewResult.data) {
    return { error: reviewResult.error ?? 'Review could not be saved.' };
  }

  const nextStatus = intent === 'approve' ? 'completed' : 'pending';
  const completedAt = intent === 'approve' ? new Date().toISOString() : null;
  const statusResult = await updateTaskReviewStatus(
    {
      taskId,
      workspaceId,
      status: nextStatus,
      completedAt,
    },
    supabase
  );

  if (statusResult.error || !statusResult.data) {
    return { error: statusResult.error ?? 'Task status could not be updated.' };
  }

  const eventResult = await createTaskEvent(
    {
      workspaceId,
      taskId,
      actorId: user.id,
      eventType: intent === 'approve' ? 'task_approved' : 'changes_requested',
      message: intent === 'approve' ? 'Task approved by reviewer' : 'Reviewer requested changes',
    },
    supabase
  );

  if (eventResult.error) {
    return { error: eventResult.error };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/review');
  revalidatePath('/dashboard/tasks');
  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath(`/dashboard/agents/${taskResult.data.agent_type}`);

  redirect(`/dashboard/tasks/${taskId}`);
}
