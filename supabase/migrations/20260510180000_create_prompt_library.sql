-- Phase 9: Prompt Library.
-- Workspace-scoped prompt organization only. No execution, provider, scheduler, webhook, or campaign changes.

create table if not exists public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'general'
    check (category in ('development', 'deployment', 'bug_fix', 'ui_ux', 'supabase', 'vercel', 'n8n', 'provider_setup', 'ads_publishing', 'reports', 'documentation', 'project_planning', 'creative_assets', 'content_studio', 'agents', 'general')),
  subcategory text,
  target_tool text
    check (target_tool is null or target_tool in ('codex', 'opencode', 'kilo_code', 'n8n_ai', 'chatgpt', 'supabase_sql_editor', 'vercel_cli', 'general_ai_tool')),
  prompt_text text not null,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prompt_library is
  'Workspace-scoped prompt library. Do not store API keys, tokens, passwords, or private credentials in prompt text or metadata.';

create index if not exists prompt_library_workspace_updated_idx
on public.prompt_library(workspace_id, updated_at desc);

create index if not exists prompt_library_workspace_category_idx
on public.prompt_library(workspace_id, category);

create index if not exists prompt_library_workspace_tool_idx
on public.prompt_library(workspace_id, target_tool);

create index if not exists prompt_library_workspace_favorite_idx
on public.prompt_library(workspace_id, is_favorite);

drop trigger if exists set_prompt_library_updated_at on public.prompt_library;
create trigger set_prompt_library_updated_at
before update on public.prompt_library
for each row execute function public.set_updated_at();

alter table public.prompt_library enable row level security;

drop policy if exists "Workspace members can view prompt library" on public.prompt_library;
create policy "Workspace members can view prompt library"
on public.prompt_library for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create prompt library items" on public.prompt_library;
create policy "Workspace members can create prompt library items"
on public.prompt_library for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Workspace members can update prompt library items" on public.prompt_library;
create policy "Workspace members can update prompt library items"
on public.prompt_library for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete prompt library items" on public.prompt_library;
create policy "Workspace admins or creators can delete prompt library items"
on public.prompt_library for delete
to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());
