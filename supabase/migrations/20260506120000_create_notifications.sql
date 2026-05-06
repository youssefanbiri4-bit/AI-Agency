-- In-app notifications foundation.
-- Stores workspace/user-scoped dashboard notifications only.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'task_needs_review',
      'task_completed',
      'task_failed',
      'report_ready',
      'campaign_task_created',
      'meta_connection_connected',
      'ad_platform_setup_required'
    )
  ),
  title text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notifications is
  'Stores non-secret in-app dashboard notifications scoped to a workspace and user.';

create index if not exists notifications_workspace_user_created_idx
on public.notifications(workspace_id, user_id, created_at desc);

create index if not exists notifications_workspace_user_status_idx
on public.notifications(workspace_id, user_id, status);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
on public.notifications for select
to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can create their notifications" on public.notifications;
create policy "Users can create their notifications"
on public.notifications for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
on public.notifications for update
to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
