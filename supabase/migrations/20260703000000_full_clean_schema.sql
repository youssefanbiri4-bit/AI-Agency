-- =============================================================================
-- AgentFlow AI — Consolidated Clean Schema
-- =============================================================================
-- Replaces incremental migrations (Phase A through RBAC) with a single idempotent
-- baseline for greenfield Supabase projects.
--
-- Safe to re-run: uses IF NOT EXISTS, DROP POLICY IF EXISTS, and ON CONFLICT.
-- Does NOT modify databases that already applied the incremental migration chain.
-- Backward compatible: preserves all final table shapes, enums, RLS, and seeds.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'department') then
    create type public.department as enum (
      'content',
      'creative',
      'social',
      'strategy',
      'paid_ads',
      'operations'
    );
  end if;
end
$$;

comment on type public.department is
  'RBAC department scope for workspace members. NULL department = no department restriction.';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rbac_role') then
    create type public.rbac_role as enum (
      'viewer',
      'editor',
      'operator',
      'admin',
      'owner'
    );
  end if;
end
$$;

comment on type public.rbac_role is
  'Workspace RBAC role hierarchy: viewer < editor < operator < admin < owner.';

-- -----------------------------------------------------------------------------
-- 3. Shared trigger functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger that refreshes updated_at to now().';

create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

comment on function public.set_completed_at() is
  'Auto-populates tasks.completed_at when status transitions to completed.';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner'::public.rbac_role)
  on conflict (workspace_id, user_id) do update
    set role = 'owner'::public.rbac_role;

  insert into public.integration_settings (workspace_id, supabase_status, n8n_status, updated_by)
  values (new.id, 'configured', 'not_connected', new.owner_id)
  on conflict (workspace_id) do nothing;

  insert into public.usage_limits (
    workspace_id,
    plan,
    max_ai_generations_per_month,
    max_creative_assets,
    max_content_items,
    metadata
  )
  values (new.id, 'free', 20, 50, 30, '{}'::jsonb)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

create or replace function public.set_task_review_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then
    select workspace_id into new.workspace_id from public.tasks where id = new.task_id;
  end if;
  if new.reviewer_id is null then
    new.reviewer_id = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_task_event_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null and new.task_id is not null then
    select workspace_id into new.workspace_id from public.tasks where id = new.task_id;
  end if;
  if new.actor_id is null then
    new.actor_id = auth.uid();
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Core identity & workspace tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Authenticated user profile mirror. Synced from auth.users on signup.';
comment on column public.profiles.email is 'Cached email from Supabase Auth.';
comment on column public.profiles.full_name is 'Display name from user metadata or profile edits.';

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspaces is
  'Top-level tenant boundary. All operational data is workspace-scoped.';
comment on column public.workspaces.owner_id is 'Primary owner; auto-added to workspace_members as owner role.';
comment on column public.workspaces.slug is 'Optional URL-safe identifier unique across all workspaces.';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.rbac_role not null default 'viewer'::public.rbac_role
    check (role in ('viewer', 'editor', 'operator', 'admin', 'owner')),
  department public.department null
    check (
      department is null
      or department in ('content', 'creative', 'social', 'strategy', 'paid_ads', 'operations')
    ),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Workspace membership with RBAC role and optional department scoping.';
comment on column public.workspace_members.role is
  'RBAC role: owner > admin > operator > editor > viewer. Enforced via enum + CHECK.';
comment on column public.workspace_members.department is
  'Department scoping for RBAC. NULL = no department restriction (subject to role).';
comment on column public.workspace_members.permissions is
  'Reserved for future workspace-scoped permission overrides. No secrets or tokens.';

-- -----------------------------------------------------------------------------
-- 5. Catalog tables (departments & agents)
-- -----------------------------------------------------------------------------

create table if not exists public.departments (
  id text primary key,
  name text not null unique,
  description text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.departments is
  'Read-only agent catalog grouping. Seeded; not workspace-scoped.';

create table if not exists public.agents (
  id text primary key,
  department_id text not null references public.departments(id) on update cascade on delete restrict,
  name text not null,
  role text not null,
  description text not null,
  capabilities text[] not null default '{}',
  example_tasks text[] not null default '{}',
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agents is
  'AI agent catalog entries referenced by tasks.agent_type. Seeded; publicly readable when active.';
comment on column public.agents.is_active is 'Inactive agents are hidden from the public catalog policy.';

-- -----------------------------------------------------------------------------
-- 6. Task lifecycle tables
-- -----------------------------------------------------------------------------

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_type text not null references public.agents(id) on update cascade on delete restrict,
  title text not null,
  description text not null,
  input_data jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'processing', 'needs_review', 'completed', 'failed', 'cancelled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High')),
  result jsonb,
  n8n_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  agent_department public.department null
);

comment on table public.tasks is
  'Primary unit of AI agency work. Scoped to workspace; executed via n8n when enabled.';
comment on column public.tasks.status is
  'Lifecycle: draft/pending → processing → needs_review → completed, or failed.';
comment on column public.tasks.result is
  'Structured n8n callback output including report fields. No secrets.';
comment on column public.tasks.n8n_execution_id is 'Optional external execution identifier from n8n.';
comment on column public.tasks.completed_at is 'Auto-set by trigger when status becomes completed.';
comment on column public.tasks.agent_department is
  'Primary RBAC department snapshot at task creation. Used for filtering and department-scoped RLS.';

create table if not exists public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  feedback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.task_reviews is
  'Human review records for tasks in needs_review status.';

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.task_events is
  'Append-only task activity log for workspace audit trails.';

-- -----------------------------------------------------------------------------
-- 7. User preferences & integration settings
-- -----------------------------------------------------------------------------

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

comment on table public.user_preferences is
  'Per-user, per-workspace UI and feature preferences.';

create table if not exists public.integration_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  supabase_status text not null default 'not_configured'
    check (supabase_status in ('not_configured', 'configured')),
  n8n_status text not null default 'not_connected'
    check (n8n_status in ('not_connected', 'prepared', 'connected')),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integration_settings is
  'Non-secret integration readiness state only. Never store service_role keys or webhook tokens.';
comment on column public.integration_settings.settings is
  'Safe operational flags (production gate, spend controls). No credentials.';

-- -----------------------------------------------------------------------------
-- 8. Ad connections (server-only via service role)
-- -----------------------------------------------------------------------------

create table if not exists public.ad_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta', 'google_ads', 'pinterest')),
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
  'Encrypted ad platform OAuth tokens. Server-side only; no authenticated RLS policies.';
comment on column public.ad_connections.access_token is
  'Encrypted token blob. Never expose to browser/client queries.';

-- -----------------------------------------------------------------------------
-- 9. Notifications
-- -----------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'task_created',
      'task_needs_review',
      'task_completed',
      'task_failed',
      'review_approved',
      'review_changes_requested',
      'report_ready',
      'campaign_task_created',
      'meta_connection_connected',
      'ad_platform_setup_required',
      'provider_setup_required',
      'approval_pending',
      'content_item_created',
      'content_item_updated',
      'content_item_scheduled',
      'content_item_published',
      'content_item_failed',
      'publishing_failed',
      'publishing_setup_required',
      'scheduler_completed',
      'scheduler_failed',
      'calendar_plan_created',
      'recovery_issue_detected',
      'reel_draft_created',
      'reel_marked_ready',
      'reel_published',
      'reel_failed',
      'reel_ai_script_task_created',
      'reel_ai_caption_task_created',
      'creative_asset_created',
      'creative_prompt_ready',
      'creative_image_generated',
      'creative_image_failed'
    )
  ),
  title text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warning', 'error', 'critical')),
  related_entity_type text,
  related_entity_id uuid,
  related_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notifications is
  'In-app dashboard notifications scoped to workspace + user. No secrets.';
comment on column public.notifications.severity is 'UI severity for notification center filtering.';
comment on column public.notifications.related_entity_type is 'Optional entity type for deep-link routing.';
comment on column public.notifications.related_url is 'Optional in-app URL for notification action.';

-- -----------------------------------------------------------------------------
-- 10. Reels Studio
-- -----------------------------------------------------------------------------

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'instagram' check (platform = 'instagram'),
  type text not null default 'reel' check (type = 'reel'),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'scheduled', 'publishing', 'published', 'failed')),
  title text not null,
  offer text,
  goal text,
  target_audience text,
  market text,
  tone text,
  cta text,
  hook text,
  main_message text,
  script text,
  storyboard text,
  caption text,
  hashtags text[] not null default '{}',
  duration_seconds integer check (duration_seconds > 0),
  creative_type text,
  video_url text,
  cover_url text,
  subtitles text,
  music_note text,
  scheduled_for timestamptz,
  published_at timestamptz,
  published_media_id text,
  published_permalink text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reels is
  'Instagram Reels planning and publishing state. Publishing requires Meta OAuth setup.';

