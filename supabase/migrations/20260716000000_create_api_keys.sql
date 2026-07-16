-- =============================================================================
-- Public REST API: API Keys
-- -----------------------------------------------------------------------------
-- Workspace-scoped API keys used to authenticate against /api/v1/* endpoints.
-- Secrets are never stored: only a SHA-256 hash + a short prefix are persisted.
-- =============================================================================

create table if not exists public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{agents:read,prompts:read}',
  rate_limit integer not null default 60, -- requests per minute
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_api_keys_workspace on public.api_keys(workspace_id);
create index if not exists idx_api_keys_hash on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys workspace members select" on public.api_keys;
create policy "api_keys workspace members select"
  on public.api_keys for select
  using (is_workspace_member(workspace_id));

drop policy if exists "api_keys admins insert" on public.api_keys;
create policy "api_keys admins insert"
  on public.api_keys for insert
  with check (is_workspace_admin(workspace_id));

drop policy if exists "api_keys admins update" on public.api_keys;
create policy "api_keys admins update"
  on public.api_keys for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

drop policy if exists "api_keys admins delete" on public.api_keys;
create policy "api_keys admins delete"
  on public.api_keys for delete
  using (is_workspace_admin(workspace_id));

-- Updated-at maintenance
drop trigger if exists trg_api_keys_set_updated_at on public.api_keys;
create trigger trg_api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function set_updated_at();

comment on table public.api_keys is 'Workspace-scoped API keys authenticating /api/v1/* requests. Only key_hash is stored; the raw secret is shown once at creation.';
comment on column public.api_keys.scopes is 'Granted API scopes (e.g. agents:read, prompts:write).';
comment on column public.api_keys.rate_limit is 'Maximum requests per minute for this key.';
