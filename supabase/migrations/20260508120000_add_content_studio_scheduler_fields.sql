alter table public.content_studio_items
  add column if not exists provider_response_summary jsonb not null default '{}'::jsonb,
  add column if not exists last_provider_action_at timestamptz null,
  add column if not exists scheduled_execution_status text null,
  add column if not exists scheduled_execution_started_at timestamptz null,
  add column if not exists scheduled_execution_finished_at timestamptz null,
  add column if not exists scheduled_execution_error text null,
  add column if not exists scheduled_execution_attempts integer not null default 0;

alter table public.content_studio_items
  drop constraint if exists content_studio_items_scheduled_execution_status_check;

alter table public.content_studio_items
  add constraint content_studio_items_scheduled_execution_status_check
    check (
      scheduled_execution_status is null
      or scheduled_execution_status in (
        'pending',
        'processing',
        'succeeded',
        'failed',
        'setup_required',
        'approval_pending',
        'billing_required',
        'token_missing',
        'manual_only',
        'unsupported',
        'error'
      )
    );

comment on column public.content_studio_items.provider_response_summary is
  'Safe provider response summary only. Never store raw tokens, OAuth credentials, or secret payloads.';

comment on column public.content_studio_items.last_provider_action_at is
  'Timestamp of the most recent successful provider action for this content item.';

comment on column public.content_studio_items.scheduled_execution_status is
  'Safe server-side scheduler execution status for due scheduled items. Never store secrets or raw provider payloads.';

comment on column public.content_studio_items.scheduled_execution_started_at is
  'Timestamp when the cron scheduler safely claimed execution for this content item.';

comment on column public.content_studio_items.scheduled_execution_finished_at is
  'Timestamp when the cron scheduler finished handling the claimed execution for this content item.';

comment on column public.content_studio_items.scheduled_execution_error is
  'Safe scheduler error message or provider setup note. Never store secrets or raw tokens.';

comment on column public.content_studio_items.scheduled_execution_attempts is
  'How many times the secure cron scheduler claimed this content item for execution.';

create index if not exists content_studio_items_due_scheduler_idx
on public.content_studio_items(status, schedule_at, scheduled_execution_status)
where status = 'scheduled' and schedule_at is not null;

notify pgrst, 'reload schema';