-- -----------------------------------------------------------------------------
-- 11. Creative Assets
-- -----------------------------------------------------------------------------

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  asset_type text not null check (
    asset_type in (
      'image',
      'video',
      'reel_cover',
      'reel_video',
      'ad_creative',
      'thumbnail',
      'campaign_visual',
      'carousel_slide',
      'story_visual'
    )
  ),
  platform text not null default 'general' check (
    platform in ('instagram', 'facebook', 'google_ads', 'pinterest', 'general')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'prompt_ready', 'generating', 'generated', 'failed', 'selected', 'archived')
  ),
  source text not null default 'prompt_only' check (source in ('prompt_only', 'openai', 'upload')),
  goal text,
  offer text,
  target_audience text,
  market text,
  tone text,
  style text,
  visual_direction text,
  text_overlay text,
  brand_colors text,
  notes text,
  prompt text,
  negative_prompt text,
  aspect_ratio text check (aspect_ratio is null or aspect_ratio in ('1:1', '4:5', '9:16', '16:9')),
  output_style text check (
    output_style is null
    or output_style in ('premium_saas', 'realistic', 'minimal', 'bold_ad', 'clean_corporate', 'luxury')
  ),
  image_url text,
  storage_path text,
  linked_reel_id uuid references public.reels(id) on delete set null,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_campaign_task_id uuid references public.tasks(id) on delete set null,
  model text,
  size text,
  quality text,
  estimated_cost_usd numeric,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.creative_assets is
  'Creative prompts and generated/uploaded assets. OpenAI keys and raw base64 must not be stored here.';
comment on column public.creative_assets.storage_path is
  'Path inside creative-assets storage bucket (workspace UUID prefix).';

-- -----------------------------------------------------------------------------
-- 12. Content Studio
-- -----------------------------------------------------------------------------

create table if not exists public.content_studio_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  platform text not null check (
    platform in ('facebook', 'instagram', 'google_ads', 'pinterest', 'linkedin')
  ),
  content_type text not null check (
    content_type in (
      'facebook_post',
      'instagram_post',
      'facebook_reel',
      'instagram_reel',
      'facebook_feed_ad',
      'instagram_feed_ad',
      'facebook_reel_ad',
      'instagram_reel_ad',
      'facebook_story_ad',
      'instagram_story_ad',
      'facebook_carousel_ad',
      'instagram_carousel_ad',
      'google_ads_campaign_draft',
      'pinterest_pin',
      'linkedin_post_planner'
    )
  ),
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'scheduled', 'published', 'failed', 'approval_pending', 'setup_required')
  ),
  objective text,
  prompt text,
  script text,
  caption text,
  ad_copy text,
  creative_brief text,
  schedule_at timestamptz,
  published_at timestamptz,
  provider_status text,
  provider_error text,
  provider_external_id text,
  provider_response_summary jsonb not null default '{}'::jsonb,
  last_provider_action_at timestamptz,
  scheduled_execution_status text check (
    scheduled_execution_status is null
    or scheduled_execution_status in (
      'pending', 'processing', 'succeeded', 'failed', 'setup_required',
      'approval_pending', 'billing_required', 'token_missing', 'manual_only',
      'unsupported', 'error'
    )
  ),
  scheduled_execution_started_at timestamptz,
  scheduled_execution_finished_at timestamptz,
  scheduled_execution_error text,
  scheduled_execution_attempts integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_studio_items is
  'Content and ad draft planning. No private provider credentials stored here.';
comment on column public.content_studio_items.provider_external_id is
  'Safe external provider ID only (post ID, campaign ID). No tokens.';
comment on column public.content_studio_items.provider_response_summary is
  'Safe provider response summary. Never store raw tokens or OAuth payloads.';
comment on column public.content_studio_items.scheduled_execution_status is
  'Cron scheduler execution status for due scheduled items.';

create table if not exists public.content_studio_item_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_studio_items(id) on delete cascade,
  creative_asset_id uuid not null references public.creative_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (content_item_id, creative_asset_id)
);

comment on table public.content_studio_item_assets is
  'Many-to-many link between content studio items and creative assets.';

create table if not exists public.content_studio_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content_item_id uuid references public.content_studio_items(id) on delete cascade,
  provider text not null check (provider in ('meta', 'google_ads', 'pinterest', 'linkedin')),
  action_type text not null check (
    action_type in (
      'publish_post',
      'publish_reel',
      'create_campaign_draft',
      'create_paused_meta_ad_draft',
      'publish_pin',
      'manual_handoff'
    )
  ),
  status text not null check (
    status in (
      'pending', 'succeeded', 'failed', 'setup_required', 'approval_pending',
      'billing_required', 'token_missing', 'manual_only', 'unsupported', 'error'
    )
  ),
  request_summary jsonb not null default '{}'::jsonb,
  provider_response_summary jsonb not null default '{}'::jsonb,
  error_message text,
  provider_external_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_studio_publish_attempts is
  'Safe publish attempt audit log. Never store raw provider secrets or full tokens.';

-- -----------------------------------------------------------------------------
-- 13. Projects & engineering modules
-- -----------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  slug text,
  description text,
  project_type text not null default 'software' check (
    project_type in ('software', 'SaaS', 'website', 'automation', 'marketing_campaign', 'AI_tool', 'internal_system', 'documentation')
  ),
  status text not null default 'planning' check (
    status in ('planning', 'active', 'paused', 'needs_review', 'ready_to_deploy', 'deployed', 'maintenance', 'archived')
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  tech_stack text,
  github_url text,
  production_url text,
  staging_url text,
  local_path_note text,
  documentation_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Internal project organization. Do not store API keys or secrets in notes/metadata.';

create table if not exists public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'general' check (
    category in (
      'development', 'deployment', 'bug_fix', 'ui_ux', 'supabase', 'vercel', 'n8n',
      'provider_setup', 'ads_publishing', 'reports', 'documentation', 'project_planning',
      'creative_assets', 'content_studio', 'agents', 'general'
    )
  ),
  subcategory text,
  target_tool text check (
    target_tool is null
    or target_tool in ('codex', 'opencode', 'kilo_code', 'n8n_ai', 'chatgpt', 'supabase_sql_editor', 'vercel_cli', 'general_ai_tool')
  ),
  prompt_text text not null,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prompt_library is
  'Reusable prompt templates per workspace. No secrets in prompt_text.';

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  version text,
  phase_name text,
  status text not null default 'draft' check (
    status in ('draft', 'ready_for_test', 'testing', 'ready_to_deploy', 'deployed', 'failed', 'rolled_back', 'archived')
  ),
  release_type text not null default 'feature' check (
    release_type in (
      'feature', 'bug_fix', 'ui_update', 'provider_update', 'database_migration',
      'deployment', 'documentation', 'stabilization', 'security', 'internal_tooling'
    )
  ),
  summary text,
  files_changed text,
  features_added text,
  fixes text,
  known_issues text,
  testing_checklist text,
  rollback_notes text,
  deploy_url text,
  main_production_url text,
  build_status text,
  lint_status text,
  typecheck_status text,
  deploy_status text,
  deployed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.releases is
  'Release tracking per project. Operational metadata only.';

create table if not exists public.safe_patch_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  change_request text not null,
  change_type text not null default 'feature' check (
    change_type in (
      'bug_fix', 'ui_update', 'feature', 'refactor', 'security', 'database_migration',
      'provider_update', 'docs', 'deployment', 'stabilization'
    )
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'draft' check (
    status in (
      'draft', 'needs_review', 'approved_to_prompt', 'copied_to_codex',
      'implemented_externally', 'rejected', 'archived'
    )
  ),
  affected_files text,
  implementation_plan text,
  safety_constraints text,
  test_checklist text,
  rollback_plan text,
  suggested_prompt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.safe_patch_plans is
  'Safe change planning records. Does not execute code or deployments.';

create table if not exists public.backup_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  backup_type text not null default 'workspace',
  categories text[] not null default '{}',
  record_counts jsonb not null default '{}'::jsonb,
  file_name text,
  file_size_bytes integer,
  status text not null default 'created' check (status in ('created', 'previewed', 'failed', 'archived')),
  warnings text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.backup_records is
  'Workspace backup metadata. Backup files stored server-side; no secrets in metadata.';

create table if not exists public.github_issue_task_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  github_owner text not null,
  github_repo text not null,
  github_issue_number integer not null,
  github_issue_url text not null,
  github_issue_title text,
  github_issue_state text,
  github_labels text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id, github_owner, github_repo, github_issue_number)
);

comment on table public.github_issue_task_links is
  'Links AgentFlow tasks to GitHub issues for project tracking.';

create table if not exists public.pull_request_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  github_owner text not null,
  github_repo text not null,
  pr_number integer not null,
  pr_url text not null,
  pr_title text,
  pr_state text,
  source_branch text,
  target_branch text,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  recommendation text not null default 'needs_manual_review' check (
    recommendation in (
      'safe_to_merge_after_tests', 'request_changes', 'needs_manual_review', 'do_not_merge_yet'
    )
  ),
  review_summary text,
  files_changed text,
  potential_issues text,
  security_notes text,
  testing_checklist text,
  release_notes_draft text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id, github_owner, github_repo, pr_number)
);

