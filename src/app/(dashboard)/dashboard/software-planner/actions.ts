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
  createProject,
  getProjectById,
  normalizeProjectMetadata,
  updateProject,
  type ProjectDeploymentMetadata,
} from '@/lib/data/projects';
import { createTask } from '@/features/tasks/data/tasks';
import {
  generateSoftwarePlan,
  platformToProjectType,
  softwarePlanForProjectMetadata,
  softwarePlanToMarkdown,
  type SoftwarePlannerInput,
  type SoftwarePlannerPlatform,
  type SoftwarePlannerScope,
  type SoftwareProjectPlan,
} from '@/lib/software-planner';
import type { AgentType, JsonObject } from '@/types';

export interface SoftwarePlannerState {
  error: string | null;
  message?: string | null;
  plan?: SoftwareProjectPlan | null;
  projectId?: string | null;
  createdTaskCount?: number;
}

const emptyState: SoftwarePlannerState = {
  error: null,
  message: null,
  plan: null,
  projectId: null,
};

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(formData: FormData, key: string) {
  return readField(formData, key) === 'on' || readField(formData, key) === 'true';
}

function readMulti(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function readPlannerInput(formData: FormData): SoftwarePlannerInput {
  return {
    projectId: readField(formData, 'projectId') || null,
    projectName: readField(formData, 'projectName'),
    shortIdea: readField(formData, 'shortIdea'),
    problemToSolve: readField(formData, 'problemToSolve'),
    targetUsers: readField(formData, 'targetUsers'),
    businessGoal: readField(formData, 'businessGoal'),
    preferredTechStack: readField(formData, 'preferredTechStack'),
    platformType: (readField(formData, 'platformType') || 'saas') as SoftwarePlannerPlatform,
    scope: (readField(formData, 'scope') || 'mvp_only') as SoftwarePlannerScope,
    frontendFramework: readField(formData, 'frontendFramework'),
    backendPreference: readField(formData, 'backendPreference'),
    databasePreference: readField(formData, 'databasePreference'),
    authRequirement: readField(formData, 'authRequirement'),
    storageRequirement: readField(formData, 'storageRequirement'),
    aiRequirement: readField(formData, 'aiRequirement'),
    paymentRequirement: readField(formData, 'paymentRequirement'),
    deploymentTarget: readField(formData, 'deploymentTarget'),
    integrationsNeeded: readField(formData, 'integrationsNeeded'),
    constraints: readMulti(formData, 'constraints'),
    language: (readField(formData, 'language') || 'english') as SoftwarePlannerInput['language'],
    detailLevel: (readField(formData, 'detailLevel') || 'medium') as SoftwarePlannerInput['detailLevel'],
    includeDatabase: readBoolean(formData, 'includeDatabase'),
    includeApi: readBoolean(formData, 'includeApi'),
    includeUiPages: readBoolean(formData, 'includeUiPages'),
    includeTesting: readBoolean(formData, 'includeTesting'),
    includeDeployment: readBoolean(formData, 'includeDeployment'),
    includeTasks: readBoolean(formData, 'includeTasks'),
  };
}

async function getPlannerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/software-planner');
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
    return { error: 'Workspace membership is required to use Software Planner.', supabase, user, workspace: workspaceResult.data };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data };
}

async function readProjectForInput(projectId: string | null, context: Awaited<ReturnType<typeof getPlannerContext>>) {
  if (!projectId) return null;

  const result = await getProjectById(projectId, context.workspace.id, context.supabase);
  return result.data ?? null;
}

function parsePlan(value: string): SoftwareProjectPlan | null {
  try {
    return JSON.parse(value) as SoftwareProjectPlan;
  } catch {
    return null;
  }
}

function mergeSoftwarePlan(metadata: ProjectDeploymentMetadata, plan: SoftwareProjectPlan) {
  return normalizeProjectMetadata({
    ...metadata,
    software_plan: softwarePlanForProjectMetadata(plan),
  });
}

export async function generateSoftwarePlanAction(
  state: SoftwarePlannerState = emptyState,
  formData: FormData
): Promise<SoftwarePlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const input = readPlannerInput(formData);

  if (!input.projectName && !input.projectId) {
    return { error: 'Add a project name or select an existing project.', plan: null };
  }

  if (input.shortIdea.length < 12 && !input.projectId) {
    return { error: 'Add a clearer project idea before generating the plan.', plan: null };
  }

  const project = await readProjectForInput(input.projectId, context);
  const result = await generateSoftwarePlan(input, project);

  if (!result.ok) {
    return { error: result.error, plan: null };
  }

  return {
    error: null,
    message: 'Project plan generated.',
    plan: result.plan,
    projectId: project?.id ?? null,
  };
}

