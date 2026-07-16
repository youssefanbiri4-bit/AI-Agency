-- W21-T2: Advanced Security + Compliance (GDPR/SOC2) + SSO
-- Tables: consent_records, data_subject_requests, sso_configs,
--         security_policies, compliance_evidence
-- All tables are workspace-scoped and protected by RLS service-role + member policies.

-- =========================================================
-- 1. consent_records — GDPR lawful basis / consent ledger
-- =========================================================
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  purpose text not null,
  legal_basis text not null default 'consent',
  granted boolean not null,
  version text not null default '1.0',
  withdrawn_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consent_records_workspace_user_idx
  on public.consent_records (workspace_id, user_id);
create index if not exists consent_records_created_idx
  on public.consent_records (created_at desc);

-- =========================================================
-- 2. data_subject_requests — GDPR DSAR (access / erasure)
-- =========================================================
create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  request_type text not null check (request_type in ('access', 'erasure', 'rectification', 'portability')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected', 'expired')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz null,
  verified boolean not null default false,
  export_path text null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_subject_requests_workspace_idx
  on public.data_subject_requests (workspace_id, status);
create index if not exists data_subject_requests_user_idx
  on public.data_subject_requests (user_id);

-- =========================================================
-- 3. sso_configs — enterprise SSO (Google Workspace, MS)
-- =========================================================
create table if not exists public.sso_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('google_workspace', 'microsoft_entra')),
  enabled boolean not null default false,
  client_id text null,
  client_secret_encrypted text null,
  tenant_id text null,
  domain text null,
  issuer_url text null,
  allow_sign_up boolean not null default false,
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists sso_configs_workspace_idx
  on public.sso_configs (workspace_id);

-- =========================================================
-- 4. security_policies — enterprise security policy registry
-- =========================================================
create table if not exists public.security_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  policy_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, policy_key)
);

create index if not exists security_policies_workspace_idx
  on public.security_policies (workspace_id);

-- =========================================================
-- 5. compliance_evidence — SOC2 evidence / attestation log
-- =========================================================
create table if not exists public.compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  framework text not null default 'SOC2',
  control_id text not null,
  control_name text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'implemented', 'evidence_collected', 'attested', 'failed')),
  evidence text null,
  attested_by uuid null,
  attested_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_evidence_workspace_idx
  on public.compliance_evidence (workspace_id, framework);

-- =========================================================
-- RLS
-- =========================================================
alter table public.consent_records enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.sso_configs enable row level security;
alter table public.security_policies enable row level security;
alter table public.compliance_evidence enable row level security;

-- Service role has full access (used by server admin client)
create policy consent_records_service_role on public.consent_records
  for all to service_role using (true) with check (true);
create policy data_subject_requests_service_role on public.data_subject_requests
  for all to service_role using (true) with check (true);
create policy sso_configs_service_role on public.sso_configs
  for all to service_role using (true) with check (true);
create policy security_policies_service_role on public.security_policies
  for all to service_role using (true) with check (true);
create policy compliance_evidence_service_role on public.compliance_evidence
  for all to service_role using (true) with check (true);

-- Members (authenticated) have read access scoped to their workspace
create policy consent_records_member_read on public.consent_records
  for select to authenticated
  using (workspace_id = (select auth.jwt() ->> 'workspace_id')::uuid);
create policy data_subject_requests_member_read on public.data_subject_requests
  for select to authenticated
  using (workspace_id = (select auth.jwt() ->> 'workspace_id')::uuid);
create policy sso_configs_member_read on public.sso_configs
  for select to authenticated
  using (workspace_id = (select auth.jwt() ->> 'workspace_id')::uuid);
create policy security_policies_member_read on public.security_policies
  for select to authenticated
  using (workspace_id = (select auth.jwt() ->> 'workspace_id')::uuid);
create policy compliance_evidence_member_read on public.compliance_evidence
  for select to authenticated
  using (workspace_id = (select auth.jwt() ->> 'workspace_id')::uuid);
