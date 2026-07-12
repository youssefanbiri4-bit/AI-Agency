-- =============================================================================
-- AgentFlow AI — Add composite index on tasks(workspace_id, status)
-- =============================================================================
-- Performance: The separate tasks_workspace_id_idx and tasks_status_idx indexes
-- each cover one column, but queries filtering on both workspace_id AND status
-- (e.g. "show all completed tasks in this workspace") benefit from a composite
-- B-tree index. This avoids sequential scans or bitmap-AND of two indexes.
--
-- Uses IF NOT EXISTS for safe idempotent deployment. Consistent with existing migration patterns.
-- =============================================================================

create index if not exists idx_tasks_workspace_status
  on public.tasks (workspace_id, status);

comment on index public.idx_tasks_workspace_status is
  'Composite index for workspace-scoped task status queries (dashboard, ops summary).';
