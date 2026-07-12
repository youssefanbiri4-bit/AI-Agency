import {
  createSupabaseServerClient,
  getSupabaseAdmin,
} from '@/lib/supabase-server';
import type {
  ContentStudioPublishAttemptRecord,
  TaskReviewRecord,
} from '@/types/database';
import type { TaskReview } from '@/types';

interface LooseWorkspaceQuery {
  select(columns: string): LooseWorkspaceQuery;
  eq(column: string, value: string): LooseWorkspaceQuery;
  order(column: string, options: { ascending: boolean }): LooseWorkspaceQuery;
  limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

interface LooseWorkspaceClient {
  from(table: string): LooseWorkspaceQuery;
}

type OptionalWorkspaceRow = Record<string, unknown>;

export interface OptionalWorkspaceRowsResult {
  data: OptionalWorkspaceRow[];
  error: string | null;
}

function mapTaskReviewRecord(record: TaskReviewRecord): TaskReview {
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

export async function listPublishAttempts(workspaceId: string) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return {
      data: [] as ContentStudioPublishAttemptRecord[],
      error: error ?? 'Supabase admin client is not configured.',
    };
  }

  const { data, error: selectError } = await client
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: selectError?.message ?? null,
  };
}

export async function listWorkspaceTaskReviews(workspaceId: string) {
  const { data, error } = await (await createSupabaseServerClient())
    .from('task_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return {
    data: (data ?? []).map(mapTaskReviewRecord),
    error: error?.message ?? null,
  };
}

export async function listOptionalWorkspaceRows(
  workspaceId: string,
  table: string,
  limit = 250
): Promise<OptionalWorkspaceRowsResult> {
  const client = (await createSupabaseServerClient()) as unknown as LooseWorkspaceClient;
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    data: (data ?? []).filter(
      (row): row is OptionalWorkspaceRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    ),
    error: error?.message ?? null,
  };
}