comment on table public.pull_request_reviews is
  'Saved GitHub PR review summaries. Fetched via server-side GITHUB_TOKEN.';

-- -----------------------------------------------------------------------------
-- 14. Security audit logs
-- -----------------------------------------------------------------------------

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  entity_type text,
  entity_id uuid,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.security_audit_logs is
  'Operational security audit trail. Written by service role only; no client INSERT.';

-- -----------------------------------------------------------------------------
-- 15. Billing foundation
-- -----------------------------------------------------------------------------

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  stripe_customer_id text unique,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_customers is
  'Stripe customer mapping. Never stores card details or Stripe secrets.';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'agency')),
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Stripe subscription mirror. Webhooks are source of truth; clients cannot set state.';

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'agency')),
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

comment on table public.usage_limits is
  'Plan quota limits. Downgrades never delete existing data.';

-- -----------------------------------------------------------------------------
-- 16. Agent Library analytics & playbooks
-- -----------------------------------------------------------------------------

create table if not exists public.agent_template_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null,
  template_name text not null,
  template_category text not null,
  action_type text not null check (
    action_type in (
      'view_template', 'use_with_alex', 'create_task', 'send_to_content_studio',
      'export_n8n_plan', 'copy_prompt', 'copy_workflow_plan', 'create_workflow_draft',
      'download_workflow_plan', 'create_tasks_from_workflow', 'add_template_to_workflow',
      'review_workflow', 'copy_workflow_review', 'download_workflow_review',
      'approval_confirmed_for_pending_tasks', 'blocked_unsafe_workflow_action',
      'save_workflow_playbook', 'update_workflow_playbook', 'open_workflow_playbook',
      'duplicate_workflow_playbook', 'favorite_workflow_playbook', 'delete_workflow_playbook',
      'export_workflow_playbook'
    )
  ),
  source_page text not null check (source_page in ('agent_library', 'alex', 'content_studio')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.agent_template_usage_events is
  'Agent Library usage analytics. No secrets, API keys, or private chat content.';

create table if not exists public.agent_workflow_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  steps jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  is_favorite boolean not null default false,
  last_opened_at timestamptz,
  last_used_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  readiness_summary jsonb not null default '{}'::jsonb,
  diagram jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_workflow_playbooks is
  'Saved workflow playbooks. Draft-only; does not execute n8n or providers.';

-- -----------------------------------------------------------------------------
-- 17. n8n callback idempotency & provider cache
-- -----------------------------------------------------------------------------

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

comment on table public.n8n_callback_events is
  'n8n callback idempotency store. No raw webhook payloads or secrets. Server-only.';

create table if not exists public.provider_readiness_cache (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  readiness_state text not null,
  message text,
  missing text[],
  last_checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (workspace_id, provider)
);

comment on table public.provider_readiness_cache is
  'Workspace provider readiness cache. service-role bypasses RLS for server writes.';

-- -----------------------------------------------------------------------------
-- 18. Indexes
-- -----------------------------------------------------------------------------

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists workspace_members_department_idx on public.workspace_members(workspace_id, department);
create index if not exists workspace_members_role_dept_idx on public.workspace_members(workspace_id, role, department);

create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists tasks_workspace_agent_department_idx on public.tasks(workspace_id, agent_department);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_agent_type_idx on public.tasks(agent_type);
create index if not exists tasks_status_idx on public.tasks(status);

create index if not exists task_reviews_workspace_id_idx on public.task_reviews(workspace_id);
create index if not exists task_reviews_task_id_idx on public.task_reviews(task_id);
create index if not exists task_events_workspace_id_idx on public.task_events(workspace_id);
create index if not exists task_events_task_id_idx on public.task_events(task_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);

create index if not exists ad_connections_workspace_id_idx on public.ad_connections(workspace_id);
create index if not exists ad_connections_user_id_idx on public.ad_connections(user_id);

create index if not exists notifications_workspace_user_created_idx
  on public.notifications(workspace_id, user_id, created_at desc);
create index if not exists notifications_workspace_user_status_idx
  on public.notifications(workspace_id, user_id, status);
create index if not exists notifications_workspace_user_type_idx
  on public.notifications(workspace_id, user_id, type);
create index if not exists notifications_workspace_user_severity_idx
  on public.notifications(workspace_id, user_id, severity);

create index if not exists reels_workspace_created_idx on public.reels(workspace_id, created_at desc);
create index if not exists reels_workspace_status_idx on public.reels(workspace_id, status);
create index if not exists reels_workspace_scheduled_idx
  on public.reels(workspace_id, scheduled_for) where scheduled_for is not null;

create index if not exists creative_assets_workspace_created_idx on public.creative_assets(workspace_id, created_at desc);
create index if not exists creative_assets_workspace_status_idx on public.creative_assets(workspace_id, status);
create index if not exists creative_assets_workspace_asset_type_idx on public.creative_assets(workspace_id, asset_type);
create index if not exists creative_assets_workspace_platform_idx on public.creative_assets(workspace_id, platform);

create index if not exists content_studio_items_workspace_updated_idx
  on public.content_studio_items(workspace_id, updated_at desc);
create index if not exists content_studio_items_workspace_status_idx
  on public.content_studio_items(workspace_id, status);
create index if not exists content_studio_items_workspace_content_type_idx
  on public.content_studio_items(workspace_id, content_type);
create index if not exists content_studio_items_due_scheduler_idx
  on public.content_studio_items(status, schedule_at, scheduled_execution_status)
  where status = 'scheduled' and schedule_at is not null;

create index if not exists content_studio_item_assets_item_idx on public.content_studio_item_assets(content_item_id);
create index if not exists content_studio_item_assets_asset_idx on public.content_studio_item_assets(creative_asset_id);

create index if not exists content_studio_publish_attempts_workspace_created_idx
  on public.content_studio_publish_attempts(workspace_id, created_at desc);
create index if not exists content_studio_publish_attempts_item_created_idx
  on public.content_studio_publish_attempts(content_item_id, created_at desc);

create unique index if not exists projects_workspace_slug_idx
  on public.projects(workspace_id, slug) where slug is not null;
create index if not exists projects_workspace_updated_idx on public.projects(workspace_id, updated_at desc);
create index if not exists projects_workspace_status_idx on public.projects(workspace_id, status);
create index if not exists projects_workspace_type_idx on public.projects(workspace_id, project_type);

create index if not exists prompt_library_workspace_updated_idx on public.prompt_library(workspace_id, updated_at desc);
create index if not exists prompt_library_workspace_category_idx on public.prompt_library(workspace_id, category);
create index if not exists prompt_library_workspace_tool_idx on public.prompt_library(workspace_id, target_tool);
create index if not exists prompt_library_workspace_favorite_idx on public.prompt_library(workspace_id, is_favorite);

create index if not exists releases_workspace_updated_idx on public.releases(workspace_id, updated_at desc);
create index if not exists releases_workspace_status_idx on public.releases(workspace_id, status);
create index if not exists releases_workspace_type_idx on public.releases(workspace_id, release_type);
create index if not exists releases_workspace_project_idx on public.releases(workspace_id, project_id);

create index if not exists safe_patch_plans_workspace_updated_idx on public.safe_patch_plans(workspace_id, updated_at desc);
create index if not exists safe_patch_plans_workspace_status_idx on public.safe_patch_plans(workspace_id, status);
create index if not exists safe_patch_plans_workspace_risk_idx on public.safe_patch_plans(workspace_id, risk_level);

create index if not exists security_audit_logs_workspace_created_idx
  on public.security_audit_logs(workspace_id, created_at desc);
create index if not exists security_audit_logs_workspace_event_idx
  on public.security_audit_logs(workspace_id, event_type);

create index if not exists subscriptions_workspace_created_idx on public.subscriptions(workspace_id, created_at desc);
create index if not exists subscriptions_workspace_status_idx on public.subscriptions(workspace_id, status);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

create index if not exists agent_template_usage_events_workspace_created_idx
  on public.agent_template_usage_events(workspace_id, created_at desc);
create index if not exists agent_template_usage_events_workspace_template_idx
  on public.agent_template_usage_events(workspace_id, template_id);
create index if not exists agent_template_usage_events_workspace_action_idx
  on public.agent_template_usage_events(workspace_id, action_type);

create index if not exists agent_workflow_playbooks_workspace_created_idx
  on public.agent_workflow_playbooks(workspace_id, created_at desc);
create index if not exists agent_workflow_playbooks_workspace_updated_idx
  on public.agent_workflow_playbooks(workspace_id, updated_at desc);
create index if not exists agent_workflow_playbooks_workspace_favorite_idx
  on public.agent_workflow_playbooks(workspace_id, is_favorite);
create index if not exists agent_workflow_playbooks_workspace_status_idx
  on public.agent_workflow_playbooks(workspace_id, status);

create index if not exists n8n_callback_events_task_id_idx on public.n8n_callback_events(task_id);
create index if not exists n8n_callback_events_workspace_id_idx on public.n8n_callback_events(workspace_id);
create index if not exists idx_provider_readiness_cache_expires_at on public.provider_readiness_cache(expires_at);

-- -----------------------------------------------------------------------------
-- 19. Triggers (updated_at + domain logic)
-- -----------------------------------------------------------------------------

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_completed_at on public.tasks;
create trigger set_tasks_completed_at
before update of status on public.tasks
for each row
when (new.status = 'completed' and old.status is distinct from 'completed')
execute function public.set_completed_at();

drop trigger if exists set_task_reviews_updated_at on public.task_reviews;
create trigger set_task_reviews_updated_at before update on public.task_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_task_review_workspace_before_insert on public.task_reviews;
create trigger set_task_review_workspace_before_insert before insert on public.task_reviews
for each row execute function public.set_task_review_workspace();

drop trigger if exists set_task_events_workspace_before_insert on public.task_events;
create trigger set_task_events_workspace_before_insert before insert on public.task_events
for each row execute function public.set_task_event_workspace();

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

drop trigger if exists on_workspace_created_add_owner on public.workspaces;
create trigger on_workspace_created_add_owner
after insert on public.workspaces
for each row execute function public.handle_new_workspace_owner();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_integration_settings_updated_at on public.integration_settings;
create trigger set_integration_settings_updated_at before update on public.integration_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_ad_connections_updated_at on public.ad_connections;
create trigger set_ad_connections_updated_at before update on public.ad_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_reels_updated_at on public.reels;
create trigger set_reels_updated_at before update on public.reels
for each row execute function public.set_updated_at();

drop trigger if exists set_creative_assets_updated_at on public.creative_assets;
create trigger set_creative_assets_updated_at before update on public.creative_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_content_studio_items_updated_at on public.content_studio_items;
create trigger set_content_studio_items_updated_at before update on public.content_studio_items
for each row execute function public.set_updated_at();

drop trigger if exists set_content_studio_publish_attempts_updated_at on public.content_studio_publish_attempts;
create trigger set_content_studio_publish_attempts_updated_at before update on public.content_studio_publish_attempts
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_prompt_library_updated_at on public.prompt_library;
create trigger set_prompt_library_updated_at before update on public.prompt_library
for each row execute function public.set_updated_at();

drop trigger if exists set_releases_updated_at on public.releases;
create trigger set_releases_updated_at before update on public.releases
for each row execute function public.set_updated_at();

drop trigger if exists set_safe_patch_plans_updated_at on public.safe_patch_plans;
create trigger set_safe_patch_plans_updated_at before update on public.safe_patch_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_github_issue_task_links_updated_at on public.github_issue_task_links;
create trigger set_github_issue_task_links_updated_at before update on public.github_issue_task_links
for each row execute function public.set_updated_at();

drop trigger if exists set_pull_request_reviews_updated_at on public.pull_request_reviews;
create trigger set_pull_request_reviews_updated_at before update on public.pull_request_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_billing_customers_updated_at on public.billing_customers;
create trigger set_billing_customers_updated_at before update on public.billing_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_usage_limits_updated_at on public.usage_limits;
create trigger set_usage_limits_updated_at before update on public.usage_limits
for each row execute function public.set_updated_at();

drop trigger if exists set_agent_workflow_playbooks_updated_at on public.agent_workflow_playbooks;
create trigger set_agent_workflow_playbooks_updated_at before update on public.agent_workflow_playbooks
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 20. RLS helper functions
-- -----------------------------------------------------------------------------

create or replace function public.is_workspace_member(check_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = check_workspace_id and wm.user_id = auth.uid()
    );
$$;

create or replace function public.is_workspace_admin(check_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = check_workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
    );
$$;

create or replace function public.has_min_role(
  check_workspace_id uuid,
  min_role public.rbac_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with role_rank(r, rank) as (
    values
      ('viewer'::public.rbac_role, 1),
      ('editor'::public.rbac_role, 2),
      ('operator'::public.rbac_role, 3),
      ('admin'::public.rbac_role, 4),
      ('owner'::public.rbac_role, 5)
  )
  select exists (
    select 1
    from public.workspace_members wm
    join role_rank r1 on r1.r = wm.role
    join role_rank r2 on r2.r = min_role
    where wm.workspace_id = check_workspace_id
      and wm.user_id = auth.uid()
      and r1.rank >= r2.rank
  );
$$;

comment on function public.is_workspace_member(uuid) is
  'True when the authenticated user belongs to the workspace.';
comment on function public.is_workspace_admin(uuid) is
  'True when the authenticated user is owner or admin in the workspace.';
comment on function public.has_min_role(uuid, public.rbac_role) is
  'True when the authenticated user has at least min_role in the workspace.';

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.has_min_role(uuid, public.rbac_role) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.has_min_role(uuid, public.rbac_role) to authenticated;

create or replace function public.catalog_dept_rbac_values(catalog_dept_id text)
returns public.department[]
language sql
immutable
as $$
  select case catalog_dept_id
    when 'research_strategy' then array['strategy']::public.department[]
    when 'content_growth' then array['content', 'social', 'creative']::public.department[]
    when 'sales_operations' then array['operations', 'paid_ads']::public.department[]
    when 'development_engineering' then array['operations', 'strategy']::public.department[]
    else array[]::public.department[]
  end;
$$;

comment on function public.catalog_dept_rbac_values(text) is
  'Maps agent catalog department_id values to RBAC department enum array.';

create or replace function public.user_can_access_task_department(
  check_workspace_id uuid,
  check_agent_type text,
  check_agent_department public.department default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    left join public.agents a
      on a.id = check_agent_type
      and a.is_active = true
    where wm.workspace_id = check_workspace_id
      and wm.user_id = auth.uid()
      and (
        wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
        or (
          wm.department is null
          and public.has_min_role(check_workspace_id, 'operator'::public.rbac_role)
        )
        or (
          wm.department is not null
          and a.department_id is not null
          and wm.department = any(public.catalog_dept_rbac_values(a.department_id))
        )
        or (
          wm.department is not null
          and check_agent_department is not null
          and wm.department = check_agent_department
        )
        or (
          a.id is null
          and check_agent_department is null
        )
      )
  );
$$;

comment on function public.user_can_access_task_department(uuid, text, public.department) is
  'True when the member may access a task based on RBAC role + department vs agent catalog mapping.';

revoke all on function public.catalog_dept_rbac_values(text) from public;
revoke all on function public.user_can_access_task_department(uuid, text, public.department) from public;
grant execute on function public.catalog_dept_rbac_values(text) to authenticated;
grant execute on function public.user_can_access_task_department(uuid, text, public.department) to authenticated;

create or replace function public.user_can_access_rbac_department(
  check_workspace_id uuid,
  required_dept public.department
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = check_workspace_id
      and wm.user_id = auth.uid()
      and (
        wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
        or (
          wm.department is null
          and public.has_min_role(check_workspace_id, 'operator'::public.rbac_role)
        )
        or (
          wm.department is not null
          and wm.department = required_dept
        )
      )
  );
$$;

comment on function public.user_can_access_rbac_department(uuid, public.department) is
  'True when the member may access a resource scoped to required_dept (owner/admin bypass, operators cross-dept).';

create or replace function public.creative_asset_rbac_department(
  asset_type text,
  platform text
)
returns public.department
language sql
immutable
as $$
  select case
    when platform in ('google_ads', 'pinterest') then 'paid_ads'::public.department
    when asset_type in ('ad_creative', 'campaign_visual') then 'paid_ads'::public.department
    when asset_type in ('reel_cover', 'reel_video') then 'social'::public.department
    when platform in ('instagram', 'facebook')
      and asset_type in ('image', 'video', 'thumbnail', 'carousel_slide', 'story_visual')
      then 'creative'::public.department
    else 'creative'::public.department
  end;
$$;

comment on function public.creative_asset_rbac_department(text, text) is
  'Maps creative asset type/platform to RBAC department for RLS.';

create or replace function public.content_studio_item_rbac_department(
  platform text,
  content_type text
)
returns public.department
language sql
immutable
as $$
  select case
    when platform = 'google_ads' or content_type like '%google_ads%' then 'paid_ads'::public.department
    when platform = 'pinterest' or content_type like '%pinterest%' then 'paid_ads'::public.department
    when content_type like '%reel%' then 'social'::public.department
    when platform in ('instagram', 'facebook') then 'social'::public.department
    when platform = 'linkedin' then 'content'::public.department
    else 'content'::public.department
  end;
$$;

comment on function public.content_studio_item_rbac_department(text, text) is
  'Maps content studio platform/content_type to RBAC department for RLS.';

create or replace function public.publish_attempt_rbac_department(
  provider text,
  action_type text
)
returns public.department
language sql
immutable
as $$
  select case
    when provider = 'google_ads' or action_type like '%campaign%' then 'paid_ads'::public.department
    when provider = 'pinterest' then 'paid_ads'::public.department
    when provider = 'linkedin' then 'content'::public.department
    when action_type like '%reel%' then 'social'::public.department
    else 'social'::public.department
  end;
$$;

comment on function public.publish_attempt_rbac_department(text, text) is
  'Maps publish attempt provider/action to RBAC department for RLS.';

revoke all on function public.user_can_access_rbac_department(uuid, public.department) from public;
revoke all on function public.creative_asset_rbac_department(text, text) from public;
revoke all on function public.content_studio_item_rbac_department(text, text) from public;
revoke all on function public.publish_attempt_rbac_department(text, text) from public;
grant execute on function public.user_can_access_rbac_department(uuid, public.department) to authenticated;
grant execute on function public.creative_asset_rbac_department(text, text) to authenticated;
grant execute on function public.content_studio_item_rbac_department(text, text) to authenticated;
grant execute on function public.publish_attempt_rbac_department(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 21. Enable RLS on all public tables
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.departments enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reviews enable row level security;
alter table public.task_events enable row level security;
alter table public.user_preferences enable row level security;
alter table public.integration_settings enable row level security;
alter table public.ad_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.reels enable row level security;
alter table public.creative_assets enable row level security;
alter table public.content_studio_items enable row level security;
alter table public.content_studio_item_assets enable row level security;
alter table public.content_studio_publish_attempts enable row level security;
alter table public.projects enable row level security;
alter table public.prompt_library enable row level security;
alter table public.releases enable row level security;
alter table public.safe_patch_plans enable row level security;
alter table public.backup_records enable row level security;
alter table public.github_issue_task_links enable row level security;
alter table public.pull_request_reviews enable row level security;
alter table public.security_audit_logs enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_limits enable row level security;
alter table public.agent_template_usage_events enable row level security;
alter table public.agent_workflow_playbooks enable row level security;
alter table public.n8n_callback_events enable row level security;
alter table public.provider_readiness_cache enable row level security;

-- -----------------------------------------------------------------------------
-- 22. RLS policies — core tables
-- -----------------------------------------------------------------------------

drop policy if exists "Profiles are visible to their owner" on public.profiles;
create policy "Profiles are visible to their owner" on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Workspace members can view workspaces" on public.workspaces;
create policy "Workspace members can view workspaces" on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Users can create owned workspaces" on public.workspaces;
create policy "Users can create owned workspaces" on public.workspaces for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Workspace admins can update workspaces" on public.workspaces;
create policy "Workspace admins can update workspaces" on public.workspaces for update to authenticated
using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists "Workspace admins can delete workspaces" on public.workspaces;
create policy "Workspace admins can delete workspaces" on public.workspaces for delete to authenticated
using (public.is_workspace_admin(id));

drop policy if exists "Workspace members can view memberships" on public.workspace_members;
create policy "Workspace members can view memberships" on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can add members" on public.workspace_members;
create policy "Workspace admins can add members" on public.workspace_members for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update members" on public.workspace_members;
create policy "Workspace admins can update members" on public.workspace_members for update to authenticated
using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can remove members" on public.workspace_members;
create policy "Workspace admins can remove members" on public.workspace_members for delete to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "Anyone can read department catalog" on public.departments;
create policy "Anyone can read department catalog" on public.departments for select to anon, authenticated
using (true);

drop policy if exists "Anyone can read active agent catalog" on public.agents;
create policy "Anyone can read active agent catalog" on public.agents for select to anon, authenticated
using (is_active = true);

drop policy if exists "Workspace members can view tasks" on public.tasks;
create policy "Workspace members can view tasks" on public.tasks for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.user_can_access_task_department(workspace_id, agent_type, agent_department)
);

drop policy if exists "Workspace members can create tasks" on public.tasks;
drop policy if exists "Editors can create tasks in their department" on public.tasks;
create policy "Editors can create tasks in their department" on public.tasks for insert to authenticated
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and user_id = auth.uid()
  and public.user_can_access_task_department(workspace_id, agent_type, agent_department)
);

drop policy if exists "Workspace members can update tasks" on public.tasks;
drop policy if exists "Editors can update tasks in their department" on public.tasks;
create policy "Editors can update tasks in their department" on public.tasks for update to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_task_department(workspace_id, agent_type, agent_department)
)
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_task_department(workspace_id, agent_type, agent_department)
);

