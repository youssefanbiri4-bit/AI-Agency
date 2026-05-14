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
import { createTask } from '@/lib/data/tasks';
import { createRelease } from '@/lib/data/releases';
import {
  getPullRequestReviewById,
  upsertPullRequestReview,
  type PullRequestReviewRecord,
} from '@/lib/data/pull-request-reviews';
import { getGitHubPullRequestReviewContext } from '@/lib/github';
import {
  generatePullRequestReview,
  pullRequestReviewToMarkdown,
  type PullRequestReviewReport,
} from '@/lib/pull-request-assistant';
import type { AgentType, JsonObject } from '@/types';

export interface PullRequestAssistantState {
  error: string | null;
  message?: string | null;
  review?: PullRequestReviewRecord | null;
  report?: PullRequestReviewReport | null;
  taskIds?: string[];
  releaseId?: string | null;
}

const emptyState: PullRequestAssistantState = {
  error: null,
  message: null,
  review: null,
  report: null,
  taskIds: [],
  releaseId: null,
};

function readField(formData: FormData, key: string, maxLength = 2000) {
  const value = formData.get(key);
  return typeof value === 'string'
    ? value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
        .replace(/(access_token|refresh_token|client_secret|api_key|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
        .trim()
        .slice(0, maxLength)
    : '';
}

function readNumberField(formData: FormData, key: string) {
  const value = Number(readField(formData, key, 20));
  return Number.isFinite(value) ? value : 0;
}

async function getProjectActionContext(projectId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?redirectTo=/dashboard/projects/${projectId}`);

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  if (!workspaceResult.data) redirect('/onboarding');

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  if (membership.error) return { error: membership.error, supabase, user, workspace: workspaceResult.data, project: null };
  if (!membership.data) return { error: 'Workspace membership is required to review pull requests.', supabase, user, workspace: workspaceResult.data, project: null };

  const projectResult = await getProjectById(projectId, workspaceResult.data.id, supabase);
  if (projectResult.error || !projectResult.data) {
    return { error: projectResult.error ?? 'Project not found.', supabase, user, workspace: workspaceResult.data, project: null };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data, project: projectResult.data };
}

async function getReviewActionContext(reviewId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectTo=/dashboard/projects');

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  if (!workspaceResult.data) redirect('/onboarding');

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  if (membership.error) return { error: membership.error, supabase, user, workspace: workspaceResult.data, review: null, project: null };
  if (!membership.data) return { error: 'Workspace membership is required.', supabase, user, workspace: workspaceResult.data, review: null, project: null };

  const reviewResult = await getPullRequestReviewById(reviewId, workspaceResult.data.id, supabase);
  if (reviewResult.error || !reviewResult.data) {
    return { error: reviewResult.error ?? 'PR review not found.', supabase, user, workspace: workspaceResult.data, review: null, project: null };
  }

  const projectResult = await getProjectById(reviewResult.data.project_id, workspaceResult.data.id, supabase);

  return {
    error: projectResult.error,
    supabase,
    user,
    workspace: workspaceResult.data,
    review: reviewResult.data,
    project: projectResult.data,
  };
}

function reportFromReview(review: PullRequestReviewRecord): PullRequestReviewReport | null {
  const report = review.metadata?.report;
  return report && typeof report === 'object' && !Array.isArray(report) ? (report as unknown as PullRequestReviewReport) : null;
}

export async function generatePullRequestReviewAction(
  state: PullRequestAssistantState = emptyState,
  formData: FormData
): Promise<PullRequestAssistantState> {
  void state;

  const projectId = readField(formData, 'projectId', 80);
  const owner = readField(formData, 'owner', 120);
  const repo = readField(formData, 'repo', 120);
  const prNumber = readNumberField(formData, 'prNumber');

  if (!projectId || !owner || !repo || !prNumber) {
    return { error: 'Pull request details are incomplete.' };
  }

  const context = await getProjectActionContext(projectId);
  if (context.error || !context.project) return { error: context.error ?? 'Project not found.' };

  const prContext = await getGitHubPullRequestReviewContext({ owner, repo, prNumber });
  if (prContext.status !== 'ready' || !prContext.pullRequest) {
    return { error: prContext.message || 'Could not load pull request review context.' };
  }

  const report = await generatePullRequestReview(prContext, context.project);
  const markdown = pullRequestReviewToMarkdown(report);
  const reviewResult = await upsertPullRequestReview(
    {
      workspaceId: context.workspace.id,
      projectId,
      userId: context.user.id,
      owner,
      repo,
      prNumber,
      prUrl: prContext.pullRequest.htmlUrl,
      prTitle: prContext.pullRequest.title,
      prState: prContext.pullRequest.state,
      sourceBranch: prContext.pullRequest.sourceBranch,
      targetBranch: prContext.pullRequest.targetBranch,
      riskLevel: report.riskLevel,
      recommendation: report.recommendation,
      reviewSummary: report.executiveSummary.join('\n'),
      filesChanged: report.filesChanged.map((file) => `${file.file} | ${file.changeType} | ${file.risk} | ${file.notes}`).join('\n'),
      potentialIssues: report.potentialIssues.join('\n'),
      securityNotes: report.securityReview.join('\n'),
      testingChecklist: report.testingChecklist.join('\n'),
      releaseNotesDraft: report.releaseNotesDraft,
      metadata: {
        report,
        markdown,
        pr: prContext.pullRequest,
        files: prContext.files.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
        })),
        commits: prContext.commits,
        warnings: prContext.warnings,
        github_write_allowed: false,
      } as unknown as JsonObject,
    },
    context.supabase
  );

  if (reviewResult.error || !reviewResult.data) {
    return { error: reviewResult.error ?? 'Could not save PR review.', report };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/releases');
  revalidatePath('/dashboard/tasks');

  return {
    error: null,
    message: 'Pull request review generated and saved. GitHub was not modified.',
    review: reviewResult.data,
    report,
  };
}

export async function createTasksFromPullRequestReviewAction(
  state: PullRequestAssistantState = emptyState,
  formData: FormData
): Promise<PullRequestAssistantState> {
  void state;

  const reviewId = readField(formData, 'reviewId', 80);
  if (!reviewId) return { error: 'PR review is required.' };

  const context = await getReviewActionContext(reviewId);
  if (context.error || !context.review) return { error: context.error ?? 'PR review not found.' };

  const report = reportFromReview(context.review);
  const projectName = context.project?.name ?? 'Project';
  const taskSpecs: Array<{ agentType: AgentType; title: string; description: string }> = [
    {
      agentType: 'code-review-agent',
      title: `PR #${context.review.pr_number} code review follow-up`,
      description: `${context.review.pr_url}\n\nReview summary:\n${context.review.review_summary ?? 'No summary.'}\n\nFiles:\n${context.review.files_changed ?? 'No file summary.'}`,
    },
    {
      agentType: 'testing-agent',
      title: `PR #${context.review.pr_number} testing checklist`,
      description: `${context.review.pr_url}\n\nTesting checklist:\n${context.review.testing_checklist ?? 'No testing checklist.'}`,
    },
    {
      agentType: 'security-review-agent',
      title: `PR #${context.review.pr_number} security review`,
      description: `${context.review.pr_url}\n\nSecurity notes:\n${context.review.security_notes ?? 'No security notes.'}`,
    },
  ];

  if (context.review.recommendation !== 'safe_to_merge_after_tests') {
    taskSpecs.push({
      agentType: 'bug-fix-agent',
      title: `PR #${context.review.pr_number} risk follow-up`,
      description: `${context.review.pr_url}\n\nPotential issues:\n${context.review.potential_issues ?? 'No issues listed.'}`,
    });
  }

  if (report?.followUpTasks.some((task) => /doc/i.test(task))) {
    taskSpecs.push({
      agentType: 'documentation-agent',
      title: `PR #${context.review.pr_number} documentation follow-up`,
      description: `${context.review.pr_url}\n\nRelease notes draft:\n${context.review.release_notes_draft ?? 'No release notes.'}`,
    });
  }

  const taskIds: string[] = [];

  for (const spec of taskSpecs.slice(0, 5)) {
    const result = await createTask(
      {
        workspaceId: context.workspace.id,
        userId: context.user.id,
        agentType: spec.agentType,
        title: spec.title,
        description: [
          `Project: ${projectName}`,
          `Pull request: #${context.review.pr_number}`,
          spec.description,
          '',
          'This task was created from a read-only PR review. Do not modify GitHub, merge/approve/comment on the PR, deploy, run task execution automatically, expose secrets, or change provider/scheduler behavior.',
        ].join('\n'),
        priority: context.review.risk_level === 'high' || context.review.risk_level === 'critical' ? 'High' : 'Normal',
        inputData: {
          source: 'pull_request_review',
          review_id: context.review.id,
          project_id: context.review.project_id,
          github: {
            owner: context.review.github_owner,
            repo: context.review.github_repo,
            pr_number: context.review.pr_number,
            pr_url: context.review.pr_url,
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

    if (result.error || !result.data) {
      return { error: result.error ?? 'Could not create follow-up tasks.', taskIds };
    }

    taskIds.push(result.data.id);
  }

  revalidatePath('/dashboard/tasks');
  revalidatePath(`/dashboard/projects/${context.review.project_id}`);

  return {
    error: null,
    message: `${taskIds.length} pending follow-up task(s) created. Tasks were not run.`,
    taskIds,
    review: context.review,
  };
}

export async function createReleaseDraftFromPullRequestReviewAction(
  state: PullRequestAssistantState = emptyState,
  formData: FormData
): Promise<PullRequestAssistantState> {
  void state;

  const reviewId = readField(formData, 'reviewId', 80);
  if (!reviewId) return { error: 'PR review is required.' };

  const context = await getReviewActionContext(reviewId);
  if (context.error || !context.review) return { error: context.error ?? 'PR review not found.' };

  const result = await createRelease(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      projectId: context.review.project_id,
      title: `PR #${context.review.pr_number}: ${context.review.pr_title ?? 'Pull request review'}`,
      version: null,
      phaseName: 'Pull Request Review',
      status: 'draft',
      releaseType: context.review.risk_level === 'critical' ? 'security' : 'bug_fix',
      summary: context.review.release_notes_draft,
      filesChanged: context.review.files_changed,
      featuresAdded: null,
      fixes: context.review.potential_issues,
      knownIssues: context.review.potential_issues,
      testingChecklist: context.review.testing_checklist,
      rollbackNotes: 'Rollback by reverting the merged PR or using the previous known-good deployment. Do not deploy from this draft automatically.',
      deployUrl: null,
      mainProductionUrl: null,
      buildStatus: 'not_run',
      lintStatus: 'not_run',
      typecheckStatus: 'not_run',
      deployStatus: 'not_deployed',
      deployedAt: null,
      metadata: {
        source: 'pull_request_review',
        pull_request_review_id: context.review.id,
        pr_url: context.review.pr_url,
        recommendation: context.review.recommendation,
        risk_level: context.review.risk_level,
      },
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not create release draft.', review: context.review };
  }

  revalidatePath('/dashboard/releases');
  revalidatePath(`/dashboard/releases/${result.data.id}`);
  revalidatePath(`/dashboard/projects/${context.review.project_id}`);

  return {
    error: null,
    message: 'Draft release created from PR review. No deploy or GitHub merge was performed.',
    releaseId: result.data.id,
    review: context.review,
  };
}
