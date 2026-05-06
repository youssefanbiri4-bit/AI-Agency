-- Meta Ads read-only connection foundation.
-- Stores encrypted ad platform tokens for server-side use only.

create table if not exists public.ad_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta')),
  status text not null check (status in ('connected', 'expired', 'revoked', 'error')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  ad_account_id text,
  ad_account_name text,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

comment on table public.ad_connections is
  'Stores encrypted ad platform OAuth tokens. Access tokens must not be selected in browser/client code.';

create index if not exists ad_connections_workspace_id_idx
on public.ad_connections(workspace_id);

create index if not exists ad_connections_user_id_idx
on public.ad_connections(user_id);

drop trigger if exists set_ad_connections_updated_at on public.ad_connections;
create trigger set_ad_connections_updated_at
before update on public.ad_connections
for each row execute function public.set_updated_at();

alter table public.ad_connections enable row level security;

-- Intentionally no authenticated select/insert/update/delete policies.
-- Server routes use the service role after validating the signed-in user and workspace.
