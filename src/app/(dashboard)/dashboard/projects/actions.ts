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
import {
  analyzeGitHubCodebase,
  analyzeManualCodebase,
  analyzeZipCodebase,
  reportToMarkdown,
  type CodebaseAnalysisReport,
  type CodebaseAnalysisSource,
} from '@/lib/codebase-analyzer';
import {
  createProject,
  defaultProjectMetadata,
  getProjectById,
  normalizeProjectMetadata,
  projectPriorities,
  projectStatuses,
  projectTypes,
  updateProject,
  type ProjectDeploymentMetadata,
  type ProjectInput,
} from '@/lib/data/projects';
import { buildGitHubRepoUrl, parseGitHubRepoUrl } from '@/lib/github-url';
import type { ProjectPriority, ProjectStatus, ProjectType } from '@/types/database';

export interface ProjectFormState {
  error: string | null;
  message?: string | null;
  projectId?: string | null;
}

export interface CodebaseAnalyzerState {
  error: string | null;
  message?: string | null;
  report?: CodebaseAnalysisReport | null;
}

const emptyProjectFormState: ProjectFormState = {
  error: null,
  message: null,
  projectId: null,
};

const emptyCodebaseAnalyzerState: CodebaseAnalyzerState = {
  error: null,
  message: null,
  report: null,
};

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function readLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isProjectStatus(value: string): value is ProjectStatus {
  return projectStatuses.includes(value as ProjectStatus);
}

function isProjectType(value: string): value is ProjectType {
  return projectTypes.includes(value as ProjectType);
}

function isProjectPriority(value: string): value is ProjectPriority {
  return projectPriorities.includes(value as ProjectPriority);
}

function sanitizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function readProjectMetadata(formData: FormData): ProjectDeploymentMetadata {
  const githubUrl = sanitizeUrl(readField(formData, 'githubUrl'));
  const parsedUrl = parseGitHubRepoUrl(githubUrl);
  const owner = emptyToNull(readField(formData, 'githubOwner')) ?? parsedUrl?.owner ?? null;
  const repo = emptyToNull(readField(formData, 'githubRepo')) ?? parsedUrl?.repo ?? null;
  const repoUrl = githubUrl ?? parsedUrl?.url ?? buildGitHubRepoUrl(owner, repo);

  return normalizeProjectMetadata({
    ...defaultProjectMetadata,
    next_actions: readLines(readField(formData, 'nextActions')),
    release_notes: emptyToNull(readField(formData, 'releaseNotes')),
    last_deploy_notes: emptyToNull(readField(formData, 'lastDeployNotes')),
    known_issues: emptyToNull(readField(formData, 'knownIssues')),
    rollback_notes: emptyToNull(readField(formData, 'rollbackNotes')),
    testing_checklist: emptyToNull(readField(formData, 'testingChecklist')),
    github: {
      owner,
      repo,
      default_branch: emptyToNull(readField(formData, 'githubDefaultBranch')),
      repo_url: repoUrl,
    },
  });
}

function readProjectInput(formData: FormData): ProjectInput {
  const projectType = readField(formData, 'projectType');
  const status = readField(formData, 'status');
  const priority = readField(formData, 'priority');
  const metadata = readProjectMetadata(formData);

  return {
    name: readField(formData, 'name'),
    description: emptyToNull(readField(formData, 'description')),
    projectType: isProjectType(projectType) ? projectType : 'software',
    status: isProjectStatus(status) ? status : 'planning',
    priority: isProjectPriority(priority) ? priority : 'medium',
    techStack: emptyToNull(readField(formData, 'techStack')),
    githubUrl: sanitizeUrl(readField(formData, 'githubUrl')) ?? metadata.github.repo_url,
    productionUrl: sanitizeUrl(readField(formData, 'productionUrl')),
    stagingUrl: sanitizeUrl(readField(formData, 'stagingUrl')),
    localPathNote: emptyToNull(readField(formData, 'localPathNote')),
    documentationUrl: sanitizeUrl(readField(formData, 'documentationUrl')),
    notes: emptyToNull(readField(formData, 'notes')),
    metadata,
  };
}