drop policy if exists "Workspace admins or creators can delete tasks" on public.tasks;
create policy "Workspace admins or creators can delete tasks" on public.tasks for delete to authenticated
using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

drop policy if exists "Workspace members can view reviews" on public.task_reviews;
create policy "Workspace members can view reviews" on public.task_reviews for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create reviews" on public.task_reviews;
create policy "Workspace members can create reviews" on public.task_reviews for insert to authenticated
with check (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid());

drop policy if exists "Review authors can update reviews" on public.task_reviews;
create policy "Review authors can update reviews" on public.task_reviews for update to authenticated
using (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and reviewer_id = auth.uid());

drop policy if exists "Workspace admins or authors can delete reviews" on public.task_reviews;
create policy "Workspace admins or authors can delete reviews" on public.task_reviews for delete to authenticated
using (public.is_workspace_admin(workspace_id) or reviewer_id = auth.uid());

drop policy if exists "Workspace members can view task events" on public.task_events;
create policy "Workspace members can view task events" on public.task_events for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create task events" on public.task_events;
create policy "Workspace members can create task events" on public.task_events for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (actor_id is null or actor_id = auth.uid()));

drop policy if exists "Users can view their preferences" on public.user_preferences;
create policy "Users can view their preferences" on public.user_preferences for select to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can create their preferences" on public.user_preferences;
create policy "Users can create their preferences" on public.user_preferences for insert to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can update their preferences" on public.user_preferences;
create policy "Users can update their preferences" on public.user_preferences for update to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can delete their preferences" on public.user_preferences;
create policy "Users can delete their preferences" on public.user_preferences for delete to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Workspace members can view integration settings" on public.integration_settings;
create policy "Workspace members can view integration settings" on public.integration_settings for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins can create integration settings" on public.integration_settings;
create policy "Workspace admins can create integration settings" on public.integration_settings for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Workspace admins can update integration settings" on public.integration_settings;
create policy "Workspace admins can update integration settings" on public.integration_settings for update to authenticated
using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- ad_connections + n8n_callback_events: RLS enabled, no authenticated policies (service role only)

