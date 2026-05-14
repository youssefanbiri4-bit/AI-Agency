create table if not exists public.github_issue_task_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  github_owner text not null,
  github_repo text not null,
  github_issue_number integer not null,
  github_issue_url text not null,
  github_issue_title text,
  github_issue_state text,
  github_labels text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_issue_task_links_unique_issue unique (
    workspace_id,
    project_id,
    github_owner,
    github_repo,
    github_issue_number
  )
);

comment on table public.github_issue_task_links is
  'Read-only GitHub issue to AgentFlow task links. Does not write to GitHub or execute tasks.';

create index if not exists github_issue_task_links_workspace_project_idx
on public.github_issue_task_links(workspace_id, project_id, created_at desc);

create index if not exists github_issue_task_links_task_idx
on public.github_issue_task_links(task_id);

drop trigger if exists set_github_issue_task_links_updated_at on public.github_issue_task_links;
create trigger set_github_issue_task_links_updated_at
before update on public.github_issue_task_links
for each row
execute function public.set_updated_at();

alter table public.github_issue_task_links enable row level security;

drop policy if exists "Workspace members can view github issue task links" on public.github_issue_task_links;
create policy "Workspace members can view github issue task links"
on public.github_issue_task_links for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = github_issue_task_links.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create github issue task links" on public.github_issue_task_links;
create policy "Workspace members can create github issue task links"
on public.github_issue_task_links for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = github_issue_task_links.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace admins or creators can update github issue task links" on public.github_issue_task_links;
create policy "Workspace admins or creators can update github issue task links"
on public.github_issue_task_links for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = github_issue_task_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = github_issue_task_links.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
