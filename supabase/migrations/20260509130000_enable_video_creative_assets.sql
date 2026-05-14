-- Add organic Reels video asset support without changing the creative_assets table shape.
-- Video-specific fields are stored in creative_assets.metadata.video.

alter table public.creative_assets
drop constraint if exists creative_assets_asset_type_check;

alter table public.creative_assets
add constraint creative_assets_asset_type_check
check (
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
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  true,
  104857600,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
