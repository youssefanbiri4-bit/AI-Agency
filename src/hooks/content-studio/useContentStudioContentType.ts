'use client';

import { useState } from 'react';
import type { ContentStudioType, ContentStudioPlatform } from '@/types/database';
import type { ContentStudioItemView, ContentStudioTab } from '@/app/(dashboard)/dashboard/content-studio/shared';
import { contentStudioTypeOptions } from '@/app/(dashboard)/dashboard/content-studio/shared';
import { buildPlatformFromType } from './shared';
import type { TemplatePrefillType } from './shared';

export type PlatformStudioKey = Exclude<ContentStudioTab, 'all'>;

const platformStudioConfig: Record<
  PlatformStudioKey,
  {
    title: string;
    summary: string;
    defaultType: ContentStudioType;
    typeOptions: ContentStudioType[];
    assetGuidance: string;
    manualOnly?: boolean;
    generationActions: Array<{ kind: string; label: string }>;
    copyActions: Array<{ label: string; packageLabel: string; fields: string[] }>;
    visibleFields: string[];
  }
> = {
  instagram: {
    title: 'Instagram Studio',
    summary: 'Create Instagram posts, reels, and organic or promo-ready content packages.',
    defaultType: 'instagram_post',
    typeOptions: ['instagram_post', 'instagram_reel', 'instagram_feed_ad', 'instagram_reel_ad'],
    assetGuidance: 'Instagram Post requires a public HTTPS image. Instagram Reel requires a public HTTPS video asset.',
    generationActions: [
      { kind: 'caption', label: 'Generate Instagram Caption' },
      { kind: 'hook', label: 'Generate Hook' },
      { kind: 'reel_script', label: 'Generate Reel Script' },
      { kind: 'hashtags', label: 'Generate Hashtags' },
      { kind: 'creative_brief', label: 'Generate Creative Brief' },
    ],
    copyActions: [
      { label: 'Copy Instagram Post', packageLabel: 'Instagram Post', fields: ['hook', 'primary_text', 'caption', 'hashtags', 'cta'] },
      { label: 'Copy Reel Package', packageLabel: 'Instagram Reel', fields: ['hook', 'voiceover_script', 'scene_breakdown', 'on_screen_text', 'caption', 'hashtags', 'cta'] },
    ],
    visibleFields: [
      'hook',
      'offer',
      'destination_url',
      'caption',
      'primary_text',
      'hashtags',
      'cta',
      'script',
      'scene_breakdown',
      'on_screen_text',
      'voiceover_script',
      'creative_brief',
      'platform_package',
    ],
  },
  facebook: {
    title: 'Facebook Studio',
    summary: 'Create Facebook Page posts and safely prepare Facebook ad draft packages.',
    defaultType: 'facebook_post',
    typeOptions: ['facebook_post', 'facebook_reel', 'facebook_feed_ad'],
    assetGuidance: 'Facebook Page posts can use text or an image. Paid ad drafts require provider checks before any paused draft action.',
    generationActions: [
      { kind: 'caption', label: 'Generate Facebook Post' },
      { kind: 'facebook_ad', label: 'Generate Facebook Ad Copy' },
      { kind: 'headlines', label: 'Generate Headlines' },
      { kind: 'cta', label: 'Generate CTA' },
    ],
    copyActions: [
      { label: 'Copy Facebook Post', packageLabel: 'Facebook Post', fields: ['primary_text', 'caption', 'cta'] },
      { label: 'Copy Facebook Ad Package', packageLabel: 'Meta Ads', fields: ['primary_text', 'ad_copy', 'headlines', 'descriptions', 'cta'] },
    ],
    visibleFields: ['primary_text', 'caption', 'headlines', 'cta', 'destination_url', 'creative_brief', 'platform_package'],
  },
  google_ads: {
    title: 'Google Ads Studio',
    summary: 'Create paused Google Ads campaign drafts without activating spend.',
    defaultType: 'google_ads_campaign_draft',
    typeOptions: ['google_ads_campaign_draft'],
    assetGuidance: 'Search campaign drafts do not require an image. Destination URL, keywords, budget notes, and ad copy should be ready.',
    generationActions: [
      { kind: 'headlines', label: 'Generate Google Ads Headlines' },
      { kind: 'descriptions', label: 'Generate Descriptions' },
      { kind: 'keywords', label: 'Generate Keywords' },
      { kind: 'google_search_ad', label: 'Generate Google Ads Package' },
    ],
    copyActions: [
      { label: 'Copy Google Ads Package', packageLabel: 'Google Ads', fields: ['headlines', 'descriptions', 'keywords', 'cta', 'ad_copy', 'creative_brief'] },
    ],
    visibleFields: ['destination_url', 'offer', 'keywords', 'headlines', 'descriptions', 'cta', 'ad_copy', 'creative_brief', 'platform_package'],
  },
  pinterest: {
    title: 'Pinterest Studio',
    summary: 'Create and publish Pinterest Pins with board, image, and URL readiness checks.',
    defaultType: 'pinterest_pin',
    typeOptions: ['pinterest_pin'],
    assetGuidance: 'Pinterest Pin publishing requires a linked public HTTPS image asset.',
    generationActions: [
      { kind: 'pinterest_pin_copy', label: 'Generate Pinterest Pin Copy' },
      { kind: 'headlines', label: 'Generate Pin Title' },
      { kind: 'descriptions', label: 'Generate Pin Description' },
    ],
    copyActions: [
      { label: 'Copy Pinterest Pin Package', packageLabel: 'Pinterest Pin', fields: ['headlines', 'caption', 'descriptions', 'destination_url', 'cta', 'creative_brief'] },
    ],
    visibleFields: ['caption', 'descriptions', 'destination_url', 'cta', 'creative_brief', 'platform_package'],
  },
  linkedin: {
    title: 'LinkedIn Planner',
    summary: 'Prepare LinkedIn posts manually until real LinkedIn OAuth and publishing are implemented.',
    defaultType: 'linkedin_post_planner',
    typeOptions: ['linkedin_post_planner'],
    assetGuidance: 'LinkedIn remains manual-only. Image assets are optional and used for copy-ready handoff.',
    manualOnly: true,
    generationActions: [
      { kind: 'caption', label: 'Generate LinkedIn Post' },
      { kind: 'hook', label: 'Generate Hook' },
      { kind: 'cta', label: 'Generate CTA' },
    ],
    copyActions: [
      { label: 'Copy LinkedIn Post', packageLabel: 'LinkedIn Post', fields: ['hook', 'caption', 'cta', 'hashtags'] },
      { label: 'Copy LinkedIn Package', packageLabel: 'LinkedIn Package', fields: ['hook', 'caption', 'cta', 'hashtags', 'creative_brief'] },
    ],
    visibleFields: ['hook', 'caption', 'cta', 'hashtags', 'creative_brief', 'platform_package'],
  },
};

