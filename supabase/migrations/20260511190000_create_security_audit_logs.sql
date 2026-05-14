create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  entity_type text null,
  entity_id uuid null,
  message text null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

comment on table public.security_audit_logs is
  'Workspace-scoped security audit events. Never store raw secrets, tokens, API keys, or raw provider responses.';

create index if not exists security_audit_logs_workspace_created_idx
on public.security_audit_logs(workspace_id, created_at desc);

create index if not exists security_audit_logs_workspace_event_idx
on public.security_audit_logs(workspace_id, event_type, created_at desc);

alter table public.security_audit_logs enable row level security;

drop policy if exists "Workspace members can view security audit logs" on public.security_audit_logs;
create policy "Workspace members can view security audit logs"
on public.security_audit_logs for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = security_audit_logs.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace members can create security audit logs" on public.security_audit_logs;
create policy "Workspace members can create security audit logs"
on public.security_audit_logs for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = security_audit_logs.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Workspace admins can delete security audit logs" on public.security_audit_logs;
create policy "Workspace admins can delete security audit logs"
on public.security_audit_logs for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = security_audit_logs.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);
