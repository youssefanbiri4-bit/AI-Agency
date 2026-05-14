alter table public.workspace_members
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

update public.workspace_members wm
set role = 'owner'
from public.workspaces w
where wm.workspace_id = w.id
  and wm.user_id = w.owner_id
  and wm.role <> 'owner';

update public.workspace_members
set role = 'viewer'
where role = 'member';

alter table public.workspace_members
  alter column role set default 'viewer';

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'operator', 'editor', 'viewer'));

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

comment on column public.workspace_members.role is
  'Workspace-scoped strict admin role: owner, admin, operator, editor, or viewer.';

comment on column public.workspace_members.permissions is
  'Reserved for future workspace-scoped permission overrides. No secrets or tokens.';
