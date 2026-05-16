'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  buildAgentWorkflowDraft,
  getValidWorkflowTemplates,
  type AgentWorkflowDraft,
} from '@/lib/agent-library/workflow-builder';
import {
  buildWorkflowDiagramFromDraft,
  type WorkflowDiagramModel,
} from '@/lib/agent-library/workflow-diagram';
import { reviewAgentWorkflow } from '@/lib/agent-library/workflow-review';
import { analyzeWorkflowReadiness } from '@/lib/agent-library/workflow-readiness';
import { getAgentTemplateById } from '@/lib/agent-library/templates';
import type {
  AgentTemplateUsageActionType,
  AgentWorkflowPlaybookRecord,
  AgentWorkflowPlaybookStatus,
} from '@/types/database';
import type { JsonObject, JsonValue } from '@/types';

export interface WorkflowPlaybookStep {
  index: number;
  template_id: string;
  template_name: string;
  template_category: string;
  required_inputs: string[];
  expected_outputs: string[];
  safety_level: string;
  execution_mode: string;
}

export interface WorkflowPlaybookView {
  id: string;
  name: string;
  description: string;
  goal: string;
  notes: string;
  status: AgentWorkflowPlaybookStatus;
  isFavorite: boolean;
  lastOpenedAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  steps: WorkflowPlaybookStep[];
  templateIds: string[];
  categories: string[];
  readinessSummary: JsonObject;
  diagram: WorkflowDiagramModel | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPlaybookInput {
  name: string;
  description?: string;
  goal?: string;
  notes?: string;
  templateIds: string[];
  status?: AgentWorkflowPlaybookStatus;
  isFavorite?: boolean;
}

interface PlaybookActionResult {
  error: string | null;
  playbook?: WorkflowPlaybookView | null;
  playbookId?: string | null;
  message?: string;
}

const allowedStatuses: AgentWorkflowPlaybookStatus[] = ['draft', 'ready', 'archived'];

function cleanText(value: unknown, limit: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeStatus(value: unknown): AgentWorkflowPlaybookStatus {
  return typeof value === 'string' && allowedStatuses.includes(value as AgentWorkflowPlaybookStatus)
    ? (value as AgentWorkflowPlaybookStatus)
    : 'draft';
}

function listJson(values: string[]): JsonValue[] {
  return values.map((value) => cleanText(value, 220)).filter(Boolean);
}

function workflowToSteps(workflow: AgentWorkflowDraft): JsonValue {
  return workflow.steps.map((step) => ({
    index: step.index,
    template_id: step.template.id,
    template_name: step.template.name,
    template_category: step.template.category,
    required_inputs: listJson(step.requiredInputs),
    expected_outputs: listJson(step.expectedOutputs),
    safety_level: step.template.safety_level,
    execution_mode: step.template.execution_mode,
  }));
}

function workflowReadinessSummary(workflow: AgentWorkflowDraft): JsonObject {
  const review = reviewAgentWorkflow(workflow);
  const readiness = analyzeWorkflowReadiness(workflow, review);

  return {
    review_status: review.overall_status,
    readiness_status: readiness.readiness_status,
    readiness_score: readiness.readiness_score,
    review_summary: cleanText(review.review_summary, 800),
    dry_run_summary: cleanText(readiness.dry_run_summary, 800),
    missing_inputs: listJson(readiness.missing_inputs),
    blocked_actions: listJson(readiness.blocked_actions),
    safe_next_actions: listJson(readiness.safe_execution_steps),
  };
}

function diagramToJson(diagram: WorkflowDiagramModel): JsonObject {
  return {
    nodes: diagram.nodes.map((node) => ({ ...node })),
    edges: diagram.edges.map((edge) => ({ ...edge })),
    mermaid: diagram.mermaid,
    markdownDiagram: diagram.markdownDiagram,
    plainTextDiagram: diagram.plainTextDiagram,
  };
}

function parseSteps(value: JsonValue): WorkflowPlaybookStep[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return [];
    const row = item as JsonObject;
    const templateId = typeof row.template_id === 'string' ? row.template_id : '';
    const template = getAgentTemplateById(templateId);
    if (!template) return [];

    return [{
      index: typeof row.index === 'number' ? row.index : 1,
      template_id: template.id,
      template_name: template.name,
      template_category: template.category,
      required_inputs: template.inputs,
      expected_outputs: template.outputs,
      safety_level: template.safety_level,
      execution_mode: template.execution_mode,
    }];
  }).sort((a, b) => a.index - b.index);
}

