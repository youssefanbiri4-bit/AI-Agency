import type {
  AgentTemplateUsageActionType,
  AgentTemplateUsageSourcePage,
} from '@/types/database';

export const templateUsageActionTypes = [
  'view_template',
  'use_with_alex',
  'create_task',
  'send_to_content_studio',
  'export_n8n_plan',
  'copy_prompt',
  'copy_workflow_plan',
  'create_workflow_draft',
  'download_workflow_plan',
  'create_tasks_from_workflow',
  'add_template_to_workflow',
  'review_workflow',
  'copy_workflow_review',
  'download_workflow_review',
  'approval_confirmed_for_pending_tasks',
  'blocked_unsafe_workflow_action',
  'save_workflow_playbook',
  'update_workflow_playbook',
  'open_workflow_playbook',
  'duplicate_workflow_playbook',
  'favorite_workflow_playbook',
  'delete_workflow_playbook',
  'export_workflow_playbook',
] as const satisfies readonly AgentTemplateUsageActionType[];

export const templateUsageSourcePages = [
  'agent_library',
  'alex',
  'content_studio',
] as const satisfies readonly AgentTemplateUsageSourcePage[];

export interface TemplateUsageSummaryItem {
  template_id: string;
  template_name: string;
  template_category: string;
  count: number;
  last_used_at: string | null;
}

export interface TemplateUsageSummary {
  total_events: number;
  most_used_templates: TemplateUsageSummaryItem[];
  recently_used_templates: TemplateUsageSummaryItem[];
  top_categories: Array<{ category: string; count: number }>;
  action_counts: Record<AgentTemplateUsageActionType, number>;
  per_template_summary: TemplateUsageSummaryItem[];
  recommended_next_templates: TemplateUsageSummaryItem[];
}

export interface TemplateUsageSummaryResult {
  data: TemplateUsageSummary;
  error: string | null;
}
