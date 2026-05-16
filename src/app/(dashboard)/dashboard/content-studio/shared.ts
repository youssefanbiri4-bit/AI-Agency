import type {
  ContentStudioItemRecord,
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
} from '@/types/database';
import {
  translateContentStudioPlatform,
  translateContentStudioStatus,
  translateContentStudioType,
} from '@/i18n/dashboard-labels';

export type ContentStudioTab =
  | 'all'
  | 'instagram'
  | 'facebook'
  | 'google_ads'
  | 'pinterest'
  | 'linkedin';

export type ContentStudioTaskKind =
  | 'script'
  | 'caption'
  | 'ad_copy'
  | 'creative_brief';

export interface ContentStudioItemView extends ContentStudioItemRecord {
  asset_ids: string[];
  asset_count: number;
}

export const contentStudioTypeOptions: Array<{
  value: ContentStudioType;
  label: string;
  tab: ContentStudioTab;
  platform: ContentStudioPlatform;
}> = [
  {
    value: 'facebook_post',
    label: 'Facebook Post',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_post',
    label: 'Instagram Post',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'facebook_reel',
    label: 'Facebook Reel',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_reel',
    label: 'Instagram Reel',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'google_ads_campaign_draft',
    label: 'Google Ads Campaign Draft',
    tab: 'google_ads',
    platform: 'google_ads',
  },
  {
    value: 'facebook_feed_ad',
    label: 'Facebook Feed Ad Draft',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_feed_ad',
    label: 'Instagram Feed Ad Draft',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'facebook_reel_ad',
    label: 'Facebook Reel Ad Draft',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_reel_ad',
    label: 'Instagram Reel Ad Draft',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'facebook_story_ad',
    label: 'Facebook Story Ad Draft',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_story_ad',
    label: 'Instagram Story Ad Draft',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'facebook_carousel_ad',
    label: 'Facebook Carousel Ad Draft',
    tab: 'facebook',
    platform: 'facebook',
  },
  {
    value: 'instagram_carousel_ad',
    label: 'Instagram Carousel Ad Draft',
    tab: 'instagram',
    platform: 'instagram',
  },
  {
    value: 'pinterest_pin',
    label: 'Pinterest Pin',
    tab: 'pinterest',
    platform: 'pinterest',
  },
  {
    value: 'linkedin_post_planner',
    label: 'LinkedIn Post Planner',
    tab: 'linkedin',
    platform: 'linkedin',
  },
];

export const contentStudioStatusOptions: Array<{
  value: ContentStudioStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'scheduled', label: 'Scheduled for real execution' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'approval_pending', label: 'Approval pending' },
  { value: 'setup_required', label: 'Setup required' },
];

export const contentStudioTabOptions: Array<{
  value: ContentStudioTab;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export const contentStudioTaskOptions: Array<{
  value: ContentStudioTaskKind;
  label: string;
}> = [
  { value: 'script', label: 'Script' },
  { value: 'caption', label: 'Caption' },
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'creative_brief', label: 'Creative Brief' },
];

export function getContentStudioTypeOption(contentType: ContentStudioType) {
  return contentStudioTypeOptions.find((option) => option.value === contentType) ?? null;
}

export function inferPlatformFromContentType(contentType: ContentStudioType): ContentStudioPlatform {
  return getContentStudioTypeOption(contentType)?.platform ?? 'facebook';
}

export function getTabForContentType(contentType: ContentStudioType): ContentStudioTab {
  return getContentStudioTypeOption(contentType)?.tab ?? 'all';
}

export function formatContentStudioTypeLabel(contentType: ContentStudioType, t?: (key: string, fallback?: string) => string) {
  if (t) return translateContentStudioType(t, contentType);
  return getContentStudioTypeOption(contentType)?.label ?? contentType;
}

export function formatContentStudioPlatformLabel(
  platform: ContentStudioPlatform | 'general',
  t?: (key: string, fallback?: string) => string
) {
  if (t) return translateContentStudioPlatform(t, platform);
  switch (platform) {
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'google_ads':
      return 'Google Ads';
    case 'pinterest':
      return 'Pinterest';
    case 'linkedin':
      return 'LinkedIn';
    case 'general':
      return 'General';
    default:
      return platform;
  }
}

export function formatContentStudioStatusLabel(status: ContentStudioStatus, t?: (key: string, fallback?: string) => string) {
  if (t) return translateContentStudioStatus(t, status);
  return contentStudioStatusOptions.find((option) => option.value === status)?.label ?? status;
}

export function itemMatchesTab(contentType: ContentStudioType, tab: ContentStudioTab) {
  return tab === 'all' || getTabForContentType(contentType) === tab;
}