function parseDiagram(value: JsonObject): WorkflowDiagramModel | null {
  if (
    Array.isArray(value.nodes)
    && Array.isArray(value.edges)
    && typeof value.mermaid === 'string'
    && typeof value.markdownDiagram === 'string'
    && typeof value.plainTextDiagram === 'string'
  ) {
    return value as unknown as WorkflowDiagramModel;
  }

  return null;
}

function mapPlaybookRecord(record: AgentWorkflowPlaybookRecord): WorkflowPlaybookView {
  const steps = parseSteps(record.steps);
  const templateIds = steps.map((step) => step.template_id);
  const fallbackDiagram = buildWorkflowDiagramFromDraft(buildAgentWorkflowDraft({
    name: record.name,
    goal: record.goal ?? '',
    notes: record.notes ?? '',
    templateIds,
  }));

  return {
    id: record.id,
    name: record.name,
    description: record.description ?? '',
    goal: record.goal ?? '',
    notes: record.notes ?? '',
    status: record.status,
    isFavorite: record.is_favorite,
    lastOpenedAt: record.last_opened_at,
    lastUsedAt: record.last_used_at,
    usageCount: record.usage_count,
    steps,
    templateIds,
    categories: [...new Set(steps.map((step) => step.template_category))],
    readinessSummary: record.readiness_summary,
    diagram: parseDiagram(record.diagram) ?? fallbackDiagram,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function getPlaybookContext(redirectTo = '/dashboard/agent-library/playbooks') {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  return { supabase, user, workspace: workspaceResult.data };
}

function preparePlaybookPayload(input: WorkflowPlaybookInput) {
  const templateIds = input.templateIds.map((id) => cleanText(id, 120));
  const validTemplates = getValidWorkflowTemplates(templateIds);

  if (validTemplates.length === 0) {
    return { error: 'Select at least one valid template before saving a playbook.' as const };
  }

  const workflow = buildAgentWorkflowDraft({
    name: cleanText(input.name, 140),
    goal: cleanText(input.goal, 700),
    notes: cleanText(input.notes, 2000),
    templateIds: validTemplates.map((template) => template.id),
  });
  const diagram = buildWorkflowDiagramFromDraft(workflow);
  const readinessSummary = workflowReadinessSummary(workflow);

  return {
    error: null,
    workflow,
    payload: {
      name: cleanText(input.name, 140) || workflow.name,
      description: cleanText(input.description, 500) || null,
      goal: workflow.goal,
      notes: workflow.notes || null,
      status: normalizeStatus(input.status),
      is_favorite: Boolean(input.isFavorite),
      steps: workflowToSteps(workflow),
      readiness_summary: readinessSummary,
      diagram: diagramToJson(diagram),
      metadata: {
        source: 'workflow_builder',
        execution_mode: 'draft_only',
        created_from_template_ids: workflow.steps.map((step) => step.template.id),
        safety_note: 'Saved playbook only. Does not run n8n, providers, publishing, scheduling, or spending.',
      } satisfies JsonObject,
    },
  };
}

async function trackPlaybookAction(
  actionType: AgentTemplateUsageActionType,
  workspaceId: string,
  userId: string,
  templateId: string | undefined,
  metadata: JsonObject
) {
  if (!templateId) return;
  const template = getAgentTemplateById(templateId);
  if (!template) return;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from('agent_template_usage_events').insert({
      workspace_id: workspaceId,
      user_id: userId,
      template_id: template.id,
      template_name: template.name,
      template_category: template.category,
      action_type: actionType,
      source_page: 'agent_library',
      metadata,
    });
  } catch {
    // Usage analytics are best-effort and must not block saved playbooks.
  }
}

function revalidatePlaybookPaths() {
  revalidatePath('/dashboard/agent-library');
  revalidatePath('/dashboard/agent-library/workflows');
  revalidatePath('/dashboard/agent-library/playbooks');
}

export async function saveWorkflowPlaybookAction(input: WorkflowPlaybookInput): Promise<PlaybookActionResult> {
  const prepared = preparePlaybookPayload(input);
  if (prepared.error) return { error: prepared.error, playbook: null };

  const { supabase, user, workspace } = await getPlaybookContext();
  const { data, error } = await supabase
    .from('agent_workflow_playbooks')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      ...prepared.payload,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Could not save the playbook. Apply the playbooks migration if it is not available yet.', playbook: null };
  }

  await trackPlaybookAction('save_workflow_playbook', workspace.id, user.id, prepared.workflow.steps[0]?.template.id, {
    playbook_id: data.id,
    playbook_name: data.name,
    step_count: prepared.workflow.steps.length,
  });

  revalidatePlaybookPaths();
  return { error: null, playbook: mapPlaybookRecord(data), playbookId: data.id, message: 'Playbook saved successfully' };
}

