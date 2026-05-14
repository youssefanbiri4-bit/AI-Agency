import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject, JsonValue } from '@/types';
import type {
  Database,
  ProjectPriority,
  ProjectRecord,
  ProjectStatus,
  ProjectType,
} from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';
import { buildGitHubRepoUrl, parseGitHubRepoUrl } from '@/lib/github-url';

type ProjectClient = SupabaseClient<Database>;

export interface ProjectDeploymentMetadata extends JsonObject {
  next_actions: string[];
  release_notes: string | null;
  last_deploy_notes: string | null;
  known_issues: string | null;
  rollback_notes: string | null;
  testing_checklist: string | null;
  github: {
    owner: string | null;
    repo: string | null;
    default_branch: string | null;
    repo_url: string | null;
    latest_commit_summary: string | null;
    open_issues_count: number | null;
    open_pull_requests_count: number | null;
    last_checked_at: string | null;
  };
  codebase_analysis: {
    summary: string | null;
    generated_at: string | null;
    source: string | null;
    source_label: string | null;
    tech_stack: string[];
    key_findings: string[];
    next_actions: string[];
    report_markdown: string | null;
  };
  software_plan: {
    summary: string | null;
    generated_at: string | null;
    source: string | null;
    project_name: string | null;
    platform_type: string | null;
    scope: string | null;
    tech_stack: string[];
    phases: string[];
    next_actions: string[];
    report_markdown: string | null;
  };
  related_task_ids: string[];
  related_content_item_ids: string[];
  related_creative_asset_ids: string[];
}

export interface ProjectInput {
  name: string;
  description: string | null;
  projectType: ProjectType;
  status: ProjectStatus;
  priority: ProjectPriority;
  techStack: string | null;
  githubUrl: string | null;
  productionUrl: string | null;
  stagingUrl: string | null;
  localPathNote: string | null;
  documentationUrl: string | null;
  notes: string | null;
  metadata?: ProjectDeploymentMetadata;
}

export interface CreateProjectInput extends ProjectInput {
  workspaceId: string;
  userId: string;
}

export interface UpdateProjectInput extends ProjectInput {
  id: string;
  workspaceId: string;
}

export const projectStatuses: ProjectStatus[] = [
  'planning',
  'active',
  'paused',
  'needs_review',
  'ready_to_deploy',
  'deployed',
  'maintenance',
  'archived',
];

export const projectTypes: ProjectType[] = [
  'software',
  'SaaS',
  'website',
  'automation',
  'marketing_campaign',
  'AI_tool',
  'internal_system',
  'documentation',
];

export const projectPriorities: ProjectPriority[] = ['low', 'medium', 'high', 'urgent'];

export const defaultProjectMetadata: ProjectDeploymentMetadata = {
  next_actions: [],
  release_notes: null,
  last_deploy_notes: null,
  known_issues: null,
  rollback_notes: null,
  testing_checklist: null,
  github: {
    owner: null,
    repo: null,
    default_branch: null,
    repo_url: null,
    latest_commit_summary: null,
    open_issues_count: null,
    open_pull_requests_count: null,
    last_checked_at: null,
  },
  codebase_analysis: {
    summary: null,
    generated_at: null,
    source: null,
    source_label: null,
    tech_stack: [],
    key_findings: [],
    next_actions: [],
    report_markdown: null,
  },
  software_plan: {
    summary: null,
    generated_at: null,
    source: null,
    project_name: null,
    platform_type: null,
    scope: null,
    tech_stack: [],
    phases: [],
    next_actions: [],
    report_markdown: null,
  },
  related_task_ids: [],
  related_content_item_ids: [],
  related_creative_asset_ids: [],
};

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cleanJsonObject(value: Record<string, JsonValue | undefined | null>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
  );
}

