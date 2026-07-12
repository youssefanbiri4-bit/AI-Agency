import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { ContentStudioType, ContentStudioPlatform, CreativeAssetRecord } from '@/types/database';
import { contentStudioTypeOptions } from '@/app/(dashboard)/dashboard/content-studio/shared';
import type { ContentStudioItemView, ContentStudioTab } from '@/app/(dashboard)/dashboard/content-studio/shared';
import type { ContentStudioStatus } from '@/types/database';

export function buildPlatformFromType(contentType: ContentStudioType): ContentStudioPlatform {
  return contentStudioTypeOptions.find((option) => option.value === contentType)?.platform ?? 'facebook';
}

export function filterAssetsForPlatform(
  assets: CreativeAssetRecord[],
  platform: ContentStudioPlatform
) {
  if (platform === 'linkedin') {
    return assets;
  }

  const allowedPlatforms =
    platform === 'facebook' || platform === 'instagram'
      ? ['facebook', 'instagram', 'general']
      : [platform, 'general'];

  return assets.filter((asset) => allowedPlatforms.includes(asset.platform));
}

export function readCreativeAssetVideo(asset: CreativeAssetRecord) {
  const video = asset.metadata?.video;

  if (!video || Array.isArray(video) || typeof video !== 'object') {
    return null;
  }

  const metadata = video as Record<string, unknown>;
  const publicUrl =
    typeof metadata.public_url === 'string'
      ? metadata.public_url
      : typeof metadata.public_video_url === 'string'
        ? metadata.public_video_url
        : null;

  return {
    publicUrl,
    mimeType: typeof metadata.mime_type === 'string' ? metadata.mime_type : null,
  };
}

export function isCreativeVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readCreativeAssetVideo(asset)?.publicUrl)
  );
}

export function inferTemplateContentType(template: AgentTemplate | null | undefined): ContentStudioType {
  const haystack = template
    ? [
        template.name,
        template.category,
        template.description,
        template.recommended_for.join(' '),
        template.inputs.join(' '),
        template.outputs.join(' '),
        template.suggested_prompt,
      ].join(' ').toLowerCase()
    : '';

  if (template?.id === 'ad-copy-agent') return 'google_ads_campaign_draft';
  if (template?.id === 'creative-brief-agent') return 'instagram_post';
  if (haystack.includes('google ads') || haystack.includes('search ad')) return 'google_ads_campaign_draft';
  if (haystack.includes('linkedin')) return 'linkedin_post_planner';
  if (haystack.includes('pinterest')) return 'pinterest_pin';
  if (haystack.includes('facebook')) return 'facebook_post';
  if (haystack.includes('reel') || haystack.includes('tiktok') || haystack.includes('short')) return 'instagram_reel';
  if (haystack.includes('ad copy') || haystack.includes('ads') || haystack.includes('campaign')) return 'facebook_feed_ad';

  return 'instagram_post';
}

export function buildTemplatePrefill(template: AgentTemplate | null | undefined) {
  if (!template) return null;

  const outputType = inferTemplateContentType(template);
  const list = (title: string, values: string[]) => `${title}\n${values.map((value) => `- ${value}`).join('\n')}`;
  const brief = [
    `Source template: ${template.name}`,
    `Category: ${template.category}`,
    '',
    template.description,
    '',
    list('Inputs to gather', template.inputs),
    '',
    list('Expected outputs', template.outputs),
    '',
    list('Review checklist', template.review_checklist),
    '',
    'Safety note',
    'Prefilled only. Nothing has been generated, published, scheduled, or sent to providers.',
  ].join('\n');

  return {
    contentType: outputType,
    outputLabel: contentStudioTypeOptions.find((option) => option.value === outputType)?.label ?? 'Creative Brief',
    title: `${template.name} Draft`,
    objective: template.description,
    prompt: [
      template.suggested_prompt,
      '',
      'Use this only as editable draft direction. Do not publish, schedule, or create live ads automatically.',
    ].join('\n'),
    creativeBrief: brief,
    platformPackage: brief,
    adCopy: template.category === 'Sales & Operations' || outputType.includes('ad') || outputType === 'google_ads_campaign_draft'
      ? template.suggested_prompt
      : '',
    caption: outputType === 'linkedin_post_planner' || outputType === 'instagram_post' || outputType === 'instagram_reel' || outputType === 'facebook_post' || outputType === 'pinterest_pin'
      ? template.suggested_prompt
      : '',
    script: outputType === 'instagram_reel' ? template.suggested_prompt : '',
    keywords: template.category === 'Content & Growth' || outputType === 'google_ads_campaign_draft'
      ? template.inputs.join('\n')
      : '',
  };
}

export function isMetaAdContentType(contentType: ContentStudioType) {
  return [
    'facebook_feed_ad',
    'instagram_feed_ad',
    'facebook_reel_ad',
    'instagram_reel_ad',
    'facebook_story_ad',
    'instagram_story_ad',
    'facebook_carousel_ad',
    'instagram_carousel_ad',
  ].includes(contentType);
}

