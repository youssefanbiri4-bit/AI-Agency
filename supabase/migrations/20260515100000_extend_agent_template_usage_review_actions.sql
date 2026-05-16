alter table public.agent_template_usage_events
drop constraint if exists agent_template_usage_events_action_type_check;

alter table public.agent_template_usage_events
add constraint agent_template_usage_events_action_type_check
check (
  action_type in (
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
    'blocked_unsafe_workflow_action'
  )
);
