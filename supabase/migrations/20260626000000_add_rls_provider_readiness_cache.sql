-- Enable RLS + add workspace-scoped policies for provider_readiness_cache.
-- This table was created without RLS in migration 20260518010000, causing a
-- CRITICAL security gap: any authenticated user could read/write any workspace's cache data.

alter table public.provider_readiness_cache enable row level security;

drop policy if exists "Workspace members can view provider readiness cache" on public.provider_readiness_cache;
create policy "Workspace members can view provider readiness cache"
on public.provider_readiness_cache
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Server can insert provider readiness cache" on public.provider_readiness_cache;
create policy "Server can insert provider readiness cache"
on public.provider_readiness_cache
for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Server can update provider readiness cache" on public.provider_readiness_cache;
create policy "Server can update provider readiness cache"
on public.provider_readiness_cache
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Server can delete provider readiness cache" on public.provider_readiness_cache;
create policy "Server can delete provider readiness cache"
on public.provider_readiness_cache
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

-- service-role bypasses RLS, so existing server-side (admin client) usage is unaffected.

comment on table public.provider_readiness_cache is
  'Workspace-scoped provider readiness cache with RLS. service-role bypasses RLS; authenticated users may only access their own workspace data.';

notify pgrst, 'reload schema';
