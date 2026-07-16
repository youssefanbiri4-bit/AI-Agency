-- Phase 10: AI Agent Builder + Templates Marketplace foundation.
-- Workspace-scoped no-code agent definitions, plus a marketplace surface
-- for templates published with visibility = 'marketplace'.
-- No execution, provider, scheduler, webhook, or campaign changes are made here.

create table if not exists public.agent_builder_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  role text not null default 'Assistant',
  description text,
  category text not null default 'general',
  icon text not null default 'Bot',
  accent_color text not null default '#1A7A8C',
  instructions text not null,
  inputs text[] not null default '{}',
  outputs text[] not null default '{}',
  safety_level text not null default 'requires_review'
    check (safety_level in ('safe', 'requires_review', 'readonly')),
  execution_mode text not null default 'supervised'
    check (execution_mode in ('autonomous', 'supervised', 'manual', 'draft_only')),
  review_checklist text[] not null default '{}',
  tags text[] not null default '{}',
  prompt_library_id uuid references public.prompt_library(id) on delete set null,
  is_template boolean not null default false,
  visibility text not null default 'workspace'
    check (visibility in ('workspace', 'marketplace')),
  share_slug text unique,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_builder_agents is
  'No-code AI agent definitions built in the Agent Builder. Published templates (visibility = ''marketplace'') are browsable across workspaces. Do not store API keys, tokens, or credentials in instructions or metadata.';

create index if not exists agent_builder_agents_workspace_updated_idx
  on public.agent_builder_agents(workspace_id, updated_at desc);

create index if not exists agent_builder_agents_workspace_category_idx
  on public.agent_builder_agents(workspace_id, category);

create index if not exists agent_builder_agents_marketplace_idx
  on public.agent_builder_agents(visibility) where visibility = 'marketplace';

create index if not exists agent_builder_agents_share_slug_idx
  on public.agent_builder_agents(share_slug);

drop trigger if exists set_agent_builder_agents_updated_at on public.agent_builder_agents;
create trigger set_agent_builder_agents_updated_at
  before update on public.agent_builder_agents
  for each row execute function public.set_updated_at();

alter table public.agent_builder_agents enable row level security;

drop policy if exists "Workspace members can view agent builder agents" on public.agent_builder_agents;
create policy "Workspace members can view agent builder agents"
  on public.agent_builder_agents for select
  to authenticated
  using (public.is_workspace_member(workspace_id) or visibility = 'marketplace');

drop policy if exists "Workspace members can create agent builder agents" on public.agent_builder_agents;
create policy "Workspace members can create agent builder agents"
  on public.agent_builder_agents for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "Workspace members can update agent builder agents" on public.agent_builder_agents;
create policy "Workspace members can update agent builder agents"
  on public.agent_builder_agents for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete agent builder agents" on public.agent_builder_agents;
create policy "Workspace admins or creators can delete agent builder agents"
  on public.agent_builder_agents for delete
  to authenticated
  using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
