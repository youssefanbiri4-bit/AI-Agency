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
import { canEditContent, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  createPromptLibraryItem,
  deletePromptLibraryItem,
  getPromptLibraryItem,
  listPromptLibraryForWorkspace,
  markPromptUsed,
  promptCategories,
  promptTargetTools,
  starterPrompts,
  updatePromptFavorite,
  updatePromptLibraryItem,
  type PromptLibraryInput,
} from '@/lib/data/prompt-library';
import type { PromptCategory, PromptTargetTool } from '@/types/database';

export interface PromptActionState {
  error: string | null;
  message?: string | null;
  promptId?: string | null;
}

const emptyState: PromptActionState = { error: null, message: null, promptId: null };

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function readTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function isPromptCategory(value: string): value is PromptCategory {
  return promptCategories.includes(value as PromptCategory);
}

function isPromptTargetTool(value: string): value is PromptTargetTool {
  return promptTargetTools.includes(value as PromptTargetTool);
}

function readPromptInput(formData: FormData): PromptLibraryInput {
  const category = readField(formData, 'category');
  const targetTool = readField(formData, 'targetTool');

  return {
    title: readField(formData, 'title'),
    description: emptyToNull(readField(formData, 'description')),
    category: isPromptCategory(category) ? category : 'general',
    subcategory: emptyToNull(readField(formData, 'subcategory')),
    targetTool: isPromptTargetTool(targetTool) ? targetTool : 'general_ai_tool',
    promptText: readField(formData, 'promptText'),
    tags: readTags(readField(formData, 'tags')),
    isFavorite: formData.get('isFavorite') === 'on',
    metadata: {},
  };
}

function validatePrompt(input: PromptLibraryInput) {
  if (input.title.length < 2) return 'Prompt title must be at least 2 characters.';
  if (input.promptText.length < 5) return 'Prompt text must be at least 5 characters.';
  return null;
}

async function getPromptContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectTo=/dashboard/prompt-library');

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) redirect('/onboarding');

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  if (membershipResult.error) {
    return { error: membershipResult.error, supabase, user, workspace: workspaceResult.data, role };
  }

  if (!membershipResult.data) {
    return { error: 'Workspace membership is required to manage prompts.', supabase, user, workspace: workspaceResult.data, role };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data, role };
}

export async function createPromptAction(
  state: PromptActionState = emptyState,
  formData: FormData
): Promise<PromptActionState> {
  void state;
  const context = await getPromptContext();
  const input = readPromptInput(formData);
  const validationError = validatePrompt(input);

  if (validationError) return { error: validationError };
  if (context.error) return { error: context.error };

  if (!canEditContent(context.role)) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'prompt',
      message: 'Blocked prompt creation.',
      metadata: { role: context.role },
    });

    return { error: 'You do not have permission to create prompts.' };
  }

  const result = await createPromptLibraryItem(
    { ...input, workspaceId: context.workspace.id, userId: context.user.id },
    context.supabase
  );

  if (result.error || !result.data) return { error: result.error ?? 'Could not save prompt.' };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/prompt-library');

  return { error: null, message: 'Prompt saved.', promptId: result.data.id };
}

export async function updatePromptAction(
  state: PromptActionState = emptyState,
  formData: FormData
): Promise<PromptActionState> {
  void state;
  const id = readField(formData, 'promptId');
  if (!id) return { error: 'Prompt ID is required.' };

  const context = await getPromptContext();
  const input = readPromptInput(formData);
  const validationError = validatePrompt(input);

  if (validationError) return { error: validationError, promptId: id };
  if (context.error) return { error: context.error, promptId: id };

  if (!canEditContent(context.role)) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'prompt',
      entityId: id,
      message: 'Blocked prompt update.',
      metadata: { role: context.role },
    });

    return { error: 'You do not have permission to edit prompts.', promptId: id };
  }

  const existing = await getPromptLibraryItem(id, context.workspace.id, context.supabase);
  const result = await updatePromptLibraryItem(
    {
      ...input,
      id,
      workspaceId: context.workspace.id,
      metadata: existing.data?.metadata ?? {},
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { error: result.error ?? 'Could not update prompt.', promptId: id };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/prompt-library');
  revalidatePath(`/dashboard/prompt-library/${id}`);

  return { error: null, message: 'Prompt updated.', promptId: id };
}

export async function deletePromptAction(id: string): Promise<PromptActionState> {
  const context = await getPromptContext();
  if (context.error) return { error: context.error, promptId: id };

  if (context.role !== 'owner' && context.role !== 'admin') {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'prompt',
      entityId: id,
      message: 'Blocked prompt delete.',
      metadata: { role: context.role },
    });

    return { error: 'Only workspace owners and admins can delete prompts.', promptId: id };
  }

  const result = await deletePromptLibraryItem(id, context.workspace.id, context.supabase);
  if (result.error) return { error: result.error, promptId: id };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/prompt-library');

  return { error: null, message: 'Prompt deleted.', promptId: id };
}

export async function togglePromptFavoriteAction(
  id: string,
  isFavorite: boolean
): Promise<PromptActionState> {
  const context = await getPromptContext();
  if (context.error) return { error: context.error, promptId: id };
  if (!canEditContent(context.role)) {
    return { error: 'ما عندكش صلاحية لتعديل المفضلة. Prompt edits are restricted for your workspace role.', promptId: id };
  }

  const result = await updatePromptFavorite(id, context.workspace.id, isFavorite, context.supabase);
  if (result.error) return { error: result.error, promptId: id };

  revalidatePath('/dashboard/prompt-library');
  revalidatePath(`/dashboard/prompt-library/${id}`);

  return { error: null, message: isFavorite ? 'Prompt favorited.' : 'Prompt unfavorited.', promptId: id };
}

export async function markPromptCopiedAction(id: string): Promise<PromptActionState> {
  const context = await getPromptContext();
  if (context.error) return { error: context.error, promptId: id };
  if (!canEditContent(context.role)) {
    return { error: 'ما عندكش صلاحية لتحديث استعمال البرومبت. Prompt usage updates are restricted for your workspace role.', promptId: id };
  }

  const result = await markPromptUsed(id, context.workspace.id, context.supabase);
  if (result.error) return { error: result.error, promptId: id };

  revalidatePath('/dashboard/prompt-library');
  revalidatePath(`/dashboard/prompt-library/${id}`);

  return { error: null, message: 'Prompt copied.', promptId: id };
}

export async function importStarterPromptsAction(): Promise<PromptActionState> {
  const context = await getPromptContext();
  if (context.error) return { error: context.error };
  if (!canEditContent(context.role)) {
    return { error: 'ما عندكش صلاحية لاستيراد البرومبتات. Prompt imports are restricted for your workspace role.' };
  }

  const existing = await listPromptLibraryForWorkspace(context.workspace.id, context.supabase);
  if (existing.error) return { error: existing.error };

  const existingKeys = new Set(
    existing.data.map((prompt) => `${prompt.title.toLowerCase()}::${prompt.category}`)
  );
  let createdCount = 0;

  for (const starter of starterPrompts) {
    const key = `${starter.title.toLowerCase()}::${starter.category}`;
    if (existingKeys.has(key)) continue;

    const result = await createPromptLibraryItem(
      { ...starter, workspaceId: context.workspace.id, userId: context.user.id },
      context.supabase
    );

    if (!result.error) {
      createdCount += 1;
      existingKeys.add(key);
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/prompt-library');

  return {
    error: null,
    message: createdCount === 0 ? 'Starter prompts already imported.' : `Imported ${createdCount} starter prompts.`,
  };
}
