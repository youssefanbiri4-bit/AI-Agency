-- Revert creative-assets storage bucket from public to private.
-- Migration 20260509130000 changed the bucket to public=true, making all
-- creative assets accessible via direct unauthenticated URL.
-- This migration restores private mode: access is gated by the existing
-- storage.objects RLS policies (workspace-scoped member check via UUID folder path).
-- Signed URLs are used for authenticated UI display.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  false,
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
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table storage.buckets is
  'creative-assets bucket reverted to private. Signed URLs are used for UI display; storage.objects RLS policies enforce workspace-scoped access.';

notify pgrst, 'reload schema';
