create table if not exists public.safe_patch_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  title text not null,
  change_request text not null,
  change_type text not null default 'feature'
    check (change_type in (
      'bug_fix',
      'ui_update',
      'feature',
      'refactor',
      'security',
      'database_migration',
      'provider_update',
      'docs',
      'deployment',
      'stabilization'
    )),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'draft'
    check (status in (
      'draft',
      'needs_review',
      'approved_to_prompt',
      'copied_to_codex',
      'implemented_externally',
      'rejected',
      'archived'
    )),
  affected_files text,
  implementation_plan text,
  safety_constraints text,
  test_checklist text,
  rollback_plan text,
  suggested_prompt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.safe_patch_plans is
  'Planning-only safe code change plans. Does not execute patches, GitHub writes, deploys, provider actions, or task execution.';

create index if not exists safe_patch_plans_workspace_created_idx
on public.safe_patch_plans(workspace_id, created_at desc);

create index if not exists safe_patch_plans_workspace_project_idx
on public.safe_patch_plans(workspace_id, project_id, created_at desc);

create index if not exists safe_patch_plans_workspace_status_idx
on public.safe_patch_plans(workspace_id, status);

drop trigger if exists set_safe_patch_plans_updated_at on public.safe_patch_plans;
create trigger set_safe_patch_plans_updated_at
before update on public.safe_patch_plans
for each row
execute function public.set_updated_at();

alter table public.safe_patch_plans enable row level security;

drop policy if exists "Workspace members can view safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can view safe patch plans"
on public.safe_patch_plans for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = safe_patch_plans.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can create safe patch plans"
on public.safe_patch_plans for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = safe_patch_plans.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can update safe patch plans"
on public.safe_patch_plans for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = safe_patch_plans.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = safe_patch_plans.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace admins or creators can delete safe patch plans" on public.safe_patch_plans;
create policy "Workspace admins or creators can delete safe patch plans"
on public.safe_patch_plans for delete
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = safe_patch_plans.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
