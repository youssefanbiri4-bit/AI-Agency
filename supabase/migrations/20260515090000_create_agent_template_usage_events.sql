create table if not exists public.agent_template_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null,
  template_name text not null,
  template_category text not null,
  action_type text not null check (
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
  ),
  source_page text not null check (
    source_page in ('agent_library', 'alex', 'content_studio')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.agent_template_usage_events is
  'Workspace-scoped Agent Library template usage analytics. Store action metadata only; never store secrets, API keys, provider responses, webhook secrets, or private chat content.';

create index if not exists agent_template_usage_events_workspace_created_idx
on public.agent_template_usage_events(workspace_id, created_at desc);

create index if not exists agent_template_usage_events_workspace_template_idx
on public.agent_template_usage_events(workspace_id, template_id);

create index if not exists agent_template_usage_events_workspace_action_idx
on public.agent_template_usage_events(workspace_id, action_type);

alter table public.agent_template_usage_events enable row level security;

drop policy if exists "Workspace members can view agent template usage events" on public.agent_template_usage_events;
create policy "Workspace members can view agent template usage events"
on public.agent_template_usage_events for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_template_usage_events.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create agent template usage events" on public.agent_template_usage_events;
create policy "Workspace members can create agent template usage events"
on public.agent_template_usage_events for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = agent_template_usage_events.workspace_id
      and wm.user_id = auth.uid()
  )
);
