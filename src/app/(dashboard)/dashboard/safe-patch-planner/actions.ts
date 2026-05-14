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
import {
  createSafePatchPlan,
  updateSafePatchPlanStatus,
  type SafePatchPlanRecord,
} from '@/lib/data/safe-patch-plans';
import {
  defaultNoTouchSystems,
  generateSafePatchPlan,
  safePatchPlanToMarkdown,
  type SafePatchChangeType,
  type SafePatchPlan,
  type SafePatchPriority,
  type SafePatchStatus,
} from '@/lib/safe-patch-planner';
import type { JsonObject } from '@/types';

export interface SafePatchPlannerState {
  error: string | null;
  message?: string | null;
  plan?: SafePatchPlan | null;
  savedPlan?: SafePatchPlanRecord | null;
}

const emptyState: SafePatchPlannerState = {
  error: null,
  message: null,
  plan: null,
  savedPlan: null,
};

function readField(formData: FormData, key: string, maxLength = 6000) {
  const value = formData.get(key);
  return typeof value === 'string'
    ? value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
        .replace(/(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
        .trim()
        .slice(0, maxLength)
    : '';
}

function readMulti(formData: FormData, key: string) {
  const items = formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  return items.length ? items : defaultNoTouchSystems;
}

function parsePlan(value: string): SafePatchPlan | null {
  try {
    return JSON.parse(value) as SafePatchPlan;
  } catch {
    return null;
  }
}

async function getPlannerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/safe-patch-planner');
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
    return { error: 'Workspace membership is required to use Safe Patch Planner.', supabase, user, workspace: workspaceResult.data };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data };
}

export async function generateSafePatchPlanAction(
  state: SafePatchPlannerState = emptyState,
  formData: FormData
): Promise<SafePatchPlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const title = readField(formData, 'title', 180);
  const changeRequest = readField(formData, 'changeRequest');

  if (title.length < 3) {
    return { error: 'Add a clear patch title.', plan: null };
  }

  if (changeRequest.length < 12) {
    return { error: 'Describe the requested change before generating a safe plan.', plan: null };
  }

  const projectId = readField(formData, 'projectId') || null;
  const projectResult = projectId
    ? await getProjectById(projectId, context.workspace.id, context.supabase)
    : { data: null };

  const plan = await generateSafePatchPlan(
    {
      title,
      projectId,
      changeType: (readField(formData, 'changeType') || 'feature') as SafePatchChangeType,
      priority: (readField(formData, 'priority') || 'medium') as SafePatchPriority,
      changeRequest,
      currentProblem: readField(formData, 'currentProblem'),
      expectedResult: readField(formData, 'expectedResult'),
      filesOrPages: readField(formData, 'filesOrPages'),
      systemsNotToTouch: readMulti(formData, 'systemsNotToTouch'),
      riskNotes: readField(formData, 'riskNotes'),
      testingRequirements: readField(formData, 'testingRequirements'),
      sourceContext: readField(formData, 'sourceContext'),
    },
    projectResult.data ?? null
  );

  return {
    error: null,
    message: 'Safe patch plan generated.',
    plan,
  };
}

export async function saveSafePatchPlanAction(
  state: SafePatchPlannerState = emptyState,
  formData: FormData
): Promise<SafePatchPlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const plan = parsePlan(readField(formData, 'planJson', 60000));
  const projectId = readField(formData, 'projectId') || null;
  const originalRequest = readField(formData, 'changeRequest') || plan?.changeSummary.join('\n') || '';

  if (!plan) {
    return { error: 'Patch plan data could not be saved.', plan: null };
  }

  if (projectId) {
    const projectResult = await getProjectById(projectId, context.workspace.id, context.supabase);
    if (!projectResult.data) {
      return { error: projectResult.error ?? 'Project not found for this workspace.', plan };
    }
  }

  const result = await createSafePatchPlan(
    {
      workspaceId: context.workspace.id,
      projectId,
      userId: context.user.id,
      title: plan.title,
      changeRequest: originalRequest,
      changeType: plan.changeType,
      priority: plan.priority,
      riskLevel: plan.riskLevel,
      status: 'draft',
      affectedFiles: plan.affectedFiles
        .map((file) => `${file.fileOrArea} | ${file.expectedChange} | ${file.risk} | ${file.notes}`)
        .join('\n'),
      implementationPlan: plan.implementationSteps.join('\n'),
      safetyConstraints: plan.safetyConstraints.join('\n'),
      testChecklist: plan.testChecklist.join('\n'),
      rollbackPlan: plan.rollbackPlan.join('\n'),
      suggestedPrompt: plan.suggestedCodexPrompt,
      metadata: {
        plan,
        markdown: safePatchPlanToMarkdown(plan),
        ai_notes: plan.aiNotes,
      } as unknown as JsonObject,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not save patch plan.', plan };
  }

  revalidatePath('/dashboard/safe-patch-planner');
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);

  return {
    error: null,
    message: 'Safe patch plan saved.',
    plan,
    savedPlan: result.data,
  };
}

export async function updateSafePatchPlanStatusAction(
  state: SafePatchPlannerState = emptyState,
  formData: FormData
): Promise<SafePatchPlannerState> {
  void state;

  const context = await getPlannerContext();
  if (context.error) return { error: context.error, plan: null };

  const planId = readField(formData, 'planId');
  const status = readField(formData, 'status') as SafePatchStatus;

  if (!planId || !status) {
    return { error: 'Patch plan and status are required.', plan: null };
  }

  const result = await updateSafePatchPlanStatus(
    planId,
    context.workspace.id,
    status,
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not update patch plan.', plan: null };
  }

  revalidatePath('/dashboard/safe-patch-planner');
  if (result.data.project_id) revalidatePath(`/dashboard/projects/${result.data.project_id}`);

  return {
    error: null,
    message: `Patch plan marked ${status.replace(/_/g, ' ')}.`,
    savedPlan: result.data,
  };
}
