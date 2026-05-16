'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  Copy,
  FileCheck2,
  FileText,
  Filter,
  Image as ImageIcon,
  Megaphone,
  Pin,
  Play,
  Plus,
  SearchCheck,
  Send,
  Sparkles,
  Unlink2,
  Wand2,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/components/ui/useActionToast';
import { formatDateTime } from '@/lib/utils';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import {
  campaignTemplateCategories,
  campaignTemplates,
  type CampaignTemplate,
  type CampaignTemplateCategory,
  type CampaignTemplateFieldSet,
} from '@/lib/content-studio/campaign-templates';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import type { BrandKit } from '@/types/brand-kit';
import type {
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
  CreativeAssetRecord,
} from '@/types/database';
import {
  createContentStudioItemAction,
  createContentStudioTaskAction,
  executeContentStudioProviderActionAction,
  generateContentStudioFieldAction,
  linkCreativeAssetToDraftAction,
  removeCreativeAssetFromDraftAction,
  updateContentStudioItemAction,
  type ContentStudioActionState,
} from './actions';
import {
  contentStudioStatusOptions,
  contentStudioTabOptions,
  contentStudioTaskOptions,
  contentStudioTypeOptions,
  type ContentStudioItemView,
  formatContentStudioPlatformLabel,
  type ContentStudioTab,
} from './shared';
import { CampaignPlanner } from './CampaignPlanner';
import { trackTemplateUsageAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import { useLanguage } from '@/i18n/context';
import {
  translateContentStudioStatus,
  translateContentStudioType,
  translateTemplateCategory,
} from '@/i18n/dashboard-labels';

interface ContentStudioClientProps {
  items: ContentStudioItemView[];
  selectedItem: ContentStudioItemView | null;
  creativeAssets: CreativeAssetRecord[];
  activeTab: ContentStudioTab;
  activeStatus: ContentStudioStatus | 'all';
  activeContentType?: ContentStudioType;
  searchQuery: string;
  initialDraftType?: ContentStudioType;
  schedulerReady: boolean;
  schedulerMessage: string;
  providerReadiness: Record<string, ProviderReadinessResult>;
  selectedItemProviderReadiness?: ProviderReadinessResult | null;
  brandKit: BrandKit;
  brandKitExists: boolean;
  agentTemplate?: AgentTemplate | null;
  templateNotFound?: boolean;
}

const initialActionState: ContentStudioActionState = {
  error: null,
  message: null,
  itemId: null,
  taskId: null,
  outcome: null,
};

function buildPlatformFromType(contentType: ContentStudioType): ContentStudioPlatform {
  return contentStudioTypeOptions.find((option) => option.value === contentType)?.platform ?? 'facebook';
}

function filterAssetsForPlatform(
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

function readCreativeAssetVideo(asset: CreativeAssetRecord) {
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

function defaultBrandValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function defaultHashtagLines(value: string | null | undefined) {
  return value
    ?.split(/[\s,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n') ?? '';
}

function inferTemplateContentType(template: AgentTemplate | null | undefined): ContentStudioType {
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

function buildTemplatePrefill(template: AgentTemplate | null | undefined) {
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

function isCreativeVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readCreativeAssetVideo(asset)?.publicUrl)
  );
}

function buildQueryHref({
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

function providerActionLabel(item: ContentStudioItemView) {
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

function providerActionProgressLabel(item: ContentStudioItemView) {
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

function safeProviderActionLabel(
  item: ContentStudioItemView,
  readiness?: ProviderReadinessResult | null
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

function isMetaAdContentType(contentType: ContentStudioType) {
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

function taskSuccessTitle(state: ContentStudioActionState) {
  return state.taskId ? 'AI task created' : 'Saved';
}

function isScheduleMessage(message: string | null | undefined) {
  return (
    message === 'Schedule saved.' ||
    message === 'Planned schedule updated.'
  );
}

function appendGeneratedVersion(existingValue: string, generatedText: string) {
  const trimmedExisting = existingValue.trim();
  const trimmedGenerated = generatedText.trim();

  if (!trimmedExisting) {
    return trimmedGenerated;
  }

  return `${trimmedExisting}\n\n---\nAI generated variation\n${trimmedGenerated}`;
}

function formatDatetimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isTextControl(
  element: Element | RadioNodeList | null
): element is HTMLInputElement | HTMLTextAreaElement {
  return Boolean(
    element &&
      'value' in element &&
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
  );
}

function readMetadataObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readCampaignString(
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

function readCampaignList(
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

function readMetaAdsNumber(
  item: ContentStudioItemView | null,
  key: string
) {
  const metaAds = readMetadataObject(readMetadataObject(item?.metadata).meta_ads);
  const value = metaAds[key];

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function readMetaAdsList(
  item: ContentStudioItemView | null,
  key: string
) {
  const metaAds = readMetadataObject(readMetadataObject(item?.metadata).meta_ads);
  const value = metaAds[key];

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').join(', ')
    : '';
}

function isSignedImageUrl(value: string | null | undefined) {
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

function isPublicImageUrl(value: string | null | undefined) {
  if (!value || isSignedImageUrl(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

type PlatformStudioKey = Exclude<ContentStudioTab, 'all'>;

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

const preservedFieldNames = [
  'hook',
  'primary_text',
  'offer',
  'destination_url',
  'ad_copy',
  'caption',
  'script',
  'headlines',
  'descriptions',
  'cta',
  'hashtags',
  'keywords',
  'creative_brief',
  'scene_breakdown',
  'on_screen_text',
  'voiceover_script',
  'platform_package',
];

const templateFieldLabels: Partial<Record<keyof CampaignTemplateFieldSet, string>> = {
  title: 'Campaign Name',
  objective: 'Objective',
  target_audience: 'Target Audience',
  offer: 'Offer / Budget Notes',
  destination_url: 'Destination URL',
  prompt: 'Prompt / Direction',
  hook: 'Hook',
  primary_text: 'Primary Text',
  caption: 'Caption',
  script: 'Script',
  scene_breakdown: 'Scene Breakdown',
  on_screen_text: 'On-screen Text',
  voiceover_script: 'Voiceover Script',
  headlines: 'Headlines',
  descriptions: 'Descriptions',
  keywords: 'Keywords',
  ad_copy: 'Ad Copy',
  cta: 'CTA',
  hashtags: 'Hashtags',
  creative_brief: 'Creative Brief',
  platform_package: 'Platform Package',
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

function isPlatformStudioTab(tab: ContentStudioTab): tab is PlatformStudioKey {
  return tab !== 'all';
}

export function ContentStudioClient({
  items,
  selectedItem,
  creativeAssets,
  activeTab,
  initialDraftType,
  schedulerReady,
  schedulerMessage,
  providerReadiness,
  selectedItemProviderReadiness,
  brandKit,
  brandKitExists,
  agentTemplate,
  templateNotFound = false,
}: ContentStudioClientProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const saveAction = useMemo(
    () =>
      selectedItem
        ? updateContentStudioItemAction.bind(null, selectedItem.id)
        : createContentStudioItemAction,
    [selectedItem]
  );
  const taskAction = useMemo(
    () =>
      selectedItem
        ? createContentStudioTaskAction.bind(null, selectedItem.id)
        : createContentStudioTaskAction.bind(null, ''),
    [selectedItem]
  );
  const providerAction = useMemo(
    () =>
      selectedItem
        ? executeContentStudioProviderActionAction.bind(null, selectedItem.id)
        : executeContentStudioProviderActionAction.bind(null, ''),
    [selectedItem]
  );
  const [saveState, saveFormAction, savePending] = useActionState(saveAction, initialActionState);
  const [taskState, taskFormAction, taskPending] = useActionState(taskAction, initialActionState);
  const [providerState, providerFormAction, providerPending] = useActionState(
    providerAction,
    initialActionState
  );
  const templatePrefill = useMemo(() => buildTemplatePrefill(agentTemplate), [agentTemplate]);

  useEffect(() => {
    if (!agentTemplate) return;

    void trackTemplateUsageAction({
      templateId: agentTemplate.id,
      actionType: 'view_template',
      sourcePage: 'content_studio',
      metadata: { surface: 'template_prefill' },
    });
  }, [agentTemplate]);
  const scheduleToastMethod =
    selectedItem?.content_type === 'linkedin_post_planner'
      ? toast.warning
      : schedulerReady
        ? toast.info
        : toast.warning;
  const [draftType, setDraftType] = useState<ContentStudioType>(
    selectedItem?.content_type ?? initialDraftType ?? templatePrefill?.contentType ?? defaultTypeForTab(activeTab)
  );
  const [assetSelection, setAssetSelection] = useState<{
    itemId: string | null;
    ids: string[];
  }>({
    itemId: selectedItem?.id ?? null,
    ids: selectedItem?.asset_ids ?? [],
  });
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [linkingAssetId, setLinkingAssetId] = useState<string | null>(null);
  const [isRemovingAsset, startRemoveAssetTransition] = useTransition();
  const [isLinkingAsset, startLinkAssetTransition] = useTransition();
  const [activeGenerationKind, setActiveGenerationKind] = useState<string | null>(null);
  const [activeTemplateCategory, setActiveTemplateCategory] =
    useState<CampaignTemplateCategory | 'All'>('All');

  useActionToast({
    isPending: savePending,
    state: saveState,
    loadingMessage: selectedItem ? 'Updating campaign...' : 'Creating campaign...',
    successMessage: (currentState) =>
      currentState.message ?? (selectedItem ? 'Campaign draft saved.' : 'Campaign draft saved.'),
    successDescription: (currentState) =>
      isScheduleMessage(currentState.message)
        ? schedulerReady
          ? 'The secure scheduler will pick this item up at or after the planned time when provider readiness allows it.'
          : schedulerMessage
        : selectedItem
          ? 'Draft saved and creative assets synced.'
          : 'You can keep editing it from Content Library.',
    errorMessage: (currentState) => currentState.error ?? (selectedItem ? 'Could not update content item.' : 'Could not create content item.'),
  });

  useActionToast({
    isPending: taskPending,
    state: taskState,
    loadingMessage: 'Creating AI task...',
    successMessage: () => 'AI task created.',
    successDescription: 'You can view it in Tasks.',
    successAction: (currentState) =>
      currentState.taskId
        ? {
            label: 'Open Tasks',
            href: `/dashboard/tasks/${currentState.taskId}`,
          }
        : {
            label: 'Open Tasks',
            href: '/dashboard/tasks',
          },
    errorMessage: (currentState) => currentState.error ?? 'Could not create AI task.',
  });

  useActionToast({
    isPending: providerPending,
    state: providerState,
    loadingMessage:
      selectedItem
        ? providerActionProgressLabel(selectedItem)
        : 'Processing provider action...',
    successMessage: (currentState) =>
      selectedItem?.content_type === 'pinterest_pin' && currentState.outcome === 'success'
        ? 'Published to Pinterest successfully.'
        : selectedItem?.content_type === 'google_ads_campaign_draft' && currentState.outcome === 'success'
          ? 'Paused Google Ads draft created.'
          : selectedItem && isMetaAdContentType(selectedItem.content_type) && currentState.outcome === 'success'
            ? 'Paused Meta ad draft created.'
            : currentState.message ?? 'Provider action completed.',
    successDescription: (currentState) =>
      currentState.outcome === 'success'
        ? 'The provider confirmed the action and the item was updated.'
        : undefined,
    errorMessage: (currentState) =>
      selectedItem?.content_type === 'pinterest_pin'
        ? currentState.error ?? 'Could not publish to Pinterest.'
        : currentState.error ?? 'Could not publish.',
  });

  useEffect(() => {
    if (!saveState.itemId || saveState.error) {
      return;
    }

    router.replace(
      buildQueryHref({
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
        itemId: saveState.itemId,
      })
    );
    router.refresh();
  }, [pathname, router, saveState.error, saveState.itemId, searchParams]);

  useEffect(() => {
    if (!providerState.itemId) {
      return;
    }

    router.replace(
      buildQueryHref({
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
        itemId: providerState.itemId,
      })
    );
    router.refresh();
  }, [pathname, providerState.itemId, router, searchParams]);

  const removeAssetFromDraft = (assetId: string) => {
    const nextItemId = selectedItem?.id ?? null;

    if (!assetId) {
      toast.error('Could not remove creative asset from draft.');
      return;
    }

    if (!nextItemId) {
      setAssetSelection((current) => ({
        itemId: nextItemId,
        ids: (current.itemId === nextItemId ? current.ids ?? [] : []).filter((id) => id !== assetId),
      }));
      return;
    }

    setRemovingAssetId(assetId);
    startRemoveAssetTransition(async () => {
      const result = await removeCreativeAssetFromDraftAction(nextItemId, assetId);

      if (result.error) {
        toast.error('Could not remove creative asset from draft.');
        setRemovingAssetId(null);
        return;
      }

      setAssetSelection((current) => {
        const currentIds =
          result.assetIds ??
          (current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? []);

        return {
          itemId: nextItemId,
          ids: currentIds.filter((id) => id !== assetId),
        };
      });
      toast.success('Creative asset removed from draft.');
      setRemovingAssetId(null);
      router.refresh();
    });
  };

  const linkAssetToDraft = (assetId: string) => {
    const nextItemId = selectedItem?.id ?? null;

    if (!assetId) {
      toast.error('Could not link creative asset to draft.');
      return;
    }

    setAssetSelection((current) => {
      const currentIds = current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? [];

      return {
        itemId: nextItemId,
        ids: Array.from(new Set([...currentIds, assetId])),
      };
    });

    if (!nextItemId) {
      return;
    }

    setLinkingAssetId(assetId);
    startLinkAssetTransition(async () => {
      const result = await linkCreativeAssetToDraftAction(nextItemId, assetId);

      if (result.error) {
        setAssetSelection((current) => {
          const currentIds = current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? [];

          return {
            itemId: nextItemId,
            ids: currentIds.filter((id) => id !== assetId),
          };
        });
        toast.error('Could not link creative asset to draft.');
        setLinkingAssetId(null);
        return;
      }

      setAssetSelection({
        itemId: nextItemId,
        ids: result.assetIds ?? [],
      });
      setLinkingAssetId(null);
      router.refresh();
    });
  };

  const handleAssetCheckboxChange = (assetId: string, checked: boolean) => {
    if (!assetId) {
      toast.error('Could not update creative asset selection.');
      return;
    }

    if (checked) {
      linkAssetToDraft(assetId);
      return;
    }

    removeAssetFromDraft(assetId);
  };

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
  const safeCreativeAssets = creativeAssets ?? [];
  const assetOptions = filterAssetsForPlatform(safeCreativeAssets, selectedPlatform);
  const currentSelectedAssetIds =
    assetSelection.itemId === (selectedItem?.id ?? null)
      ? assetSelection.ids ?? []
      : selectedItem?.asset_ids ?? [];
  const selectedAssetIdSet = new Set(currentSelectedAssetIds);
  const isGenerating = activeGenerationKind !== null;
  const selectedProviderReadiness =
    selectedItemProviderReadiness ?? providerReadiness[selectedPlatform];
  const selectedAssetNames = safeCreativeAssets
    .filter((asset) => selectedAssetIdSet.has(asset.id))
    .map((asset) => asset.title);
  const selectedAssets = safeCreativeAssets.filter((asset) => selectedAssetIdSet.has(asset.id));
  const selectedPublicImageAsset = selectedAssets.find((asset) => isPublicImageUrl(asset.image_url));
  const selectedSignedImageAsset = selectedAssets.find((asset) => isSignedImageUrl(asset.image_url));
  const selectedHasAnyImageAsset = selectedAssets.some((asset) => Boolean(asset.image_url));
  const selectedDestinationUrl = readCampaignString(selectedItem, 'destination_url');
  const selectedPinterestBoardName =
    typeof selectedProviderReadiness?.details?.selectedBoardName === 'string'
      ? selectedProviderReadiness.details.selectedBoardName
      : null;
  const selectedMetaAdAccountName =
    typeof selectedProviderReadiness?.details?.selectedAdAccountName === 'string'
      ? selectedProviderReadiness.details.selectedAdAccountName
      : null;
  const selectedHasBudget = Boolean(
    readMetaAdsNumber(selectedItem, 'daily_budget') ||
      readMetaAdsNumber(selectedItem, 'lifetime_budget')
  );
  const selectedHasCaption = Boolean(selectedItem?.caption?.trim());
  const selectedHasFacebookBody = Boolean(
    selectedItem?.caption?.trim() ||
      selectedItem?.script?.trim() ||
      selectedItem?.ad_copy?.trim() ||
      selectedItem?.objective?.trim() ||
      selectedHasAnyImageAsset
  );
  const brandDefaultOffer = brandKit.campaignDefaults.defaultOffer ?? brandKit.offer;
  const brandDefaultCreativeDirection =
    brandKit.campaignDefaults.defaultCreativeDirection ?? brandKit.visualStyle;
  const visibleCampaignTemplates = useMemo(
    () =>
      campaignTemplates.filter((template) =>
        activeTemplateCategory === 'All'
          ? true
          : template.categories.includes(activeTemplateCategory)
      ),
    [activeTemplateCategory]
  );

  function getSelectedAssetNames() {
    if (!formRef.current) {
      return [];
    }

    const formData = new FormData(formRef.current);
    const assetIds = new Set(
      formData
        .getAll('asset_ids')
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter(Boolean)
    );

    return safeCreativeAssets
      .filter((asset) => assetIds.has(asset.id))
      .map((asset) => asset.title);
  }

  function readFormValue(name: string) {
    if (!formRef.current) {
      return '';
    }

    const element = formRef.current.elements.namedItem(name);
    return isTextControl(element) ? element.value.trim() : '';
  }

  function writeFormValue(name: string, nextValue: string) {
    if (!formRef.current) {
      return false;
    }

    const element = formRef.current.elements.namedItem(name);

    if (!isTextControl(element)) {
      return false;
    }

    element.value = nextValue;
    return true;
  }

  function applyTemplateFields(fields: CampaignTemplateFieldSet, overwriteFilledFields: boolean) {
    const skippedFields: string[] = [];

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) {
        continue;
      }

      const currentValue = readFormValue(fieldName);

      if (currentValue && !overwriteFilledFields) {
        skippedFields.push(templateFieldLabels[fieldName as keyof CampaignTemplateFieldSet] ?? fieldName);
        continue;
      }

      writeFormValue(fieldName, fieldValue);
    }

    return skippedFields;
  }

  function handleUseTemplate(template: CampaignTemplate) {
    if (savePending || isGenerating) {
      return;
    }

    const fields = template.buildFields(brandKit);
    const filledFields = Object.keys(fields).filter((fieldName) => Boolean(readFormValue(fieldName)));
    const overwriteFilledFields =
      filledFields.length > 0
        ? window.confirm(
            'Some draft fields already have text. Overwrite those fields with the template? Choose Cancel to fill only empty fields.'
          )
        : false;

    if (!selectedItem) {
      setDraftType(template.contentType);
    } else if (selectedItem.content_type !== template.contentType) {
      toast.info('Template platform kept copy-ready.', {
        description:
          'This saved item already has a fixed platform/type, so only compatible draft fields were filled.',
      });
    }

    window.setTimeout(() => {
      const skippedFields = applyTemplateFields(fields, overwriteFilledFields);

      if (brandKitExists) {
        toast.success('Template applied.');
        return;
      }

      toast.info('Template applied. Add a Brand Kit for more personalized content.', {
        description:
          skippedFields.length > 0
            ? `Kept existing text in: ${skippedFields.slice(0, 4).join(', ')}.`
            : undefined,
      });
    }, 0);
  }

  function readStoredFieldValue(name: string) {
    switch (name) {
      case 'caption':
        return selectedItem?.caption ?? '';
      case 'script':
        return selectedItem?.script ?? '';
      case 'ad_copy':
        return selectedItem?.ad_copy ?? '';
      case 'creative_brief':
        return selectedItem?.creative_brief ?? '';
      case 'headlines':
      case 'descriptions':
      case 'keywords':
      case 'hashtags':
        return readCampaignList(selectedItem, name);
      default:
        return readCampaignString(selectedItem, name);
    }
  }

  function readTemplateDefault(name: string) {
    if (selectedItem || !templatePrefill) return '';

    switch (name) {
      case 'title':
        return templatePrefill.title;
      case 'objective':
        return templatePrefill.objective;
      case 'prompt':
        return templatePrefill.prompt;
      case 'caption':
        return templatePrefill.caption;
      case 'script':
        return templatePrefill.script;
      case 'ad_copy':
        return templatePrefill.adCopy;
      case 'creative_brief':
        return templatePrefill.creativeBrief;
      case 'platform_package':
        return templatePrefill.platformPackage;
      case 'keywords':
        return templatePrefill.keywords;
      default:
        return '';
    }
  }

  function buildPlatformPackage(label: string, fieldNames: string[]) {
    const assetNames = getSelectedAssetNames();
    const lines = [
      `${label} Package`,
      '',
      `Campaign Name: ${readFormValue('title') || 'Not provided'}`,
      `Objective: ${readFormValue('objective') || 'Not provided'}`,
      `Destination URL: ${readFormValue('destination_url') || 'Not provided'}`,
    ];

    if (label === 'Pinterest Pin') {
      lines.push(`Board: ${selectedPinterestBoardName ?? 'Not selected'}`);
      lines.push(`Linked Image Asset: ${assetNames[0] ?? 'None linked'}`);
      lines.push(`Provider Readiness: ${selectedProviderReadiness?.state ?? 'unsupported'}`);
    }

    if (label === 'Meta Ads') {
      lines.push(`Meta Ad Account: ${selectedMetaAdAccountName ?? 'Not selected'}`);
      lines.push(`Budget: ${readFormValue('daily_budget') || readFormValue('lifetime_budget') || 'Not provided'}`);
      lines.push(`Audience: ${readFormValue('target_audience') || 'Not provided'}`);
      lines.push(`Linked Creative Assets: ${assetNames.length > 0 ? assetNames.join(', ') : 'None linked'}`);
      lines.push(`Provider Readiness: ${selectedProviderReadiness?.state ?? 'unsupported'}`);
    }

    for (const fieldName of fieldNames) {
      lines.push('');
      lines.push(
        fieldName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (value) => value.toUpperCase())
      );
      lines.push(readFormValue(fieldName) || 'Not provided');
    }

    return lines.join('\n');
  }

  async function copyText(label: string, value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      toast.info('Nothing to copy yet.', {
        description: `Add ${label.toLowerCase()} content first, then try again.`,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success(label === 'Pinterest Pin Package' ? 'Copied Pinterest package.' : 'Copied to clipboard.');
    } catch {
      toast.error('Could not copy to clipboard.', {
        description: 'Your browser blocked clipboard access. Try again after granting permission.',
      });
    }
  }

  function openQualityReview() {
    const reviewType = selectedType === 'google_ads_campaign_draft' || selectedType.includes('ad') ? 'ad_copy' : 'marketing_content';
    const reviewPlatform =
      selectedPlatformKey === 'google_ads'
        ? 'google_ads'
        : selectedPlatformKey === 'instagram' || selectedPlatformKey === 'facebook' || selectedPlatformKey === 'linkedin'
          ? selectedPlatformKey
          : 'generic';
    const packageContent = buildPlatformPackage('Content Studio Draft', selectedStudio.visibleFields).slice(0, 6000);
    router.push(`/dashboard/quality-review?type=${reviewType}&platform=${reviewPlatform}&content=${encodeURIComponent(packageContent)}`);
  }

  async function handleGenerate(kind: string) {
    if (!selectedItem) {
      toast.warning('Save this draft first.', {
        description: 'AI generation is available after the content item exists in your workspace.',
      });
      return;
    }

    if (!formRef.current || isGenerating || savePending || taskPending) {
      return;
    }

    setActiveGenerationKind(kind);
    const loadingToastId = toast.loading(
      'Generating with AI...',
      {
        description: `Generating ${kind.replace(/_/g, ' ')} using the current draft fields and linked creative assets.`,
      }
    );

    try {
      const formData = new FormData(formRef.current);
      formData.set('generation_kind', kind);

      const result = await generateContentStudioFieldAction(selectedItem.id, formData);

      if (result.error || !result.generatedText || !result.field) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: result.error ?? 'Generation failed.',
          description: 'Please review OpenAI setup, quota, and the draft fields, then try again.',
        });
        return;
      }

      const existingValue = readFormValue(result.field);

      if (!writeFormValue(result.field, appendGeneratedVersion(existingValue, result.generatedText))) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not place generated content.',
          description: 'Refresh the page and try again.',
        });
        return;
      }

      toast.update(loadingToastId, {
        tone: 'success',
        title: result.message ?? 'Generated successfully.',
        description: 'Review it in the field, then click Update Content Item to persist it.',
      });
    } catch (error) {
      toast.update(loadingToastId, {
        tone: 'error',
        title: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        description: 'AI provider setup required.',
      });
    } finally {
      setActiveGenerationKind(null);
    }
  }

  return (
    <div className="space-y-6">
      {templateNotFound ? (
        <Notice tone="warning" title={t('dashboardI18n.contentStudio.templateNotFound')}>
          {t('dashboardI18n.contentStudio.templateNotFoundDescription')}
        </Notice>
      ) : null}

      {agentTemplate && templatePrefill ? (
        <Card className="border-sky-200 bg-sky-50/70 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 ring-1 ring-sky-100">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-700">{t('dashboardI18n.contentStudio.templateContext')}</p>
                <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{agentTemplate.name}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{translateTemplateCategory(t, agentTemplate.category)}</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{agentTemplate.description}</p>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-white/80 bg-white/80 p-3 text-sm lg:w-72">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.contentStudio.suggestedOutputType')}</p>
                <p className="mt-1 font-bold text-slate-800">{translateContentStudioType(t, templatePrefill.contentType)}</p>
              </div>
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
                {t('dashboardI18n.contentStudio.prefillNotice')}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={t('dashboardI18n.contentStudio.platformWorkspace')}
          description={t('dashboardI18n.contentStudio.platformWorkspaceDescription')}
          action={<Pin className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="dashboard-card-grid">
          {contentStudioTabOptions
            .filter((option): option is { value: PlatformStudioKey; label: string } =>
              isPlatformStudioTab(option.value)
            )
            .map((option) => (
              <Link
                key={option.value}
                href={buildQueryHref({
                  pathname,
                  searchParams: new URLSearchParams(searchParams.toString()),
                  tab: option.value,
                  contentType: 'all',
                  itemId: null,
                })}
                className={buttonStyles({
                  variant: activeTab === option.value ? 'primary' : 'outline',
                  size: 'sm',
                })}
              >
                  {t(`action.${option.value === 'google_ads' ? 'googleAdsStudio' : option.value === 'linkedin' ? 'linkedinPlanner' : `${option.value}Studio`}`, platformStudioConfig[option.value].title)}
              </Link>
            ))}
        </div>
      </Card>

      <div className="grid gap-8">
      <div className="space-y-6">
        <div key={selectedItem?.id ?? 'new-item'} className="space-y-6">
          {(saveState.error || taskState.error) && (
            <Notice tone="danger" title={t('dashboardI18n.contentStudio.actionFailed')}>
              {saveState.error || taskState.error}
            </Notice>
          )}

          {saveState.message && !saveState.error && (
            <Notice tone="success" title={t('dashboardI18n.contentStudio.itemSaved')}>
              {saveState.message}
            </Notice>
          )}

          {taskState.message && !taskState.error && (
            <Notice tone="success" title={taskSuccessTitle(taskState)}>
              <span>{taskState.message}</span>
              {taskState.taskId ? (
                <Link
                  href={`/dashboard/tasks/${taskState.taskId}`}
                  className="ms-2 inline-flex font-bold text-[#F7CBCA] hover:text-black"
                >
                  {t('dashboardI18n.contentStudio.openTask')}
                </Link>
              ) : null}
            </Notice>
          )}

          {providerState.error && (
            <Notice tone="warning" title={t('dashboardI18n.contentStudio.providerActionUpdate')}>
              {providerState.error}
            </Notice>
          )}

          {providerState.message && !providerState.error && providerState.outcome === 'success' && (
            <Notice tone="success" title={t('dashboardI18n.contentStudio.providerActionCompleted')}>
              {providerState.message}
            </Notice>
          )}

          <Card className="border-[#F7CBCA]/16 bg-[#D5E5E5]/42">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-black">
                    {selectedItem ? `${t('common.edit')} ${t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)}` : t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-black/62">
                    {selectedStudio.summary} Draft here, then use the platform-specific actions below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/dashboard/calendar" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <CalendarDays className="h-4 w-4" />
                  {t('dashboardI18n.contentStudio.viewCalendar')}
                </Link>
                {selectedItem ? (
                  <StatusBadge status={selectedItem.status} type="task" size="sm" />
                ) : (
                  <StatusBadge status="Ready" type="system" size="sm" />
                )}
              </div>
            </div>
          </Card>

          <Card className="border-[#F7CBCA]/12 bg-white/90">
            <CardHeader
              title={t('dashboardI18n.contentStudio.brandContext')}
              description={
                brandKitExists
                  ? 'Brand Kit applied to empty draft defaults and AI generation prompts.'
                  : 'Sample brand defaults are available until you save a Brand Kit in Settings.'
              }
              action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="muted-panel p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.brand')}</p>
                <p className="mt-1 text-sm font-semibold text-black">{brandKit.brandName}</p>
              </div>
              <div className="muted-panel p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.tone')}</p>
                <p className="mt-1 text-sm font-semibold text-black">
                  {brandKit.toneOfVoice ?? t('dashboardI18n.common.notSet')}
                </p>
              </div>
              <div className="muted-panel p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.defaultCta')}</p>
                <p className="mt-1 text-sm font-semibold text-black">
                  {brandKit.defaultCta ?? t('dashboardI18n.common.notSet')}
                </p>
              </div>
              <div className="muted-panel p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.hashtags')}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-black">
                  {brandKit.defaultHashtags ?? t('dashboardI18n.common.notSet')}
                </p>
              </div>
            </div>
          </Card>

          <CampaignPlanner
            brandKit={brandKit}
            brandKitExists={brandKitExists}
            providerReadiness={providerReadiness}
          />

          <Card>
            <CardHeader
              title="Start from a Template"
              description="Choose a campaign template and let AgentFlow AI prefill the right fields for your platform."
              action={<Filter className="h-5 w-5 text-[#F7CBCA]" />}
            />

            <div className="mb-5 flex flex-wrap gap-2">
              {campaignTemplateCategories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant={activeTemplateCategory === category ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTemplateCategory(category)}
                  disabled={savePending || isGenerating}
                >
                  {category}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {visibleCampaignTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm transition-colors hover:border-[#F7CBCA]/24 hover:bg-[#F9F7FB]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-bold text-black">{template.name}</h3>
                        <Badge tone="brand">{template.platformLabel}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-black/62">{template.goal}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/36">
                        {t('dashboardI18n.contentStudio.bestFor')}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-black/58">{template.bestFor}</p>
                    </div>
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() => handleUseTemplate(template)}
                      disabled={savePending || isGenerating}
                    >
                      <Sparkles className="h-4 w-4" />
                      {t('dashboardI18n.contentStudio.useTemplate')}
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.categories.map((category) => (
                      <Badge key={category} tone="neutral">
                        {category}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/36">
                      {t('dashboardI18n.contentStudio.fieldsIncluded')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-black/58">
                      {template.fieldsIncluded.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <form ref={formRef} action={saveFormAction} className="space-y-6">
            {preservedFieldNames
              .filter((fieldName) => !visibleFieldSet.has(fieldName))
              .map((fieldName) => (
                <input
                  key={fieldName}
                  type="hidden"
                  name={fieldName}
                  defaultValue={readStoredFieldValue(fieldName)}
                />
              ))}

            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.campaignBasics')}
                description="Set the campaign foundation, platform, objective, destination, schedule, and status in one place."
                action={<Megaphone className="h-5 w-5 text-[#F7CBCA]" />}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="title">{t('dashboardI18n.contentStudio.campaignName')}</Label>
                  <Input
                    id="title"
                    name="title"
                    minLength={3}
                    maxLength={200}
                    required
                    disabled={savePending || isGenerating}
                    defaultValue={selectedItem?.title ?? readTemplateDefault('title')}
                    placeholder="Spring launch carousel concept"
                  />
                </div>

                <div>
                  <Label htmlFor="content_type">{t('dashboardI18n.contentStudio.platformType')}</Label>
                  {selectedItem ? (
                    <input type="hidden" name="content_type" value={selectedType} />
                  ) : null}
                  <Select
                    id="content_type"
                    name="content_type"
                    value={selectedType}
                    onChange={(event) => setDraftType(event.target.value as ContentStudioType)}
                    disabled={savePending || isGenerating || Boolean(selectedItem)}
                  >
                    {availableTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {translateContentStudioType(t, option.value)}
                      </option>
                    ))}
                  </Select>
                  {selectedItem ? (
                    <p className="mt-2 text-xs text-black/44">
                      {t('dashboardI18n.contentStudio.fixedType', 'Platform/type stays fixed after creation for this foundation.')}
                    </p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="status">{t('dashboardI18n.contentStudio.status')}</Label>
                  <Select
                    id="status"
                    name="status"
                    defaultValue={selectedItem?.status ?? 'draft'}
                    disabled={savePending || isGenerating}
                  >
                    {contentStudioStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {translateContentStudioStatus(t, option.value)}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-2 text-xs text-black/44">
                    {schedulerReady
                      ? 'Scheduled items are queued for secure server-side execution at or after the planned time.'
                      : schedulerMessage}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="objective">{t('dashboardI18n.contentStudio.objective')}</Label>
                  <Textarea
                    id="objective"
                    name="objective"
                    rows={3}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      selectedItem?.objective ??
                      (readTemplateDefault('objective') ||
                      defaultBrandValue(brandKit.campaignDefaults.defaultObjective)
                      )
                    }
                    placeholder="Drive qualified traffic, increase saves, or prepare a draft campaign concept"
                  />
                </div>

                <div>
                  <Label htmlFor="target_audience">{t('dashboardI18n.contentStudio.targetAudience')}</Label>
                  <Textarea
                    id="target_audience"
                    name="target_audience"
                    rows={3}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      readCampaignString(selectedItem, 'target_audience') ||
                      (!selectedItem ? defaultBrandValue(brandKit.targetAudience) : '')
                    }
                    placeholder="Who this campaign is for and what signals qualify them"
                  />
                </div>

                {visibleFieldSet.has('offer') ? (
                  <div>
                    <Label htmlFor="offer">{t('dashboardI18n.contentStudio.budgetValue')}</Label>
                    <Textarea
                      id="offer"
                      name="offer"
                      rows={3}
                      disabled={savePending || isGenerating}
                      defaultValue={
                        readCampaignString(selectedItem, 'offer') ||
                        (!selectedItem ? defaultBrandValue(brandDefaultOffer) : '')
                      }
                      placeholder="Budget notes, offer framing, differentiation, or promise"
                    />
                  </div>
                ) : null}

                {visibleFieldSet.has('destination_url') ? (
                  <div className="md:col-span-2">
                    <Label htmlFor="destination_url">{t('dashboardI18n.contentStudio.destinationUrl')}</Label>
                    <Input
                      id="destination_url"
                      name="destination_url"
                      type="url"
                      disabled={savePending || isGenerating}
                      defaultValue={
                        readCampaignString(selectedItem, 'destination_url') ||
                        (!selectedItem ? defaultBrandValue(brandKit.campaignDefaults.defaultDestinationUrl) : '')
                      }
                      placeholder="https://example.com/landing-page"
                    />
                  </div>
                ) : null}

                {isMetaAdContentType(selectedType) ? (
                  <>
                    <div>
                      <Label htmlFor="daily_budget">Daily Budget</Label>
                      <Input
                        id="daily_budget"
                        name="daily_budget"
                        type="number"
                        min="1"
                        step="1"
                        disabled={savePending || isGenerating}
                        defaultValue={readMetaAdsNumber(selectedItem, 'daily_budget')}
                        placeholder="5000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lifetime_budget">Lifetime Budget</Label>
                      <Input
                        id="lifetime_budget"
                        name="lifetime_budget"
                        type="number"
                        min="1"
                        step="1"
                        disabled={savePending || isGenerating}
                        defaultValue={readMetaAdsNumber(selectedItem, 'lifetime_budget')}
                        placeholder="25000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="countries">Countries</Label>
                      <Input
                        id="countries"
                        name="countries"
                        disabled={savePending || isGenerating}
                        defaultValue={readMetaAdsList(selectedItem, 'countries')}
                        placeholder="US, CA"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                      <Label htmlFor="age_min">Age Min</Label>
                      <Input
                        id="age_min"
                        name="age_min"
                        type="number"
                        min="13"
                        max="65"
                        disabled={savePending || isGenerating}
                        defaultValue={readMetaAdsNumber(selectedItem, 'age_min')}
                        placeholder="25"
                      />
                      </div>
                      <div>
                        <Label htmlFor="age_max">Age Max</Label>
                        <Input
                          id="age_max"
                          name="age_max"
                          type="number"
                          min="13"
                          max="65"
                          disabled={savePending || isGenerating}
                          defaultValue={readMetaAdsNumber(selectedItem, 'age_max')}
                          placeholder="55"
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="md:col-span-2">
                  <Label htmlFor="prompt">{t('dashboardI18n.contentStudio.promptDirection')}</Label>
                  <Textarea
                    id="prompt"
                    name="prompt"
                    rows={4}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      selectedItem?.prompt ??
                      (readTemplateDefault('prompt') ||
                      (!selectedItem
                        ? defaultBrandValue(brandKit.campaignDefaults.defaultPostingStyle)
                        : '')
                      )
                    }
                    placeholder="Audience, hook, product angle, offer framing, constraints, and references"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="schedule_at">{t('dashboardI18n.contentStudio.plannedSchedule', 'Planned Schedule Time')}</Label>
                  <Input
                    id="schedule_at"
                    name="schedule_at"
                    type="datetime-local"
                    disabled={savePending || isGenerating}
                    defaultValue={formatDatetimeLocal(selectedItem?.schedule_at)}
                  />
                  <p className="mt-2 text-xs text-black/44">
                    {t('dashboardI18n.contentStudio.scheduleGuard', 'Scheduled items are only processed when provider readiness allows it. Google Ads stays paused-only, and manual-only providers will never be marked published.')}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.creativeMessage', 'Creative & Message')}
                description="Build the ad/package copy, structured campaign fields, and production notes for every channel."
                action={<Wand2 className="h-5 w-5 text-[#F7CBCA]" />}
              />

              {selectedItem ? (
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedStudio.generationActions.map((action) => (
                    <Button
                      key={action.kind}
                      type="button"
                      variant="soft"
                      disabled={isGenerating || savePending || taskPending}
                      className="justify-start"
                      onClick={() => void handleGenerate(action.kind)}
                    >
                      <Wand2 className="h-4 w-4" />
                      {activeGenerationKind === action.kind
                        ? `${action.label.replace('Generate ', 'Generating ')}...`
                        : action.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {selectedItem ? (
                <div className="mb-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/38">
                    {t('dashboardI18n.contentStudio.existingContentPreserved', 'Existing field content is preserved. New AI generations are appended below a divider for review before saving.')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedStudio.copyActions.map((action) => (
                      <Button
                        key={action.label}
                        type="button"
                        variant="outline"
                        disabled={savePending || isGenerating || taskPending}
                        className="justify-start"
                        onClick={() =>
                          void copyText(
                            action.label,
                            buildPlatformPackage(action.packageLabel, action.fields)
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                        {action.label}
                      </Button>
                    ))}
                    <button
                      type="button"
                      onClick={openQualityReview}
                      className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full justify-start' })}
                    >
                      <SearchCheck className="h-4 w-4" />
                      Review Quality
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                {visibleFieldSet.has('hook') ? (
                <div>
                  <Label htmlFor="hook">{t('dashboardI18n.contentStudio.hook', 'Hook')}</Label>
                  <Textarea
                    id="hook"
                    name="hook"
                    rows={4}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'hook')}
                    placeholder="Lead with the sharpest angle, pattern interrupt, or strongest opening line"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('primary_text') ? (
                <div>
                  <Label htmlFor="primary_text">{t('dashboardI18n.contentStudio.primaryText', 'Primary Text')}</Label>
                  <Textarea
                    id="primary_text"
                    name="primary_text"
                    rows={4}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'primary_text')}
                    placeholder="Primary text for ads and promoted posts"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('ad_copy') ? (
                <div>
                  <Label htmlFor="ad_copy">{t('dashboardI18n.contentStudio.adCopy', 'Ad Copy')}</Label>
                  <Textarea
                    id="ad_copy"
                    name="ad_copy"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={selectedItem?.ad_copy ?? readTemplateDefault('ad_copy')}
                    placeholder="Primary copy, angle notes, testing notes, and variations"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('caption') ? (
                <div>
                  <Label htmlFor="caption">
                    {selectedType === 'linkedin_post_planner' ? t('dashboardI18n.contentStudio.linkedinPostBody', 'LinkedIn Post Body') : selectedType === 'pinterest_pin' ? t('dashboardI18n.contentStudio.pinDescription', 'Pin Description') : t('dashboardI18n.contentStudio.caption', 'Caption')}
                  </Label>
                  <Textarea
                    id="caption"
                    name="caption"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={selectedItem?.caption ?? readTemplateDefault('caption')}
                    placeholder="Post caption, reel caption, or copy-ready LinkedIn text"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('script') ? (
                <div>
                  <Label htmlFor="script">{t('dashboardI18n.contentStudio.scriptForReels', 'Script for Reels')}</Label>
                  <Textarea
                    id="script"
                    name="script"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={selectedItem?.script ?? readTemplateDefault('script')}
                    placeholder="Working script, structured talking points, or short-form flow"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('headlines') ? (
                <div>
                  <Label htmlFor="headlines">{selectedType === 'pinterest_pin' ? t('dashboardI18n.contentStudio.pinTitle', 'Pin Title') : t('dashboardI18n.contentStudio.headlines', 'Headlines')}</Label>
                  <Textarea
                    id="headlines"
                    name="headlines"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignList(selectedItem, 'headlines')}
                    placeholder="One headline per line"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('descriptions') ? (
                <div>
                  <Label htmlFor="descriptions">{selectedType === 'pinterest_pin' ? t('dashboardI18n.contentStudio.pinDescription', 'Pin Description') : t('dashboardI18n.contentStudio.descriptions', 'Descriptions')}</Label>
                  <Textarea
                    id="descriptions"
                    name="descriptions"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignList(selectedItem, 'descriptions')}
                    placeholder="Google Ads descriptions, supportive copy, or pin description variants"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('cta') ? (
                <div>
                  <Label htmlFor="cta">{t('dashboardI18n.contentStudio.cta', 'CTA')}</Label>
                  <Textarea
                    id="cta"
                    name="cta"
                    rows={4}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      readCampaignString(selectedItem, 'cta') ||
                      (!selectedItem ? defaultBrandValue(brandKit.defaultCta) : '')
                    }
                    placeholder="Call-to-action options or the preferred CTA"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('hashtags') ? (
                <div>
                  <Label htmlFor="hashtags">{t('dashboardI18n.contentStudio.hashtags')}</Label>
                  <Textarea
                    id="hashtags"
                    name="hashtags"
                    rows={4}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      readCampaignList(selectedItem, 'hashtags') ||
                      (!selectedItem ? defaultHashtagLines(brandKit.defaultHashtags) : '')
                    }
                    placeholder="One hashtag per line"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('keywords') ? (
                <div>
                  <Label htmlFor="keywords">{t('dashboardI18n.contentStudio.keywords', 'Keywords')}</Label>
                  <Textarea
                    id="keywords"
                    name="keywords"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignList(selectedItem, 'keywords') || readTemplateDefault('keywords')}
                    placeholder="Search keyword ideas, one per line"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('creative_brief') ? (
                <div>
                  <Label htmlFor="creative_brief">{t('dashboardI18n.contentStudio.creativeBrief', 'Creative Brief')}</Label>
                  <Textarea
                    id="creative_brief"
                    name="creative_brief"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={
                      selectedItem?.creative_brief ??
                      (readTemplateDefault('creative_brief') ||
                      (!selectedItem ? defaultBrandValue(brandDefaultCreativeDirection) : '')
                      )
                    }
                    placeholder="Concept, visual direction, audience insight, and production notes"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('scene_breakdown') ? (
                <div>
                  <Label htmlFor="scene_breakdown">Scene Breakdown</Label>
                  <Textarea
                    id="scene_breakdown"
                    name="scene_breakdown"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'scene_breakdown')}
                    placeholder="Scene-by-scene beats for reels, stories, or motion creative"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('on_screen_text') ? (
                <div>
                  <Label htmlFor="on_screen_text">On-screen Text</Label>
                  <Textarea
                    id="on_screen_text"
                    name="on_screen_text"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'on_screen_text')}
                    placeholder="Text overlays, card copy, or slide text"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('voiceover_script') ? (
                <div>
                  <Label htmlFor="voiceover_script">Voiceover Script</Label>
                  <Textarea
                    id="voiceover_script"
                    name="voiceover_script"
                    rows={5}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'voiceover_script')}
                    placeholder="Voiceover lines for reels or short-form video"
                  />
                </div>
                ) : null}

                {visibleFieldSet.has('platform_package') ? (
                <div className="md:col-span-2">
                  <Label htmlFor="platform_package">Platform Package</Label>
                  <Textarea
                    id="platform_package"
                    name="platform_package"
                    rows={6}
                    disabled={savePending || isGenerating}
                    defaultValue={readCampaignString(selectedItem, 'platform_package') || readTemplateDefault('platform_package')}
                    placeholder="Optional AI-generated or manually assembled platform package notes"
                  />
                </div>
                ) : null}
              </div>
            </Card>

            {selectedItem?.content_type === 'linkedin_post_planner' ? (
              <Notice tone="info" title={t('dashboardI18n.contentStudio.manualLinkedinTitle', 'Manual LinkedIn planner only')}>
                {t('dashboardI18n.contentStudio.manualLinkedinDescription', 'Use the copy-ready actions here to move LinkedIn draft text into your manual posting workflow. No LinkedIn API or automatic publishing is enabled.')}
              </Notice>
            ) : null}

            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.creativeAssets')}
                description={t('dashboardI18n.contentStudio.creativeAssetsDescription', 'Link existing creative assets, see what is attached, and route to Creative Assets when provider-ready media is still missing.')}
                action={<ImageIcon className="h-5 w-5 text-[#F7CBCA]" />}
              />

              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-black/58">
                <span className="basis-full text-black/62">{selectedStudio.assetGuidance}</span>
                <span>
                  {t('dashboardI18n.contentStudio.linkedAssetCount', 'Linked asset count')}: <strong className="text-black">{selectedAssetNames.length}</strong>
                </span>
                <span>
                  {t('dashboardI18n.contentStudio.assetNames', 'Asset names')}:{' '}
                  <strong className="text-black">{selectedAssetNames.join(', ') || t('dashboardI18n.contentStudio.noneLinkedYet', 'None linked yet')}</strong>
                </span>
                <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  Creative Assets
                </Link>
              </div>

              {[
                'instagram_post',
                'instagram_reel',
                'pinterest_pin',
              ].includes(selectedType) && selectedAssetNames.length === 0 ? (
                <Notice tone="warning" title={t('dashboardI18n.contentStudio.providerMediaRequired', 'Provider-ready media is still required')}>
                  {t('dashboardI18n.contentStudio.providerMediaRequiredDescription', 'This content type needs a suitable linked asset before a real provider action can succeed.')}
                </Notice>
              ) : null}

              {selectedType === 'instagram_reel' || selectedType === 'instagram_reel_ad' ? (
                <Notice
                  tone={selectedType === 'instagram_reel' ? 'warning' : 'info'}
                  title={
                    selectedType === 'instagram_reel'
                      ? 'Linked video asset required'
                      : 'Instagram Reel Ad is manual-only'
                  }
                >
                  {selectedType === 'instagram_reel'
                    ? 'Organic Instagram Reels require a linked video asset, caption, and selected Instagram account before publishing.'
                    : 'Keep this as ad planning and copy-ready handoff. Paid Meta ads are not implemented in this phase.'}
                </Notice>
              ) : null}

              {selectedType === 'pinterest_pin' ? (
                <Notice
                  tone={selectedProviderReadiness?.state === 'ready' && selectedPublicImageAsset ? 'info' : 'warning'}
                  title={
                    selectedProviderReadiness?.state === 'ready' && selectedPublicImageAsset
                      ? 'Pinterest Pin publishing ready'
                      : 'Pinterest Pin publishing checks'
                  }
                >
                  Board: {selectedPinterestBoardName ?? 'not selected'}. Destination URL:{' '}
                  {selectedDestinationUrl || 'not provided'}. Linked image:{' '}
                  {selectedPublicImageAsset
                    ? selectedPublicImageAsset.title
                    : selectedSignedImageAsset
                      ? 'signed URL may expire'
                      : 'required'}.
                </Notice>
              ) : null}

              {assetOptions.length === 0 ? (
                <Notice tone="warning" title={t('dashboardI18n.contentStudio.noMatchingAssets', 'No matching creative assets yet')}>
                  {t('dashboardI18n.contentStudio.noMatchingAssetsDescription', 'Create assets in Creative Assets first, then link them here.')}
                </Notice>
              ) : (
                <div className="grid gap-3">
                  {assetOptions.map((asset) => {
                    const video = readCreativeAssetVideo(asset);
                    const isVideo = isCreativeVideoAsset(asset);
                    const inputId = `content-studio-asset-${asset.id}`;

                    return (
                      <div
                        key={asset.id}
                        className="flex items-start gap-3 rounded-lg border border-black/8 bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#F7CBCA]/28 hover:bg-[#F9F7FB]"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          name="asset_ids"
                          value={asset.id}
                          checked={selectedAssetIdSet.has(asset.id)}
                          onChange={(event) => {
                            handleAssetCheckboxChange(asset.id, event.currentTarget.checked);
                          }}
                          disabled={
                            savePending ||
                            isGenerating ||
                            isRemovingAsset ||
                            isLinkingAsset ||
                            removingAssetId === asset.id ||
                            linkingAssetId === asset.id
                          }
                          className="mt-1 h-4 w-4 rounded border-black/18 text-[#F7CBCA] focus:ring-[#F7CBCA]"
                        />
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-[#D5E5E5]/36">
                          {isVideo && video?.publicUrl ? (
                            <video
                              src={video.publicUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full bg-black object-cover"
                            />
                          ) : asset.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.image_url}
                              alt={`${asset.title} thumbnail`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {isVideo ? (
                                <Play className="h-5 w-5 text-[#F7CBCA]" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-[#F7CBCA]" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <label htmlFor={inputId} className="block cursor-pointer break-words font-semibold text-black">
                            {asset.title}
                          </label>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/48">
                            <span>{formatContentStudioPlatformLabel(asset.platform, t)}</span>
                            <span>{asset.asset_type.replace(/_/g, ' ')}</span>
                            {isVideo ? <span>video asset</span> : null}
                            <span>{asset.status.replace(/_/g, ' ')}</span>
                            <span>
                              {isVideo
                                ? video?.publicUrl
                                  ? 'public video URL'
                                  : 'video URL missing'
                                : asset.image_url
                                  ? 'image uploaded'
                                  : 'no image'}
                            </span>
                            <span>{formatDateTime(asset.updated_at)}</span>
                          </div>
                          {selectedAssetIdSet.has(asset.id) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                removeAssetFromDraft(asset.id);
                              }}
                              disabled={
                                savePending ||
                                isGenerating ||
                                isRemovingAsset ||
                                isLinkingAsset ||
                                removingAssetId === asset.id
                              }
                            >
                              <Unlink2 className="h-4 w-4" />
                              {removingAssetId === asset.id ? t('dashboardI18n.contentStudio.removing') : t('dashboardI18n.contentStudio.removeFromDraft')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {selectedItem ? (
                <Link
                  href={buildQueryHref({
                    pathname,
                    searchParams: new URLSearchParams(searchParams.toString()),
                    itemId: null,
                  })}
                  onClick={() =>
                    toast.info('Starting a new draft.', {
                      description: 'Your current item stays saved in Content Library.',
                    })
                  }
                  className={buttonStyles({ variant: 'outline' })}
                >
                  <Plus className="h-4 w-4" />
                  {t('dashboardI18n.contentStudio.newDraft')}
                </Link>
              ) : null}
              <Button
                type="submit"
                disabled={savePending || isGenerating}
                size="lg"
              >
                <Plus className="h-4 w-4" />
                {savePending
                  ? t('dashboardI18n.contentStudio.saving')
                  : selectedItem
                    ? t('dashboardI18n.contentStudio.updateContentItem')
                    : t('dashboardI18n.contentStudio.createContentItem')}
              </Button>
            </div>
          </form>

          <Card>
            <CardHeader
              title={`${t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)} ${t('dashboardI18n.contentStudio.readiness', 'Readiness')}`}
              description="This workspace shows the setup, asset, URL, provider, and manual-only checks that apply to the selected platform."
              action={<Send className="h-5 w-5 text-[#F7CBCA]" />}
            />

            <div className="grid gap-3 md:grid-cols-2">
              {[
                [
                  selectedPlatform,
                  selectedProviderReadiness ?? providerReadiness[selectedPlatform],
                ] as const,
              ].map(([providerKey, readiness]) => (
                <div
                  key={providerKey}
                  className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-black">
                      {formatContentStudioPlatformLabel(providerKey as ContentStudioPlatform, t)}
                    </p>
                    <StatusBadge status={readiness.state} type="system" size="sm" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-black/58">{readiness.message}</p>
                  {readiness.missing.length > 0 ? (
                    <p className="mt-2 text-xs text-black/48">
                      Missing: {readiness.missing.join(', ')}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                <p className="font-semibold text-black">{t('dashboardI18n.contentStudio.actionType', 'Action Type')}</p>
                <p className="mt-2 text-sm leading-6 text-black/58">
                  {selectedType === 'google_ads_campaign_draft'
                    ? t('dashboardI18n.contentStudio.pausedAdDraft', 'paused ad draft')
                    : selectedType === 'linkedin_post_planner'
                      ? t('dashboardI18n.contentStudio.manualOnly', 'manual-only')
                      : isMetaAdContentType(selectedType)
                        ? t('dashboardI18n.contentStudio.pausedAdDraft', 'paused ad draft')
                        : t('dashboardI18n.contentStudio.organicPublish', 'organic publish')}
                </p>
              </div>
            </div>
          </Card>

          {selectedItem ? (
            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.aiTaskActions', 'AI Task Actions')}
                description="Create normal task records linked to this content item. Existing task execution, callback, and webhook behavior remain untouched."
                action={<FileText className="h-5 w-5 text-[#F7CBCA]" />}
              />

              <form action={taskFormAction} className="grid gap-3 sm:grid-cols-2">
                {contentStudioTaskOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="submit"
                    name="task_kind"
                    value={option.value}
                    variant="soft"
                    disabled={taskPending || savePending}
                    className="justify-start"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('action.createTask')} {option.label}
                  </Button>
                ))}
              </form>
            </Card>
          ) : null}

          {selectedItem ? (
            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.executionActions', 'Execution Actions')}
                description="These actions now either execute the real provider call or explain exactly what setup is still missing."
                action={<Send className="h-5 w-5 text-[#F7CBCA]" />}
              />

              {selectedItem.content_type === 'facebook_post' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Facebook Page</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedProviderReadiness?.state === 'ready'
                        ? selectedProviderReadiness.message
                        : selectedProviderReadiness?.message ?? 'Facebook Page setup required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Text or image</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedHasFacebookBody
                        ? 'Ready: post text or a linked image is present.'
                        : 'Add post text or link an image asset before publishing.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedItem.content_type === 'instagram_post' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Instagram account</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedProviderReadiness?.state === 'ready'
                        ? selectedProviderReadiness.message
                        : selectedProviderReadiness?.message ??
                          'Instagram Business Account setup required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Image asset</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedPublicImageAsset
                        ? 'Ready: public HTTPS image asset linked.'
                        : selectedSignedImageAsset
                          ? 'This image URL may expire before Meta can process it. Use a public uploaded asset.'
                          : 'Image asset required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Caption</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedHasCaption ? 'Ready: caption present.' : 'Caption required.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {isMetaAdContentType(selectedItem.content_type) ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Meta ad account</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedMetaAdAccountName ?? 'Meta Ad Account is not selected.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Permission</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedProviderReadiness?.details?.hasAdsManagement
                        ? 'ads_management permission is present.'
                        : selectedProviderReadiness?.message ?? 'Meta Ads permission ads_management is missing.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Budget</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedHasBudget ? 'Budget is present.' : 'Budget is required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Creative asset</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedPublicImageAsset
                        ? 'Ready: public HTTPS creative asset linked.'
                        : selectedSignedImageAsset
                          ? 'Creative asset must have a public HTTPS URL.'
                          : 'A creative asset is required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Destination URL</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {readCampaignString(selectedItem, 'destination_url')
                        ? 'Destination URL is present.'
                        : 'Destination URL is required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Safety</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      Created Meta campaign, ad set, and ad stay PAUSED.
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedItem.content_type === 'instagram_reel' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Instagram Business Account</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedProviderReadiness?.message ?? 'Instagram account setup required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Video asset</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedAssets.some((asset) => isCreativeVideoAsset(asset))
                        ? 'Video asset linked.'
                        : 'Linked video asset required for reels.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Public HTTPS media URL</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedAssets.some((asset) => isPublicImageUrl(readCreativeAssetVideo(asset)?.publicUrl))
                        ? 'Public HTTPS video URL present.'
                        : 'Public HTTPS video URL required.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedItem.content_type === 'google_ads_campaign_draft' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">OAuth connection</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedProviderReadiness?.message ?? 'Google Ads OAuth connection required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Destination URL</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {readCampaignString(selectedItem, 'destination_url') ? 'Destination URL is present.' : 'Destination URL is required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Budget, ad copy, keywords</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {readCampaignString(selectedItem, 'offer') || readCampaignList(selectedItem, 'keywords') || selectedItem.ad_copy
                        ? 'Draft inputs are present.'
                        : 'Add budget notes, keywords, and ad copy before creating the paused draft.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedItem.content_type === 'pinterest_pin' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">OAuth and board</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      Board: {selectedPinterestBoardName ?? 'not selected'}. {selectedProviderReadiness?.message ?? ''}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Image asset</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {selectedPublicImageAsset ? 'Public HTTPS image asset linked.' : 'Public HTTPS image asset required.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Destination URL</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      {readCampaignString(selectedItem, 'destination_url') ? 'Destination URL is present.' : 'Destination URL is recommended before publishing.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedItem.content_type === 'linkedin_post_planner' ? (
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">manual_only</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      LinkedIn publishing is not implemented, so this planner only supports copy-ready handoff.
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
                    <p className="text-sm font-bold text-black">Future API setup</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">
                      Real LinkedIn OAuth and publishing can be connected later without fake publish buttons now.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() =>
                    scheduleToastMethod(
                      selectedItem.content_type === 'linkedin_post_planner' ||
                        isMetaAdContentType(selectedItem.content_type)
                        ? 'This item is manual-only and will not auto-publish.'
                        : schedulerReady
                          ? 'Scheduled for real execution.'
                          : schedulerMessage,
                      {
                        description:
                          selectedItem.content_type === 'linkedin_post_planner' ||
                            isMetaAdContentType(selectedItem.content_type)
                            ? 'Use the copy-ready package and keep paid campaign creation safely blocked until provider support is ready.'
                            : schedulerReady
                              ? 'The secure cron job will execute this item after its planned time when the provider is ready.'
                              : 'Configure CRON_SECRET and Vercel Cron, then redeploy to enable automatic execution.',
                      }
                    )
                  }
                >
                  <CalendarClock className="h-4 w-4" />
                  {t('dashboardI18n.contentStudio.schedule')}
                </Button>
                {selectedItem.content_type !== 'linkedin_post_planner' ? (
                <form
                  action={providerFormAction}
                  onSubmit={(event) => {
                    const confirmed = window.confirm(
                      isMetaAdContentType(selectedItem.content_type)
                        ? 'This will create a PAUSED Meta campaign/ad draft. It will not spend money until you activate it manually in Meta Ads Manager. / سيتم إنشاء مسودة متوقفة فقط.'
                        : 'Send this content to the configured provider now? / واش ترسل هذا المحتوى للمزوّد دابا؟'
                    );

                    if (!confirmed) {
                      event.preventDefault();
                      return;
                    }

                    let confirmationInput = event.currentTarget.querySelector<HTMLInputElement>(
                      'input[name="provider_action_confirmed"]'
                    );

                    if (!confirmationInput) {
                      confirmationInput = document.createElement('input');
                      confirmationInput.type = 'hidden';
                      confirmationInput.name = 'provider_action_confirmed';
                      event.currentTarget.appendChild(confirmationInput);
                    }

                    confirmationInput.value = 'true';
                  }}
                >
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={providerPending || savePending || taskPending || isGenerating}
                  >
                    <Send className="h-4 w-4" />
                    {providerPending
                      ? providerActionProgressLabel(selectedItem)
                      : safeProviderActionLabel(selectedItem, selectedProviderReadiness)}
                  </Button>
                </form>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() =>
                    toast.info(
                      selectedItem.content_type === 'linkedin_post_planner'
                        ? 'LinkedIn is currently manual mode only.'
                        : 'Planner-only output.',
                      {
                        description:
                          selectedItem.content_type === 'linkedin_post_planner'
                            ? 'Use the copy-ready fields here for manual posting.'
                            : 'Use the draft text fields and AI task actions to prepare copy-ready output.',
                      }
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                  {selectedItem.content_type === 'linkedin_post_planner'
                    ? t('dashboardI18n.contentStudio.copyLinkedinPackage')
                    : t('dashboardI18n.contentStudio.copyReadyHandoff')}
                </Button>
              </div>

              {selectedItem.provider_error ? (
                <p className="mt-4 text-sm leading-6 text-black/58">{selectedItem.provider_error}</p>
              ) : null}
              {selectedItem.status === 'scheduled' &&
              (selectedItem.content_type === 'linkedin_post_planner' ||
                isMetaAdContentType(selectedItem.content_type)) ? (
                <p className="mt-4 text-sm leading-6 text-black/58">
                  This item is manual-only and will not auto-publish.
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="border-[#F7CBCA]/12 bg-[#F1F7F7]">
        <CardHeader
          title={t('dashboardI18n.contentStudio.contentLibrarySeparate', 'Content Library is separate')}
          description="Use this studio for platform-specific creation and editing. Manage saved drafts, filters, provider status, assets, and planned times in the dedicated library."
          action={<FileText className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold leading-6 text-black/58">
            {items.length} item{items.length === 1 ? '' : 's'} match this studio view. Opening an item from the library returns here on the correct platform tab.
          </p>
          <Link href="/dashboard/content-library" className={buttonStyles({ variant: 'secondary' })}>
            <FileText className="h-4 w-4" />
            {t('dashboardI18n.contentStudio.openContentLibrary')}
          </Link>
        </div>
      </Card>
      </div>
    </div>
  );
}