-- -----------------------------------------------------------------------------
-- 23. RLS policies — feature tables
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications" on public.notifications for select to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can create their notifications" on public.notifications;
create policy "Users can create their notifications" on public.notifications for insert to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications" on public.notifications for update to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Users can select reels in their workspace" on public.reels;
drop policy if exists "Members can view reels in their department" on public.reels;
create policy "Members can view reels in their department" on public.reels for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.user_can_access_rbac_department(workspace_id, 'social'::public.department)
);

drop policy if exists "Users can insert reels in their workspace" on public.reels;
drop policy if exists "Editors can create reels in their department" on public.reels;
create policy "Editors can create reels in their department" on public.reels for insert to authenticated
with check (
  auth.uid() = user_id
  and public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(workspace_id, 'social'::public.department)
);

drop policy if exists "Users can update reels in their workspace" on public.reels;
drop policy if exists "Editors can update reels in their department" on public.reels;
create policy "Editors can update reels in their department" on public.reels for update to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(workspace_id, 'social'::public.department)
)
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(workspace_id, 'social'::public.department)
);

drop policy if exists "Users can delete reels in their workspace" on public.reels;
drop policy if exists "Editors can delete reels in their department" on public.reels;
create policy "Editors can delete reels in their department" on public.reels for delete to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(workspace_id, 'social'::public.department)
);

drop policy if exists "Users can select creative assets in their workspace" on public.creative_assets;
drop policy if exists "Members can view creative assets in their department" on public.creative_assets;
create policy "Members can view creative assets in their department" on public.creative_assets for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.creative_asset_rbac_department(asset_type, platform)
  )
);

drop policy if exists "Users can insert creative assets in their workspace" on public.creative_assets;
drop policy if exists "Editors can create creative assets in their department" on public.creative_assets;
create policy "Editors can create creative assets in their department" on public.creative_assets for insert to authenticated
with check (
  auth.uid() = user_id
  and public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.creative_asset_rbac_department(asset_type, platform)
  )
);

drop policy if exists "Users can update creative assets in their workspace" on public.creative_assets;
drop policy if exists "Editors can update creative assets in their department" on public.creative_assets;
create policy "Editors can update creative assets in their department" on public.creative_assets for update to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.creative_asset_rbac_department(asset_type, platform)
  )
)
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.creative_asset_rbac_department(asset_type, platform)
  )
);

drop policy if exists "Users can delete creative assets in their workspace" on public.creative_assets;
drop policy if exists "Editors can delete creative assets in their department" on public.creative_assets;
create policy "Editors can delete creative assets in their department" on public.creative_assets for delete to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.creative_asset_rbac_department(asset_type, platform)
  )
);

