-- Creative Assets foundation for prompt-only and future OpenAI image generation.
-- Real image generation is server-gated by OPENAI_API_KEY and stores files in Supabase Storage.

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  asset_type text not null check (
    asset_type in (
      'reel_cover',
      'ad_creative',
      'thumbnail',
      'campaign_visual',
      'carousel_slide',
      'story_visual'
    )
  ),
  platform text not null default 'general' check (
    platform in (
      'instagram',
      'facebook',
      'google_ads',
      'pinterest',
      'general'
    )
  ),
  status text not null default 'draft' check (
    status in (
      'draft',
      'prompt_ready',
      'generating',
      'generated',
      'failed',
      'selected',
      'archived'
    )
  ),
  source text not null default 'prompt_only' check (
    source in ('prompt_only', 'openai', 'upload')
  ),
  goal text null,
  offer text null,
  target_audience text null,
  market text null,
  tone text null,
  style text null,
  visual_direction text null,
  text_overlay text null,
  brand_colors text null,
  notes text null,
  prompt text null,
  negative_prompt text null,
  aspect_ratio text null check (
    aspect_ratio is null or aspect_ratio in ('1:1', '4:5', '9:16', '16:9')
  ),
  output_style text null check (
    output_style is null or output_style in (
      'premium_saas',
      'realistic',
      'minimal',
      'bold_ad',
      'clean_corporate',
      'luxury'
    )
  ),
  image_url text null,
  storage_path text null,
  linked_reel_id uuid null references public.reels(id) on delete set null,
  linked_task_id uuid null references public.tasks(id) on delete set null,
  linked_campaign_task_id uuid null references public.tasks(id) on delete set null,
  model text null,
  size text null,
  quality text null,
  estimated_cost_usd numeric null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.creative_assets is
  'Workspace-scoped creative prompt and image asset records. OpenAI keys and raw base64 outputs must not be stored here.';

create index if not exists creative_assets_workspace_created_idx
on public.creative_assets(workspace_id, created_at desc);

create index if not exists creative_assets_workspace_status_idx
on public.creative_assets(workspace_id, status);

create index if not exists creative_assets_workspace_asset_type_idx
on public.creative_assets(workspace_id, asset_type);

create index if not exists creative_assets_workspace_platform_idx
on public.creative_assets(workspace_id, platform);

drop trigger if exists set_creative_assets_updated_at on public.creative_assets;
create trigger set_creative_assets_updated_at
before update on public.creative_assets
for each row execute function public.set_updated_at();

alter table public.creative_assets enable row level security;

drop policy if exists "Users can select creative assets in their workspace" on public.creative_assets;
create policy "Users can select creative assets in their workspace"
on public.creative_assets
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Users can insert creative assets in their workspace" on public.creative_assets;
create policy "Users can insert creative assets in their workspace"
on public.creative_assets
for insert
to authenticated
with check (
  auth.uid() = user_id and
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Users can update creative assets in their workspace" on public.creative_assets;
create policy "Users can update creative assets in their workspace"
on public.creative_assets
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Users can delete creative assets in their workspace" on public.creative_assets;
create policy "Users can delete creative assets in their workspace"
on public.creative_assets
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'task_needs_review',
    'task_completed',
    'task_failed',
    'report_ready',
    'campaign_task_created',
    'meta_connection_connected',
    'ad_platform_setup_required',
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
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace members can read creative asset files" on storage.objects;
create policy "Workspace members can read creative asset files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can upload creative asset files" on storage.objects;
create policy "Workspace members can upload creative asset files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace members can update creative asset files" on storage.objects;
create policy "Workspace members can update creative asset files"
on storage.objects
for update
to authenticated
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
create policy "Workspace members can delete creative asset files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creative-assets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
