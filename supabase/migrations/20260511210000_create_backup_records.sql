create table if not exists public.backup_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  backup_type text not null default 'workspace',
  categories text[] not null default '{}',
  record_counts jsonb not null default '{}'::jsonb,
  file_name text,
  file_size_bytes integer,
  status text not null default 'created'
    check (status in ('created', 'previewed', 'failed', 'archived')),
  warnings text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.backup_records is
  'Metadata-only history for workspace backup exports. Full backup JSON is not stored here.';

create index if not exists backup_records_workspace_created_idx
on public.backup_records(workspace_id, created_at desc);

create index if not exists backup_records_workspace_status_idx
on public.backup_records(workspace_id, status);

alter table public.backup_records enable row level security;

drop policy if exists "Workspace members can view backup records" on public.backup_records;
create policy "Workspace members can view backup records"
on public.backup_records for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = backup_records.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create backup records" on public.backup_records;
create policy "Workspace members can create backup records"
on public.backup_records for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = backup_records.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace admins or creators can archive backup records" on public.backup_records;
create policy "Workspace admins or creators can archive backup records"
on public.backup_records for update
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = backup_records.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = backup_records.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
