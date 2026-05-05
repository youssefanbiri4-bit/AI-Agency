import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { TaskReview } from '@/types';
import type { Database, TaskReviewRecord } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface CreateTaskReviewInput {
  workspaceId: string;
  taskId: string;
  reviewerId: string;
  rating: number;
  feedback: string;
}

export function mapTaskReviewRecordToTaskReview(record: TaskReviewRecord): TaskReview {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    task_id: record.task_id,
    reviewer_id: record.reviewer_id,
    rating: record.rating,
    feedback: record.feedback,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function listTaskReviews(
  taskId: string,
  workspaceId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<TaskReview[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  let query = client
    .from('task_reviews')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult((data ?? []).map(mapTaskReviewRecordToTaskReview), true);
}

export async function createTaskReview(
  input: CreateTaskReviewInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<TaskReview | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('task_reviews')
    .insert({
      task_id: input.taskId,
      workspace_id: input.workspaceId,
      reviewer_id: input.reviewerId,
      rating: input.rating,
      feedback: input.feedback,
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(mapTaskReviewRecordToTaskReview(data), true);
}
