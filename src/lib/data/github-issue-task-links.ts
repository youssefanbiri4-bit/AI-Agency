import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject } from '@/types';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface GitHubIssueTaskLink {
  id: string;
  workspace_id: string;
  project_id: string;
  task_id: string;
  github_owner: string;
  github_repo: string;
  github_issue_number: number;
  github_issue_url: string;
  github_issue_title: string | null;
  github_issue_state: string | null;
  github_labels: string[];
  metadata: JsonObject;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  task_title?: string | null;
  task_status?: string | null;
}

export interface CreateGitHubIssueTaskLinkInput {
  workspaceId: string;
  projectId: string;
  taskId: string;
  owner: string;
  repo: string;
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueState: string;
  labels: string[];
  metadata: JsonObject;
  userId: string;
}

interface LinkQuery {
  select(columns: string): LinkQuery;
  eq(column: string, value: string | number): LinkQuery;
  order(column: string, options: { ascending: boolean }): LinkQuery;
  maybeSingle(): Promise<{ data: GitHubIssueTaskLink | null; error: { message: string; code?: string } | null }>;
  insert(value: Record<string, unknown>): LinkQuery;
  single(): Promise<{ data: GitHubIssueTaskLink | null; error: { message: string; code?: string } | null }>;
}

function linkClient(client: SupabaseClient<Database>) {
  return client as unknown as {
    from(name: string): LinkQuery;
  };
}

export async function listGitHubIssueTaskLinksForProject(
  workspaceId: string,
  projectId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<GitHubIssueTaskLink[]>> {
  const query = linkClient(client)
    .from('github_issue_task_links')
    .select('*, tasks(title,status)')
    .eq('workspace_id', workspaceId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const { data, error } = await query as unknown as {
    data: GitHubIssueTaskLink[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(
    (data ?? []).map((record) => {
      const maybeTask = (record as unknown as { tasks?: { title?: string | null; status?: string | null } | null }).tasks;
      return {
        ...record,
        task_title: maybeTask?.title ?? null,
        task_status: maybeTask?.status ?? null,
      };
    }),
    true
  );
}

export async function getGitHubIssueTaskLink(
  input: {
    workspaceId: string;
    projectId: string;
    owner: string;
    repo: string;
    issueNumber: number;
  },
  client: SupabaseClient<Database>
): Promise<DataResult<GitHubIssueTaskLink | null>> {
  const { data, error } = await linkClient(client)
    .from('github_issue_task_links')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .eq('project_id', input.projectId)
    .eq('github_owner', input.owner)
    .eq('github_repo', input.repo)
    .eq('github_issue_number', input.issueNumber)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function createGitHubIssueTaskLink(
  input: CreateGitHubIssueTaskLinkInput,
  client: SupabaseClient<Database>
): Promise<DataResult<GitHubIssueTaskLink | null>> {
  const { data, error } = await linkClient(client)
    .from('github_issue_task_links')
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      task_id: input.taskId,
      github_owner: input.owner,
      github_repo: input.repo,
      github_issue_number: input.issueNumber,
      github_issue_url: input.issueUrl,
      github_issue_title: input.issueTitle,
      github_issue_state: input.issueState,
      github_labels: input.labels,
      metadata: input.metadata,
      created_by: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}
