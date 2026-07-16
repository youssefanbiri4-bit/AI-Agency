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
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  cloneMarketplaceAgent,
  createAgentBuilderAgent,
  deleteAgentBuilderAgent,
  publishAgentBuilderAgent,
  saveAgentToPromptLibrary,
  updateAgentBuilderAgent,
  type AgentBuilderExecutionMode,
  type AgentBuilderSafetyLevel,
  type AgentBuilderVisibility,
} from '@/lib/data/agent-builder';
import { getAgentTemplateById } from '@/lib/agent-library/templates';
import type { JsonObject } from '@/types';

export interface AgentBuilderActionState {
  error: string | null;
  message?: string | null;
  agentId?: string | null;
  shareSlug?: string | null;
  promptId?: string | null;
}

const emptyState: AgentBuilderActionState = {
  error: null,
  message: null,
  agentId: null,
  shareSlug: null,
  promptId: null,
};

const safetyLevels: AgentBuilderSafetyLevel[] = ['safe', 'requires_review', 'readonly'];
const executionModes: AgentBuilderExecutionMode[] = ['autonomous', 'supervised', 'manual', 'draft_only'];
const visibilities: AgentBuilderVisibility[] = ['workspace', 'marketplace'];

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

interface ParsedAgentForm {
  name: string;
  role: string;
  description: string | null;
  category: string;
  icon: string;
  accentColor: string;
  instructions: string;
  inputs: string[];
  outputs: string[];
  safetyLevel: AgentBuilderSafetyLevel;
  executionMode: AgentBuilderExecutionMode;
  reviewChecklist: string[];
  tags: string[];
  promptLibraryId: string | null;
}

function parseAgentForm(formData: FormData): ParsedAgentForm {
  const safety = readField(formData, 'safetyLevel');
  const mode = readField(formData, 'executionMode');
  const promptLibraryId = readField(formData, 'promptLibraryId');

  return {
    name: readField(formData, 'name'),
    role: readField(formData, 'role') || 'Assistant',
    description: emptyToNull(readField(formData, 'description')),
    category: readField(formData, 'category') || 'general',
    icon: readField(formData, 'icon') || 'Bot',
    accentColor: readField(formData, 'accentColor') || '#1A7A8C',
    instructions: readField(formData, 'instructions'),
    inputs: parseList(readField(formData, 'inputs')),
    outputs: parseList(readField(formData, 'outputs')),
    safetyLevel: (safetyLevels.includes(safety as AgentBuilderSafetyLevel)
      ? safety
      : 'requires_review') as AgentBuilderSafetyLevel,
    executionMode: (executionModes.includes(mode as AgentBuilderExecutionMode)
      ? mode
      : 'supervised') as AgentBuilderExecutionMode,
    reviewChecklist: parseList(readField(formData, 'reviewChecklist')),
    tags: parseList(readField(formData, 'tags')),
    promptLibraryId: promptLibraryId ? promptLibraryId : null,
  };
}

function validateAgent(input: ParsedAgentForm) {
  if (input.name.trim().length < 2) return 'Agent name must be at least 2 characters.';
  if (input.instructions.trim().length < 10) {
    return 'Instructions must be at least 10 characters.';
  }
  return null;
}

async function getAgentContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectTo=/dashboard/agent-builder');

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
    return {
      error: 'Workspace membership is required to manage agents.',
      supabase,
      user,
      workspace: workspaceResult.data,
      role,
    };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data, role };
}

export async function createAgentAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const context = await getAgentContext();
  const input = parseAgentForm(formData);
  const validationError = validateAgent(input);

  if (validationError) return { ...emptyState, error: validationError };
  if (context.error) return { ...emptyState, error: context.error };

  if (!hasPermission(context.role, 'editor')) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'agent_builder',
      message: 'Blocked agent creation.',
      metadata: { role: context.role },
    });

    return { ...emptyState, error: 'You do not have permission to create agents.' };
  }

  const result = await createAgentBuilderAgent(
    { ...input, workspaceId: context.workspace.id, userId: context.user.id },
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not save agent.' };
  }

  revalidatePath('/dashboard/agent-builder');

  return { ...emptyState, message: 'Agent saved.', agentId: result.data.id };
}

export async function updateAgentAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const id = readField(formData, 'agentId');
  if (!id) return { ...emptyState, error: 'Agent ID is required.' };

  const context = await getAgentContext();
  const input = parseAgentForm(formData);
  const validationError = validateAgent(input);

  if (validationError) return { ...emptyState, error: validationError, agentId: id };
  if (context.error) return { ...emptyState, error: context.error, agentId: id };

  if (!hasPermission(context.role, 'editor')) {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'agent_builder',
      entityId: id,
      message: 'Blocked agent update.',
      metadata: { role: context.role },
    });

    return { ...emptyState, error: 'You do not have permission to edit agents.', agentId: id };
  }

  const result = await updateAgentBuilderAgent(
    { ...input, id, workspaceId: context.workspace.id },
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not update agent.', agentId: id };
  }

  revalidatePath('/dashboard/agent-builder');

  return { ...emptyState, message: 'Agent updated.', agentId: id };
}