drop policy if exists "Workspace members can view content studio items" on public.content_studio_items;
drop policy if exists "Members can view content studio items in their department" on public.content_studio_items;
create policy "Members can view content studio items in their department" on public.content_studio_items for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.content_studio_item_rbac_department(platform, content_type)
  )
);

drop policy if exists "Workspace members can create content studio items" on public.content_studio_items;
drop policy if exists "Editors can create content studio items in their department" on public.content_studio_items;
create policy "Editors can create content studio items in their department" on public.content_studio_items for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.content_studio_item_rbac_department(platform, content_type)
  )
);

drop policy if exists "Workspace members can update content studio items" on public.content_studio_items;
drop policy if exists "Editors can update content studio items in their department" on public.content_studio_items;
create policy "Editors can update content studio items in their department" on public.content_studio_items for update to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.content_studio_item_rbac_department(platform, content_type)
  )
)
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.content_studio_item_rbac_department(platform, content_type)
  )
);

drop policy if exists "Workspace members can delete content studio items" on public.content_studio_items;
drop policy if exists "Editors can delete content studio items in their department" on public.content_studio_items;
create policy "Editors can delete content studio items in their department" on public.content_studio_items for delete to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.content_studio_item_rbac_department(platform, content_type)
  )
);

drop policy if exists "Workspace members can view content studio item assets" on public.content_studio_item_assets;
drop policy if exists "Members can view content studio item assets in their department" on public.content_studio_item_assets;
create policy "Members can view content studio item assets in their department" on public.content_studio_item_assets for select to authenticated
using (exists (
  select 1 from public.content_studio_items item
  where item.id = content_item_id
    and public.is_workspace_member(item.workspace_id)
    and public.user_can_access_rbac_department(
      item.workspace_id,
      public.content_studio_item_rbac_department(item.platform, item.content_type)
    )
));

drop policy if exists "Workspace members can create content studio item assets" on public.content_studio_item_assets;
drop policy if exists "Editors can create content studio item assets in their department" on public.content_studio_item_assets;
create policy "Editors can create content studio item assets in their department" on public.content_studio_item_assets for insert to authenticated
with check (exists (
  select 1 from public.content_studio_items item
  where item.id = content_item_id
    and public.has_min_role(item.workspace_id, 'editor'::public.rbac_role)
    and public.user_can_access_rbac_department(
      item.workspace_id,
      public.content_studio_item_rbac_department(item.platform, item.content_type)
    )
));

drop policy if exists "Workspace members can delete content studio item assets" on public.content_studio_item_assets;
drop policy if exists "Editors can delete content studio item assets in their department" on public.content_studio_item_assets;
create policy "Editors can delete content studio item assets in their department" on public.content_studio_item_assets for delete to authenticated
using (exists (
  select 1 from public.content_studio_items item
  where item.id = content_item_id
    and public.has_min_role(item.workspace_id, 'editor'::public.rbac_role)
    and public.user_can_access_rbac_department(
      item.workspace_id,
      public.content_studio_item_rbac_department(item.platform, item.content_type)
    )
));

drop policy if exists "Workspace members can view content studio publish attempts" on public.content_studio_publish_attempts;
drop policy if exists "Members can view publish attempts in their department" on public.content_studio_publish_attempts;
create policy "Members can view publish attempts in their department" on public.content_studio_publish_attempts for select to authenticated
using (
  public.is_workspace_member(workspace_id)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.publish_attempt_rbac_department(provider, action_type)
  )
);

drop policy if exists "Workspace members can create content studio publish attempts" on public.content_studio_publish_attempts;
drop policy if exists "Editors can create publish attempts in their department" on public.content_studio_publish_attempts;
create policy "Editors can create publish attempts in their department" on public.content_studio_publish_attempts for insert to authenticated
with check (
  (created_by is null or created_by = auth.uid())
  and public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.publish_attempt_rbac_department(provider, action_type)
  )
);

drop policy if exists "Workspace members can update content studio publish attempts" on public.content_studio_publish_attempts;
drop policy if exists "Editors can update publish attempts in their department" on public.content_studio_publish_attempts;
create policy "Editors can update publish attempts in their department" on public.content_studio_publish_attempts for update to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.publish_attempt_rbac_department(provider, action_type)
  )
)
with check (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.publish_attempt_rbac_department(provider, action_type)
  )
);

drop policy if exists "Workspace members can delete content studio publish attempts" on public.content_studio_publish_attempts;
drop policy if exists "Editors can delete publish attempts in their department" on public.content_studio_publish_attempts;
create policy "Editors can delete publish attempts in their department" on public.content_studio_publish_attempts for delete to authenticated
using (
  public.has_min_role(workspace_id, 'editor'::public.rbac_role)
  and public.user_can_access_rbac_department(
    workspace_id,
    public.publish_attempt_rbac_department(provider, action_type)
  )
);

drop policy if exists "Workspace members can view projects" on public.projects;
create policy "Workspace members can view projects" on public.projects for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create projects" on public.projects;
create policy "Workspace members can create projects" on public.projects for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "Workspace members can update projects" on public.projects;
create policy "Workspace members can update projects" on public.projects for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete projects" on public.projects;
create policy "Workspace admins or creators can delete projects" on public.projects for delete to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view prompt library items" on public.prompt_library;
create policy "Workspace members can view prompt library items" on public.prompt_library for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create prompt library items" on public.prompt_library;
create policy "Workspace members can create prompt library items" on public.prompt_library for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "Workspace members can update prompt library items" on public.prompt_library;
create policy "Workspace members can update prompt library items" on public.prompt_library for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete prompt library items" on public.prompt_library;
create policy "Workspace admins or creators can delete prompt library items" on public.prompt_library for delete to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view releases" on public.releases;
create policy "Workspace members can view releases" on public.releases for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create releases" on public.releases;
create policy "Workspace members can create releases" on public.releases for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "Workspace members can update releases" on public.releases;
create policy "Workspace members can update releases" on public.releases for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete releases" on public.releases;
create policy "Workspace admins or creators can delete releases" on public.releases for delete to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can view safe patch plans" on public.safe_patch_plans for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can create safe patch plans" on public.safe_patch_plans for insert to authenticated
with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "Workspace members can update safe patch plans" on public.safe_patch_plans;
create policy "Workspace members can update safe patch plans" on public.safe_patch_plans for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace admins or creators can delete safe patch plans" on public.safe_patch_plans;
create policy "Workspace admins or creators can delete safe patch plans" on public.safe_patch_plans for delete to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view backup records" on public.backup_records;
create policy "Workspace members can view backup records" on public.backup_records for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create backup records" on public.backup_records;
create policy "Workspace members can create backup records" on public.backup_records for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "Workspace admins or creators can archive backup records" on public.backup_records;
create policy "Workspace admins or creators can archive backup records" on public.backup_records for update to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid())
with check (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view github issue task links" on public.github_issue_task_links;
create policy "Workspace members can view github issue task links" on public.github_issue_task_links for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create github issue task links" on public.github_issue_task_links;
create policy "Workspace members can create github issue task links" on public.github_issue_task_links for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "Workspace admins or creators can update github issue task links" on public.github_issue_task_links;
create policy "Workspace admins or creators can update github issue task links" on public.github_issue_task_links for update to authenticated
using (public.is_workspace_admin(workspace_id) or created_by = auth.uid())
with check (public.is_workspace_admin(workspace_id) or created_by = auth.uid());

drop policy if exists "Workspace members can view pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can view pull request reviews" on public.pull_request_reviews for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can create pull request reviews" on public.pull_request_reviews for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "Workspace members can update pull request reviews" on public.pull_request_reviews;
create policy "Workspace members can update pull request reviews" on public.pull_request_reviews for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- Security audit logs (hardened: no client INSERT)
drop policy if exists "Workspace members can view security audit logs" on public.security_audit_logs;
drop policy if exists "Workspace owners and admins can view security audit logs" on public.security_audit_logs;
create policy "Workspace owners and admins can view security audit logs" on public.security_audit_logs for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = security_audit_logs.workspace_id
    and wm.user_id = auth.uid()
    and wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
));

drop policy if exists "Workspace members can create security audit logs" on public.security_audit_logs;
drop policy if exists "Server can create security audit logs" on public.security_audit_logs;

drop policy if exists "Workspace admins can delete security audit logs" on public.security_audit_logs;
drop policy if exists "Workspace owners can delete security audit logs" on public.security_audit_logs;
create policy "Workspace owners can delete security audit logs" on public.security_audit_logs for delete to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = security_audit_logs.workspace_id
    and wm.user_id = auth.uid()
    and wm.role = 'owner'::public.rbac_role
));

-- Billing
drop policy if exists "Workspace owners and admins can view billing customers" on public.billing_customers;
create policy "Workspace owners and admins can view billing customers" on public.billing_customers for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = billing_customers.workspace_id
    and wm.user_id = auth.uid()
    and wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
));