export function providerActionLabel(item: ContentStudioItemView) {
  if (item.content_type === 'facebook_post') {
    return 'Publish to Facebook Page';
  }

  if (item.content_type === 'instagram_post') {
    return 'Publish to Instagram';
  }

  if (item.content_type === 'instagram_reel') {
    return 'Publish Reel to Instagram';
  }

  if (item.content_type === 'google_ads_campaign_draft') {
    return 'Create Paused Google Ads Campaign Draft';
  }

  if (isMetaAdContentType(item.content_type)) {
    return 'Create Paused Meta Ad Draft';
  }

  if (item.content_type === 'linkedin_post_planner') {
    return 'Manual-only';
  }

  if (item.content_type === 'pinterest_pin') {
    return 'Publish to Pinterest';
  }

  return 'Unsupported';
}

export function providerActionProgressLabel(item: ContentStudioItemView) {
  switch (providerActionLabel(item)) {
    case 'Publish to Facebook Page':
      return 'Publishing to Facebook Page...';
    case 'Publish to Instagram':
      return 'Publishing to Instagram...';
    case 'Publish Reel to Instagram':
      return 'Publishing Reel to Instagram...';
    case 'Publish to Pinterest':
      return 'Publishing to Pinterest...';
    case 'Create Paused Google Ads Campaign Draft':
      return 'Creating Paused Google Ads Campaign Draft...';
    case 'Create Paused Meta Ad Draft':
      return 'Creating Paused Meta Ad Draft...';
    default:
      return 'Processing provider action...';
  }
}

export function safeProviderActionLabel(
  item: ContentStudioItemView,
  readiness?: { state: string } | null
) {
  if (readiness?.state === 'setup_required' || readiness?.state === 'token_missing') {
    return 'Setup Required';
  }

  if (readiness?.state === 'approval_pending') {
    return 'Approval Pending';
  }

  if (readiness?.state === 'unsupported') {
    return 'Unsupported';
  }

  if (readiness?.state === 'manual_only' && item.content_type === 'linkedin_post_planner') {
    return 'Manual-only';
  }

  return providerActionLabel(item);
}

export function isScheduleMessage(message: string | null | undefined) {
  return (
    message === 'Schedule saved.' ||
    message === 'Planned schedule updated.'
  );
}

export function appendGeneratedVersion(existingValue: string, generatedText: string) {
  const trimmedExisting = existingValue.trim();
  const trimmedGenerated = generatedText.trim();

  if (!trimmedExisting) {
    return trimmedGenerated;
  }

  return `${trimmedExisting}\n\n---\nAI generated variation\n${trimmedGenerated}`;
}

export function buildQueryHref({
  pathname,
  searchParams,
  tab,
  status,
  contentType,
  query: searchQueryText,
  itemId,
}: {
  pathname: string;
  searchParams: URLSearchParams;
  tab?: ContentStudioTab | null;
  status?: ContentStudioStatus | 'all' | null;
  contentType?: ContentStudioType | 'all' | null;
  query?: string | null;
  itemId?: string | null;
}) {
  const next = new URLSearchParams(searchParams.toString());

  if (tab !== undefined) {
    if (!tab || tab === 'all') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
  }

  if (status !== undefined) {
    if (!status || status === 'all') {
      next.delete('status');
    } else {
      next.set('status', status);
    }
  }

  if (contentType !== undefined) {
    if (!contentType || contentType === 'all') {
      next.delete('content_type');
    } else {
      next.set('content_type', contentType);
    }
  }

  if (searchQueryText !== undefined) {
    if (!searchQueryText) {
      next.delete('q');
    } else {
      next.set('q', searchQueryText);
    }
  }

  if (itemId !== undefined) {
    if (!itemId) {
      next.delete('item');
    } else {
      next.set('item', itemId);
    }
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function isSignedImageUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.pathname.includes('/storage/v1/object/sign/') || url.searchParams.has('token');
  } catch {
    return false;
  }
}

export function isPublicImageUrl(value: string | null | undefined) {
  if (!value || isSignedImageUrl(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function readMetadataObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readCampaignString(
  item: ContentStudioItemView | null,
  key: string
) {
  const campaign = readMetadataObject(readMetadataObject(item?.metadata).campaign);
  const value = campaign[key];
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value;
  }

  return '';
}

export function readCampaignList(
  item: ContentStudioItemView | null,
  key: string
) {
  const campaign = readMetadataObject(readMetadataObject(item?.metadata).campaign);
  const value = campaign[key];

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .join('\n');
}

export function readMetaAdsNumber(
  item: ContentStudioItemView | null,
  key: string
) {
  const metaAds = readMetadataObject(readMetadataObject(item?.metadata).meta_ads);
  const value = metaAds[key];

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function readMetaAdsList(
  item: ContentStudioItemView | null,
  key: string
) {
  const metaAds = readMetadataObject(readMetadataObject(item?.metadata).meta_ads);
  const value = metaAds[key];

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').join(', ')
    : '';
}

export type TemplatePrefillType = ReturnType<typeof buildTemplatePrefill>;
