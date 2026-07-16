-- ORCH-2: Memory System + Planning & Reasoning Engine
-- Adds persistent storage for long-term agent memory and human-in-the-loop review requests.

-- =====================================================================
-- Long-term memory store
-- =====================================================================
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_type text not null,
  memory_type text not null
    check (memory_type in ('episodic','semantic','procedural','working')),
  category text not null default 'general',
  content text not null,
  embedding smallint[],                 -- reserved for future pgvector upgrade
  importance integer not null default 5 check (importance between 1 and 10),
  confidence numeric(3,2) not null default 1.0 check (confidence between 0 and 1),
  source text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  last_accessed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_memory_workspace
  on public.agent_memory(workspace_id, memory_type, category);
create index if not exists idx_agent_memory_agent
  on public.agent_memory(workspace_id, agent_type);
create index if not exists idx_agent_memory_tags
  on public.agent_memory using gin(tags);
create index if not exists idx_agent_memory_expires
  on public.agent_memory(expires_at) where expires_at is not null;

-- =====================================================================
-- Human-in-the-loop review requests
-- =====================================================================
create table if not exists public.human_review_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id text not null,
  step_id text not null,
  agent_type text not null,
  reason text not null,
  context jsonb not null default '{}'::jsonb,
  requested_action text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','cancelled')),
  reviewer_id uuid references auth.users(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_human_review_workspace_status
  on public.human_review_requests(workspace_id, status, created_at desc);
create index if not exists idx_human_review_run
  on public.human_review_requests(run_id);

-- =====================================================================
-- RLS: both tables are platform-managed via the service-role client only.
-- =====================================================================
alter table public.agent_memory enable row level security;
alter table public.human_review_requests enable row level security;

drop policy if exists agent_memory_service on public.agent_memory;
create policy agent_memory_service on public.agent_memory
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists human_review_service on public.human_review_requests;
create policy human_review_service on public.human_review_requests
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