drop policy if exists "Workspace owners can create billing customers" on public.billing_customers;
drop policy if exists "Workspace owners can update billing customers" on public.billing_customers;

drop policy if exists "Workspace owners and admins can view subscriptions" on public.subscriptions;
create policy "Workspace owners and admins can view subscriptions" on public.subscriptions for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = subscriptions.workspace_id
    and wm.user_id = auth.uid()
    and wm.role in ('owner'::public.rbac_role, 'admin'::public.rbac_role)
));

drop policy if exists "Workspace owners can create subscriptions" on public.subscriptions;
drop policy if exists "Workspace owners can update subscriptions" on public.subscriptions;

drop policy if exists "Workspace members can view usage limits" on public.usage_limits;
create policy "Workspace members can view usage limits" on public.usage_limits for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = usage_limits.workspace_id and wm.user_id = auth.uid()
));

drop policy if exists "Workspace owners can update usage limits" on public.usage_limits;
create policy "Workspace owners can update usage limits" on public.usage_limits for update to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = usage_limits.workspace_id
    and wm.user_id = auth.uid()
    and wm.role = 'owner'::public.rbac_role
))
with check (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = usage_limits.workspace_id
    and wm.user_id = auth.uid()
    and wm.role = 'owner'::public.rbac_role
));

-- Agent Library
drop policy if exists "Workspace members can view agent template usage events" on public.agent_template_usage_events;
create policy "Workspace members can view agent template usage events" on public.agent_template_usage_events for select to authenticated
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = agent_template_usage_events.workspace_id and wm.user_id = auth.uid()
));

drop policy if exists "Workspace members can create agent template usage events" on public.agent_template_usage_events;
create policy "Workspace members can create agent template usage events" on public.agent_template_usage_events for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = agent_template_usage_events.workspace_id and wm.user_id = auth.uid()
));

drop policy if exists "Workspace members can read workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can read workflow playbooks" on public.agent_workflow_playbooks for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can insert own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can insert own workflow playbooks" on public.agent_workflow_playbooks for insert to authenticated
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can update own workflow playbooks" on public.agent_workflow_playbooks for update to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete own workflow playbooks" on public.agent_workflow_playbooks;
create policy "Workspace members can delete own workflow playbooks" on public.agent_workflow_playbooks for delete to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- Provider readiness cache
drop policy if exists "Workspace members can view provider readiness cache" on public.provider_readiness_cache;
create policy "Workspace members can view provider readiness cache" on public.provider_readiness_cache for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Server can insert provider readiness cache" on public.provider_readiness_cache;
create policy "Server can insert provider readiness cache" on public.provider_readiness_cache for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Server can update provider readiness cache" on public.provider_readiness_cache;
create policy "Server can update provider readiness cache" on public.provider_readiness_cache for update to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "Server can delete provider readiness cache" on public.provider_readiness_cache;
create policy "Server can delete provider readiness cache" on public.provider_readiness_cache for delete to authenticated
using (public.is_workspace_member(workspace_id));

-- -----------------------------------------------------------------------------
-- 24. Storage bucket (private creative-assets)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  false,
  104857600,
  array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can read creative asset files" on storage.objects;
