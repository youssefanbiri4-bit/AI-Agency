'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { getProjectById } from '@/lib/data/projects';
import { createTask } from '@/features/tasks/data/tasks';
import {
  createGitHubIssueTaskLink,
  getGitHubIssueTaskLink,
  type GitHubIssueTaskLink,
} from '@/lib/data/github-issue-task-links';
import type { AgentType, JsonObject } from '@/types';
import type { TaskPriority } from '@/types/database';

export interface GitHubIssueTaskState {
  error: string | null;
  message?: string | null;
  taskId?: string | null;
  link?: GitHubIssueTaskLink | null;
}

const emptyState: GitHubIssueTaskState = {
  error: null,
  message: null,
  taskId: null,
  link: null,
};

function readField(formData: FormData, key: string, maxLength = 12000) {
  const value = formData.get(key);
  return typeof value === 'string'
    ? value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
        .replace(/token\s+[A-Za-z0-9._~+/=-]+/gi, 'token [redacted]')
        .replace(/(access_token|refresh_token|client_secret|api_key|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
        .trim()
        .slice(0, maxLength)
    : '';
}

function readNumberField(formData: FormData, key: string) {
  const value = Number(readField(formData, key, 20));
  return Number.isFinite(value) ? value : 0;
}

function readLabels(formData: FormData) {
  return readField(formData, 'labels', 2000)
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function labelHaystack(labels: string[], title: string, body: string) {
  return [...labels, title, body].join(' ').toLowerCase();
}

function suggestPriority(labels: string[], title: string, body: string): TaskPriority {
  const haystack = labelHaystack(labels, title, body);
  if (/critical|urgent|security|vulnerability|incident|sev[ -]?1|p0|p1/.test(haystack)) return 'High';
  if (/bug|broken|error|crash|failing|regression/.test(haystack)) return 'High';
  return 'Normal';
}

function suggestAgent(labels: string[], title: string, body: string): AgentType {
  const haystack = labelHaystack(labels, title, body);
  if (/security|vulnerability|auth|rls|token|secret/.test(haystack)) return 'security-review-agent';
  if (/doc|documentation|readme|guide/.test(haystack)) return 'documentation-agent';
  if (/database|supabase|sql|migration|rls|schema/.test(haystack)) return 'database-agent';
  if (/ui|ux|design|frontend|layout|responsive|css/.test(haystack)) return 'ui-ux-review-agent';
  if (/test|testing|qa|coverage|playwright|jest/.test(haystack)) return 'testing-agent';
  if (/deploy|vercel|build|ci|release|production/.test(haystack)) return 'deployment-agent';
  if (/refactor|architecture|architecture|structure/.test(haystack)) return 'architecture-agent';
  if (/bug|error|crash|broken|fix|runtime|type/.test(haystack)) return 'bug-fix-agent';
  return 'code-review-agent';
}

async function getActionContext(projectId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=/dashboard/projects/${projectId}`);
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  if (membership.error) {
    return { error: membership.error, supabase, user, workspace: workspaceResult.data, project: null };
  }

  if (!membership.data) {
    return { error: 'Workspace membership is required to import GitHub issues.', supabase, user, workspace: workspaceResult.data, project: null };
  }

  const projectResult = await getProjectById(projectId, workspaceResult.data.id, supabase);
  if (projectResult.error || !projectResult.data) {
    return { error: projectResult.error ?? 'Project not found.', supabase, user, workspace: workspaceResult.data, project: null };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data, project: projectResult.data };
}

export async function createTaskFromGitHubIssueAction(
  state: GitHubIssueTaskState = emptyState,
  formData: FormData
): Promise<GitHubIssueTaskState> {
  void state;

  const projectId = readField(formData, 'projectId', 80);
  const owner = readField(formData, 'owner', 120);
  const repo = readField(formData, 'repo', 120);
  const issueNumber = readNumberField(formData, 'issueNumber');
  const issueTitle = readField(formData, 'issueTitle', 280);
  const issueState = readField(formData, 'issueState', 40) || 'open';
  const issueUrl = readField(formData, 'issueUrl', 500);
  const issueBody = readField(formData, 'issueBody');
  const author = readField(formData, 'author', 160);
  const labels = readLabels(formData);

  if (!projectId || !owner || !repo || !issueNumber || !issueTitle || !issueUrl) {
    return { error: 'GitHub issue details are incomplete.' };
  }

  const context = await getActionContext(projectId);
  if (context.error || !context.project) {
    return { error: context.error ?? 'Project not found.' };
  }

  const existing = await getGitHubIssueTaskLink(
    {
      workspaceId: context.workspace.id,
      projectId,
      owner,
      repo,
      issueNumber,
    },
    context.supabase
  );

  if (existing.error) {
    return { error: existing.error };
  }

  if (existing.data) {
    return {
      error: 'This GitHub issue is already linked to an AgentFlow task.',
      taskId: existing.data.task_id,
      link: existing.data,
    };
  }

  const priority = suggestPriority(labels, issueTitle, issueBody);
  const agentType = suggestAgent(labels, issueTitle, issueBody);
  const taskTitle = `[GitHub #${issueNumber}] ${issueTitle}`.slice(0, 180);
  const taskDescription = [
    `Project: ${context.project.name}`,
    `GitHub issue: #${issueNumber}`,
    `Issue URL: ${issueUrl}`,
    `State: ${issueState}`,
    `Author: ${author || 'unknown'}`,
    `Labels: ${labels.length ? labels.join(', ') : 'none'}`,
    '',
    'Issue body:',
    issueBody || 'No issue body provided.',
    '',
    'Requested output:',
    '- Analyze the issue and propose the safest next steps.',
    '- Identify likely affected areas/files before any implementation.',
    '- Include risk level, test checklist, and rollback notes.',
    '- Do not edit code, push commits, create pull requests, deploy, close/comment/modify GitHub issues, run task execution, trigger n8n, expose secrets, or change provider/scheduler behavior.',
    '',
    'Review issue content before running this task. Do not store secrets in tasks.',
  ].join('\n');

  const taskResult = await createTask(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      agentType,
      title: taskTitle,
      description: taskDescription,
      priority,
      inputData: {
        source: 'github_issue',
        project_id: projectId,
        project_name: context.project.name,
        github: {
          owner,
          repo,
          issue_number: issueNumber,
          issue_url: issueUrl,
          issue_title: issueTitle,
          issue_state: issueState,
          labels,
          author,
        },
        safety: {
          github_write_allowed: false,
          task_execution_allowed: false,
          n8n_triggered: false,
        },
      } as unknown as JsonObject,
    },
    context.supabase
  );

  if (taskResult.error || !taskResult.data) {
    return { error: taskResult.error ?? 'Could not create task from issue.' };
  }

  const linkResult = await createGitHubIssueTaskLink(
    {
      workspaceId: context.workspace.id,
      projectId,
      taskId: taskResult.data.id,
      owner,
      repo,
      issueNumber,
      issueUrl,
      issueTitle,
      issueState,
      labels,
      userId: context.user.id,
      metadata: {
        imported_from: 'project_github_issues_panel',
        suggested_agent: agentType,
        suggested_priority: priority,
        author,
      },
    },
    context.supabase
  );

  if (linkResult.error) {
    return {
      error: linkResult.error,
      taskId: taskResult.data.id,
    };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/tasks');
  revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

  return {
    error: null,
    message: 'Pending task created from GitHub issue. GitHub was not modified and the task was not run.',
    taskId: taskResult.data.id,
    link: linkResult.data,
  };
}
