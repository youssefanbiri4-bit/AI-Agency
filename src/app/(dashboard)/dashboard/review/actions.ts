'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createTaskReview } from '@/lib/data/reviews';
import { createNotification } from '@/lib/data/notifications';
import {
  createTaskEvent,
  getTaskById,
  updateTaskReviewStatus,
} from '@/features/tasks/data/tasks';
import { getRBACContext, hasPermission } from '@/lib/auth/rbac';

export interface ReviewTaskState {
  error: string | null;
  message?: string | null;
  taskId?: string | null;
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

  const access = await getRBACContext();

  if (!access.data && access.error === 'Authentication is required.') {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/dashboard/review?taskId=${taskId}`)}`);
  }

  if (!access.data && access.error === 'Active workspace is required.') {
    redirect('/onboarding');
  }

  if (!access.data) {
    return { error: access.error };
  }

  const { supabase, user, workspace, role } = access.data;

  if (!hasPermission(role, 'editor')) {
    return { error: 'ما عندكش صلاحية لمراجعة المهام. Task review is restricted for your workspace role.' };
  }

  const workspaceId = workspace.id;
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

  try {
    await createNotification(
      {
        workspaceId,
        userId: taskResult.data.user_id,
        type: intent === 'approve' ? 'review_approved' : 'review_changes_requested',
        severity: intent === 'approve' ? 'success' : 'warning',
        title: intent === 'approve' ? 'Review approved' : 'Changes requested',
        message:
          intent === 'approve'
            ? `${taskResult.data.title} was approved and marked completed.`
            : `${taskResult.data.title} needs changes before completion.`,
        relatedEntityType: 'review',
        relatedEntityId: taskId,
        relatedUrl: `/dashboard/tasks/${taskId}`,
        metadata: {
          category: 'review',
          task_id: taskId,
          review_id: reviewResult.data.id,
          intent,
        },
      },
      supabase
    );
  } catch {
    // Notifications must not affect review approval behavior.
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/review');
  revalidatePath('/dashboard/tasks');
  revalidatePath(`/dashboard/tasks/${taskId}`);
  revalidatePath(`/dashboard/agents/${taskResult.data.agent_type}`);

  return {
    error: null,
    message: intent === 'approve' ? 'Review approved.' : 'Changes requested.',
    taskId,
  };
}
