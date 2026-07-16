-- =============================================================================
-- AgentFlow AI — usage_events: Precise Monthly Usage Tracking
-- =============================================================================
-- Purpose:
--   Append-only event store for every usage increment. Enables precise monthly
--   aggregation without expensive COUNT queries on production tables and avoids
--   metadata counter drift.
--
--   Used by:
--   - `getMonthlyUsageByType()` in billing-service.ts for accurate monthly counts
--   - Usage dashboard (/dashboard/usage)
--
-- Safe to re-run: uses IF NOT EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create usage_events table
-- -----------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  quota_type text not null check (
    quota_type in (
      'ai_generations',
      'tasks',
      'creative_assets',
      'content_items',
      'content_publishes',
      'reels_publishes',
      'paid_ads_spend',
      'cost_usd'
    )
  ),
  amount integer not null default 1 check (amount > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.usage_events is
  'Append-only usage event store for precise monthly quota tracking. Every incrementUsageCounter call also writes a row here.';
comment on column public.usage_events.event_type is
  'Human-readable event description: ai_generation, task_created, asset_generated, content_published, etc.';
comment on column public.usage_events.quota_type is
  'Matches QuotaType in quotas.ts. Used for GROUP BY aggregation.';
comment on column public.usage_events.amount is
  'Positive integer count for this event (default 1). Future use: batch events with amount > 1.';
comment on column public.usage_events.metadata is
  'Optional context: agent_type, model, source_action, etc.';

-- -----------------------------------------------------------------------------
-- 2. Indexes for monthly aggregation queries
-- -----------------------------------------------------------------------------
create index if not exists usage_events_workspace_quota_created_idx
  on public.usage_events(workspace_id, quota_type, created_at desc);

create index if not exists usage_events_workspace_created_idx
  on public.usage_events(workspace_id, created_at desc);

-- Partial index for the common "current month" query pattern
create index if not exists usage_events_current_month_idx
  on public.usage_events(workspace_id, quota_type, created_at)
  where created_at >= date_trunc('month', now());

-- Index for cleanup queries (old events)
create index if not exists usage_events_cleanup_idx
  on public.usage_events(created_at)
  where created_at < date_trunc('month', now()) - interval '13 months';

-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------
alter table public.usage_events enable row level security;

-- -----------------------------------------------------------------------------
-- 4. RLS policies
-- -----------------------------------------------------------------------------

-- Workspace members can view their own usage events
drop policy if exists "Workspace members can view usage events" on public.usage_events;
create policy "Workspace members can view usage events" on public.usage_events for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = usage_events.workspace_id
    and wm.user_id = auth.uid()
));

-- Service role only for INSERT (via admin client); no client INSERT policy
-- This ensures usage events are only written by the server-side admin client.

-- Workspace owners and admins can delete old usage events (cleanup)
drop policy if exists "Workspace owners can delete old usage events" on public.usage_events;
create policy "Workspace owners can delete old usage events" on public.usage_events for delete to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = usage_events.workspace_id
    and wm.user_id = auth.uid()
    and wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
));
