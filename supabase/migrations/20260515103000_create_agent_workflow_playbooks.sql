create table if not exists public.agent_workflow_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  steps jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  is_favorite boolean not null default false,
  last_opened_at timestamptz,
  last_used_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  readiness_summary jsonb not null default '{}'::jsonb,
  diagram jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_workflow_playbooks is
  'Saved Agent Library workflow playbooks. Draft-only storage; does not execute n8n, providers, publishing, or scheduling.';

create index if not exists agent_workflow_playbooks_workspace_created_idx
  on public.agent_workflow_playbooks (workspace_id, created_at desc);

create index if not exists agent_workflow_playbooks_workspace_updated_idx
  on public.agent_workflow_playbooks (workspace_id, updated_at desc);

create index if not exists agent_workflow_playbooks_workspace_favorite_idx
  on public.agent_workflow_playbooks (workspace_id, is_favorite);

create index if not exists agent_workflow_playbooks_workspace_status_idx
  on public.agent_workflow_playbooks (workspace_id, status);

drop trigger if exists set_agent_workflow_playbooks_updated_at on public.agent_workflow_playbooks;
create trigger set_agent_workflow_playbooks_updated_at
before update on public.agent_workflow_playbooks
for each row execute function public.set_updated_at();

alter table public.agent_workflow_playbooks enable row level security;

drop policy if exists "Workspace members can read workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can read workflow playbooks"
on public.agent_workflow_playbooks
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_workflow_playbooks.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can insert own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can insert own workflow playbooks"
on public.agent_workflow_playbooks
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_workflow_playbooks.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can update own workflow playbooks"
on public.agent_workflow_playbooks
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_workflow_playbooks.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_workflow_playbooks.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can delete own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can delete own workflow playbooks"
on public.agent_workflow_playbooks
for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_workflow_playbooks.workspace_id
      and wm.user_id = auth.uid()
  )
);

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
    'blocked_unsafe_workflow_action',
    'save_workflow_playbook',
    'update_workflow_playbook',
    'open_workflow_playbook',
    'duplicate_workflow_playbook',
    'favorite_workflow_playbook',
    'delete_workflow_playbook',
    'export_workflow_playbook'
  )
);
