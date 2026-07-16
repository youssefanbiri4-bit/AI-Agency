-- =============================================================================
-- Customer Success: support tickets, feedback, NPS, churn prevention
-- =============================================================================

create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category text not null default 'general',
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_feedback (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  author_email text,
  rating integer check (rating >= 1 and rating <= 5),
  category text not null default 'general',
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nps_responses (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  score integer not null check (score >= 0 and score <= 10),
  comment text,
  period text not null default to_char(now(), 'YYYY-MM'),
  created_at timestamptz not null default now()
);

create table if not exists public.churn_alerts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  signal_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  acknowledged boolean not null default false,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_workspace on public.support_tickets(workspace_id);
create index if not exists idx_support_tickets_status on public.support_tickets(workspace_id, status);
create index if not exists idx_customer_feedback_workspace on public.customer_feedback(workspace_id);
create index if not exists idx_nps_responses_workspace on public.nps_responses(workspace_id);
create index if not exists idx_nps_responses_period on public.nps_responses(workspace_id, period);
create index if not exists idx_churn_alerts_workspace on public.churn_alerts(workspace_id);
create index if not exists idx_churn_alerts_open on public.churn_alerts(workspace_id, acknowledged);

alter table public.support_tickets enable row level security;
alter table public.customer_feedback enable row level security;
alter table public.nps_responses enable row level security;
alter table public.churn_alerts enable row level security;

-- support_tickets: members read; members create; admins manage
drop policy if exists "support_tickets members select" on public.support_tickets;
create policy "support_tickets members select" on public.support_tickets for select using (is_workspace_member(workspace_id));
drop policy if exists "support_tickets members insert" on public.support_tickets;
create policy "support_tickets members insert" on public.support_tickets for insert with check (is_workspace_member(workspace_id));
drop policy if exists "support_tickets admins update" on public.support_tickets;
create policy "support_tickets admins update" on public.support_tickets for update using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
drop policy if exists "support_tickets admins delete" on public.support_tickets;
create policy "support_tickets admins delete" on public.support_tickets for delete using (is_workspace_admin(workspace_id));

-- customer_feedback: members read/create; admins manage
drop policy if exists "customer_feedback members select" on public.customer_feedback;
create policy "customer_feedback members select" on public.customer_feedback for select using (is_workspace_member(workspace_id));
drop policy if exists "customer_feedback members insert" on public.customer_feedback;
create policy "customer_feedback members insert" on public.customer_feedback for insert with check (is_workspace_member(workspace_id));
drop policy if exists "customer_feedback admins update" on public.customer_feedback;
create policy "customer_feedback admins update" on public.customer_feedback for update using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
drop policy if exists "customer_feedback admins delete" on public.customer_feedback;
create policy "customer_feedback admins delete" on public.customer_feedback for delete using (is_workspace_admin(workspace_id));

-- nps_responses: members read/create; admins manage
drop policy if exists "nps_responses members select" on public.nps_responses;
create policy "nps_responses members select" on public.nps_responses for select using (is_workspace_member(workspace_id));
drop policy if exists "nps_responses members insert" on public.nps_responses;
create policy "nps_responses members insert" on public.nps_responses for insert with check (is_workspace_member(workspace_id));
drop policy if exists "nps_responses admins update" on public.nps_responses;
create policy "nps_responses admins update" on public.nps_responses for update using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
drop policy if exists "nps_responses admins delete" on public.nps_responses;
create policy "nps_responses admins delete" on public.nps_responses for delete using (is_workspace_admin(workspace_id));

-- churn_alerts: members read; admins create/manage
drop policy if exists "churn_alerts members select" on public.churn_alerts;
create policy "churn_alerts members select" on public.churn_alerts for select using (is_workspace_member(workspace_id));
drop policy if exists "churn_alerts admins insert" on public.churn_alerts;
create policy "churn_alerts admins insert" on public.churn_alerts for insert with check (is_workspace_admin(workspace_id));
drop policy if exists "churn_alerts admins update" on public.churn_alerts;
create policy "churn_alerts admins update" on public.churn_alerts for update using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));
drop policy if exists "churn_alerts admins delete" on public.churn_alerts;
create policy "churn_alerts admins delete" on public.churn_alerts for delete using (is_workspace_admin(workspace_id));

-- updated_at triggers
drop trigger if exists trg_support_tickets_set_updated_at on public.support_tickets;
create trigger trg_support_tickets_set_updated_at before update on public.support_tickets for each row execute function set_updated_at();
drop trigger if exists trg_customer_feedback_set_updated_at on public.customer_feedback;
create trigger trg_customer_feedback_set_updated_at before update on public.customer_feedback for each row execute function set_updated_at();
drop trigger if exists trg_nps_responses_set_updated_at on public.nps_responses;
create trigger trg_nps_responses_set_updated_at before update on public.nps_responses for each row execute function set_updated_at();
drop trigger if exists trg_churn_alerts_set_updated_at on public.churn_alerts;
create trigger trg_churn_alerts_set_updated_at before update on public.churn_alerts for each row execute function set_updated_at();

comment on table public.support_tickets is 'Workspace customer-support tickets managed by the Customer Success area.';
comment on table public.customer_feedback is 'Customer feedback and CSAT ratings.';
comment on table public.nps_responses is 'Net Promoter Score responses (0-10) per workspace per period.';
comment on table public.churn_alerts is 'Computed churn-risk signals; acknowledged by CS admins.';
