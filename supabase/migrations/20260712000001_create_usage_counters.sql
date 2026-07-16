-- =============================================================================
-- AgentFlow AI — usage_counters: Pre-computed Quota Counts
-- =============================================================================
-- Purpose:
--   Eliminates expensive COUNT(*) queries on every quota check by maintaining
--   pre-computed counters in a dedicated table, kept in sync via DB triggers.
--
--   Replaces the 6 live COUNT queries in quotas.ts with a single fast read:
--   SELECT count FROM usage_counters WHERE workspace_id = $1 AND quota_type = $2
--
-- Safe to re-run: uses IF NOT EXISTS and drop trigger IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper functions for atomic counter increments/decrements
-- -----------------------------------------------------------------------------

-- Increment counter by 1 (or create with count=1)
create or replace function public.increment_usage_counter(
  p_workspace_id uuid,
  p_quota_type text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.usage_counters (workspace_id, quota_type, count)
  values (p_workspace_id, p_quota_type, 1)
  on conflict (workspace_id, quota_type)
  do update set count = public.usage_counters.count + 1,
                updated_at = now();
end;
$$;

-- Decrement counter by 1 (floor at 0)
create or replace function public.decrement_usage_counter(
  p_workspace_id uuid,
  p_quota_type text
)
returns void
language plpgsql
security definer
as $$
begin
  update public.usage_counters
  set count = GREATEST(count - 1, 0),
      updated_at = now()
  where workspace_id = p_workspace_id
    and quota_type = p_quota_type;
end;
$$;

comment on function public.increment_usage_counter(uuid, text) is
  'Atomically increment a usage counter for a workspace+quota_type pair.';
comment on function public.decrement_usage_counter(uuid, text) is
  'Atomically decrement a usage counter (floor at 0) for a workspace+quota_type pair.';

-- -----------------------------------------------------------------------------
-- 2. Create usage_counters table
-- -----------------------------------------------------------------------------
create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quota_type text not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, quota_type)
);

comment on table public.usage_counters is
  'Pre-computed usage counters maintained by DB triggers. Replaces live COUNT(*) queries in quotas.ts.';

create index if not exists usage_counters_workspace_idx
  on public.usage_counters(workspace_id, quota_type);

drop trigger if exists set_usage_counters_updated_at on public.usage_counters;
create trigger set_usage_counters_updated_at
before update on public.usage_counters
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------
alter table public.usage_counters enable row level security;

-- Workspace members can view counters
drop policy if exists "Workspace members can view usage counters" on public.usage_counters;
create policy "Workspace members can view usage counters"
on public.usage_counters for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = usage_counters.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- Only service role (triggers) can insert/update — no client write policy needed.

-- -----------------------------------------------------------------------------
-- 4. Trigger: tasks table → 'tasks' counter
-- -----------------------------------------------------------------------------
create or replace function public.trg_sync_tasks_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.increment_usage_counter(NEW.workspace_id, 'tasks');
    return NEW;
  elsif TG_OP = 'DELETE' then
    perform public.decrement_usage_counter(OLD.workspace_id, 'tasks');
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_tasks_usage on public.tasks;
create trigger sync_tasks_usage
after insert or delete on public.tasks
for each row execute function public.trg_sync_tasks_usage();

-- -----------------------------------------------------------------------------
-- 5. Trigger: creative_assets table → 'creative_assets' + 'ai_generations' counters
-- -----------------------------------------------------------------------------
create or replace function public.trg_sync_creative_assets_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    -- All assets count toward creative_assets
    perform public.increment_usage_counter(NEW.workspace_id, 'creative_assets');
    -- OpenAI images count toward ai_generations
    if NEW.asset_type = 'image' and NEW.source = 'openai' then
      perform public.increment_usage_counter(NEW.workspace_id, 'ai_generations');
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    perform public.decrement_usage_counter(OLD.workspace_id, 'creative_assets');
    if OLD.asset_type = 'image' and OLD.source = 'openai' then
      perform public.decrement_usage_counter(OLD.workspace_id, 'ai_generations');
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_creative_assets_usage on public.creative_assets;
create trigger sync_creative_assets_usage
after insert or delete on public.creative_assets
for each row execute function public.trg_sync_creative_assets_usage();

-- -----------------------------------------------------------------------------
-- 6. Trigger: content_studio_items → 'content_items' + 'content_publishes' counters
-- -----------------------------------------------------------------------------
create or replace function public.trg_sync_content_studio_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    -- All items count toward content_items
    perform public.increment_usage_counter(NEW.workspace_id, 'content_items');
    -- Published items also count toward content_publishes
    if NEW.status = 'published' then
      perform public.increment_usage_counter(NEW.workspace_id, 'content_publishes');
    end if;
    return NEW;

  elsif TG_OP = 'UPDATE' then
    -- Handle status transitions for content_publishes
    if OLD.status is distinct from NEW.status then
      if OLD.status = 'published' and NEW.status != 'published' then
        -- Un-published: decrement
        perform public.decrement_usage_counter(NEW.workspace_id, 'content_publishes');
      elsif OLD.status != 'published' and NEW.status = 'published' then
        -- Newly published: increment
        perform public.increment_usage_counter(NEW.workspace_id, 'content_publishes');
      end if;
    end if;
    return NEW;

  elsif TG_OP = 'DELETE' then
    perform public.decrement_usage_counter(OLD.workspace_id, 'content_items');
    if OLD.status = 'published' then
      perform public.decrement_usage_counter(OLD.workspace_id, 'content_publishes');
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_content_studio_usage on public.content_studio_items;
create trigger sync_content_studio_usage
after insert or update or delete on public.content_studio_items
for each row execute function public.trg_sync_content_studio_usage();

-- -----------------------------------------------------------------------------
-- 7. Trigger: reels table → 'reels_publishes' counter
-- -----------------------------------------------------------------------------
create or replace function public.trg_sync_reels_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'published' then
      perform public.increment_usage_counter(NEW.workspace_id, 'reels_publishes');
    end if;
    return NEW;

  elsif TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status then
      if OLD.status = 'published' and NEW.status != 'published' then
        perform public.decrement_usage_counter(NEW.workspace_id, 'reels_publishes');
      elsif OLD.status != 'published' and NEW.status = 'published' then
        perform public.increment_usage_counter(NEW.workspace_id, 'reels_publishes');
      end if;
    end if;
    return NEW;

  elsif TG_OP = 'DELETE' then
    if OLD.status = 'published' then
      perform public.decrement_usage_counter(OLD.workspace_id, 'reels_publishes');
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_reels_usage on public.reels;
create trigger sync_reels_usage
after insert or update or delete on public.reels
for each row execute function public.trg_sync_reels_usage();

-- -----------------------------------------------------------------------------
-- 8. Backfill existing counts from production tables
--    This ensures counters are accurate for existing workspaces.
-- -----------------------------------------------------------------------------
insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'tasks', count(*)
from public.tasks
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();

insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'creative_assets', count(*)
from public.creative_assets
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();

insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'ai_generations', count(*)
from public.creative_assets
where asset_type = 'image' and source = 'openai'
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();

insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'content_items', count(*)
from public.content_studio_items
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();

insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'content_publishes', count(*)
from public.content_studio_items
where status = 'published'
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();

insert into public.usage_counters (workspace_id, quota_type, count)
select workspace_id, 'reels_publishes', count(*)
from public.reels
where status = 'published'
group by workspace_id
on conflict (workspace_id, quota_type) do update set count = excluded.count, updated_at = now();