function platformKeyFromType(contentType: ContentStudioType): PlatformStudioKey {
  const platform = buildPlatformFromType(contentType);
  return platform === 'linkedin' ? 'linkedin' : platform;
}

function defaultTypeForTab(tab: ContentStudioTab, fallback?: ContentStudioType) {
  if (tab !== 'all') {
    return platformStudioConfig[tab].defaultType;
  }

  return fallback ?? 'instagram_post';
}

export function isPlatformStudioTab(tab: ContentStudioTab): tab is PlatformStudioKey {
  return tab !== 'all';
}

interface UseContentStudioContentTypeOptions {
  selectedItem: ContentStudioItemView | null;
  initialDraftType?: ContentStudioType;
  templatePrefill: TemplatePrefillType;
  activeTab: ContentStudioTab;
}

interface UseContentStudioContentTypeReturn {
  draftType: ContentStudioType;
  setDraftType: React.Dispatch<React.SetStateAction<ContentStudioType>>;
  selectedType: ContentStudioType;
  selectedPlatform: ContentStudioPlatform;
  selectedPlatformKey: PlatformStudioKey;
  selectedStudio: (typeof platformStudioConfig)[PlatformStudioKey];
  visibleFieldSet: Set<string>;
  availableTypeOptions: Array<{ value: ContentStudioType; label: string; tab: ContentStudioTab; platform: ContentStudioPlatform }>;
}

export function useContentStudioContentType({
  selectedItem,
  initialDraftType,
  templatePrefill,
  activeTab,
}: UseContentStudioContentTypeOptions): UseContentStudioContentTypeReturn {
  const [draftType, setDraftType] = useState<ContentStudioType>(
    selectedItem?.content_type ?? initialDraftType ?? templatePrefill?.contentType ?? defaultTypeForTab(activeTab)
  );

  const selectedType =
    selectedItem?.content_type ??
    (activeTab !== 'all' && !platformStudioConfig[activeTab].typeOptions.includes(draftType)
      ? platformStudioConfig[activeTab].defaultType
      : draftType);

  const selectedPlatform = buildPlatformFromType(selectedType);
  const selectedPlatformKey = platformKeyFromType(selectedType);
  const selectedStudio = platformStudioConfig[selectedPlatformKey];
  const visibleFieldSet = new Set(selectedStudio.visibleFields);
  const availableTypeOptions = contentStudioTypeOptions.filter((option) =>
    selectedStudio.typeOptions.includes(option.value)
  );

  return {
    draftType,
    setDraftType,
    selectedType,
    selectedPlatform,
    selectedPlatformKey,
    selectedStudio,
    visibleFieldSet,
    availableTypeOptions,
  };
}

export { platformStudioConfig };
