-- =============================================================================
-- AgentFlow AI — Referral & Rewards System
-- W16-T2: Marketing Automation & Growth
-- =============================================================================
-- Implements the full referral lifecycle (invite -> signup -> reward) plus a
-- points-based reward ledger and a workspace-wide leaderboard.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. referrals table
-- -----------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referrer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  referred_email text,
  referred_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired')),
  reward_granted boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);

comment on table public.referrals is
  'Tracks referral invitations and conversions. One row per invite; completed when the referred user signs up.';

create index if not exists referrals_code_idx on public.referrals(code);
create index if not exists referrals_referrer_idx on public.referrals(referrer_user_id);
create index if not exists referrals_workspace_idx on public.referrals(referrer_workspace_id);

-- -----------------------------------------------------------------------------
-- 2. referral_rewards table (points ledger)
-- -----------------------------------------------------------------------------
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  reason text not null,
  referral_id uuid references public.referrals(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.referral_rewards is
  'Append-only points ledger for the referral rewards program. Balance = SUM(points).';

create index if not exists referral_rewards_user_idx on public.referral_rewards(user_id);
create index if not exists referral_rewards_workspace_idx on public.referral_rewards(workspace_id);

-- -----------------------------------------------------------------------------
-- 3. marketing_events table (generic A/B + campaign analytics)
-- -----------------------------------------------------------------------------
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  experiment text,
  variant text,
  workspace_id uuid references public.workspaces(id) on delete set null,
  anonymous_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.marketing_events is
  'Generic marketing analytics sink: A/B experiment exposures/conversions and email-campaign events.';

create index if not exists marketing_events_type_idx on public.marketing_events(event_type);
create index if not exists marketing_events_experiment_idx on public.marketing_events(experiment, variant);

-- -----------------------------------------------------------------------------
-- 4. Row-level security
-- -----------------------------------------------------------------------------
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.marketing_events enable row level security;

drop policy if exists "Referrers can view own referrals" on public.referrals;
create policy "Referrers can view own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_user_id = auth.uid());

drop policy if exists "Workspace members can view own rewards" on public.referral_rewards;
create policy "Workspace members can view own rewards"
  on public.referral_rewards for select
  to authenticated
  using (user_id = auth.uid());

-- marketing_events is write-only analytics; no direct client read policy needed.
