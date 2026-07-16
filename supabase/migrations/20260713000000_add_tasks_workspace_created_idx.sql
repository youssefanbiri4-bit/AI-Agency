-- =============================================================================
-- AgentFlow AI — Add tasks_workspace_created_idx
-- =============================================================================
-- Purpose:
--   Cover the most frequently executed list query: listTasks() filters by
--   workspace_id and orders by created_at DESC. Without this composite index,
--   PostgreSQL sorts in memory after filtering on workspace_id alone.
--
--   Query pattern:
--     SELECT ... FROM tasks
--     WHERE workspace_id = $1
--     ORDER BY created_at DESC
--     LIMIT $2;
--
-- Safe to re-run: uses IF NOT EXISTS.
-- =============================================================================

create index if not exists tasks_workspace_created_idx
  on public.tasks(workspace_id, created_at desc);

comment on index public.tasks_workspace_created_idx is
  'Cover listTasks() query: filter by workspace_id, order by created_at desc';
