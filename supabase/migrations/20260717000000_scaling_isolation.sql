-- =============================================================================
-- AgentFlow AI — Multi-Tenant Isolation Hardening + Query Optimization
-- W17-T2: Scalability Engineer deliverable
-- =============================================================================
-- 1. Tenant isolation introspection helper (used by verifyTenantIsolation()).
-- 2. Ensure RLS is enabled on all core tenant tables (idempotent).
-- 3. Query optimization: composite covering indexes for the most common
--    access patterns (workspace + created_at, workspace + status).
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS introspection helper
-- -----------------------------------------------------------------------------
create or replace function public.list_rls_enabled_tables()
returns table (tablename text, rowsecurity boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text as tablename, c.relrowsecurity as rowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
$$;

-- -----------------------------------------------------------------------------
-- 2. Ensure RLS enabled on core tenant tables
-- -----------------------------------------------------------------------------
alter table if exists public.tasks enable row level security;
alter table if exists public.usage_events enable row level security;
alter table if exists public.usage_counters enable row level security;
alter table if exists public.projects enable row level security;
alter table if exists public.releases enable row level security;
alter table if exists public.referrals enable row level security;
alter table if exists public.referral_rewards enable row level security;
alter table if exists public.marketing_events enable row level security;
alter table if exists public.security_audit_logs enable row level security;
alter table if exists public.workspace_members enable row level security;
alter table if exists public.creative_assets enable row level security;
alter table if exists public.content_studio_items enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Query optimization — composite indexes
-- -----------------------------------------------------------------------------

-- tasks: most dashboards sort by recency and filter by status within a workspace
create index if not exists idx_tasks_workspace_created_status
  on public.tasks(workspace_id, created_at desc, status);

-- tasks: completion-rate / cycle-time queries filter by status + completed_at
create index if not exists idx_tasks_workspace_status_completed
  on public.tasks(workspace_id, status, completed_at desc)
  where status in ('completed', 'failed');

-- usage_events: month-over-month aggregations scan (workspace_id, created_at)
create index if not exists idx_usage_events_workspace_created_quota
  on public.usage_events(workspace_id, created_at desc, quota_type);

-- usage_events: per-user rollups (churn / member analytics)
create index if not exists idx_usage_events_workspace_user_created
  on public.usage_events(workspace_id, user_id, created_at desc)
  where user_id is not null;

-- referrals: leaderboard / stats queries by workspace + status
create index if not exists idx_referrals_workspace_status_created
  on public.referrals(referrer_workspace_id, status, created_at desc);

-- referral_rewards: balance rollups by workspace + user
create index if not exists idx_referral_rewards_workspace_user
  on public.referral_rewards(workspace_id, user_id);

-- marketing_events: time-series analytics by type + created_at
create index if not exists idx_marketing_events_type_created
  on public.marketing_events(event_type, created_at desc);

-- security_audit_logs: retention + viewer queries by workspace + created_at
create index if not exists idx_audit_logs_workspace_severity_created
  on public.security_audit_logs(workspace_id, severity, created_at desc);
