-- Notifications Center enrichment.
-- Adds readable severity and related-item routing fields to the existing
-- workspace/user-scoped notifications table without storing secrets.

alter table public.notifications
add column if not exists severity text not null default 'info';

alter table public.notifications
add column if not exists related_entity_type text;

alter table public.notifications
add column if not exists related_entity_id uuid;

alter table public.notifications
add column if not exists related_url text;

alter table public.notifications
drop constraint if exists notifications_severity_check;

alter table public.notifications
add constraint notifications_severity_check
check (severity in ('info', 'success', 'warning', 'error', 'critical'));

alter table public.notifications
drop constraint if exists notifications_status_check;

alter table public.notifications
add constraint notifications_status_check
check (status in ('unread', 'read', 'archived'));

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'task_created',
    'task_needs_review',
    'task_completed',
    'task_failed',
    'review_approved',
    'review_changes_requested',
    'report_ready',
    'campaign_task_created',
    'meta_connection_connected',
    'ad_platform_setup_required',
    'provider_setup_required',
    'approval_pending',
    'content_item_created',
    'content_item_updated',
    'content_item_scheduled',
    'content_item_published',
    'content_item_failed',
    'publishing_failed',
    'publishing_setup_required',
    'scheduler_completed',
    'scheduler_failed',
    'calendar_plan_created',
    'recovery_issue_detected',
    'reel_draft_created',
    'reel_marked_ready',
    'reel_published',
    'reel_failed',
    'reel_ai_script_task_created',
    'reel_ai_caption_task_created',
    'creative_asset_created',
    'creative_prompt_ready',
    'creative_image_generated',
    'creative_image_failed'
  )
);

create index if not exists notifications_workspace_user_type_idx
on public.notifications(workspace_id, user_id, type);

create index if not exists notifications_workspace_user_severity_idx
on public.notifications(workspace_id, user_id, severity);