export async function updateWorkflowPlaybookAction(id: string, input: WorkflowPlaybookInput): Promise<PlaybookActionResult> {
  const playbookId = cleanText(id, 80);
  const prepared = preparePlaybookPayload(input);
  if (prepared.error) return { error: prepared.error, playbook: null };

  const { supabase, user, workspace } = await getPlaybookContext();
  const { data, error } = await supabase
    .from('agent_workflow_playbooks')
    .update({
      ...prepared.payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playbookId)
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Could not update the playbook.', playbook: null };
  }

  await trackPlaybookAction('update_workflow_playbook', workspace.id, user.id, prepared.workflow.steps[0]?.template.id, {
    playbook_id: data.id,
    playbook_name: data.name,
    step_count: prepared.workflow.steps.length,
  });

  revalidatePlaybookPaths();
  return { error: null, playbook: mapPlaybookRecord(data), playbookId: data.id, message: 'Playbook updated successfully' };
}

export async function listWorkflowPlaybooksAction(): Promise<{ data: WorkflowPlaybookView[]; error: string | null }> {
  try {
    const { supabase, workspace } = await getPlaybookContext();
    const { data, error } = await supabase
      .from('agent_workflow_playbooks')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('is_favorite', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      return { data: [], error: 'Saved playbooks are not available yet. Apply the playbooks migration to enable them.' };
    }

    return { data: (data ?? []).map(mapPlaybookRecord), error: null };
  } catch {
    return { data: [], error: 'Saved playbooks could not be loaded right now.' };
  }
}

