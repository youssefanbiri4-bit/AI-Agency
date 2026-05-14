-- Instagram Reels Studio table for planning, drafting, and managing reels.
-- Publishing is gated and requires proper Meta connection, scopes, and Instagram Business/Creator account.

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'instagram' check (platform = 'instagram'),
  type text not null default 'reel' check (type = 'reel'),
  status text not null default 'draft' check (status in ('draft', 'ready', 'scheduled', 'publishing', 'published', 'failed')),
  title text not null,
  offer text null,
  goal text null,
  target_audience text null,
  market text null,
  tone text null,
  cta text null,
  hook text null,
  main_message text null,
  script text null,
  storyboard text null,
  caption text null,
  hashtags text[] not null default '{}',
  duration_seconds integer null check (duration_seconds > 0),
  creative_type text null,
  video_url text null,
  cover_url text null,
  subtitles text null,
  music_note text null,
  scheduled_for timestamptz null,
  published_at timestamptz null,
  published_media_id text null,
  published_permalink text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reels is
  'Instagram Reels Studio table for planning, drafting, and managing Instagram Reels. Publishing requires proper Meta connection setup.';

create index if not exists reels_workspace_created_idx
on public.reels(workspace_id, created_at desc);

create index if not exists reels_workspace_status_idx
on public.reels(workspace_id, status);

create index if not exists reels_workspace_scheduled_idx
on public.reels(workspace_id, scheduled_for)
where scheduled_for is not null;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'task_needs_review',
    'task_completed',
    'task_failed',
    'report_ready',
    'campaign_task_created',
    'meta_connection_connected',
    'ad_platform_setup_required',
    'reel_draft_created',
    'reel_marked_ready',
    'reel_published',
    'reel_failed',
    'reel_ai_script_task_created',
    'reel_ai_caption_task_created'
  )
);

drop trigger if exists set_reels_updated_at on public.reels;
create trigger set_reels_updated_at
before update on public.reels
for each row execute function public.set_updated_at();

alter table public.reels enable row level security;

-- Authenticated users can select/insert/update/delete reels only in their workspaces
drop policy if exists "Users can select reels in their workspace" on public.reels;
create policy "Users can select reels in their workspace"
on public.reels
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Users can insert reels in their workspace" on public.reels;
create policy "Users can insert reels in their workspace"
on public.reels
for insert
to authenticated
with check (
  auth.uid() = user_id and
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Users can update reels in their workspace" on public.reels;
create policy "Users can update reels in their workspace"
on public.reels
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Users can delete reels in their workspace" on public.reels;
create policy "Users can delete reels in their workspace"
on public.reels
for delete
to authenticated
using (public.is_workspace_member(workspace_id));
