-- Phase 6: tighten operational audit logs.
-- Logs must not be writable directly by authenticated clients. Server code writes
-- with the service role after validating user/workspace/role context.

alter table public.security_audit_logs enable row level security;

drop policy if exists "Workspace members can view security audit logs" on public.security_audit_logs;
create policy "Workspace owners and admins can view security audit logs"
on public.security_audit_logs for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = security_audit_logs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists "Workspace members can create security audit logs" on public.security_audit_logs;
drop policy if exists "Server can create security audit logs" on public.security_audit_logs;

drop policy if exists "Workspace admins can delete security audit logs" on public.security_audit_logs;
create policy "Workspace owners can delete security audit logs"
on public.security_audit_logs for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = security_audit_logs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);
