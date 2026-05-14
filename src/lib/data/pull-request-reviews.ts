import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject } from '@/types';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export type PullRequestRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PullRequestRecommendation =
  | 'safe_to_merge_after_tests'
  | 'request_changes'
  | 'needs_manual_review'
  | 'do_not_merge_yet';

export interface PullRequestReviewRecord {
  id: string;
  workspace_id: string;
  project_id: string;
  created_by: string | null;
  github_owner: string;
  github_repo: string;
  pr_number: number;
  pr_url: string;
  pr_title: string | null;
  pr_state: string | null;
  source_branch: string | null;
  target_branch: string | null;
  risk_level: PullRequestRiskLevel;
  recommendation: PullRequestRecommendation;
  review_summary: string | null;
  files_changed: string | null;
  potential_issues: string | null;
  security_notes: string | null;
  testing_checklist: string | null;
  release_notes_draft: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface UpsertPullRequestReviewInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  prState: string;
  sourceBranch: string;
  targetBranch: string;
  riskLevel: PullRequestRiskLevel;
  recommendation: PullRequestRecommendation;
  reviewSummary: string;
  filesChanged: string;
  potentialIssues: string;
  securityNotes: string;
  testingChecklist: string;
  releaseNotesDraft: string;
  metadata: JsonObject;
}

interface ReviewQuery {
  select(columns: string): ReviewQuery;
  eq(column: string, value: string | number): ReviewQuery;
  order(column: string, options: { ascending: boolean }): ReviewQuery;
  limit(count: number): Promise<{ data: PullRequestReviewRecord[] | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: PullRequestReviewRecord | null; error: { message: string } | null }>;
  upsert(value: Record<string, unknown>, options: { onConflict: string }): ReviewQuery;
  single(): Promise<{ data: PullRequestReviewRecord | null; error: { message: string } | null }>;
}

function reviewClient(client: SupabaseClient<Database>) {
  return client as unknown as {
    from(name: string): ReviewQuery;
  };
}

export async function listPullRequestReviewsForProject(
  workspaceId: string,
  projectId: string,
  client: SupabaseClient<Database>,
  limit = 20
): Promise<DataResult<PullRequestReviewRecord[]>> {
  const { data, error } = await reviewClient(client)
    .from('pull_request_reviews')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return errorDataResult([], error.message);
  return emptyDataResult(data ?? [], true);
}

export async function getPullRequestReviewById(
  id: string,
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<PullRequestReviewRecord | null>> {
  const { data, error } = await reviewClient(client)
    .from('pull_request_reviews')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function upsertPullRequestReview(
  input: UpsertPullRequestReviewInput,
  client: SupabaseClient<Database>
): Promise<DataResult<PullRequestReviewRecord | null>> {
  const { data, error } = await reviewClient(client)
    .from('pull_request_reviews')
    .upsert(
      {
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        created_by: input.userId,
        github_owner: input.owner,
        github_repo: input.repo,
        pr_number: input.prNumber,
        pr_url: input.prUrl,
        pr_title: input.prTitle,
        pr_state: input.prState,
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch,
        risk_level: input.riskLevel,
        recommendation: input.recommendation,
        review_summary: input.reviewSummary,
        files_changed: input.filesChanged,
        potential_issues: input.potentialIssues,
        security_notes: input.securityNotes,
        testing_checklist: input.testingChecklist,
        release_notes_draft: input.releaseNotesDraft,
        metadata: input.metadata,
      },
      { onConflict: 'workspace_id,project_id,github_owner,github_repo,pr_number' }
    )
    .select('*')
    .single();

  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data, true);
}