export function buildProjectSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function formatProjectStatus(status: ProjectStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatProjectType(type: ProjectType) {
  const labels: Record<ProjectType, string> = {
    software: 'Software',
    SaaS: 'SaaS',
    website: 'Website',
    automation: 'Automation',
    marketing_campaign: 'Marketing Campaign',
    AI_tool: 'AI Tool',
    internal_system: 'Internal System',
    documentation: 'Documentation',
  };

  return labels[type];
}

export function normalizeProjectMetadata(value: unknown): ProjectDeploymentMetadata {
  const raw = readObject(value);
  const github = readObject(raw.github);
  const codebaseAnalysis = readObject(raw.codebase_analysis);
  const softwarePlan = readObject(raw.software_plan);
  const parsedGithubUrl = parseGitHubRepoUrl(readString(github.repo_url) ?? readString(raw.github_url));
  const owner = readString(github.owner) ?? parsedGithubUrl?.owner ?? null;
  const repo = readString(github.repo) ?? parsedGithubUrl?.repo ?? null;

  return {
    ...defaultProjectMetadata,
    next_actions: readStringList(raw.next_actions),
    release_notes: readString(raw.release_notes),
    last_deploy_notes: readString(raw.last_deploy_notes),
    known_issues: readString(raw.known_issues),
    rollback_notes: readString(raw.rollback_notes),
    testing_checklist: readString(raw.testing_checklist),
    github: {
      owner,
      repo,
      default_branch: readString(github.default_branch),
      repo_url: readString(github.repo_url) ?? parsedGithubUrl?.url ?? buildGitHubRepoUrl(owner, repo),
      latest_commit_summary: readString(github.latest_commit_summary),
      open_issues_count: readNumber(github.open_issues_count),
      open_pull_requests_count: readNumber(github.open_pull_requests_count),
      last_checked_at: readString(github.last_checked_at),
    },
    codebase_analysis: {
      summary: readString(codebaseAnalysis.summary),
      generated_at: readString(codebaseAnalysis.generated_at),
      source: readString(codebaseAnalysis.source),
      source_label: readString(codebaseAnalysis.source_label),
      tech_stack: readStringList(codebaseAnalysis.tech_stack),
      key_findings: readStringList(codebaseAnalysis.key_findings),
      next_actions: readStringList(codebaseAnalysis.next_actions),
      report_markdown: readString(codebaseAnalysis.report_markdown),
    },
    software_plan: {
      summary: readString(softwarePlan.summary),
      generated_at: readString(softwarePlan.generated_at),
      source: readString(softwarePlan.source),
      project_name: readString(softwarePlan.project_name),
      platform_type: readString(softwarePlan.platform_type),
      scope: readString(softwarePlan.scope),
      tech_stack: readStringList(softwarePlan.tech_stack),
      phases: readStringList(softwarePlan.phases),
      next_actions: readStringList(softwarePlan.next_actions),
      report_markdown: readString(softwarePlan.report_markdown),
    },
    related_task_ids: readStringList(raw.related_task_ids),
    related_content_item_ids: readStringList(raw.related_content_item_ids),
    related_creative_asset_ids: readStringList(raw.related_creative_asset_ids),
  };
}

export function serializeProjectMetadata(metadata: ProjectDeploymentMetadata): JsonObject {
  return cleanJsonObject({
    next_actions: metadata.next_actions,
    release_notes: metadata.release_notes,
    last_deploy_notes: metadata.last_deploy_notes,
    known_issues: metadata.known_issues,
    rollback_notes: metadata.rollback_notes,
    testing_checklist: metadata.testing_checklist,
    github: metadata.github,
    codebase_analysis: metadata.codebase_analysis,
    software_plan: metadata.software_plan,
    related_task_ids: metadata.related_task_ids,
    related_content_item_ids: metadata.related_content_item_ids,
    related_creative_asset_ids: metadata.related_creative_asset_ids,
  });
}

export function getProjectHealth(project: ProjectRecord) {
  const metadata = normalizeProjectMetadata(project.metadata);

  if (project.status === 'needs_review') {
    return { label: 'Needs review', detail: 'Review blockers and notes before moving forward.' };
  }

  if (project.status === 'ready_to_deploy') {
    return { label: 'Ready to deploy', detail: 'Confirm deployment notes and testing checklist.' };
  }

  if (project.status === 'deployed') {
    return { label: 'Deployed', detail: project.production_url ? 'Production URL is available.' : 'Add the production URL.' };
  }

  if (!project.github_url) {
    return { label: 'Missing GitHub URL', detail: 'Add the repository URL for traceability.' };
  }

  if (!project.production_url) {
    return { label: 'Missing production URL', detail: 'Add the production URL when available.' };
  }

  if (metadata.related_task_ids.length === 0) {
    return { label: 'No tasks linked', detail: 'Create a project task to connect execution work.' };
  }

  return { label: 'Organized', detail: 'Core project references are in place.' };
}

export async function listProjectsForWorkspace(
  workspaceId: string,
  client: ProjectClient = supabase as ProjectClient
): Promise<DataResult<ProjectRecord[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}

export async function getProjectById(
  projectId: string,
  workspaceId: string,
  client: ProjectClient = supabase as ProjectClient
): Promise<DataResult<ProjectRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function createProject(
  input: CreateProjectInput,
  client: ProjectClient = supabase as ProjectClient
): Promise<DataResult<ProjectRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('projects')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      name: input.name,
      slug: buildProjectSlug(input.name) || null,
      description: input.description,
      project_type: input.projectType,
      status: input.status,
      priority: input.priority,
      tech_stack: input.techStack,
      github_url: input.githubUrl,
      production_url: input.productionUrl,
      staging_url: input.stagingUrl,
      local_path_note: input.localPathNote,
      documentation_url: input.documentationUrl,
      notes: input.notes,
      metadata: serializeProjectMetadata(input.metadata ?? defaultProjectMetadata),
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateProject(
  input: UpdateProjectInput,
  client: ProjectClient = supabase as ProjectClient
): Promise<DataResult<ProjectRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('projects')
    .update({
      name: input.name,
      slug: buildProjectSlug(input.name) || null,
      description: input.description,
      project_type: input.projectType,
      status: input.status,
      priority: input.priority,
      tech_stack: input.techStack,
      github_url: input.githubUrl,
      production_url: input.productionUrl,
      staging_url: input.stagingUrl,
      local_path_note: input.localPathNote,
      documentation_url: input.documentationUrl,
      notes: input.notes,
      metadata: serializeProjectMetadata(input.metadata ?? defaultProjectMetadata),
    })
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}
