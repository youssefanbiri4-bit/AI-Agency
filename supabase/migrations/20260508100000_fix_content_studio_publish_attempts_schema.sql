create table if not exists public.content_studio_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content_item_id uuid references public.content_studio_items(id) on delete cascade,
  provider text not null,
  action_type text not null,
  status text not null,
  request_summary jsonb not null default '{}'::jsonb,
  provider_response_summary jsonb not null default '{}'::jsonb,
  error_message text null,
  provider_external_id text null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_studio_publish_attempts
  alter column request_summary set default '{}'::jsonb,
  alter column provider_response_summary set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column content_item_id drop not null,
  alter column created_by drop not null;

alter table public.content_studio_publish_attempts
  drop constraint if exists content_studio_publish_attempts_provider_check,
  drop constraint if exists content_studio_publish_attempts_action_type_check,
  drop constraint if exists content_studio_publish_attempts_status_check,
  drop constraint if exists content_studio_publish_attempts_created_by_fkey;

alter table public.content_studio_publish_attempts
  add constraint content_studio_publish_attempts_provider_check
    check (provider in ('meta', 'google_ads', 'pinterest', 'linkedin')),
  add constraint content_studio_publish_attempts_action_type_check
    check (
      action_type in (
        'publish_post',
        'publish_reel',
        'create_campaign_draft',
        'publish_pin',
        'manual_handoff'
      )
    ),
  add constraint content_studio_publish_attempts_status_check
    check (
      status in (
        'pending',
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
    ),
  add constraint content_studio_publish_attempts_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

comment on table public.content_studio_publish_attempts is
  'Safe server-side publish attempt log for Content Studio. Never store raw provider secrets, full tokens, or OAuth credentials.';

create index if not exists content_studio_publish_attempts_workspace_created_idx
on public.content_studio_publish_attempts(workspace_id, created_at desc);

create index if not exists content_studio_publish_attempts_item_created_idx
on public.content_studio_publish_attempts(content_item_id, created_at desc);

drop trigger if exists set_content_studio_publish_attempts_updated_at on public.content_studio_publish_attempts;
create trigger set_content_studio_publish_attempts_updated_at
before update on public.content_studio_publish_attempts
for each row execute function public.set_updated_at();

alter table public.content_studio_publish_attempts enable row level security;

drop policy if exists "Workspace members can view content studio publish attempts" on public.content_studio_publish_attempts;
create policy "Workspace members can view content studio publish attempts"
on public.content_studio_publish_attempts
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create content studio publish attempts" on public.content_studio_publish_attempts;
create policy "Workspace members can create content studio publish attempts"
on public.content_studio_publish_attempts
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Workspace members can update content studio publish attempts" on public.content_studio_publish_attempts;
create policy "Workspace members can update content studio publish attempts"
on public.content_studio_publish_attempts
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete content studio publish attempts" on public.content_studio_publish_attempts;
create policy "Workspace members can delete content studio publish attempts"
on public.content_studio_publish_attempts
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

notify pgrst, 'reload schema';
