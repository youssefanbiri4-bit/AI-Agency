create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  stripe_customer_id text unique,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'agency')),
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'pro', 'agency')),
  max_projects integer,
  max_prompts integer,
  max_content_items integer,
  max_creative_assets integer,
  max_ai_generations_per_month integer,
  max_backups_per_month integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_customers is
  'Workspace billing customer mapping. Never stores card details, payment method data, or Stripe secrets.';

comment on table public.subscriptions is
  'Workspace subscription mirror from Stripe webhooks. Webhooks are the source of truth; clients cannot set subscription state.';

comment on table public.usage_limits is
  'Workspace plan limits for gentle SaaS gating. Downgrades never delete existing data.';

create index if not exists subscriptions_workspace_created_idx
on public.subscriptions(workspace_id, created_at desc);

create index if not exists subscriptions_workspace_status_idx
on public.subscriptions(workspace_id, status);

create index if not exists subscriptions_customer_idx
on public.subscriptions(stripe_customer_id);

drop trigger if exists set_billing_customers_updated_at on public.billing_customers;
create trigger set_billing_customers_updated_at
before update on public.billing_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_usage_limits_updated_at on public.usage_limits;
create trigger set_usage_limits_updated_at
before update on public.usage_limits
for each row execute function public.set_updated_at();

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_limits enable row level security;

drop policy if exists "Workspace owners and admins can view billing customers" on public.billing_customers;
create policy "Workspace owners and admins can view billing customers"
on public.billing_customers for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = billing_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists "Workspace owners can create billing customers" on public.billing_customers;
create policy "Workspace owners can create billing customers"
on public.billing_customers for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = billing_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "Workspace owners can update billing customers" on public.billing_customers;
create policy "Workspace owners can update billing customers"
on public.billing_customers for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = billing_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = billing_customers.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "Workspace owners and admins can view subscriptions" on public.subscriptions;
create policy "Workspace owners and admins can view subscriptions"
on public.subscriptions for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists "Workspace owners can create subscriptions" on public.subscriptions;
create policy "Workspace owners can create subscriptions"
on public.subscriptions for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "Workspace owners can update subscriptions" on public.subscriptions;
create policy "Workspace owners can update subscriptions"
on public.subscriptions for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = subscriptions.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists "Workspace members can view usage limits" on public.usage_limits;
create policy "Workspace members can view usage limits"
on public.usage_limits for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = usage_limits.workspace_id
      and wm.user_id = auth.uid()
  )
);
