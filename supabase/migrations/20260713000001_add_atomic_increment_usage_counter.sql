-- =============================================================================
-- AgentFlow AI — Atomic Usage Counter Increment Function
-- =============================================================================
-- Purpose:
--   Replace the read-then-write race condition in usage-limits.ts with an
--   atomic PostgreSQL upsert. The old TypeScript code reads metadata, modifies
--   it in JS, and writes back — two concurrent requests for the same workspace
--   can lose one increment.
--
--   This function atomically increments a counter stored in usage_limits.metadata
--   using jsonb_set in a single UPDATE statement.
--
-- Safe to re-run: uses OR REPLACE.
-- =============================================================================

create or replace function public.increment_usage_counter_metadata(
  p_workspace_id uuid,
  p_quota_type text,
  p_amount integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_counter_key text;
begin
  v_counter_key := 'current_' || p_quota_type;

  update public.usage_limits
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    array[v_counter_key],
    to_jsonb(coalesce((metadata ->> v_counter_key)::int, 0) + p_amount)
  ),
  updated_at = now()
  where workspace_id = p_workspace_id;

  -- If no row existed (workspace without usage_limits row), insert one
  if not found then
    insert into public.usage_limits (workspace_id, metadata, updated_at)
    values (
      p_workspace_id,
      jsonb_build_object(v_counter_key, p_amount),
      now()
    )
    on conflict (workspace_id) do update
    set metadata = jsonb_set(
      coalesce(excluded.metadata, '{}'::jsonb),
      array[v_counter_key],
      to_jsonb(coalesce((public.usage_limits.metadata ->> v_counter_key)::int, 0) + p_amount)
    ),
    updated_at = now();
  end if;
end;
$$;

comment on function public.increment_usage_counter_metadata(uuid, text, int) is
  'Atomically increment metadata.current_{type} in usage_limits for a workspace. Replaces read-then-write race condition.';
