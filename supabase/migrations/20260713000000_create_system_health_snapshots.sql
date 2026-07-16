-- System health snapshots.
-- Stores point-in-time health snapshots for the platform (global, workspace_id
-- null) and per workspace. Written server-side via the service role; read by
-- dashboard consumers (authenticated, RLS-scoped).

create table if not exists public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  status text not null check (status in ('healthy', 'degraded', 'critical')),
  score int not null check (score >= 0 and score <= 100),
  metrics jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.system_health_snapshots is
  'Point-in-time system/workspace health snapshots used by the dashboard command center.';

create index if not exists system_health_snapshots_workspace_created_idx
  on public.system_health_snapshots(workspace_id, created_at desc);

create index if not exists system_health_snapshots_created_idx
  on public.system_health_snapshots(created_at desc);

alter table public.system_health_snapshots enable row level security;

-- Reads: workspace members see their own workspace snapshots; global (null
-- workspace) snapshots are visible to any authenticated user.
drop policy if exists "Authenticated can read health snapshots" on public.system_health_snapshots;
create policy "Authenticated can read health snapshots"
  on public.system_health_snapshots for select
  to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

-- Writes happen via the service role (which bypasses RLS). Explicitly deny
-- authenticated writes to prevent tampering with health data.
drop policy if exists "No authenticated writes to health snapshots" on public.system_health_snapshots;
create policy "No authenticated writes to health snapshots"
  on public.system_health_snapshots
  for insert, update, delete
  to authenticated
  using (false)
  with check (false);

-- Enable realtime so dashboards can subscribe to new snapshots.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.system_health_snapshots;
  end if;
end $$;
