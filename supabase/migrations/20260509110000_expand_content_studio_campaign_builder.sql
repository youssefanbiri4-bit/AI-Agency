alter table public.content_studio_items
  drop constraint if exists content_studio_items_platform_check,
  drop constraint if exists content_studio_items_content_type_check,
  drop constraint if exists content_studio_items_status_check;

alter table public.content_studio_items
  add constraint content_studio_items_platform_check
    check (
      platform in (
        'facebook',
        'instagram',
        'google_ads',
        'pinterest',
        'linkedin'
      )
    ),
  add constraint content_studio_items_content_type_check
    check (
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
  add constraint content_studio_items_status_check
    check (
      status in (
        'draft',
        'ready',
        'scheduled',
        'published',
        'failed',
        'approval_pending',
        'setup_required'
      )
    );

notify pgrst, 'reload schema';
