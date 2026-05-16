import type { AgentWorkflowDraft } from './workflow-builder';
import type { WorkflowReviewResult } from './workflow-review';

export type WorkflowReadinessStatus =
  | 'ready_for_draft_tasks'
  | 'needs_inputs'
  | 'blocked'
  | 'review_required';

export interface WorkflowReadinessResult {
  readiness_status: WorkflowReadinessStatus;
  readiness_score: number;
  dry_run_summary: string;
  required_inputs: string[];
  missing_inputs: string[];
  provider_requirements: string[];
  safe_execution_steps: string[];
  blocked_actions: string[];
  approval_requirements: string[];
  estimated_outputs: string[];
  task_payload_preview: Array<{
    title: string;
    template_id: string;
    status: 'pending';
    execution_mode: 'draft_only';
  }>;
  content_studio_handoff_preview: string[];
  n8n_plan_preview: string[];
  safety_notes: string[];
}

function mapStatus(review: WorkflowReviewResult): WorkflowReadinessStatus {
  if (review.overall_status === 'blocked') return 'blocked';
  if (review.overall_status === 'risky') return 'review_required';
  if (review.overall_status === 'needs_inputs') return 'needs_inputs';
  return 'ready_for_draft_tasks';
}

export function analyzeWorkflowReadiness(
  workflow: AgentWorkflowDraft,
  review: WorkflowReviewResult
): WorkflowReadinessResult {
  const contentSteps = workflow.steps.filter((step) => step.template.category === 'Content & Growth');
  const n8nSteps = workflow.steps.filter((step) => step.template.category === 'n8n Workflow Ideas');

  return {
    readiness_status: mapStatus(review),
    readiness_score: review.readiness_score,
    dry_run_summary: workflow.steps.length
      ? `Dry run preview: ${workflow.steps.length} pending draft task${workflow.steps.length === 1 ? '' : 's'} would be prepared. No n8n, provider, publishing, scheduling, spending, or database mutation is performed by dry run.`
      : 'Dry run preview: no workflow steps selected yet.',
    required_inputs: workflow.requiredInputs,
    missing_inputs: review.missing_inputs,
    provider_requirements: review.provider_blockers,
    safe_execution_steps: [
      'Review missing inputs and update workflow notes.',
      'Preview pending task payloads.',
      'Confirm the approval gate if you want pending tasks.',
      'Review each pending task manually before any separate execution flow.',
    ],
    blocked_actions: [
      'Run n8n automatically',
      'Create or edit live n8n workflows',
      'Publish or schedule content',
      'Create live ads or spend money',
      'Delete data, write to GitHub, or change provider settings',
    ],
    approval_requirements: review.required_approvals,
    estimated_outputs: workflow.expectedOutputs,
    task_payload_preview: workflow.steps.map((step) => ({
      title: `${workflow.name}: Step ${step.index} - ${step.template.name}`,
      template_id: step.template.id,
      status: 'pending',
      execution_mode: 'draft_only',
    })),
    content_studio_handoff_preview: contentSteps.map((step) => `${step.template.name} can be sent to Content Studio as editable prefilled context.`),
    n8n_plan_preview: n8nSteps.map((step) => `${step.template.name} can export a reference-only n8n plan with placeholder credentials.`),
    safety_notes: [
      'Readiness preparation is deterministic and local.',
      'Dry run does not create tasks or modify provider/n8n/scheduler state.',
      'Pending task creation remains a manual confirmed action.',
      'Never include secrets, webhook tokens, API keys, or provider responses in notes.',
    ],
  };
}
