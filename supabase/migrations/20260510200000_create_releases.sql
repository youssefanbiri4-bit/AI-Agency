-- Phase 10: Release Manager.
-- Release tracking and documentation only. No execution, provider, scheduler, webhook, or campaign changes.

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  version text,
  phase_name text,
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_test', 'testing', 'ready_to_deploy', 'deployed', 'failed', 'rolled_back', 'archived')),
  release_type text not null default 'feature'
    check (release_type in ('feature', 'bug_fix', 'ui_update', 'provider_update', 'database_migration', 'deployment', 'documentation', 'stabilization', 'security', 'internal_tooling')),
  summary text,
  files_changed text,
  features_added text,
  fixes text,
  known_issues text,
  testing_checklist text,
  rollback_notes text,
  deploy_url text,
  main_production_url text,
  build_status text,
  lint_status text,
  typecheck_status text,
  deploy_status text,
  deployed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.releases is
  'Workspace-scoped release documentation. Do not store API keys, tokens, environment values, or private credentials in release notes.';

create index if not exists releases_workspace_updated_idx on public.releases(workspace_id, updated_at desc);
create index if not exists releases_workspace_status_idx on public.releases(workspace_id, status);
create index if not exists releases_workspace_type_idx on public.releases(workspace_id, release_type);
create index if not exists releases_workspace_project_idx on public.releases(workspace_id, project_id);

drop trigger if exists set_releases_updated_at on public.releases;
create trigger set_releases_updated_at
before update on public.releases
for each row execute function public.set_updated_at();

alter table public.releases enable row level security;

drop policy if exists "Workspace members can view releases" on public.releases;
create policy "Workspace members can view releases"
on public.releases for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create releases" on public.releases;
create policy "Workspace members can create releases"
on public.releases for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Workspace members can update releases" on public.releases;
create policy "Workspace members can update releases"
on public.releases for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete releases" on public.releases;
create policy "Workspace admins or creators can delete releases"
on public.releases for delete
to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
