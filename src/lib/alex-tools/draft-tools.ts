import 'server-only';

import type { AlexDraftAction, AlexToolContext, AlexToolResult } from './types';
import { sanitizeToolText } from './read-tools';

function userText(input: unknown) {
  if (typeof input === 'string') return sanitizeToolText(input, 1200);
  if (typeof input === 'object' && input && 'message' in input) {
    return sanitizeToolText((input as { message?: unknown }).message, 1200);
  }
  return 'Draft requested from Alex conversation.';
}

function draftResult(toolId: string, toolName: string, sourceLabel: string, draft: AlexDraftAction): AlexToolResult {
  return {
    toolId,
    toolName,
    category: 'draft',
    riskLevel: 'draft_only',
    sourceLabel,
    summary: `${draft.title}: ${sanitizeToolText(draft.description, 240)}`,
    draft,
  };
}

const safetyNote = 'Draft only. Requires explicit user confirmation before saving. Does not run n8n, publish, schedule, spend money, send email, delete data, write to GitHub, or change providers.';

export async function prepareTaskDraftTool(input: unknown, _context?: AlexToolContext) {
  void _context;
  const text = userText(input);
  return draftResult('prepare_task_draft', 'Prepare Task Draft', 'Draft Task', {
    type: 'task',
    title: text.length > 80 ? `${text.slice(0, 77).trim()}...` : text || 'Alex draft task',
    description: `Draft task prepared from Alex request:\n\n${text}\n\nReview before creating a pending task.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'draft_only' },
    safetyNote,
  });
}

export async function prepareContentStudioDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_content_studio_draft', 'Prepare Content Studio Draft', 'Draft Content', {
    type: 'content_studio',
    title: 'Content Studio draft',
    description: `Draft content brief:\n\n${text}\n\nKeep as draft until manually reviewed.`,
    metadata: { source: 'alex_tool_action', status: 'draft', execution_mode: 'draft_only' },
    safetyNote,
  });
}

export async function prepareWorkflowPlanDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_workflow_plan_draft', 'Prepare Workflow Plan Draft', 'Draft Workflow Plan', {
    type: 'workflow_plan',
    title: 'Workflow plan draft',
    description: `Draft workflow plan request:\n\n${text}\n\nAdd missing inputs, review steps, safety gates, and testing checklist before use.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'draft_only' },
    safetyNote,
  });
}

export async function prepareN8nBlueprintDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_n8n_blueprint_draft', 'Prepare n8n Blueprint Draft', 'Draft n8n Blueprint', {
    type: 'n8n_blueprint',
    title: 'n8n blueprint draft',
    description: `Planning-only n8n blueprint request:\n\n${text}\n\nUse placeholders only. Do not create, edit, activate, or run n8n workflows.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'planning_only' },
    safetyNote,
  });
}

export async function prepareQualityReviewDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_quality_review_draft', 'Prepare Quality Review Draft', 'Draft Quality Review', {
    type: 'quality_review',
    title: 'Quality review draft',
    description: `Draft to review:\n\n${text}\n\nRun through Quality Review before use.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'draft_only' },
    safetyNote,
  });
}

export async function preparePlaybookDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_playbook_draft', 'Prepare Playbook Draft', 'Draft Playbook', {
    type: 'playbook',
    title: 'Playbook draft',
    description: `Draft playbook idea:\n\n${text}\n\nSave only after review. Creating tasks from a playbook must remain pending-only.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'draft_only' },
    safetyNote,
  });
}

export async function prepareFollowUpMessageDraftTool(input: unknown) {
  const text = userText(input);
  return draftResult('prepare_follow_up_message_draft', 'Prepare Follow-up Message Draft', 'Draft Follow-up', {
    type: 'follow_up_message',
    title: 'Follow-up message draft',
    description: `Draft follow-up message request:\n\n${text}\n\nDo not send automatically. Review manually before contacting anyone.`,
    metadata: { source: 'alex_tool_action', execution_mode: 'draft_only', send_status: 'not_sent' },
    safetyNote,
  });
}