async function getProjectActionContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/projects');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  if (membershipResult.error) {
    return { error: membershipResult.error, supabase, user, workspace: workspaceResult.data };
  }

  if (!membershipResult.data) {
    return { error: 'Workspace membership is required to manage projects.', supabase, user, workspace: workspaceResult.data };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data };
}

function validateProjectInput(project: ProjectInput) {
  if (project.name.length < 2) {
    return 'Project name must be at least 2 characters.';
  }

  return null;
}

export async function createProjectAction(
  state: ProjectFormState = emptyProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  void state;

  const context = await getProjectActionContext();
  const project = readProjectInput(formData);
  const validationError = validateProjectInput(project);

  if (validationError) {
    return { error: validationError };
  }

  if (context.error) {
    return { error: context.error };
  }

  const result = await createProject(
    {
      ...project,
      workspaceId: context.workspace.id,
      userId: context.user.id,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not create project.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard/reports');

  return {
    error: null,
    message: 'Project created.',
    projectId: result.data.id,
  };
}

export async function updateProjectAction(
  state: ProjectFormState = emptyProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  void state;

  const projectId = readField(formData, 'projectId');

  if (!projectId) {
    return { error: 'Project ID is required.' };
  }

  const context = await getProjectActionContext();
  const project = readProjectInput(formData);
  const validationError = validateProjectInput(project);

  if (validationError) {
    return { error: validationError, projectId };
  }

  if (context.error) {
    return { error: context.error, projectId };
  }

  const existingResult = await getProjectById(projectId, context.workspace.id, context.supabase);
  const existingMetadata = normalizeProjectMetadata(existingResult.data?.metadata);
  const nextMetadata = normalizeProjectMetadata({
    ...project.metadata,
    github: {
      ...existingMetadata.github,
      ...project.metadata?.github,
    },
    codebase_analysis: existingMetadata.codebase_analysis,
    related_task_ids: existingMetadata.related_task_ids,
    related_content_item_ids: existingMetadata.related_content_item_ids,
    related_creative_asset_ids: existingMetadata.related_creative_asset_ids,
  });

  const result = await updateProject(
    {
      ...project,
      metadata: nextMetadata,
      id: projectId,
      workspaceId: context.workspace.id,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not update project.', projectId };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/reports');

  return {
    error: null,
    message: 'Project updated.',
    projectId,
  };
}

function summarizeReportForMetadata(report: CodebaseAnalysisReport): ProjectDeploymentMetadata['codebase_analysis'] {
  return {
    summary: report.summary,
    generated_at: report.generatedAt,
    source: report.source,
    source_label: report.sourceLabel,
    tech_stack: report.techStack.slice(0, 16),
    key_findings: report.potentialRisks.slice(0, 10).map((finding) => `${finding.priority}: ${finding.title}`),
    next_actions: report.recommendedNextActions.slice(0, 10),
    report_markdown: reportToMarkdown(report).slice(0, 24_000),
  };
}

async function getProjectForWorkspace(projectId: string) {
  const context = await getProjectActionContext();

  if (context.error) {
    return { error: context.error, context, project: null };
  }

  const projectResult = await getProjectById(projectId, context.workspace.id, context.supabase);

  if (projectResult.error || !projectResult.data) {
    return {
      error: projectResult.error ?? 'Project not found for this workspace.',
      context,
      project: null,
    };
  }

  return { error: null, context, project: projectResult.data };
}

export async function analyzeCodebaseAction(
  state: CodebaseAnalyzerState = emptyCodebaseAnalyzerState,
  formData: FormData
): Promise<CodebaseAnalyzerState> {
  void state;

  const projectId = readField(formData, 'projectId');
  const source = readField(formData, 'source') as CodebaseAnalysisSource;

  if (!projectId) {
    return { error: 'Project ID is required.', report: null };
  }

  const projectContext = await getProjectForWorkspace(projectId);

  if (projectContext.error || !projectContext.project) {
    return { error: projectContext.error ?? 'Project not found.', report: null };
  }

  if (source === 'manual') {
    const manualText = readField(formData, 'manualSummary');

    if (manualText.length < 20) {
      return { error: 'Paste at least a short file tree, package.json, or project summary.', report: null };
    }

    return {
      error: null,
      message: 'Manual codebase summary analyzed.',
      report: analyzeManualCodebase({
        text: manualText,
        sourceLabel: `${projectContext.project.name} manual summary`,
      }),
    };
  }

  if (source === 'github') {
    const metadata = normalizeProjectMetadata(projectContext.project.metadata);
    const owner = metadata.github.owner;
    const repo = metadata.github.repo;

    if (!owner || !repo) {
      return {
        error: 'No GitHub repository is linked to this project yet.',
        report: null,
      };
    }

    const result = await analyzeGitHubCodebase({
      owner,
      repo,
      branch: metadata.github.default_branch,
    });

    if (!result.ok) {
      return {
        error: result.error,
        report: null,
      };
    }

    return {
      error: null,
      message: 'GitHub repository analyzed read-only.',
      report: result.report,
    };
  }

  if (source === 'zip') {
    const zipFile = formData.get('zipFile');

    if (!(zipFile instanceof File) || zipFile.size === 0) {
      return { error: 'Upload a .zip file to analyze.', report: null };
    }

    const result = await analyzeZipCodebase(zipFile);

    if (!result.ok) {
      return {
        error: result.error,
        report: null,
      };
    }

    return {
      error: null,
      message: 'ZIP archive analyzed without executing code.',
      report: result.report,
    };
  }

  return {
    error: 'Choose GitHub, ZIP, or Manual analysis.',
    report: null,
  };
}

export async function saveCodebaseAnalysisAction(
  state: ProjectFormState = emptyProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  void state;

  const projectId = readField(formData, 'projectId');
  const reportJson = readField(formData, 'reportJson');
  const saveToNotes = readField(formData, 'saveToNotes') === 'true';

  if (!projectId) {
    return { error: 'Project ID is required.' };
  }

  let report: CodebaseAnalysisReport;

  try {
    report = JSON.parse(reportJson) as CodebaseAnalysisReport;
  } catch {
    return { error: 'Analysis report could not be saved.' };
  }

  const projectContext = await getProjectForWorkspace(projectId);

  if (projectContext.error || !projectContext.project) {
    return { error: projectContext.error ?? 'Project not found.', projectId };
  }

  const project = projectContext.project;
  const metadata = normalizeProjectMetadata(project.metadata);
  const reportSummary = summarizeReportForMetadata(report);
  const nextMetadata = normalizeProjectMetadata({
    ...metadata,
    codebase_analysis: reportSummary,
  });
  const noteAppend = [
    project.notes ?? '',
    '',
    'Codebase analysis summary',
    report.summary,
    '',
    'Recommended next actions:',
    ...report.recommendedNextActions.map((action) => `- ${action}`),
  ].join('\n').trim();
  const result = await updateProject(
    {
      id: project.id,
      workspaceId: projectContext.context.workspace.id,
      name: project.name,
      description: project.description,
      projectType: project.project_type,
      status: project.status,
      priority: project.priority,
      techStack: project.tech_stack,
      githubUrl: project.github_url,
      productionUrl: project.production_url,
      stagingUrl: project.staging_url,
      localPathNote: project.local_path_note,
      documentationUrl: project.documentation_url,
      notes: saveToNotes ? noteAppend : project.notes,
      metadata: nextMetadata,
    },
    projectContext.context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not save codebase analysis.', projectId };
  }

  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${project.id}`);
  revalidatePath('/dashboard/releases');

  return {
    error: null,
    message: saveToNotes ? 'Analysis saved to project metadata and notes.' : 'Analysis saved to project metadata.',
    projectId,
  };
}