export async function deleteAgentAction(id: string): Promise<AgentBuilderActionState> {
  const context = await getAgentContext();
  if (context.error) return { ...emptyState, error: context.error, agentId: id };

  if (context.role !== 'owner' && context.role !== 'admin') {
    await logSecurityAuditEvent({
      supabase: context.supabase,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'agent_builder',
      entityId: id,
      message: 'Blocked agent delete.',
      metadata: { role: context.role },
    });

    return { ...emptyState, error: 'Only workspace owners and admins can delete agents.', agentId: id };
  }

  const result = await deleteAgentBuilderAgent(id, context.workspace.id, context.supabase);
  if (result.error) return { ...emptyState, error: result.error, agentId: id };

  revalidatePath('/dashboard/agent-builder');

  return { ...emptyState, message: 'Agent deleted.', agentId: id };
}

export async function publishTemplateAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const id = readField(formData, 'agentId');
  const visibility = readField(formData, 'visibility');
  if (!id) return { ...emptyState, error: 'Agent ID is required.' };

  const context = await getAgentContext();
  if (context.error) return { ...emptyState, error: context.error, agentId: id };

  if (!hasPermission(context.role, 'editor')) {
    return { ...emptyState, error: 'You do not have permission to publish templates.', agentId: id };
  }

  const normalizedVisibility = (visibilities.includes(visibility as AgentBuilderVisibility)
    ? visibility
    : 'marketplace') as AgentBuilderVisibility;

  const result = await publishAgentBuilderAgent(
    id,
    context.workspace.id,
    normalizedVisibility,
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not publish template.', agentId: id };
  }

  revalidatePath('/dashboard/agent-builder');
  revalidatePath('/dashboard/agent-builder/gallery');

  return {
    ...emptyState,
    message:
      normalizedVisibility === 'marketplace'
        ? 'Published to Marketplace.'
        : 'Saved as a workspace template.',
    agentId: id,
    shareSlug: result.data.share_slug ?? null,
  };
}

export async function saveAgentToPromptLibraryAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const id = readField(formData, 'agentId');
  const name = readField(formData, 'name');
  const instructions = readField(formData, 'instructions');
  const description = emptyToNull(readField(formData, 'description'));
  const tags = parseList(readField(formData, 'tags'));

  if (!instructions.trim()) return { ...emptyState, error: 'Agent instructions are required.' };

  const context = await getAgentContext();
  if (context.error) return { ...emptyState, error: context.error, agentId: id };

  if (!hasPermission(context.role, 'editor')) {
    return { ...emptyState, error: 'You do not have permission to edit prompts.', agentId: id };
  }

  const result = await saveAgentToPromptLibrary(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      name: name || 'Agent instructions',
      instructions,
      description,
      tags,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not save to Prompt Library.', agentId: id };
  }

  revalidatePath('/dashboard/prompt-library');

  return {
    ...emptyState,
    message: 'Saved to Prompt Library.',
    agentId: id,
    promptId: result.data.id,
  };
}

export async function createAgentFromTemplateAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const templateId = readField(formData, 'templateId');
  if (!templateId) return { ...emptyState, error: 'Template ID is required.' };

  const template = getAgentTemplateById(templateId);
  if (!template) return { ...emptyState, error: 'Template was not found.' };

  const context = await getAgentContext();
  if (context.error) return { ...emptyState, error: context.error };

  if (!hasPermission(context.role, 'editor')) {
    return { ...emptyState, error: 'You do not have permission to create agents.' };
  }

  const result = await createAgentBuilderAgent(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      name: template.name,
      role: 'Assistant',
      description: template.description,
      category: String(template.category),
      icon: 'Bot',
      accentColor: '#1A7A8C',
      instructions: template.suggested_prompt,
      inputs: template.inputs,
      outputs: template.outputs,
      safetyLevel: template.safety_level,
      executionMode: template.execution_mode,
      reviewChecklist: template.review_checklist,
      tags: ['from-template', template.category],
      promptLibraryId: null,
      isTemplate: false,
      visibility: 'workspace',
      metadata: { source_template_id: template.id } as JsonObject,
    },
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not create agent from template.' };
  }

  revalidatePath('/dashboard/agent-builder');

  return { ...emptyState, message: 'Agent created from template.', agentId: result.data.id };
}

export async function cloneSharedAgentAction(
  state: AgentBuilderActionState = emptyState,
  formData: FormData
): Promise<AgentBuilderActionState> {
  void state;
  const slug = readField(formData, 'slug');
  if (!slug) return { ...emptyState, error: 'Template slug is required.' };

  const context = await getAgentContext();
  if (context.error) return { ...emptyState, error: context.error };

  if (!hasPermission(context.role, 'editor')) {
    return { ...emptyState, error: 'You do not have permission to create agents.' };
  }

  const { getAgentBuilderAgentBySlug } = await import('@/lib/data/agent-builder');
  const sourceResult = await getAgentBuilderAgentBySlug(slug, context.supabase);
  if (sourceResult.error || !sourceResult.data) {
    return { ...emptyState, error: sourceResult.error ?? 'Shared template was not found.' };
  }

  const result = await cloneMarketplaceAgent(
    sourceResult.data,
    context.workspace.id,
    context.user.id,
    context.supabase
  );

  if (result.error || !result.data) {
    return { ...emptyState, error: result.error ?? 'Could not clone template.' };
  }

  revalidatePath('/dashboard/agent-builder');

  return { ...emptyState, message: 'Template cloned to your workspace.', agentId: result.data.id };
}
