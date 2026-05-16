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
import { buildAgentWorkflowDraft } from '@/lib/agent-library/workflow-builder';
import type { TemplateCategory } from '@/lib/agent-library/templates';
import type { AgentType, JsonObject } from '@/types';
import type { TaskPriority } from '@/types/database';

export interface CreateWorkflowTasksInput {
  workflowName: string;
  goal: string;
  notes?: string;
  templateIds: string[];
  priority?: TaskPriority;
  manualApprovalConfirmed?: boolean;
}

export interface CreateWorkflowTasksResult {
  error: string | null;
  taskIds: string[];
  message?: string;
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

export async function createPendingTasksFromWorkflowAction(
  input: CreateWorkflowTasksInput
): Promise<CreateWorkflowTasksResult> {
  if (input.manualApprovalConfirmed !== true) {
    return { error: 'Manual workflow review confirmation is required before creating pending tasks.', taskIds: [] };
  }

  const workflow = buildAgentWorkflowDraft({
    name: cleanText(input.workflowName, 140),
    goal: cleanText(input.goal, 600),
    notes: cleanText(input.notes, 2000),
    templateIds: input.templateIds.map((id) => cleanText(id, 120)),
  });

  if (workflow.steps.length === 0) {
    return { error: 'Select at least one valid template before creating tasks.', taskIds: [] };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/agent-library/workflows');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const workspaceId = workspaceResult.data.id;
  const priority = normalizePriority(input.priority);
  const taskIds: string[] = [];

  for (const step of workflow.steps) {
    const agentType = categoryAgentMap[step.template.category];
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentType)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError) {
      return { error: agentError.message, taskIds };
    }

    if (!agent) {
      return { error: `Mapped agent is not available for ${step.template.name}.`, taskIds };
    }

    const inputData: JsonObject = {
      source: 'agent_workflow_builder',
      workflow_name: workflow.name,
      workflow_goal: workflow.goal,
      workflow_step_index: step.index,
      template_id: step.template.id,
      template_name: step.template.name,
      template_category: step.template.category,
      execution_mode: 'draft_only',
      required_inputs: step.requiredInputs,
      expected_outputs: step.expectedOutputs,
      suggested_prompt: step.template.suggested_prompt,
      review_checklist: step.reviewChecklist,
      safety_level: step.template.safety_level,
      template_execution_mode: step.template.execution_mode,
      workflow_notes: workflow.notes || null,
      status_on_create: 'pending',
      ai_execution_allowed: false,
      n8n_execution_allowed: false,
      provider_execution_allowed: false,
      manual_approval_required_before_execution: true,
    };

    const taskResult = await createTask(
      {
        workspaceId,
        userId: user.id,
        agentType,
        title: `${workflow.name}: Step ${step.index} - ${step.template.name}`,
        description: [
          step.description,
          '',
          `Workflow goal: ${workflow.goal}`,
          'Created from Agent Workflow Builder as a pending draft task only.',
          'This does not run n8n, publish content, create ads, spend money, delete data, or change webhooks automatically.',
          workflow.notes ? `\nWorkflow notes:\n${workflow.notes}` : '',
        ].join('\n').trim(),
        priority,
        inputData,
      },
      supabase
    );

    if (taskResult.error || !taskResult.data) {
      return { error: taskResult.error ?? `Could not create task for ${step.template.name}.`, taskIds };
    }

    taskIds.push(taskResult.data.id);
  }

  try {
    await createNotification(
      {
        workspaceId,
        userId: user.id,
        type: 'task_created',
        severity: 'info',
        title: 'Workflow tasks created',
        message: `${taskIds.length} pending draft tasks were created from ${workflow.name}.`,
        relatedEntityType: 'task',
        relatedEntityId: taskIds[0] ?? null,
        relatedUrl: '/dashboard/tasks',
        metadata: {
          category: 'task',
          source: 'agent_workflow_builder',
          workflow_name: workflow.name,
          task_count: taskIds.length,
          draft_only: true,
        },
      },
      supabase
    );
  } catch {
    // Notifications are best-effort and must not block safe workflow task creation.
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/tasks');
  revalidatePath('/dashboard/agent-library');
  revalidatePath('/dashboard/agent-library/workflows');

  return {
    error: null,
    taskIds,
    message: `${taskIds.length} pending tasks created successfully.`,
  };
}
