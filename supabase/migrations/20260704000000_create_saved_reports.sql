-- Persistent client reports + signed share links
-- Adds saved_reports metadata table, report_share_links, and private workspace-reports bucket.

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  template text not null default 'full' check (template in ('full', 'executive', 'performance')),
  period_label text,
  filename text not null,
  storage_path text not null,
  file_size_bytes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.saved_reports is
  'Persisted client PDF reports stored in Supabase Storage (workspace-reports bucket).';

create index if not exists saved_reports_workspace_created_idx
  on public.saved_reports (workspace_id, created_at desc);

create table if not exists public.report_share_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.saved_reports(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  token text not null unique,
  expires_at timestamptz not null,
  password_hash text,
  access_count integer not null default 0,
  max_access_count integer,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_share_links is
  'Signed share links for saved reports. Access verified server-side; optional password + expiration.';

create index if not exists report_share_links_token_idx on public.report_share_links (token);
create index if not exists report_share_links_report_idx on public.report_share_links (report_id);

alter table public.saved_reports enable row level security;
alter table public.report_share_links enable row level security;

drop policy if exists "Workspace members can view saved reports" on public.saved_reports;
create policy "Workspace members can view saved reports" on public.saved_reports for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Editors can create saved reports" on public.saved_reports;
create policy "Editors can create saved reports" on public.saved_reports for insert to authenticated
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and created_by = auth.uid()
);

drop policy if exists "Editors can update saved reports" on public.saved_reports;
create policy "Editors can update saved reports" on public.saved_reports for update to authenticated
using (public.has_min_role(workspace_id, 'editor'::public.rbac_role))
with check (public.has_min_role(workspace_id, 'editor'::public.rbac_role));

drop policy if exists "Admins can delete saved reports" on public.saved_reports;
create policy "Admins can delete saved reports" on public.saved_reports for delete to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace members can view report share links" on public.report_share_links;
create policy "Workspace members can view report share links" on public.report_share_links for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Editors can create report share links" on public.report_share_links;
create policy "Editors can create report share links" on public.report_share_links for insert to authenticated
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and created_by = auth.uid()
);

drop policy if exists "Editors can update report share links" on public.report_share_links;
create policy "Editors can update report share links" on public.report_share_links for update to authenticated
using (public.has_min_role(workspace_id, 'editor'::public.rbac_role))
with check (public.has_min_role(workspace_id, 'editor'::public.rbac_role));

drop policy if exists "Admins can delete report share links" on public.report_share_links;
create policy "Admins can delete report share links" on public.report_share_links for delete to authenticated
using (public.is_workspace_admin(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-reports',
  'workspace-reports',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can read workspace report files" on storage.objects;
create policy "Workspace members can read workspace report files" on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-reports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Editors can upload workspace report files" on storage.objects;
create policy "Editors can upload workspace report files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'workspace-reports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_min_role(((storage.foldername(name))[1])::uuid, 'editor'::public.rbac_role)
);

drop policy if exists "Admins can delete workspace report files" on storage.objects;
create policy "Admins can delete workspace report files" on storage.objects for delete to authenticated
using (
  bucket_id = 'workspace-reports'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
);