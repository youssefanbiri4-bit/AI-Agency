-- Phase 2: n8n callback idempotency and replay protection.
-- Stores derived callback keys and safe metadata only. Do not store raw webhook payloads or secrets here.

create table if not exists public.n8n_callback_events (
  id uuid primary key default gen_random_uuid(),
  callback_key text not null unique,
  source_route text not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  callback_status text,
  execution_identifier text,
  payload_hash text not null,
  outcome text not null default 'accepted'
    check (outcome in ('accepted', 'processed', 'duplicate', 'stale_ignored', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists n8n_callback_events_task_id_idx
on public.n8n_callback_events(task_id);

create index if not exists n8n_callback_events_workspace_id_idx
on public.n8n_callback_events(workspace_id);

alter table public.n8n_callback_events enable row level security;

-- Intentionally no authenticated policies.
-- Callback routes use the service role after validating the webhook secret.
