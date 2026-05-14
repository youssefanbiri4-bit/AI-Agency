alter table public.content_studio_publish_attempts
drop constraint if exists content_studio_publish_attempts_action_type_check;

alter table public.content_studio_publish_attempts
add constraint content_studio_publish_attempts_action_type_check
check (
  action_type in (
    'publish_post',
    'publish_reel',
    'create_campaign_draft',
    'create_paused_meta_ad_draft',
    'publish_pin',
    'manual_handoff'
  )
);
