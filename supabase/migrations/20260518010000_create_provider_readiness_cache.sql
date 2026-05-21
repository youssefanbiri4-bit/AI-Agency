-- Create provider readiness cache table
create table if not exists public.provider_readiness_cache (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    provider text not null,
    readiness_state text not null,
    message text,
    missing text[],
    last_checked_at timestamptz not null default now(),
    expires_at timestamptz not null,
    constraint provider_readiness_cache_workspace_id_provider_key unique (workspace_id, provider)
);

-- Index for expired cache cleanup
create index if not exists idx_provider_readiness_cache_expires_at on public.provider_readiness_cache(expires_at);