export async function getWorkflowPlaybookAction(id: string): Promise<{ data: WorkflowPlaybookView | null; error: string | null }> {
  const playbookId = cleanText(id, 80);
  if (!playbookId) return { data: null, error: 'Playbook not found.' };

  try {
    const { supabase, user, workspace } = await getPlaybookContext('/dashboard/agent-library/workflows');
    const { data: current, error: currentError } = await supabase
      .from('agent_workflow_playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .single();

    if (currentError || !current) {
      return { data: null, error: 'Playbook not found. You can still build a workflow manually.' };
    }

    const openedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('agent_workflow_playbooks')
      .update({
        last_opened_at: openedAt,
        last_used_at: openedAt,
        usage_count: current.usage_count + 1,
      })
      .eq('id', playbookId)
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    const record = data ?? current;
    const playbook = mapPlaybookRecord(record);

    await trackPlaybookAction('open_workflow_playbook', workspace.id, user.id, playbook.templateIds[0], {
      playbook_id: playbook.id,
      playbook_name: playbook.name,
      step_count: playbook.steps.length,
    });

    return { data: playbook, error: error ? 'Playbook opened, but usage metadata could not be updated.' : null };
  } catch {
    return { data: null, error: 'Playbook could not be opened right now.' };
  }
}

export async function duplicateWorkflowPlaybookAction(id: string): Promise<PlaybookActionResult> {
  const original = await getWorkflowPlaybookAction(id);
  if (!original.data) return { error: original.error ?? 'Playbook not found.', playbook: null };

  const { supabase, user, workspace } = await getPlaybookContext();
  const duplicateInput: WorkflowPlaybookInput = {
    name: `Copy of ${original.data.name}`.slice(0, 140),
    description: original.data.description,
    goal: original.data.goal,
    notes: original.data.notes,
    templateIds: original.data.templateIds,
    status: 'draft',
    isFavorite: false,
  };
  const prepared = preparePlaybookPayload(duplicateInput);
  if (prepared.error) return { error: prepared.error, playbook: null };

  const { data, error } = await supabase
    .from('agent_workflow_playbooks')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      ...prepared.payload,
      usage_count: 0,
      last_opened_at: null,
      last_used_at: null,
    })
    .select('*')
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not duplicate the playbook.', playbook: null };

  await trackPlaybookAction('duplicate_workflow_playbook', workspace.id, user.id, prepared.workflow.steps[0]?.template.id, {
    original_playbook_id: original.data.id,
    playbook_id: data.id,
    step_count: prepared.workflow.steps.length,
  });

  revalidatePlaybookPaths();
  return { error: null, playbook: mapPlaybookRecord(data), playbookId: data.id, message: 'Playbook duplicated successfully' };
}

export async function toggleFavoritePlaybookAction(id: string): Promise<PlaybookActionResult> {
  const playbookId = cleanText(id, 80);
  const { supabase, user, workspace } = await getPlaybookContext();
  const { data: current, error: currentError } = await supabase
    .from('agent_workflow_playbooks')
    .select('*')
    .eq('id', playbookId)
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .single();

  if (currentError || !current) return { error: 'Playbook not found.', playbook: null };

  const { data, error } = await supabase
    .from('agent_workflow_playbooks')
    .update({ is_favorite: !current.is_favorite })
    .eq('id', playbookId)
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) return { error: error?.message ?? 'Could not update favorite status.', playbook: null };

  const playbook = mapPlaybookRecord(data);
  await trackPlaybookAction('favorite_workflow_playbook', workspace.id, user.id, playbook.templateIds[0], {
    playbook_id: playbook.id,
    is_favorite: playbook.isFavorite,
  });

  revalidatePlaybookPaths();
  return { error: null, playbook, playbookId: playbook.id, message: playbook.isFavorite ? 'Playbook added to favorites' : 'Playbook removed from favorites' };
}

export async function deleteWorkflowPlaybookAction(id: string): Promise<{ error: string | null; message?: string }> {
  const playbookId = cleanText(id, 80);
  const { supabase, user, workspace } = await getPlaybookContext();
  const { data: current } = await supabase
    .from('agent_workflow_playbooks')
    .select('*')
    .eq('id', playbookId)
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .single();

  const { error } = await supabase
    .from('agent_workflow_playbooks')
    .delete()
    .eq('id', playbookId)
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  if (current) {
    const playbook = mapPlaybookRecord(current);
    await trackPlaybookAction('delete_workflow_playbook', workspace.id, user.id, playbook.templateIds[0], {
      playbook_id: playbook.id,
      playbook_name: playbook.name,
    });
  }

  revalidatePlaybookPaths();
  return { error: null, message: 'Playbook deleted' };
}
