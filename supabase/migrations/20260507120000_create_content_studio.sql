-- Content & Ads Studio foundation for draft planning only.
-- This phase intentionally excludes automatic publishing and ads management writes.

create table if not exists public.content_studio_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  platform text not null check (
    platform in (
      'facebook',
      'instagram',
      'google_ads',
      'pinterest',
      'linkedin'
    )
  ),
  content_type text not null check (
    content_type in (
      'facebook_post',
      'instagram_post',
      'facebook_reel',
      'instagram_reel',
      'google_ads_campaign_draft',
      'pinterest_pin',
      'linkedin_post_planner'
    )
  ),
  status text not null default 'draft' check (
    status in (
      'draft',
      'ready',
      'scheduled',
      'published',
      'failed',
      'setup_required'
    )
  ),
  objective text null,
  prompt text null,
  script text null,
  caption text null,
  ad_copy text null,
  creative_brief text null,
  schedule_at timestamptz null,
  published_at timestamptz null,
  provider_status text null,
  provider_error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_studio_items is
  'Workspace-scoped content and ad draft planning records. No private provider credentials or automatic publishing state should be stored here.';

create index if not exists content_studio_items_workspace_updated_idx
on public.content_studio_items(workspace_id, updated_at desc);

create index if not exists content_studio_items_workspace_status_idx
on public.content_studio_items(workspace_id, status);

create index if not exists content_studio_items_workspace_content_type_idx
on public.content_studio_items(workspace_id, content_type);

drop trigger if exists set_content_studio_items_updated_at on public.content_studio_items;
create trigger set_content_studio_items_updated_at
before update on public.content_studio_items
for each row execute function public.set_updated_at();

create table if not exists public.content_studio_item_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_studio_items(id) on delete cascade,
  creative_asset_id uuid not null references public.creative_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (content_item_id, creative_asset_id)
);

create index if not exists content_studio_item_assets_item_idx
on public.content_studio_item_assets(content_item_id);

create index if not exists content_studio_item_assets_asset_idx
on public.content_studio_item_assets(creative_asset_id);

alter table public.content_studio_items enable row level security;
alter table public.content_studio_item_assets enable row level security;

drop policy if exists "Workspace members can view content studio items" on public.content_studio_items;
create policy "Workspace members can view content studio items"
on public.content_studio_items
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create content studio items" on public.content_studio_items;
create policy "Workspace members can create content studio items"
on public.content_studio_items
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists "Workspace members can update content studio items" on public.content_studio_items;
create policy "Workspace members can update content studio items"
on public.content_studio_items
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete content studio items" on public.content_studio_items;
create policy "Workspace members can delete content studio items"
on public.content_studio_items
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can view content studio item assets" on public.content_studio_item_assets;
create policy "Workspace members can view content studio item assets"
on public.content_studio_item_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.content_studio_items item
    where item.id = content_item_id
      and public.is_workspace_member(item.workspace_id)
  )
);

drop policy if exists "Workspace members can create content studio item assets" on public.content_studio_item_assets;
create policy "Workspace members can create content studio item assets"
on public.content_studio_item_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.content_studio_items item
    where item.id = content_item_id
      and public.is_workspace_member(item.workspace_id)
  )
);

drop policy if exists "Workspace members can delete content studio item assets" on public.content_studio_item_assets;
create policy "Workspace members can delete content studio item assets"
on public.content_studio_item_assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.content_studio_items item
    where item.id = content_item_id
      and public.is_workspace_member(item.workspace_id)
  )
);

notify pgrst, 'reload schema';
