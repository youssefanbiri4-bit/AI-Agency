-- Phase A Supabase schema for the AI Agency Dashboard.
-- n8n execution and real AI agent execution are intentionally not connected in this phase.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.departments (
  id text primary key,
  name text not null unique,
  description text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id text primary key,
  department_id text not null references public.departments(id) on update cascade on delete restrict,
  name text not null,
  role text not null,
  description text not null,
  capabilities text[] not null default '{}',
  example_tasks text[] not null default '{}',
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_type text not null references public.agents(id) on update cascade on delete restrict,
  title text not null,
  description text not null,
  input_data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending', 'processing', 'needs_review', 'completed', 'failed', 'cancelled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High')),
  result jsonb,
  n8n_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.integration_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  supabase_status text not null default 'not_configured'
    check (supabase_status in ('not_configured', 'configured')),
  n8n_status text not null default 'not_connected'
    check (n8n_status in ('not_connected', 'prepared', 'connected')),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integration_settings is
  'Stores non-secret integration readiness state only. Do not store service_role keys, webhook tokens, or private credentials here.';

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists tasks_agent_type_idx on public.tasks(agent_type);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists task_reviews_workspace_id_idx on public.task_reviews(workspace_id);
create index if not exists task_reviews_task_id_idx on public.task_reviews(task_id);
create index if not exists task_events_workspace_id_idx on public.task_events(workspace_id);
create index if not exists task_events_task_id_idx on public.task_events(task_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_task_reviews_updated_at on public.task_reviews;
create trigger set_task_reviews_updated_at
before update on public.task_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_integration_settings_updated_at on public.integration_settings;
create trigger set_integration_settings_updated_at
before update on public.integration_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.handle_new_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update
    set role = 'owner';

  insert into public.integration_settings (workspace_id, supabase_status, n8n_status, updated_by)
  values (new.id, 'configured', 'not_connected', new.owner_id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_workspace_created_add_owner on public.workspaces;
create trigger on_workspace_created_add_owner
after insert on public.workspaces
for each row execute function public.handle_new_workspace_owner();

create or replace function public.set_task_review_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select workspace_id into new.workspace_id
    from public.tasks
    where id = new.task_id;
  end if;

  if new.reviewer_id is null then
    new.reviewer_id = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_review_workspace_before_insert on public.task_reviews;
create trigger set_task_review_workspace_before_insert
before insert on public.task_reviews
for each row execute function public.set_task_review_workspace();

create or replace function public.set_task_event_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null and new.task_id is not null then
    select workspace_id into new.workspace_id
    from public.tasks
    where id = new.task_id;
  end if;

  if new.actor_id is null then
    new.actor_id = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_event_workspace_before_insert on public.task_events;
create trigger set_task_event_workspace_before_insert
before insert on public.task_events
for each row execute function public.set_task_event_workspace();

create or replace function public.is_workspace_member(check_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = check_workspace_id
        and wm.user_id = auth.uid()
    );
$$;

create or replace function public.is_workspace_admin(check_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = check_workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.departments enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reviews enable row level security;
alter table public.task_events enable row level security;
alter table public.user_preferences enable row level security;
alter table public.integration_settings enable row level security;

drop policy if exists "Profiles are visible to their owner" on public.profiles;
create policy "Profiles are visible to their owner"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Workspace members can view workspaces" on public.workspaces;
create policy "Workspace members can view workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Users can create owned workspaces" on public.workspaces;
create policy "Users can create owned workspaces"
on public.workspaces for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Workspace admins can update workspaces" on public.workspaces;
create policy "Workspace admins can update workspaces"
on public.workspaces for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

drop policy if exists "Workspace admins can delete workspaces" on public.workspaces;
create policy "Workspace admins can delete workspaces"
on public.workspaces for delete
to authenticated
using (public.is_workspace_admin(id));

drop policy if exists "Workspace members can view memberships" on public.workspace_members;
create policy "Workspace members can view memberships"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can add members" on public.workspace_members;
create policy "Workspace admins can add members"
on public.workspace_members for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update members" on public.workspace_members;
create policy "Workspace admins can update members"
on public.workspace_members for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can remove members" on public.workspace_members;
create policy "Workspace admins can remove members"
on public.workspace_members for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "Anyone can read department catalog" on public.departments;
create policy "Anyone can read department catalog"
on public.departments for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can read active agent catalog" on public.agents;
create policy "Anyone can read active agent catalog"
on public.agents for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Workspace members can view tasks" on public.tasks;
create policy "Workspace members can view tasks"
on public.tasks for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create tasks" on public.tasks;
create policy "Workspace members can create tasks"
on public.tasks for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Workspace members can update tasks" on public.tasks;
create policy "Workspace members can update tasks"
on public.tasks for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete tasks" on public.tasks;
create policy "Workspace admins or creators can delete tasks"
on public.tasks for delete
to authenticated
using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

drop policy if exists "Workspace members can view reviews" on public.task_reviews;
create policy "Workspace members can view reviews"
on public.task_reviews for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create reviews" on public.task_reviews;
create policy "Workspace members can create reviews"
on public.task_reviews for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid());

drop policy if exists "Review authors can update reviews" on public.task_reviews;
create policy "Review authors can update reviews"
on public.task_reviews for update
to authenticated
using (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid());

drop policy if exists "Workspace admins or authors can delete reviews" on public.task_reviews;
create policy "Workspace admins or authors can delete reviews"
on public.task_reviews for delete
to authenticated
using (public.is_workspace_admin(workspace_id) or reviewer_id = auth.uid());

drop policy if exists "Workspace members can view task events" on public.task_events;
create policy "Workspace members can view task events"
on public.task_events for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create task events" on public.task_events;
create policy "Workspace members can create task events"
on public.task_events for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (actor_id is null or actor_id = auth.uid())
);

drop policy if exists "Users can view their preferences" on public.user_preferences;
create policy "Users can view their preferences"
on public.user_preferences for select
to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can create their preferences" on public.user_preferences;
create policy "Users can create their preferences"
on public.user_preferences for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can update their preferences" on public.user_preferences;
create policy "Users can update their preferences"
on public.user_preferences for update
to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can delete their preferences" on public.user_preferences;
create policy "Users can delete their preferences"
on public.user_preferences for delete
to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Workspace members can view integration settings" on public.integration_settings;
create policy "Workspace members can view integration settings"
on public.integration_settings for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can create integration settings" on public.integration_settings;
create policy "Workspace admins can create integration settings"
on public.integration_settings for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update integration settings" on public.integration_settings;
create policy "Workspace admins can update integration settings"
on public.integration_settings for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));