export async function saveSoftwarePlanToProjectAction(
  state: SoftwarePlannerState = emptyState,
  formData: FormData
): Promise<SoftwarePlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const projectId = readField(formData, 'projectId');
  const plan = parsePlan(readField(formData, 'planJson'));

  if (!projectId) return { error: 'Select a project before saving the plan.', plan: null };
  if (!plan) return { error: 'Plan data could not be saved.', plan: null };

  const projectResult = await getProjectById(projectId, context.workspace.id, context.supabase);
  if (!projectResult.data) return { error: projectResult.error ?? 'Project not found.', plan };

  const project = projectResult.data;
  const metadata = mergeSoftwarePlan(normalizeProjectMetadata(project.metadata), plan);
  const result = await updateProject(
    {
      id: project.id,
      workspaceId: context.workspace.id,
      name: project.name,
      description: project.description,
      projectType: project.project_type,
      status: project.status,
      priority: project.priority,
      techStack: project.tech_stack ?? plan.techStack.map((row) => row.cells[1]).join(', '),
      githubUrl: project.github_url,
      productionUrl: project.production_url,
      stagingUrl: project.staging_url,
      localPathNote: project.local_path_note,
      documentationUrl: project.documentation_url,
      notes: project.notes,
      metadata,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not save plan to project.', plan, projectId };
  }

  revalidatePath('/dashboard/projects');
  revalidatePath(`/dashboard/projects/${project.id}`);
  revalidatePath('/dashboard/software-planner');

  return { error: null, message: 'Software plan saved to project.', plan, projectId: project.id };
}

export async function createProjectFromPlanAction(
  state: SoftwarePlannerState = emptyState,
  formData: FormData
): Promise<SoftwarePlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const plan = parsePlan(readField(formData, 'planJson'));
  if (!plan) return { error: 'Plan data could not create a project.', plan: null };

  const metadata = mergeSoftwarePlan(normalizeProjectMetadata(null), plan);
  const result = await createProject(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      name: plan.projectName,
      description: plan.executiveSummary.overview,
      projectType: platformToProjectType(plan.platformType),
      status: 'planning',
      priority: 'medium',
      techStack: plan.techStack.map((row) => row.cells[1]).join(', ').slice(0, 500),
      githubUrl: null,
      productionUrl: null,
      stagingUrl: null,
      localPathNote: null,
      documentationUrl: null,
      notes: softwarePlanToMarkdown(plan).slice(0, 12_000),
      metadata,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not create project from plan.', plan };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/projects');
  revalidatePath('/dashboard/software-planner');

  return {
    error: null,
    message: 'Project record created from plan.',
    plan,
    projectId: result.data.id,
  };
}

export async function createTasksFromPlanAction(
  state: SoftwarePlannerState = emptyState,
  formData: FormData
): Promise<SoftwarePlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const plan = parsePlan(readField(formData, 'planJson'));
  const projectId = readField(formData, 'projectId');

  if (!plan) return { error: 'Plan data could not create tasks.', plan: null };
  if (!plan.taskDrafts.length) return { error: 'This plan has no task drafts enabled.', plan };

  const createdIds: string[] = [];

  for (const task of plan.taskDrafts.slice(0, 10)) {
    const result = await createTask(
      {
        workspaceId: context.workspace.id,
        userId: context.user.id,
        agentType: task.suggestedAgent as AgentType,
        title: task.title,
        description: task.description,
        priority: task.priority,
        inputData: {
          source: 'software_planner',
          project_id: projectId || null,
          phase_name: task.phaseName,
          plan_project_name: plan.projectName,
          note: 'Created as pending planning task only. No agent execution was triggered automatically.',
        } satisfies JsonObject,
      },
      context.supabase
    );

    if (result.error || !result.data) {
      return {
        error: result.error ?? 'Could not create all planning tasks.',
        plan,
        projectId: projectId || null,
        createdTaskCount: createdIds.length,
      };
    }

    createdIds.push(result.data.id);
  }

  if (projectId && createdIds.length) {
    const projectResult = await getProjectById(projectId, context.workspace.id, context.supabase);
    if (projectResult.data) {
      const project = projectResult.data;
      const metadata = normalizeProjectMetadata(project.metadata);
      const nextMetadata = normalizeProjectMetadata({
        ...metadata,
        related_task_ids: [...new Set([...metadata.related_task_ids, ...createdIds])],
      });

      await updateProject(
        {
          id: project.id,
          workspaceId: context.workspace.id,
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
          notes: project.notes,
          metadata: nextMetadata,
        },
        context.supabase
      );
    }
  }

  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/projects');
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);

  return {
    error: null,
    message: `${createdIds.length} pending planning tasks created.`,
    plan,
    projectId: projectId || null,
    createdTaskCount: createdIds.length,
  };
}
