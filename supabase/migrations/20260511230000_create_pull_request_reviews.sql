create table if not exists public.pull_request_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  github_owner text not null,
  github_repo text not null,
  pr_number integer not null,
  pr_url text not null,
  pr_title text,
  pr_state text,
  source_branch text,
  target_branch text,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  recommendation text not null default 'needs_manual_review'
    check (recommendation in (
      'safe_to_merge_after_tests',
      'request_changes',
      'needs_manual_review',
      'do_not_merge_yet'
    )),
  review_summary text,
  files_changed text,
  potential_issues text,
  security_notes text,
  testing_checklist text,
  release_notes_draft text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pull_request_reviews_unique_pr unique (
    workspace_id,
    project_id,
    github_owner,
    github_repo,
    pr_number
  )
);

comment on table public.pull_request_reviews is
  'Read-only AgentFlow PR review reports. Does not approve, merge, comment, push, deploy, or modify GitHub.';

create index if not exists pull_request_reviews_workspace_project_idx
on public.pull_request_reviews(workspace_id, project_id, created_at desc);

create index if not exists pull_request_reviews_workspace_risk_idx
on public.pull_request_reviews(workspace_id, risk_level, created_at desc);

drop trigger if exists set_pull_request_reviews_updated_at on public.pull_request_reviews;
create trigger set_pull_request_reviews_updated_at
before update on public.pull_request_reviews
for each row
execute function public.set_updated_at();

alter table public.pull_request_reviews enable row level security;

drop policy if exists "Workspace members can view pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can view pull request reviews"
on public.pull_request_reviews for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = pull_request_reviews.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can create pull request reviews"
on public.pull_request_reviews for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = pull_request_reviews.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can update pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can update pull request reviews"
on public.pull_request_reviews for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = pull_request_reviews.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = pull_request_reviews.workspace_id
      and wm.user_id = auth.uid()
  )
);
