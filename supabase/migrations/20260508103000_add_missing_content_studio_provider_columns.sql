alter table public.content_studio_items
  add column if not exists provider_external_id text null,
  add column if not exists provider_response_summary jsonb not null default '{}'::jsonb,
  add column if not exists last_provider_action_at timestamptz null;

comment on column public.content_studio_items.provider_external_id is
  'Safe external provider resource ID such as a post ID, pin ID, or paused Google Ads campaign resource name. Never store tokens or secrets.';

comment on column public.content_studio_items.provider_response_summary is
  'Safe provider response summary only. Never store raw tokens, OAuth credentials, or secret payloads.';

comment on column public.content_studio_items.last_provider_action_at is
  'Timestamp of the most recent successful provider action for this content item.';

notify pgrst, 'reload schema';
