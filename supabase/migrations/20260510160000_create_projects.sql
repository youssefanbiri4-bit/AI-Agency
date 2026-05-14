-- Phase 7: Project Workspace System.
-- Internal workspace-scoped project organization only. No provider, scheduler, webhook, or execution changes.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  slug text,
  description text,
  project_type text not null default 'software'
    check (project_type in ('software', 'SaaS', 'website', 'automation', 'marketing_campaign', 'AI_tool', 'internal_system', 'documentation')),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'paused', 'needs_review', 'ready_to_deploy', 'deployed', 'maintenance', 'archived')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  tech_stack text,
  github_url text,
  production_url text,
  staging_url text,
  local_path_note text,
  documentation_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Workspace-scoped internal project organization. Do not store API keys, tokens, or secrets in project notes or metadata.';

create unique index if not exists projects_workspace_slug_idx
on public.projects(workspace_id, slug)
where slug is not null;

create index if not exists projects_workspace_updated_idx
on public.projects(workspace_id, updated_at desc);

create index if not exists projects_workspace_status_idx
on public.projects(workspace_id, status);

create index if not exists projects_workspace_type_idx
on public.projects(workspace_id, project_type);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Workspace members can view projects" on public.projects;
create policy "Workspace members can view projects"
on public.projects for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create projects" on public.projects;
create policy "Workspace members can create projects"
on public.projects for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Workspace members can update projects" on public.projects;
create policy "Workspace members can update projects"
on public.projects for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete projects" on public.projects;
create policy "Workspace admins or creators can delete projects"
on public.projects for delete
to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
