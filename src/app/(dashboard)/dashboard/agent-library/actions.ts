'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { createTask } from '@/lib/data/tasks';
import { createNotification } from '@/lib/data/notifications';
import { getAgentTemplateById, type TemplateCategory } from '@/lib/agent-library/templates';
import type { AgentType, JsonObject } from '@/types';
import type { TaskPriority } from '@/types/database';

type CreatedFrom = 'agent_library' | 'alex';

export interface CreateTemplateTaskInput {
  templateId: string;
  title?: string;
  userContext?: string;
  priority?: TaskPriority;
  createdFrom?: CreatedFrom;
  manualApprovalConfirmed?: boolean;
}

export interface CreateTemplateTaskResult {
  error: string | null;
  message?: string | null;
  taskId?: string | null;
}

const allowedPriorities: TaskPriority[] = ['Low', 'Normal', 'High'];

const categoryAgentMap: Record<TemplateCategory, AgentType> = {
  'Research & Strategy': 'market_research',
  'Content & Growth': 'social_media_content',
  'Sales & Operations': 'lead_qualifier',
  'Reports & Analytics': 'analytics_report',
  'Alex Assistant Skills': 'analytics_report',
  'Developer/Code Agents': 'architecture-agent',
  'n8n Workflow Ideas': 'documentation-agent',
};

function cleanText(value: unknown, limit: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizePriority(value: unknown): TaskPriority {
  return typeof value === 'string' && allowedPriorities.includes(value as TaskPriority)
    ? (value as TaskPriority)
    : 'Normal';
}

function normalizeCreatedFrom(value: unknown): CreatedFrom {
  return value === 'alex' ? 'alex' : 'agent_library';
}

function buildTaskDescription(template: NonNullable<ReturnType<typeof getAgentTemplateById>>, userContext: string) {
  const lines = [
    template.description,
    '',
    'Created from an AgentFlow Agent Library template.',
    'This task is draft-only and pending. It does not execute n8n, publish content, create ads, spend money, delete data, or write to GitHub automatically.',
  ];

  if (userContext) {
    lines.push('', 'User context:', userContext);
  }

  return lines.join('\n').trim();
}

export async function createTaskFromTemplateAction(input: CreateTemplateTaskInput): Promise<CreateTemplateTaskResult> {
  if (input.manualApprovalConfirmed !== true) {
    return { error: 'Manual confirmation is required before creating a pending task.' };
  }

  const templateId = cleanText(input.templateId, 120);
  const template = getAgentTemplateById(templateId);

  if (!template) {
    return { error: 'Template was not found.' };
  }

  const titleOverride = cleanText(input.title, 140);
  const userContext = cleanText(input.userContext, 2000);
  const priority = normalizePriority(input.priority);
  const createdFrom = normalizeCreatedFrom(input.createdFrom);
  const agentType = categoryAgentMap[template.category];

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/agent-library');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentType)
    .eq('is_active', true)
    .maybeSingle();

  if (agentError) {
    return { error: agentError.message };
  }

  if (!agent) {
    return { error: 'The mapped agent is not available in this workspace.' };
  }

  const inputData: JsonObject = {
    source: 'agent_library',
    created_from: createdFrom,
    template_id: template.id,
    template_name: template.name,
    template_category: template.category,
    recommended_for: template.recommended_for,
    inputs: template.inputs,
    outputs: template.outputs,
    suggested_prompt: template.suggested_prompt,
    review_checklist: template.review_checklist,
    safety_level: template.safety_level,
    execution_mode: 'draft_only',
    template_execution_mode: template.execution_mode,
    status_on_create: 'pending',
    ai_execution_allowed: false,
    n8n_execution_allowed: false,
    provider_execution_allowed: false,
    manual_approval_required_before_execution: true,
    user_context: userContext || null,
  };

  const taskResult = await createTask(
    {
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      agentType,
      title: titleOverride || template.name,
      description: buildTaskDescription(template, userContext),
      priority,
      inputData,
    },
    supabase
  );

  if (taskResult.error || !taskResult.data) {
    return { error: taskResult.error ?? 'Task could not be created.' };
  }

  try {
    await createNotification(
      {
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        type: 'task_created',
        severity: 'info',
        title: 'Task created from template',
        message: `${taskResult.data.title} was created as a pending draft task.`,
        relatedEntityType: 'task',
        relatedEntityId: taskResult.data.id,
        relatedUrl: `/dashboard/tasks/${taskResult.data.id}`,
        metadata: {
          category: 'task',
          task_id: taskResult.data.id,
          template_id: template.id,
          created_from: createdFrom,
          draft_only: true,
        },
      },
      supabase
    );
  } catch {
    // Notifications are best-effort and must not block safe task creation.
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/tasks');
  revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);
  revalidatePath('/dashboard/agent-library');

  return {
    error: null,
    message: 'Task created successfully',
    taskId: taskResult.data.id,
  };
}
