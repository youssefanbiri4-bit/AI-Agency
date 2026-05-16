'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { getProjectById } from '@/lib/data/projects';
import { createRelease, releaseStatuses, releaseTypes, updateRelease, type ReleaseInput } from '@/lib/data/releases';
import { canManageReleases, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import type { ReleaseStatus, ReleaseType } from '@/types/database';

export interface ReleaseFormState {
  error: string | null;
  message?: string | null;
  releaseId?: string | null;
}

const emptyState: ReleaseFormState = { error: null, message: null, releaseId: null };

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value: string) {
  return value ? value : null;
}

function isReleaseStatus(value: string): value is ReleaseStatus {
  return releaseStatuses.includes(value as ReleaseStatus);
}

function isReleaseType(value: string): value is ReleaseType {
  return releaseTypes.includes(value as ReleaseType);
}

function readDateTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitizeUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function readReleaseInput(formData: FormData): ReleaseInput {
  const status = readField(formData, 'status');
  const releaseType = readField(formData, 'releaseType');
  return {
    projectId: emptyToNull(readField(formData, 'projectId')),
    title: readField(formData, 'title'),
    version: emptyToNull(readField(formData, 'version')),
    phaseName: emptyToNull(readField(formData, 'phaseName')),
    status: isReleaseStatus(status) ? status : 'draft',
    releaseType: isReleaseType(releaseType) ? releaseType : 'feature',
    summary: emptyToNull(readField(formData, 'summary')),
    filesChanged: emptyToNull(readField(formData, 'filesChanged')),
    featuresAdded: emptyToNull(readField(formData, 'featuresAdded')),
    fixes: emptyToNull(readField(formData, 'fixes')),
    knownIssues: emptyToNull(readField(formData, 'knownIssues')),
    testingChecklist: emptyToNull(readField(formData, 'testingChecklist')),
    rollbackNotes: emptyToNull(readField(formData, 'rollbackNotes')),
    deployUrl: sanitizeUrl(readField(formData, 'deployUrl')),
    mainProductionUrl: sanitizeUrl(readField(formData, 'mainProductionUrl')),
    buildStatus: emptyToNull(readField(formData, 'buildStatus')),
    lintStatus: emptyToNull(readField(formData, 'lintStatus')),
    typecheckStatus: emptyToNull(readField(formData, 'typecheckStatus')),
    deployStatus: emptyToNull(readField(formData, 'deployStatus')),
    deployedAt: readDateTime(readField(formData, 'deployedAt')),
    metadata: {
      tested_routes: readField(formData, 'testedRoutes'),
      warnings: readField(formData, 'warnings'),
      blockers: readField(formData, 'blockers'),
      previous_deploy_url: sanitizeUrl(readField(formData, 'previousDeployUrl')),
      safe_recovery_steps: readField(formData, 'safeRecoverySteps'),
    },
  };
}

async function getReleaseContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirectTo=/dashboard/releases');
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  if (!workspaceResult.data) redirect('/onboarding');
  const membershipResult = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  if (membershipResult.error) return { error: membershipResult.error, supabase, user, workspace: workspaceResult.data };
  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);
  if (!membershipResult.data || !canManageReleases(role)) {
    return {
      error: 'ما عندكش صلاحية لتدبير الإصدارات. Releases are restricted to workspace owners and admins.',
      supabase,
      user,
      workspace: workspaceResult.data,
    };
  }
  return { error: null, supabase, user, workspace: workspaceResult.data };
}

async function validateRelatedProject(context: Awaited<ReturnType<typeof getReleaseContext>>, projectId: string | null) {
  if (!projectId || context.error) return null;
  const projectResult = await getProjectById(projectId, context.workspace.id, context.supabase);
  if (projectResult.error) return projectResult.error;
  if (!projectResult.data) return 'Related project must belong to the active workspace.';
  return null;
}

export async function createReleaseAction(state: ReleaseFormState = emptyState, formData: FormData): Promise<ReleaseFormState> {
  void state;
  const context = await getReleaseContext();
  const input = readReleaseInput(formData);
  if (input.title.length < 2) return { error: 'Release title must be at least 2 characters.' };
  if (context.error) return { error: context.error };
  const projectError = await validateRelatedProject(context, input.projectId);
  if (projectError) return { error: projectError };
  const result = await createRelease({ ...input, workspaceId: context.workspace.id, userId: context.user.id }, context.supabase);
  if (result.error || !result.data) return { error: result.error ?? 'Could not create release.' };
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/releases');
  revalidatePath('/dashboard/reports');
  return { error: null, message: 'Release created.', releaseId: result.data.id };
}

export async function updateReleaseAction(state: ReleaseFormState = emptyState, formData: FormData): Promise<ReleaseFormState> {
  void state;
  const releaseId = readField(formData, 'releaseId');
  if (!releaseId) return { error: 'Release ID is required.' };
  const context = await getReleaseContext();
  const input = readReleaseInput(formData);
  if (input.title.length < 2) return { error: 'Release title must be at least 2 characters.', releaseId };
  if (context.error) return { error: context.error, releaseId };
  const projectError = await validateRelatedProject(context, input.projectId);
  if (projectError) return { error: projectError, releaseId };
  const result = await updateRelease({ ...input, id: releaseId, workspaceId: context.workspace.id }, context.supabase);
  if (result.error || !result.data) return { error: result.error ?? 'Could not update release.', releaseId };
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/releases');
  revalidatePath(`/dashboard/releases/${releaseId}`);
  revalidatePath('/dashboard/reports');
  return { error: null, message: 'Release updated.', releaseId };
}
