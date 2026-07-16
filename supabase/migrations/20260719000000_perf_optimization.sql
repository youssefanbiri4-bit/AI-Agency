-- =============================================================================
-- AgentFlow AI — Performance Optimization (W19-T2)
-- Senior Performance Engineer deliverable
-- =============================================================================
-- 1. Cost persistence: `usage_costs` table + `sum_workspace_cost()` RPC so the
--    cost dashboard no longer loops over creative_assets in JS.
-- 2. Covering indexes for the heaviest analytics scans:
--      - usage_events(workspace_id, created_at) for monthly/period rollups.
--      - tasks aggregates (workspace_id, status, created_at) used by team perf.
--      - creative_assets(workspace_id, created_at) for cost rollups.
-- 3. Idempotent / re-runnable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cost persistence
-- -----------------------------------------------------------------------------
create table if not exists public.usage_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  operation_type text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  image_count integer not null default 0,
  n8n_executions integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_costs_workspace_created
  on public.usage_costs(workspace_id, created_at desc);
create index if not exists idx_usage_costs_workspace_operation
  on public.usage_costs(workspace_id, operation_type);

alter table public.usage_costs enable row level security;

drop policy if exists usage_costs_member on public.usage_costs;
create policy usage_costs_member on public.usage_costs
  for select using (public.is_workspace_member(workspace_id));
drop policy if exists usage_costs_write on public.usage_costs;
create policy usage_costs_write on public.usage_costs
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Aggregate estimated cost for a workspace in a date range (server-side).
create or replace function public.sum_workspace_cost(
  p_workspace_id uuid,
  p_since timestamptz default now() - interval '30 days',
  p_until timestamptz default now()
)
returns table (
  total_cost numeric,
  openai_cost numeric,
  n8n_cost numeric,
  total_tokens bigint,
  operations bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(uc.estimated_cost_usd), 0) as total_cost,
    coalesce(sum(uc.estimated_cost_usd)
      filter (where uc.operation_type in ('text_generation','image_generation','reel_generation','video_generation')), 0) as openai_cost,
    coalesce(sum(uc.estimated_cost_usd) filter (where uc.operation_type = 'task_execution'), 0) as n8n_cost,
    coalesce(sum(uc.input_tokens + uc.output_tokens), 0)::bigint as total_tokens,
    count(*)::bigint as operations
  from public.usage_costs uc
  where uc.workspace_id = p_workspace_id
    and uc.created_at >= p_since
    and uc.created_at < p_until
$$;

-- -----------------------------------------------------------------------------
-- 2. Covering indexes for analytics hot paths
-- -----------------------------------------------------------------------------

-- Monthly + period rollups scan usage_events by workspace + created_at.
create index if not exists idx_usage_events_workspace_created
  on public.usage_events(workspace_id, created_at desc);

-- Team-performance aggregates tasks by workspace + status + created_at.
create index if not exists idx_tasks_workspace_status_created
  on public.tasks(workspace_id, status, created_at desc);

-- AI-generation hotspots (the most common operation_type in analytics scans).
create index if not exists idx_usage_events_workspace_ai_created
  on public.usage_events(workspace_id, created_at desc)
  where quota_type = 'ai_generations';

-- Creative-asset cost rollups.
create index if not exists idx_creative_assets_workspace_created
  on public.creative_assets(workspace_id, created_at desc);