create policy "Workspace members can read creative asset files" on storage.objects for select to authenticated
using (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can upload creative asset files" on storage.objects;
create policy "Workspace members can upload creative asset files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can update creative asset files" on storage.objects;
create policy "Workspace members can update creative asset files" on storage.objects for update to authenticated
using (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can delete creative asset files" on storage.objects;
create policy "Workspace members can delete creative asset files" on storage.objects for delete to authenticated
using (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
-- -----------------------------------------------------------------------------
-- 25. Seed data — departments & agents catalog
-- -----------------------------------------------------------------------------
insert into public.departments (id, name, description, color, sort_order)
values
  ('research_strategy', 'Research & Strategy', 'Market intelligence, competitive analysis, and strategic planning', '#8B3CDE', 1),
  ('content_growth', 'Content & Growth', 'Content creation, marketing, and audience engagement', '#F55477', 2),
  ('sales_operations', 'Sales & Operations', 'Lead generation, customer relations, and performance analytics', '#000000', 3)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.agents (
  id,
  department_id,
  name,
  role,
  description,
  capabilities,
  example_tasks,
  icon,
  color,
  sort_order,
  is_active
)
values
  (
    'market_research',
    'research_strategy',
    'Market Research Agent',
    'Research & Strategy',
    'Research market trends, analyze industry data, and generate insights about target markets.',
    array['Market trend analysis', 'Industry data collection', 'Competitive intelligence', 'Consumer behavior analysis', 'Market sizing and forecasting'],
    array['Analyze the SaaS market in North America', 'Research consumer trends in e-commerce', 'Identify emerging market opportunities'],
    'Search',
    '#8B3CDE',
    1,
    true
  ),
  (
    'competitor_analysis',
    'research_strategy',
    'Competitor Analysis Agent',
    'Research & Strategy',
    'Analyze competitor strategies, strengths, weaknesses, and market positioning.',
    array['Competitor profiling', 'SWOT analysis', 'Pricing strategy analysis', 'Feature comparison', 'Market positioning assessment'],
    array['Analyze top 5 competitors in fintech', 'Compare pricing strategies', 'Assess competitive threats'],
    'Target',
    '#8B3CDE',
    2,
    true
  ),
  (
    'audience_persona',
    'research_strategy',
    'Audience Persona Agent',
    'Research & Strategy',
    'Create detailed buyer personas and audience segments based on market research.',
    array['Demographic analysis', 'Psychographic profiling', 'Buyer journey mapping', 'Persona development', 'Audience segmentation'],
    array['Create B2B buyer personas', 'Segment target audience', 'Map customer journey'],
    'Users',
    '#8B3CDE',
    3,
    true
  ),
  (
    'product_idea',
    'research_strategy',
    'Product Idea Agent',
    'Research & Strategy',
    'Generate innovative product concepts and validate market opportunities.',
    array['Idea generation', 'Market validation', 'Feature prioritization', 'Concept testing', 'Innovation frameworks'],
    array['Generate 10 mobile app ideas', 'Validate product-market fit', 'Prioritize feature roadmap'],
    'Lightbulb',
    '#8B3CDE',
    4,
    true
  ),
  (
    'seo_keyword',
    'research_strategy',
    'SEO Keyword Agent',
    'Research & Strategy',
    'Discover high-value keywords and optimize content for search rankings.',
    array['Keyword research', 'Search intent analysis', 'Competition analysis', 'Content optimization', 'Ranking prediction'],
    array['Find high-volume keywords', 'Analyze keyword difficulty', 'Optimize content for SEO'],
    'Search',
    '#8B3CDE',
    5,
    true
  ),
  (
    'strategy_planner',
    'research_strategy',
    'Strategy Planner Agent',
    'Research & Strategy',
    'Develop comprehensive business strategies and execution roadmaps.',
    array['Strategic planning', 'Goal setting', 'Roadmap creation', 'Resource allocation', 'Risk assessment'],
    array['Create go-to-market strategy', 'Develop quarterly roadmap', 'Assess strategic risks'],
    'BarChart3',
    '#8B3CDE',
    6,
    true
  ),
  (
    'social_media_content',
    'content_growth',
    'Social Media Content Agent',
    'Content & Growth',
    'Generate engaging social media posts and platform-specific content strategies.',
    array['Content ideation', 'Platform optimization', 'Hashtag strategy', 'Posting schedule', 'Engagement analysis'],
    array['Create LinkedIn content calendar', 'Generate Twitter thread series', 'Plan Instagram campaign'],
    'Megaphone',
    '#F55477',
    7,
    true
  ),
  (
    'copywriting',
    'content_growth',
    'Copywriting Agent',
    'Content & Growth',
    'Create persuasive marketing copy for landing pages, ads, and promotional materials.',
    array['Landing page copy', 'Ad copy creation', 'Email copywriting', 'Brand voice consistency', 'Conversion optimization'],
    array['Write landing page copy', 'Create Facebook ad variations', 'Draft email sequences'],
    'FileText',
    '#F55477',
    8,
    true
  ),
  (
    'ads_script',
    'content_growth',
    'Ads Script Agent',
    'Content & Growth',
    'Write compelling advertising scripts for video, display, and paid campaigns.',
    array['Script writing', 'Storyboarding', 'A/B testing variations', 'Call-to-action optimization', 'Platform adaptation'],
    array['Create 30-second video ad', 'Write display ad copy', 'Develop YouTube script'],
    'Megaphone',
    '#F55477',
    9,
    true
  ),
  (
    'email_marketing',
    'content_growth',
    'Email Marketing Agent',
    'Content & Growth',
    'Design and write effective email campaigns and nurture sequences.',
    array['Campaign creation', 'Segmentation strategy', 'A/B testing', 'Automation sequences', 'Performance tracking'],
    array['Create welcome email series', 'Write promotional newsletter', 'Design drip campaign'],
    'Mail',
    '#F55477',
    10,
    true
  ),
  (
    'blog_seo_article',
    'content_growth',
    'Blog SEO Article Agent',
    'Content & Growth',
    'Create SEO-optimized blog articles that rank and drive organic traffic.',
    array['SEO optimization', 'Content structuring', 'Keyword integration', 'Readability scoring', 'Internal linking strategy'],
    array['Write 2000-word guide', 'Optimize existing content', 'Create content cluster'],
    'FileText',
    '#F55477',
    11,
    true
  ),
  (
    'visual_brief',
    'content_growth',
    'Visual Brief Agent',
    'Content & Growth',
    'Generate detailed creative briefs for designers, illustrators, and visual content creators.',
    array['Brief creation', 'Brand guideline adherence', 'Creative direction', 'Asset specification', 'Quality control'],
    array['Create infographic brief', 'Design social media template spec', 'Develop style guide'],
    'Image',
    '#F55477',
    12,
    true
  ),
  (
    'lead_finder',
    'sales_operations',
    'Lead Finder Agent',
    'Sales & Operations',
    'Identify and qualify potential leads from various sources and databases.',
    array['Lead sourcing', 'Database mining', 'Contact enrichment', 'Intent detection', 'Lead scoring'],
    array['Find 100 qualified leads', 'Research target accounts', 'Build prospect database'],
    'UserPlus',
    '#000000',
    13,
    true
  ),
  (
    'lead_qualifier',
    'sales_operations',
    'Lead Qualifier Agent',
    'Sales & Operations',
    'Score and qualify leads based on fit, interest, and buying signals.',
    array['Lead scoring', 'BANT analysis', 'Fit assessment', 'Priority ranking', 'Disqualification filtering'],
    array['Score 50 incoming leads', 'Qualify MQL to SQL', 'Assess lead readiness'],
    'UserCheck',
    '#000000',
    14,
    true
  ),
  (
    'outreach_message',
    'sales_operations',
    'Outreach Message Agent',
    'Sales & Operations',
    'Craft personalized outreach messages for cold emails and prospecting campaigns.',
    array['Message personalization', 'Template creation', 'Sequence design', 'A/B test variants', 'Response optimization'],
    array['Create email sequence', 'Write LinkedIn outreach', 'Draft sales pitch'],
    'MessageCircle',
    '#000000',
    15,
    true
  ),
  (
    'crm_update',
    'sales_operations',
    'CRM Update Agent',
    'Sales & Operations',
    'Automatically update and maintain CRM records with latest customer interactions.',
    array['CRM synchronization', 'Data validation', 'Activity logging', 'Report generation', 'Integration management'],
    array['Sync Salesforce data', 'Update deal stages', 'Generate activity report'],
    'Database',
    '#000000',
    16,
    true
  ),
  (
    'customer_support',
    'sales_operations',
    'Customer Support Agent',
    'Sales & Operations',
    'Handle customer inquiries, provide solutions, and maintain support documentation.',
    array['Ticket triage', 'Knowledge base creation', 'FAQ generation', 'Response drafting', 'Issue categorization'],
    array['Draft support response', 'Create help documentation', 'Analyze support tickets'],
    'Headphones',
    '#000000',
    17,
    true
  ),
  (
    'analytics_report',
    'sales_operations',
    'Analytics Report Agent',
    'Sales & Operations',
    'Generate comprehensive reports from sales data, metrics, and KPIs.',
    array['Data analysis', 'Report generation', 'KPI tracking', 'Trend identification', 'Dashboard creation'],
    array['Create monthly report', 'Analyze conversion funnel', 'Generate performance dashboard'],
    'PieChart',
    '#000000',
    18,
    true
  )
on conflict (id) do update
set
  department_id = excluded.department_id,
  name = excluded.name,
  role = excluded.role,
  description = excluded.description,
  capabilities = excluded.capabilities,
  example_tasks = excluded.example_tasks,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Development & Engineering department + agents
insert into public.departments (id, name, description, color, sort_order)
values
  (
    'development_engineering',
    'Development & Engineering',
    'Helps the manager plan, review, debug, document, test, and deploy software projects inside AgentFlow AI.',
    '#CA2851',
    4
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.agents (
  id,
  department_id,
  name,
  role,
  description,
  capabilities,
  example_tasks,
  icon,
  color,
  sort_order,
  is_active
)
values
  (
    'code-review-agent',
    'development_engineering',
    'Code Review Agent',
    'Development & Engineering',
    'Reviews code quality, structure, readability, maintainability, and potential bugs.',
    array['Code quality review', 'Changed-file review', 'Pull request summary review', 'Risk detection', 'Testing checklist'],
    array['Review recent project changes', 'Review a pull request summary', 'Inspect component structure and risky code'],
    'Code',
    '#CA2851',
    19,
    true
  ),
  (
    'bug-fix-agent',
    'development_engineering',
    'Bug Fix Agent',
    'Development & Engineering',
    'Analyzes errors, logs, screenshots, and failing behavior to propose a safe fix plan.',
    array['Root-cause analysis', 'Build error triage', 'Runtime crash planning', 'TypeScript error review', 'Safe fix plan'],
    array['Analyze this build error', 'Create a safe fix plan for a broken UI behavior', 'Investigate a failed API call'],
    'Bug',
    '#CA2851',
    20,
    true
  ),
  (
    'architecture-agent',
    'development_engineering',
    'Architecture Agent',
    'Development & Engineering',
    'Plans system architecture, project structure, data flow, and feature implementation phases.',
    array['Architecture planning', 'Folder structure design', 'Data flow mapping', 'Database design', 'API/server actions plan'],
    array['Plan a new SaaS project architecture', 'Design a provider integration', 'Split this feature into implementation phases'],
    'Workflow',
    '#CA2851',
    21,
    true
  ),
  (
    'testing-agent',
    'development_engineering',
    'Testing Agent',
    'Development & Engineering',
    'Creates testing checklists, QA plans, edge cases, and acceptance criteria.',
    array['Manual QA planning', 'Route smoke testing', 'Form validation testing', 'Provider readiness testing', 'Acceptance criteria'],
    array['Create final stabilization checklist', 'Write route smoke test plan', 'Create provider readiness test checklist'],
    'TestTube',
    '#CA2851',
    22,
    true
  ),
  (
    'documentation-agent',
    'development_engineering',
    'Documentation Agent',
    'Development & Engineering',
    'Creates internal guides, user docs, technical reports, release notes, FAQs, and checklists.',
    array['Internal documentation', 'Technical reports', 'Release notes', 'Setup guides', 'FAQ writing'],
    array['Write a feature guide', 'Create release summary', 'Document this setup workflow'],
    'BookOpen',
    '#CA2851',
    23,
    true
  ),
  (
    'deployment-agent',
    'development_engineering',
    'Deployment Agent',
    'Development & Engineering',
    'Prepares deployment plans, Vercel checks, environment checklists, smoke tests, and rollback notes.',
    array['Vercel deployment planning', 'Environment checklist', 'Migration checklist', 'Smoke test report', 'Rollback plan'],
    array['Prepare production deployment checklist', 'Review Vercel build error', 'Create rollback notes for this release'],
    'Rocket',
    '#CA2851',
    24,
    true
  ),
  (
    'security-review-agent',
    'development_engineering',
    'Security Review Agent',
    'Development & Engineering',
    'Reviews security risks, secret exposure, RLS, file upload safety, OAuth, and token storage.',
    array['Secret exposure review', 'RLS review', 'OAuth/token storage review', 'Upload safety review', 'No-secrets checklist'],
    array['Review env var safety', 'Audit Supabase RLS notes', 'Check file upload safety'],
    'ShieldCheck',
    '#CA2851',
    25,
    true
  ),
  (
    'database-agent',
    'development_engineering',
    'Database Agent',
    'Development & Engineering',
    'Plans and reviews database schema, Supabase migrations, RLS, indexes, relationships, and storage policies.',
    array['Migration planning', 'SQL review', 'RLS checklist', 'Relationship design', 'Storage policy review'],
    array['Design a workspace-scoped table', 'Review Supabase migration', 'Create RLS testing checklist'],
    'Database',
    '#CA2851',
    26,
    true
  ),
  (
    'ui-ux-review-agent',
    'development_engineering',
    'UI/UX Review Agent',
    'Development & Engineering',
    'Reviews interface layout, readability, flows, accessibility, and responsive behavior.',
    array['UI audit', 'Responsive review', 'Accessibility notes', 'Flow review', 'Layout improvement plan'],
    array['Review dashboard layout', 'Audit mobile responsiveness', 'Suggest UI fixes for a crowded form'],
    'PanelsTopLeft',
    '#CA2851',
    27,
    true
  )
on conflict (id) do update
set
  department_id = excluded.department_id,
  name = excluded.name,
  role = excluded.role,
  description = excluded.description,
  capabilities = excluded.capabilities,
  example_tasks = excluded.example_tasks,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

notify pgrst, 'reload schema';
