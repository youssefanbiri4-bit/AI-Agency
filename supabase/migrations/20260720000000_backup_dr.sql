-- =============================================================================
-- AgentFlow AI — Backup & Disaster Recovery Metadata (W20-T2)
-- Senior DevOps + Infrastructure Engineer deliverable
-- =============================================================================
-- Tracks backup jobs (DB dumps, storage snapshots) so monitoring can detect
-- stale/missing backups and alert. The actual dump is performed by
-- scripts/backup-snapshot.sh (pg_dump -> object storage) or Supabase managed
-- backups; this table is the source of truth for backup freshness/status.
-- Idempotent / re-runnable.
-- =============================================================================

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  job_type text not null,
  status text not null default 'started'
    check (status in ('started','succeeded','failed','partial')),
  destination text,
  destination_path text,
  size_bytes bigint not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rpo_target_minutes integer,
  rto_target_minutes integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_backup_jobs_workspace_started
  on public.backup_jobs(workspace_id, started_at desc);
create index if not exists idx_backup_jobs_type_status
  on public.backup_jobs(job_type, status, started_at desc);

alter table public.backup_jobs enable row level security;

-- Platform metadata: only the service-role (admin) client reads/writes these.
-- The cookie/client path is blocked, so backup records never leak to tenants.
drop policy if exists backup_jobs_service on public.backup_jobs;
create policy backup_jobs_service on public.backup_jobs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
