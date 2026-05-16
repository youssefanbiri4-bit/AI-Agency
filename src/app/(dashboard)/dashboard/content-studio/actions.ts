'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import {
  canCreateTasks,
  canEditContent,
  canPublishContent,
  canUseAIGeneration,
  normalizeWorkspaceRole,
} from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  addContentStudioItemAsset,
  createContentStudioItem,
  getContentStudioItemById,
  removeContentStudioItemAsset,
  replaceContentStudioItemAssets,
  updateContentStudioItem,
} from '@/lib/data/content-studio';
import {
  createContentStudioPublishAttempt,
  updateContentStudioPublishAttempt,
  type ContentStudioPublishAttemptActionType,
} from '@/lib/data/content-studio-publish-attempts';
import { createNotification } from '@/lib/data/notifications';
import { createTask } from '@/lib/data/tasks';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { checkRateLimit } from '@/lib/rate-limit';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { generateContentStudioText, type ContentGenerationKind } from '@/lib/ai/openai-content';
import { generateMarketingText } from '@/lib/ai/text-provider';
import {
  executeContentStudioProviderAction,
  getContentStudioProviderReadiness,
} from '@/lib/content-studio/provider-actions';
import { campaignTemplates } from '@/lib/content-studio/campaign-templates';
import type {
  CampaignCalendarPlanItem,
  CampaignPlannerInput,
  CampaignPlannerResult,
} from '@/lib/content-studio/campaign-planner-types';
import type { BrandKit } from '@/types/brand-kit';
import type { AgentType, JsonObject } from '@/types';
import type {
  ContentStudioItemRecord,
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
  CreativeAssetRecord,
  NotificationSeverity,
  NotificationType,
} from '@/types/database';
import {
  contentStudioStatusOptions,
  contentStudioTypeOptions,
  formatContentStudioPlatformLabel,
  formatContentStudioTypeLabel,
  inferPlatformFromContentType,
  type ContentStudioTaskKind,
} from './shared';

export interface ContentStudioActionState {
  error: string | null;
  message?: string | null;
  itemId?: string | null;
  taskId?: string | null;
  assetIds?: string[];
  assetCount?: number;
  outcome?: 'success' | 'failed' | 'setup_required' | 'approval_pending' | 'manual_only' | 'unsupported' | null;
}

export interface GenerateContentStudioFieldState {
  error: string | null;
  message?: string | null;
  generatedText?: string | null;
  field?: string | null;
  requestId?: string | null;
  providerUsed?: 'openai' | null;
  fallbackUsed?: false;
}

export interface CampaignPlannerGenerateState {
  error: string | null;
  message?: string | null;
  plan?: CampaignPlannerResult | null;
  providerUsed?: 'openai' | null;
  fallbackUsed?: false;
  model?: string | null;
}

export interface CampaignPlannerDraftState {
  error: string | null;
  message?: string | null;
  itemIds?: string[];
  outcome?: 'success' | 'failed' | null;
}

const initialState: ContentStudioActionState = {
  error: null,
  message: null,
  itemId: null,
  taskId: null,
  outcome: null,
};

const initialGenerateState: GenerateContentStudioFieldState = {
  error: null,
  message: null,
  generatedText: null,
  field: null,
  requestId: null,
};

const allowedPlannerPlatforms: ContentStudioPlatform[] = [
  'instagram',
  'facebook',
  'google_ads',
  'pinterest',
  'linkedin',
];

const plannerContentTypes: ContentStudioType[] = [
  'instagram_post',
  'instagram_reel',
  'facebook_post',
  'google_ads_campaign_draft',
  'pinterest_pin',
  'linkedin_post_planner',
];

const scriptAgentPreferences: AgentType[] = ['social_media_content', 'content_creator', 'copywriting'];
const captionAgentPreferences: AgentType[] = ['social_media_content', 'copywriting', 'content_creator'];
const adCopyAgentPreferences: AgentType[] = ['copywriting', 'ads_script', 'social_media_content'];
const creativeBriefAgentPreferences: AgentType[] = ['visual_brief', 'social_media_content', 'copywriting'];

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function createContentStudioNotification({
  workspaceId,
  userId,
  type,
  severity,
  title,
  message,
  itemId,
  metadata,
  client,
}: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  itemId: string;
  metadata?: JsonObject;
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  try {
    await createNotification(
      {
        workspaceId,
        userId,
        type,
        severity,
        title,
        message,
        relatedEntityType: 'content',
        relatedEntityId: itemId,
        relatedUrl: `/dashboard/content-studio?item=${itemId}`,
        metadata: {
          category: 'content',
          content_item_id: itemId,
          ...(metadata ?? {}),
        },
      },
      client
    );
  } catch {
    // Notifications are best-effort and must not block Content Studio workflows.
  }
}

function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function readCampaignTextField(formData: FormData, key: string) {
  return emptyToNull(readField(formData, key));
}

function readCampaignNumberField(formData: FormData, key: string) {
  const raw = readField(formData, key);
  const value = Number(raw);

  return raw && Number.isFinite(value) && value > 0 ? value : null;
}

function readCampaignListField(formData: FormData, key: string) {
  const raw = readField(formData, key);

  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function readStatus(formData: FormData): ContentStudioStatus {
  const value = readField(formData, 'status') as ContentStudioStatus;

  return contentStudioStatusOptions.some((option) => option.value === value) ? value : 'draft';
}

function readContentType(formData: FormData): ContentStudioType | null {
  const value = readField(formData, 'content_type') as ContentStudioType;

  return contentStudioTypeOptions.some((option) => option.value === value) ? value : null;
}

function readScheduleAt(formData: FormData) {
  const value = readField(formData, 'schedule_at');

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readAssetIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll('asset_ids')
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function readPlannerPlatforms(formData: FormData): ContentStudioPlatform[] {
  const platforms = formData
    .getAll('preferred_platforms')
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter((value): value is ContentStudioPlatform =>
      allowedPlannerPlatforms.includes(value as ContentStudioPlatform)
    );

  return platforms.length > 0 ? Array.from(new Set(platforms)) : allowedPlannerPlatforms;
}

function readCampaignPlannerInput(formData: FormData): CampaignPlannerInput {
  const campaignLength = readField(formData, 'campaign_length');

  return {
    campaignName: readField(formData, 'campaign_name'),
    goal: readField(formData, 'campaign_goal'),
    productService: readField(formData, 'product_service'),
    targetAudience: readField(formData, 'target_audience'),
    offer: readField(formData, 'offer'),
    destinationUrl: readField(formData, 'destination_url'),
    platforms: readPlannerPlatforms(formData),
    campaignLength:
      campaignLength === 'one_post' ||
      campaignLength === '3_day' ||
      campaignLength === '7_day' ||
      campaignLength === '14_day'
        ? campaignLength
        : '7_day',
    tone: readField(formData, 'tone'),
    language: readField(formData, 'language'),
    cta: readField(formData, 'cta'),
    notes: readField(formData, 'notes'),
    templateId: readField(formData, 'template_id'),
  };
}

function brandValue(value: string | null | undefined, fallback = 'Not set') {
  return value?.trim() || fallback;
}

function buildPlannerBrandContext(brandKit: BrandKit) {
  return [
    `Brand name: ${brandValue(brandKit.brandName, 'AgentFlow AI')}`,
    `Description: ${brandValue(brandKit.description)}`,
    `Offer: ${brandValue(brandKit.campaignDefaults.defaultOffer ?? brandKit.offer)}`,
    `Target audience: ${brandValue(brandKit.targetAudience)}`,
    `Tone of voice: ${brandValue(brandKit.toneOfVoice)}`,
    `Writing style: ${brandValue(brandKit.writingStyle)}`,
    `Default CTA: ${brandValue(brandKit.defaultCta)}`,
    `Default hashtags: ${brandValue(brandKit.defaultHashtags)}`,
    `Website URL: ${brandValue(brandKit.campaignDefaults.defaultDestinationUrl ?? brandKit.websiteUrl)}`,
    `Visual style: ${brandValue(brandKit.visualStyle)}`,
    `Image style notes: ${brandValue(brandKit.imageStyleNotes)}`,
    `Brand colors: ${[
      brandKit.primaryColor,
      brandKit.secondaryColor,
      brandKit.accentColor,
      brandKit.backgroundColor,
    ]
      .filter(Boolean)
      .join(', ') || 'Not set'}`,
    `AI preferences: language=${brandKit.aiPreferences.defaultLanguage}, length=${brandKit.aiPreferences.contentLength}, cta style=${brandValue(brandKit.aiPreferences.ctaStyle)}`,
  ].join('\n');
}

function buildPlannerSystemPrompt() {
  return [
    'You are AgentFlow AI campaign planner.',
    'Return only valid JSON matching the requested schema.',
    'Do not include markdown fences or prose outside JSON.',
    'Create draft/copy planning only. Do not claim anything will publish.',
    'Google Ads must always be a paused campaign draft concept only.',
    'LinkedIn must be manual-only / copy-ready.',
    'Keep claims credible, specific, and safe for review.',
  ].join('\n');
}

function buildPlannerUserPrompt(input: CampaignPlannerInput, brandKit: BrandKit) {
  const template = campaignTemplates.find((candidate) => candidate.id === input.templateId);

  return `
Create a complete multi-platform campaign plan from this brief.

Brand Kit:
${buildPlannerBrandContext(brandKit)}

Starting template:
${template ? `${template.name}: ${template.goal}. Best for: ${template.bestFor}.` : 'None selected.'}

Planner input:
Campaign name: ${input.campaignName || 'Use the product/service and goal to name it'}
Goal: ${input.goal || 'Not specified'}
Product/service: ${input.productService || 'Not specified'}
Target audience: ${input.targetAudience || 'Not specified'}
Offer/value proposition: ${input.offer || 'Not specified'}
Destination URL: ${input.destinationUrl || 'Not specified'}
Preferred platforms: ${input.platforms.join(', ')}
Campaign length: ${input.campaignLength}
Tone: ${input.tone || 'Use Brand Kit tone'}
Language: ${input.language || 'Use Brand Kit language'}
CTA: ${input.cta || 'Use Brand Kit default CTA'}
Notes: ${input.notes || 'None'}

JSON schema:
{
  "overview": {
    "campaignName": "string",
    "goal": "string",
    "audience": "string",
    "offer": "string",
    "cta": "string",
    "platforms": ["string"],
    "campaignAngle": "string"
  },
  "instagram": {
    "postCaption": "string",
    "hook": "string",
    "hashtags": ["string"],
    "cta": "string",
    "creativeDirection": "string",
    "reelScript": "string",
    "sceneBreakdown": ["string"],
    "onScreenText": ["string"],
    "voiceoverScript": "string"
  },
  "facebook": {
    "postCopy": "string",
    "headline": "string",
    "description": "string",
    "cta": "string",
    "creativeDirection": "string"
  },
  "googleAds": {
    "campaignObjective": "string",
    "keywords": ["string"],
    "headlines": ["string"],
    "descriptions": ["string"],
    "cta": "string",
    "destinationUrl": "string",
    "budgetNotes": "string",
    "pausedDraftReminder": "string"
  },
  "pinterest": {
    "pinTitle": "string",
    "pinDescription": "string",
    "destinationUrl": "string",
    "creativeDirection": "string",
    "boardSuggestion": "string"
  },
  "linkedin": {
    "post": "string",
    "hook": "string",
    "cta": "string",
    "hashtags": ["string"],
    "manualOnlyNote": "string"
  },
  "creativeBrief": {
    "imageVideoDirection": "string",
    "visualStyle": "string",
    "colors": ["string"],
    "designNotes": "string",
    "suggestedAssetTypes": ["string"]
  },
  "calendarPlan": [
    {
      "day": "Day 1",
      "platform": "instagram",
      "contentType": "instagram_post",
      "title": "string",
      "plannedTime": "09:00",
      "status": "draft",
      "notes": "string"
    }
  ]
}

Use only these platform values in calendarPlan: instagram, facebook, google_ads, pinterest, linkedin.
Use only these contentType values in calendarPlan: ${plannerContentTypes.join(', ')}.
Use only "draft" or "ready" for calendarPlan status.`.trim();
}

function parsePlannerJson(text: string): CampaignPlannerResult | null {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0] ?? '';

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as CampaignPlannerResult;
    if (!parsed.overview || !parsed.instagram || !parsed.googleAds || !Array.isArray(parsed.calendarPlan)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function stringList(values: string[] | undefined) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function joinLines(values: string[] | undefined) {
  return stringList(values).join('\n');
}

function findCalendarItem(
  plan: CampaignPlannerResult,
  contentType: ContentStudioType
): CampaignCalendarPlanItem | null {
  return plan.calendarPlan.find((item) => item.contentType === contentType) ?? null;
}

function scheduleFromCalendarItem(item: CampaignCalendarPlanItem | null, scheduleDrafts: boolean) {
  if (!scheduleDrafts || !item?.day) {
    return null;
  }

  const dayNumber = Number(item.day.match(/\d+/)?.[0] ?? '1');
  const offset = Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber - 1 : 0;
  const [hoursRaw, minutesRaw] = item.plannedTime.split(':');
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(Number(hoursRaw) || 9, Number(minutesRaw) || 0, 0, 0);
  return date.toISOString();
}

function contentItemMetadata(input: {
  plannerInput: CampaignPlannerInput;
  plan: CampaignPlannerResult;
  planId: string;
  packageName: string;
  campaign: JsonObject;
}) {
  return {
    source: 'campaign_planner',
    publishing_mode: 'draft_only',
    campaign: input.campaign,
    planner: {
      campaign_plan_id: input.planId,
      package: input.packageName,
      input: input.plannerInput as unknown as JsonObject,
      overview: input.plan.overview as unknown as JsonObject,
      calendar_plan: input.plan.calendarPlan as unknown as JsonObject[],
      no_publish: true,
      no_live_ads: true,
    },
  } as JsonObject;
}

function buildDraftsFromPlan({
  plannerInput,
  plan,
  planId,
  scheduleDrafts,
}: {
  plannerInput: CampaignPlannerInput;
  plan: CampaignPlannerResult;
  planId: string;
  scheduleDrafts: boolean;
}) {
  const shared = {
    objective: plan.overview.goal,
    prompt: plannerInput.notes || plan.overview.campaignAngle,
  };

  return [
    {
      title: `${plan.overview.campaignName} - Instagram Post`,
      platform: 'instagram' as const,
      contentType: 'instagram_post' as const,
      caption: plan.instagram.postCaption,
      creativeBrief: plan.instagram.creativeDirection,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'instagram_post'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'instagram_post',
        campaign: {
          hook: plan.instagram.hook,
          hashtags: plan.instagram.hashtags,
          cta: plan.instagram.cta,
          offer: plan.overview.offer,
          target_audience: plan.overview.audience,
          destination_url: plannerInput.destinationUrl,
          platform_package: [
            plan.instagram.hook,
            plan.instagram.postCaption,
            plan.instagram.cta,
            joinLines(plan.instagram.hashtags),
          ].filter(Boolean).join('\n\n'),
        },
      }),
      ...shared,
    },
    {
      title: `${plan.overview.campaignName} - Instagram Reel`,
      platform: 'instagram' as const,
      contentType: 'instagram_reel' as const,
      script: plan.instagram.reelScript,
      caption: plan.instagram.postCaption,
      creativeBrief: plan.instagram.creativeDirection,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'instagram_reel'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'instagram_reel',
        campaign: {
          hook: plan.instagram.hook,
          scene_breakdown: plan.instagram.sceneBreakdown.join('\n'),
          on_screen_text: plan.instagram.onScreenText.join('\n'),
          voiceover_script: plan.instagram.voiceoverScript,
          hashtags: plan.instagram.hashtags,
          cta: plan.instagram.cta,
          offer: plan.overview.offer,
          target_audience: plan.overview.audience,
        },
      }),
      ...shared,
    },
    {
      title: `${plan.overview.campaignName} - Facebook Post`,
      platform: 'facebook' as const,
      contentType: 'facebook_post' as const,
      caption: plan.facebook.postCopy,
      creativeBrief: plan.facebook.creativeDirection,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'facebook_post'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'facebook_post',
        campaign: {
          primary_text: plan.facebook.postCopy,
          headlines: [plan.facebook.headline],
          descriptions: [plan.facebook.description],
          cta: plan.facebook.cta,
          offer: plan.overview.offer,
          target_audience: plan.overview.audience,
          destination_url: plannerInput.destinationUrl,
        },
      }),
      ...shared,
    },
    {
      title: `${plan.overview.campaignName} - Google Ads Draft`,
      platform: 'google_ads' as const,
      contentType: 'google_ads_campaign_draft' as const,
      adCopy: [
        plan.googleAds.campaignObjective,
        plan.googleAds.budgetNotes,
        plan.googleAds.pausedDraftReminder || 'Create Paused Google Ads Campaign Draft only.',
      ].join('\n\n'),
      creativeBrief: plan.creativeBrief.designNotes,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'google_ads_campaign_draft'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'google_ads_campaign_draft',
        campaign: {
          destination_url: plan.googleAds.destinationUrl,
          keywords: plan.googleAds.keywords,
          headlines: plan.googleAds.headlines,
          descriptions: plan.googleAds.descriptions,
          cta: plan.googleAds.cta,
          offer: plan.googleAds.budgetNotes,
          platform_package: plan.googleAds.pausedDraftReminder,
        },
      }),
      ...shared,
    },
    {
      title: `${plan.overview.campaignName} - Pinterest Pin`,
      platform: 'pinterest' as const,
      contentType: 'pinterest_pin' as const,
      caption: plan.pinterest.pinDescription,
      creativeBrief: plan.pinterest.creativeDirection,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'pinterest_pin'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'pinterest_pin',
        campaign: {
          headlines: [plan.pinterest.pinTitle],
          descriptions: [plan.pinterest.pinDescription],
          destination_url: plan.pinterest.destinationUrl,
          cta: plan.overview.cta,
          platform_package: `Board suggestion: ${plan.pinterest.boardSuggestion}`,
        },
      }),
      ...shared,
    },
    {
      title: `${plan.overview.campaignName} - LinkedIn Post Planner`,
      platform: 'linkedin' as const,
      contentType: 'linkedin_post_planner' as const,
      caption: plan.linkedin.post,
      creativeBrief: plan.linkedin.manualOnlyNote,
      scheduleAt: scheduleFromCalendarItem(findCalendarItem(plan, 'linkedin_post_planner'), scheduleDrafts),
      metadata: contentItemMetadata({
        plannerInput,
        plan,
        planId,
        packageName: 'linkedin_post_planner',
        campaign: {
          hook: plan.linkedin.hook,
          hashtags: plan.linkedin.hashtags,
          cta: plan.linkedin.cta,
          platform_package: plan.linkedin.manualOnlyNote,
        },
      }),
      ...shared,
    },
  ];
}

async function getWorkspaceContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    throw new Error('Workspace not found');
  }

  return {
    supabase,
    user,
    workspace: workspaceResult.data,
    role: normalizeWorkspaceRole(
      (await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id)).data?.role,
      workspaceResult.data,
      user.id
    ),
  };
}

async function resolveProviderState({
  contentType,
  requestedStatus,
  workspaceId,
  userId,
}: {
  contentType: ContentStudioType;
  requestedStatus: ContentStudioStatus;
  workspaceId: string;
  userId: string;
}) {
  const readiness = await getContentStudioProviderReadiness({
    workspaceId,
    userId,
    contentType,
  });

  if (requestedStatus === 'scheduled') {
    return {
      status: 'scheduled' as const,
      providerStatus: readiness.state === 'ready' ? 'scheduled' : readiness.state,
      providerError: readiness.state === 'ready' ? null : readiness.message,
    };
  }

  if (readiness.state === 'setup_required' || readiness.state === 'token_missing') {
    return {
      status: 'setup_required' as const,
      providerStatus: readiness.state,
      providerError: readiness.message,
    };
  }

  if (readiness.state === 'approval_pending') {
    return {
      status: requestedStatus,
      providerStatus: 'approval_pending',
      providerError: readiness.message,
    };
  }

  if (readiness.state === 'manual_only' || readiness.state === 'unsupported') {
    return {
      status: requestedStatus,
      providerStatus: readiness.state,
      providerError: readiness.message,
    };
  }

  return {
    status: requestedStatus,
    providerStatus: readiness.state,
    providerError: readiness.state === 'ready' ? null : readiness.message,
  };
}

function buildItemMetadata({
  contentType,
  assetIds,
  formData,
  existingMetadata,
}: {
  contentType: ContentStudioType;
  assetIds: string[];
  formData: FormData;
  existingMetadata?: JsonObject | null;
}): JsonObject {
  const baseMetadata = toJsonObject(existingMetadata);
  const baseCampaign = toJsonObject(baseMetadata.campaign);
  const hook = readCampaignTextField(formData, 'hook');
  const primaryText = readCampaignTextField(formData, 'primary_text');
  const targetAudience = readCampaignTextField(formData, 'target_audience');
  const offer = readCampaignTextField(formData, 'offer');
  const destinationUrl = readCampaignTextField(formData, 'destination_url');
  const cta = readCampaignTextField(formData, 'cta');
  const dailyBudget = readCampaignNumberField(formData, 'daily_budget');
  const lifetimeBudget = readCampaignNumberField(formData, 'lifetime_budget');
  const ageMin = readCampaignNumberField(formData, 'age_min');
  const ageMax = readCampaignNumberField(formData, 'age_max');
  const countries = readCampaignListField(formData, 'countries');
  const onScreenText = readCampaignTextField(formData, 'on_screen_text');
  const voiceoverScript = readCampaignTextField(formData, 'voiceover_script');
  const sceneBreakdown = readCampaignTextField(formData, 'scene_breakdown');
  const platformPackage = readCampaignTextField(formData, 'platform_package');
  const headlines = readCampaignListField(formData, 'headlines');
  const descriptions = readCampaignListField(formData, 'descriptions');
  const keywords = readCampaignListField(formData, 'keywords');
  const hashtags = readCampaignListField(formData, 'hashtags');

  return {
    ...baseMetadata,
    source: 'content_studio',
    content_type: contentType,
    linked_asset_ids: assetIds,
    linked_asset_count: assetIds.length,
    publishing_mode: 'provider_action',
    campaign: {
      ...baseCampaign,
      target_audience: targetAudience,
      offer,
      destination_url: destinationUrl,
      hook,
      primary_text: primaryText,
      headlines,
      descriptions,
      keywords,
      hashtags,
      cta,
      scene_breakdown: sceneBreakdown,
      voiceover_script: voiceoverScript,
      on_screen_text: onScreenText,
      platform_package: platformPackage,
    },
    ...(contentType === 'pinterest_pin'
      ? {
          pinterest: {
            title: readField(formData, 'title'),
            description: emptyToNull(readField(formData, 'caption')) ?? emptyToNull(readField(formData, 'ad_copy')),
            destination_url: destinationUrl,
          },
        }
      : {}),
    ...(contentType === 'facebook_feed_ad' ||
    contentType === 'instagram_feed_ad' ||
    contentType === 'facebook_reel_ad' ||
    contentType === 'instagram_reel_ad' ||
    contentType === 'facebook_story_ad' ||
    contentType === 'instagram_story_ad' ||
    contentType === 'facebook_carousel_ad' ||
    contentType === 'instagram_carousel_ad'
      ? {
          meta_ads: {
            objective: emptyToNull(readField(formData, 'objective')),
            destination_url: destinationUrl,
            campaign_name: readField(formData, 'title'),
            ad_set_name: emptyToNull(readField(formData, 'ad_set_name')),
            ad_name: emptyToNull(readField(formData, 'ad_name')),
            daily_budget: dailyBudget,
            lifetime_budget: lifetimeBudget,
            currency: readCampaignTextField(formData, 'currency'),
            start_time: readCampaignTextField(formData, 'start_time'),
            end_time: readCampaignTextField(formData, 'end_time'),
            target_audience: targetAudience,
            countries,
            age_min: ageMin,
            age_max: ageMax,
            genders: readCampaignListField(formData, 'genders'),
            interests: readCampaignListField(formData, 'interests'),
            placements: readCampaignListField(formData, 'placements'),
            optimization_goal: readCampaignTextField(formData, 'optimization_goal') ?? 'LINK_CLICKS',
            billing_event: readCampaignTextField(formData, 'billing_event') ?? 'IMPRESSIONS',
            call_to_action: cta ?? 'LEARN_MORE',
            primary_text: primaryText,
            headline: readCampaignTextField(formData, 'headlines'),
            description: readCampaignTextField(formData, 'descriptions'),
            creative_asset_id: assetIds[0] ?? null,
          },
        }
      : {}),
  };
}

function readItemCampaignString(item: ContentStudioItemRecord, key: string) {
  const campaign = toJsonObject(toJsonObject(item.metadata).campaign);
  const value = campaign[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readItemCampaignStringList(item: ContentStudioItemRecord, key: string) {
  const campaign = toJsonObject(toJsonObject(item.metadata).campaign);
  const value = campaign[key];

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readItemMetaAdsObject(item: ContentStudioItemRecord) {
  return toJsonObject(toJsonObject(item.metadata).meta_ads);
}

function readItemMetaAdsString(item: ContentStudioItemRecord, key: string) {
  const value = readItemMetaAdsObject(item)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readItemMetaAdsNumber(item: ContentStudioItemRecord, key: string) {
  const value = readItemMetaAdsObject(item)[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function readItemMetaAdsStringList(item: ContentStudioItemRecord, key: string) {
  const value = readItemMetaAdsObject(item)[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

async function persistItem({
  itemId,
  formData,
}: {
  itemId?: string;
  formData: FormData;
}): Promise<ContentStudioActionState> {
  const title = readField(formData, 'title');
  const contentType = readContentType(formData);
  const requestedStatus = readStatus(formData);
  const assetIds = readAssetIds(formData);
  const scheduleAt = readScheduleAt(formData);

  if (title.length < 3) {
    return { ...initialState, error: 'Title must be at least 3 characters.' };
  }

  if (!contentType) {
    return { ...initialState, error: 'Choose a platform and format first.' };
  }

  if (requestedStatus === 'scheduled' && !scheduleAt) {
    return {
      ...initialState,
      error: 'Add a planned schedule time before marking this item as scheduled.',
    };
  }

  const { supabase, user, workspace, role } = await getWorkspaceContext();

  if (!canEditContent(role)) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspace.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'content',
      message: 'Blocked content edit.',
      metadata: { role },
    });

    return { ...initialState, error: 'You do not have permission to edit content.' };
  }

  if (requestedStatus === 'scheduled' && !canPublishContent(role)) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspace.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'content',
      message: 'Blocked content scheduling.',
      metadata: { role },
    });

    return { ...initialState, error: 'You do not have permission to schedule content.' };
  }

  const existingItemResult = itemId
    ? await getContentStudioItemById(workspace.id, itemId, supabase)
    : null;

  if (itemId && (existingItemResult?.error || !existingItemResult?.data)) {
    return {
      ...initialState,
      error: existingItemResult?.error ?? 'Content item not found.',
    };
  }

  const provider = await resolveProviderState({
    contentType,
    requestedStatus,
    workspaceId: workspace.id,
    userId: user.id,
  });
  const platform = inferPlatformFromContentType(contentType);
  const payload = {
    title,
    platform,
    contentType,
    status: provider.status,
    objective: emptyToNull(readField(formData, 'objective')),
    prompt: emptyToNull(readField(formData, 'prompt')),
    script: emptyToNull(readField(formData, 'script')),
    caption: emptyToNull(readField(formData, 'caption')),
    adCopy: emptyToNull(readField(formData, 'ad_copy')),
    creativeBrief: emptyToNull(readField(formData, 'creative_brief')),
    scheduleAt,
    providerStatus: provider.providerStatus,
    providerError: provider.providerError,
    scheduledExecutionStatus: requestedStatus === 'scheduled' ? 'pending' : null,
    scheduledExecutionStartedAt: null,
    scheduledExecutionFinishedAt: null,
    scheduledExecutionError: null,
    scheduledExecutionAttempts: 0,
    metadata: buildItemMetadata({
      contentType,
      assetIds,
      formData,
      existingMetadata: existingItemResult?.data?.metadata as JsonObject | null | undefined,
    }),
  };

  const result = itemId
    ? await updateContentStudioItem(itemId, workspace.id, payload, supabase)
    : await createContentStudioItem(
        {
          workspaceId: workspace.id,
          userId: user.id,
          ...payload,
        },
        supabase
      );

  if (result.error || !result.data) {
    return { ...initialState, error: result.error ?? 'Content item could not be saved.' };
  }

  const linkResult = await replaceContentStudioItemAssets(result.data.id, assetIds, supabase);

  if (linkResult.error) {
    return { ...initialState, error: linkResult.error };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/content-studio');

  const existingItem = existingItemResult?.data ?? null;
  const hadScheduledPlan = Boolean(existingItem?.schedule_at);
  const hasScheduledPlan = Boolean(scheduleAt);
  const isPlannedSchedule =
    provider.status === 'scheduled' ||
    (requestedStatus === 'scheduled' && hasScheduledPlan);
  const notificationType: NotificationType = !itemId
    ? isPlannedSchedule
      ? 'content_item_scheduled'
      : 'content_item_created'
    : isPlannedSchedule
      ? 'content_item_scheduled'
      : 'content_item_updated';
  const notificationTitle = !itemId
    ? isPlannedSchedule
      ? 'Content scheduled'
      : 'Content item created'
    : isPlannedSchedule
      ? 'Content schedule updated'
      : 'Content item updated';

  await createContentStudioNotification({
    workspaceId: workspace.id,
    userId: user.id,
    type: notificationType,
    severity: isPlannedSchedule ? 'success' : 'info',
    title: notificationTitle,
    message: `${title} was ${!itemId ? 'created' : 'updated'} in Content & Ads Studio.`,
    itemId: result.data.id,
    metadata: {
      platform,
      content_type: contentType,
      status: provider.status,
      scheduled: String(isPlannedSchedule),
    },
    client: supabase,
  });

  const message = isPlannedSchedule
    ? itemId
      ? 'Planned schedule updated.'
      : 'Schedule saved.'
    : hasScheduledPlan && !hadScheduledPlan
      ? 'Schedule saved.'
      : itemId
        ? 'Content item updated.'
        : 'Content item created.';

  return {
    error: null,
    message,
    itemId: result.data.id,
    outcome: 'success',
  };
}

async function loadLinkedAssets(
  workspaceId: string,
  assetIds: string[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  if (assetIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('creative_assets')
    .select('id, title, asset_type, platform, image_url, storage_path, metadata')
    .eq('workspace_id', workspaceId)
    .in('id', assetIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<
      CreativeAssetRecord,
      'id' | 'title' | 'asset_type' | 'platform' | 'image_url' | 'storage_path' | 'metadata'
    >
  >;
}

function getProviderActionType(contentType: ContentStudioType): ContentStudioPublishAttemptActionType {
  switch (contentType) {
    case 'facebook_post':
    case 'instagram_post':
      return 'publish_post';
    case 'facebook_reel':
    case 'instagram_reel':
      return 'publish_reel';
    case 'google_ads_campaign_draft':
      return 'create_campaign_draft';
    case 'facebook_feed_ad':
    case 'instagram_feed_ad':
    case 'facebook_reel_ad':
    case 'instagram_reel_ad':
    case 'facebook_story_ad':
    case 'instagram_story_ad':
    case 'facebook_carousel_ad':
    case 'instagram_carousel_ad':
      return 'create_paused_meta_ad_draft';
    case 'pinterest_pin':
      return 'publish_pin';
    case 'linkedin_post_planner':
      return 'manual_handoff';
    default:
      return 'manual_handoff';
  }
}

function getProviderName(contentType: ContentStudioType) {
  switch (contentType) {
    case 'facebook_post':
    case 'facebook_reel':
    case 'instagram_post':
    case 'instagram_reel':
      return 'meta' as const;
    case 'google_ads_campaign_draft':
      return 'google_ads' as const;
    case 'facebook_feed_ad':
    case 'facebook_reel_ad':
    case 'facebook_story_ad':
    case 'facebook_carousel_ad':
    case 'instagram_feed_ad':
    case 'instagram_reel_ad':
    case 'instagram_story_ad':
    case 'instagram_carousel_ad':
      return 'meta' as const;
    case 'pinterest_pin':
      return 'pinterest' as const;
    case 'linkedin_post_planner':
      return 'linkedin' as const;
    default:
      return 'linkedin' as const;
  }
}

function isPublishedContentType(contentType: ContentStudioType) {
  return (
    contentType === 'facebook_post' ||
    contentType === 'instagram_post' ||
    contentType === 'instagram_reel' ||
    contentType === 'pinterest_pin'
  );
}

function getTaskAgentPreferences(kind: ContentStudioTaskKind) {
  switch (kind) {
    case 'script':
      return scriptAgentPreferences;
    case 'caption':
      return captionAgentPreferences;
    case 'ad_copy':
      return adCopyAgentPreferences;
    case 'creative_brief':
      return creativeBriefAgentPreferences;
    default:
      return scriptAgentPreferences;
  }
}

async function getTaskAgentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  kind: ContentStudioTaskKind
) {
  const preferredIds = getTaskAgentPreferences(kind);
  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .eq('department_id', 'content_growth')
    .eq('is_active', true)
    .in('id', preferredIds)
    .order('sort_order', { ascending: true });

  if (error) {
    return { agentType: null, error: error.message };
  }

  const sorted = preferredIds
    .map((id) => data?.find((agent) => agent.id === id)?.id)
    .find(Boolean);

  if (!sorted) {
    return { agentType: null, error: 'No active Content & Growth agent is available.' };
  }

  return { agentType: sorted as AgentType, error: null };
}

function buildTaskDescription(item: ContentStudioItemRecord, kind: ContentStudioTaskKind) {
  const typeLabel = formatContentStudioTypeLabel(item.content_type);
  const platformLabel = formatContentStudioPlatformLabel(item.platform);
  const metadataAssetCount =
    typeof item.metadata?.linked_asset_count === 'number' ? item.metadata.linked_asset_count : 0;

  const common = `
Content Studio item: "${item.title}"
Platform: ${platformLabel}
Format: ${typeLabel}
Objective: ${item.objective || 'Not specified'}
Prompt / direction: ${item.prompt || 'Not specified'}
Linked creative assets: ${metadataAssetCount}
Current script: ${item.script || 'Not specified'}
Current caption: ${item.caption || 'Not specified'}
Current ad copy: ${item.ad_copy || 'Not specified'}
Current creative brief: ${item.creative_brief || 'Not specified'}
`.trim();

  switch (kind) {
    case 'script':
      return `${common}

Task:
Create a polished platform-ready script or structured talking points for this content item.

Required output:
- Hook
- Main script
- CTA
- Optional on-screen text ideas`;
    case 'caption':
      return `${common}

Task:
Write caption options tailored to this content item.

Required output:
- 3 caption variants
- CTA
- Optional hashtags
- Short posting note`;
    case 'ad_copy':
      return `${common}

Task:
Write ad copy for this campaign draft or social placement.

Required output:
- Primary copy
- Headline ideas
- CTA ideas
- Short testing notes`;
    case 'creative_brief':
      return `${common}

Task:
Create a creative brief that can guide design or production.

Required output:
- Core concept
- Audience insight
- Visual direction
- Messaging pillars
- Production notes`;
    default:
      return common;
  }
}

function generationFieldFromKind(kind: ContentGenerationKind) {
  switch (kind) {
    case 'script':
      return 'script' as const;
    case 'caption':
      return 'caption' as const;
    case 'ad_copy':
      return 'ad_copy' as const;
    case 'creative_brief':
      return 'creative_brief' as const;
    case 'campaign_brief':
      return 'creative_brief' as const;
    case 'instagram_ad':
    case 'facebook_ad':
      return 'ad_copy' as const;
    case 'google_search_ad':
    case 'headlines':
      return 'headlines' as const;
    case 'pinterest_pin_copy':
      return 'caption' as const;
    case 'reel_script':
      return 'voiceover_script' as const;
    case 'hook':
      return 'hook' as const;
    case 'descriptions':
      return 'descriptions' as const;
    case 'keywords':
      return 'keywords' as const;
    case 'hashtags':
      return 'hashtags' as const;
    case 'cta':
      return 'cta' as const;
    case 'audience_suggestions':
      return 'target_audience' as const;
    case 'full_campaign_package':
      return 'platform_package' as const;
    default:
      return 'script' as const;
  }
}

function generationMessageFromKind(kind: ContentGenerationKind) {
  switch (kind) {
    case 'script':
      return 'Script generated.';
    case 'caption':
      return 'Caption generated.';
    case 'ad_copy':
      return 'Ad copy generated.';
    case 'creative_brief':
      return 'Creative brief generated.';
    case 'campaign_brief':
      return 'Campaign brief generated.';
    case 'instagram_ad':
      return 'Instagram ad copy generated.';
    case 'facebook_ad':
      return 'Facebook ad copy generated.';
    case 'google_search_ad':
      return 'Google Search ad package generated.';
    case 'pinterest_pin_copy':
      return 'Pinterest pin copy generated.';
    case 'reel_script':
      return 'Reel script generated.';
    case 'hook':
      return 'Hook generated.';
    case 'headlines':
      return 'Headlines generated.';
    case 'descriptions':
      return 'Descriptions generated.';
    case 'keywords':
      return 'Keywords generated.';
    case 'hashtags':
      return 'Hashtags generated.';
    case 'cta':
      return 'CTA generated.';
    case 'audience_suggestions':
      return 'Audience suggestions generated.';
    case 'full_campaign_package':
      return 'Full campaign package generated.';
    default:
      return 'Content generated.';
  }
}

function buildTaskTitle(item: ContentStudioItemRecord, kind: ContentStudioTaskKind) {
  switch (kind) {
    case 'script':
      return `[Content Studio Script] ${item.title}`;
    case 'caption':
      return `[Content Studio Caption] ${item.title}`;
    case 'ad_copy':
      return `[Content Studio Ad Copy] ${item.title}`;
    case 'creative_brief':
      return `[Content Studio Creative Brief] ${item.title}`;
    default:
      return `[Content Studio Task] ${item.title}`;
  }
}

function checkGenerationLimit(workspaceId: string, userId: string) {
  return checkRateLimit({
    key: `content-generation:${workspaceId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
}

export async function createContentStudioItemAction(
  _state: ContentStudioActionState,
  formData: FormData
): Promise<ContentStudioActionState> {
  try {
    return await persistItem({ formData });
  } catch (error) {
    return {
      ...initialState,
      error: error instanceof Error ? error.message : 'Content item could not be created.',
    };
  }
}

export async function updateContentStudioItemAction(
  itemId: string,
  _state: ContentStudioActionState,
  formData: FormData
): Promise<ContentStudioActionState> {
  try {
    return await persistItem({ itemId, formData });
  } catch (error) {
    return {
      ...initialState,
      error: error instanceof Error ? error.message : 'Content item could not be updated.',
    };
  }
}

export async function removeCreativeAssetFromDraftAction(
  itemId: string,
  creativeAssetId: string
): Promise<ContentStudioActionState> {
  try {
    if (!itemId || !creativeAssetId) {
      return {
        ...initialState,
        error: 'Could not remove creative asset from draft.',
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canEditContent(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'content',
        entityId: itemId,
        message: 'Blocked creative asset unlink from content draft.',
        metadata: { role },
      });

      return { ...initialState, error: 'ما عندكش صلاحية لتعديل المحتوى. Content editing is restricted for your workspace role.' };
    }

    const result = await removeContentStudioItemAsset(
      itemId,
      workspace.id,
      creativeAssetId,
      supabase
    );

    if (result.error || !result.data) {
      return {
        ...initialState,
        error: 'Could not remove creative asset from draft.',
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard', 'layout');
    revalidatePath('/dashboard/content-studio');

    return {
      ...initialState,
      message: 'Creative asset removed from draft.',
      itemId,
      assetIds: result.data.asset_ids,
      assetCount: result.data.asset_count,
      outcome: 'success',
    };
  } catch {
    return {
      ...initialState,
      error: 'Could not remove creative asset from draft.',
    };
  }
}

export async function linkCreativeAssetToDraftAction(
  itemId: string,
  creativeAssetId: string
): Promise<ContentStudioActionState> {
  try {
    if (!itemId || !creativeAssetId) {
      return {
        ...initialState,
        error: 'Could not link creative asset to draft.',
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canEditContent(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'content',
        entityId: itemId,
        message: 'Blocked creative asset link to content draft.',
        metadata: { role },
      });

      return { ...initialState, error: 'ما عندكش صلاحية لتعديل المحتوى. Content editing is restricted for your workspace role.' };
    }

    const result = await addContentStudioItemAsset(itemId, workspace.id, creativeAssetId, supabase);

    if (result.error || !result.data) {
      return {
        ...initialState,
        error: 'Could not link creative asset to draft.',
      };
    }

    revalidatePath('/dashboard/content-studio');

    return {
      ...initialState,
      message: 'Creative asset linked to draft.',
      itemId,
      assetIds: result.data.asset_ids,
      assetCount: result.data.asset_count,
      outcome: 'success',
    };
  } catch {
    return {
      ...initialState,
      error: 'Could not link creative asset to draft.',
    };
  }
}

export async function executeContentStudioProviderActionAction(
  itemId: string,
  _state: ContentStudioActionState,
  formData?: FormData
): Promise<ContentStudioActionState> {
  void _state;

  try {
    const { supabase, user, workspace, role } = await getWorkspaceContext();
    const explicitConfirmation = formData?.get('provider_action_confirmed') === 'true';

    if (!canPublishContent(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'publishing',
        entityId: itemId,
        message: 'Blocked provider publishing action.',
        metadata: { role },
      });

      return {
        ...initialState,
        error: 'You do not have permission to publish content.',
        outcome: 'failed',
      };
    }

    const itemResult = await getContentStudioItemById(workspace.id, itemId, supabase);

    if (itemResult.error || !itemResult.data) {
      return {
        ...initialState,
        error: itemResult.error ?? 'Content item not found.',
        outcome: 'failed',
      };
    }

    const item = itemResult.data;

    if (item.created_by !== user.id) {
      return {
        ...initialState,
        error: 'You can only publish content items you created.',
        outcome: 'failed',
      };
    }

    const actionType = getProviderActionType(item.content_type);
    const existingExternalId = item.provider_external_id?.trim();

    if (existingExternalId && item.status === 'published') {
      return {
        ...initialState,
        message: 'Published successfully.',
        itemId: item.id,
        outcome: 'success',
      };
    }

    if (
      existingExternalId &&
      item.provider_status === 'external_draft_created' &&
      actionType === 'create_paused_meta_ad_draft'
    ) {
      return {
        ...initialState,
        message: 'Paused Meta ad draft already created.',
        itemId: item.id,
        outcome: 'success',
      };
    }

    const attemptResult = await createContentStudioPublishAttempt(
      {
        workspaceId: workspace.id,
        contentItemId: item.id,
        provider: getProviderName(item.content_type),
        actionType,
        status: 'pending',
        requestSummary: {
          content_type: item.content_type,
          title: item.title,
          linked_asset_count: item.asset_count,
        },
        createdBy: user.id,
      },
      supabase
    );

    if (attemptResult.error || !attemptResult.data) {
      return {
        ...initialState,
        error: attemptResult.error ?? 'Publish attempt could not be recorded.',
        outcome: 'failed',
      };
    }

    const linkedAssets = await loadLinkedAssets(workspace.id, item.asset_ids, supabase);
    const readiness = await getContentStudioProviderReadiness({
      workspaceId: workspace.id,
      userId: user.id,
      contentType: item.content_type,
      caption: item.caption,
      script: item.script,
      adCopy: item.ad_copy,
      creativeBrief: item.creative_brief,
      objective: item.objective,
      title: item.title,
      itemId: item.id,
      destinationUrl: readItemCampaignString(item, 'destination_url'),
      budgetNotes: readItemCampaignString(item, 'offer'),
      keywords: readItemCampaignStringList(item, 'keywords'),
      dailyBudget: readItemMetaAdsNumber(item, 'daily_budget'),
      lifetimeBudget: readItemMetaAdsNumber(item, 'lifetime_budget'),
      targetAudience: readItemMetaAdsString(item, 'target_audience'),
      countries: readItemMetaAdsStringList(item, 'countries'),
      ageMin: readItemMetaAdsNumber(item, 'age_min'),
      ageMax: readItemMetaAdsNumber(item, 'age_max'),
      callToAction: readItemMetaAdsString(item, 'call_to_action'),
      headline: readItemMetaAdsString(item, 'headline'),
      description: readItemMetaAdsString(item, 'description'),
      linkedAssets: linkedAssets.map((asset) => ({
        id: asset.id,
        title: asset.title,
        assetType: asset.asset_type,
        platform: asset.platform,
        imageUrl: asset.image_url,
        storagePath: asset.storage_path,
        metadata: asset.metadata as Record<string, unknown> | null,
      })),
      validateContent: true,
    });

    if (readiness.state !== 'ready') {
      const guardedStatus =
        readiness.state === 'manual_only'
          ? 'manual_only'
          : readiness.state === 'unsupported'
            ? 'unsupported'
            : readiness.state === 'approval_pending'
              ? 'approval_pending'
              : 'setup_required';

      await updateContentStudioPublishAttempt(
        attemptResult.data.id,
        workspace.id,
        {
          status: guardedStatus,
          providerResponseSummary: {
            readiness_state: readiness.state,
            missing: readiness.missing,
          },
          errorMessage: readiness.message,
        },
        supabase
      );

      await updateContentStudioItem(
        item.id,
        workspace.id,
        {
          status:
            readiness.state === 'approval_pending'
              ? 'approval_pending'
              : readiness.state === 'manual_only' || readiness.state === 'unsupported'
                ? item.status
                : 'setup_required',
          providerStatus: readiness.state,
          providerError: readiness.message,
        },
        supabase
      );

      const outcome: ContentStudioActionState['outcome'] =
        readiness.state === 'approval_pending'
          ? 'approval_pending'
          : readiness.state === 'manual_only'
            ? 'manual_only'
            : readiness.state === 'unsupported'
              ? 'unsupported'
              : 'setup_required';

      await createContentStudioNotification({
        workspaceId: workspace.id,
        userId: user.id,
        type: readiness.state === 'approval_pending' ? 'approval_pending' : 'publishing_setup_required',
        severity: readiness.state === 'approval_pending' ? 'warning' : 'error',
        title: readiness.state === 'approval_pending' ? 'Provider approval pending' : 'Publishing setup required',
        message: readiness.message,
        itemId: item.id,
        metadata: {
          category: 'publishing',
          platform: item.platform,
          content_type: item.content_type,
          readiness_state: readiness.state,
        },
        client: supabase,
      });

      revalidatePath('/dashboard');
      revalidatePath('/dashboard', 'layout');
      revalidatePath('/dashboard/content-studio');
      return {
        ...initialState,
        error: readiness.message,
        message: readiness.message,
        itemId: item.id,
        outcome,
      };
    }

    const providerResult = await executeContentStudioProviderAction({
      workspaceId: workspace.id,
      userId: user.id,
      supabase,
      role,
      explicitConfirmation,
      itemId: item.id,
      title: item.title,
      contentType: item.content_type,
      objective: item.objective,
      caption: item.caption,
      script: item.script,
      adCopy: item.ad_copy,
      creativeBrief: item.creative_brief,
      destinationUrl: readItemCampaignString(item, 'destination_url'),
      dailyBudget: readItemMetaAdsNumber(item, 'daily_budget'),
      lifetimeBudget: readItemMetaAdsNumber(item, 'lifetime_budget'),
      targetAudience: readItemMetaAdsString(item, 'target_audience'),
      countries: readItemMetaAdsStringList(item, 'countries'),
      ageMin: readItemMetaAdsNumber(item, 'age_min'),
      ageMax: readItemMetaAdsNumber(item, 'age_max'),
      callToAction: readItemMetaAdsString(item, 'call_to_action'),
      headline: readItemMetaAdsString(item, 'headline'),
      description: readItemMetaAdsString(item, 'description'),
      linkedAssets: linkedAssets.map((asset) => ({
        id: asset.id,
        title: asset.title,
        assetType: asset.asset_type,
        platform: asset.platform,
        imageUrl: asset.image_url,
        storagePath: asset.storage_path,
        metadata: asset.metadata as Record<string, unknown> | null,
      })),
    });

    const normalizedStatus =
      providerResult.status === 'succeeded'
        ? 'succeeded'
        : providerResult.status === 'approval_pending'
          ? 'approval_pending'
          : providerResult.status === 'setup_required'
            ? 'setup_required'
            : providerResult.status === 'manual_only'
              ? 'manual_only'
              : providerResult.status === 'unsupported'
                ? 'unsupported'
                : 'failed';
    await updateContentStudioPublishAttempt(
      attemptResult.data.id,
      workspace.id,
      {
        status: normalizedStatus,
        providerExternalId: providerResult.providerExternalId ?? null,
        providerResponseSummary:
          (providerResult.providerResponseSummary as JsonObject | undefined) ?? {},
        errorMessage: providerResult.status === 'succeeded' ? null : providerResult.message,
      },
      supabase
    );

    if (providerResult.status === 'succeeded') {
      const completedAt = new Date().toISOString();
      const shouldMarkPublished = isPublishedContentType(item.content_type);
      const isPausedMetaAdDraft =
        providerResult.actionType === 'create_paused_meta_ad_draft';
      const isPausedGoogleAdsDraft =
        providerResult.actionType === 'create_campaign_draft';
      const nextStatus =
        item.content_type === 'google_ads_campaign_draft'
          ? 'ready'
          : shouldMarkPublished
            ? 'published'
            : item.status;
      const updateResult = await updateContentStudioItem(
        item.id,
        workspace.id,
        {
          status: nextStatus,
          publishedAt: shouldMarkPublished ? completedAt : item.published_at,
          providerExternalId: providerResult.providerExternalId ?? null,
          providerResponseSummary:
            (providerResult.providerResponseSummary as JsonObject | undefined) ?? {},
          lastProviderActionAt: completedAt,
          providerStatus: isPausedMetaAdDraft
            ? 'external_draft_created'
            : isPausedGoogleAdsDraft
              ? 'paused_draft_created'
              : 'ready',
          providerError: null,
          metadata: {
            ...item.metadata,
            last_provider_action: providerResult.actionType,
            ...(isPausedMetaAdDraft
              ? {
                  meta_ads_external_draft: {
                    status: 'draft_created',
                    created_at: completedAt,
                    ...(providerResult.providerResponseSummary ?? {}),
                  },
                }
              : {}),
            ...(isPausedGoogleAdsDraft
              ? {
                  google_ads_external_draft: {
                    status: 'paused_draft_created',
                    created_at: completedAt,
                    ...(providerResult.providerResponseSummary ?? {}),
                  },
                }
              : {}),
            ...(shouldMarkPublished
              ? { last_provider_publish_at: completedAt }
              : { last_provider_action_at: completedAt }),
          },
        },
        supabase
      );

      if (updateResult.error) {
        return {
          ...initialState,
          error: updateResult.error,
          itemId: item.id,
          outcome: 'failed',
        };
      }

      await createContentStudioNotification({
        workspaceId: workspace.id,
        userId: user.id,
        type: shouldMarkPublished ? 'content_item_published' : 'content_item_updated',
        severity: 'success',
        title: shouldMarkPublished ? 'Content published' : 'Provider action completed',
        message: providerResult.message,
        itemId: item.id,
        metadata: {
          category: shouldMarkPublished ? 'publishing' : 'content',
          platform: item.platform,
          content_type: item.content_type,
          provider_action: providerResult.actionType,
        },
        client: supabase,
      });

      revalidatePath('/dashboard');
      revalidatePath('/dashboard', 'layout');
      revalidatePath('/dashboard/content-studio');
      return {
        ...initialState,
        message: providerResult.message,
        itemId: item.id,
        outcome: 'success',
      };
    }

    const statusToPersist =
      providerResult.status === 'setup_required'
        ? 'setup_required'
        : providerResult.status === 'approval_pending'
          ? 'approval_pending'
        : providerResult.status === 'manual_only' || providerResult.status === 'unsupported'
          ? item.status
          : 'failed';
    await updateContentStudioItem(
      item.id,
      workspace.id,
      {
        status: statusToPersist,
        providerExternalId: providerResult.providerExternalId ?? null,
        providerResponseSummary:
          (providerResult.providerResponseSummary as JsonObject | undefined) ?? {},
        providerStatus:
          providerResult.status === 'manual_only' || providerResult.status === 'unsupported'
            ? providerResult.status
            : normalizedStatus,
        providerError: providerResult.message,
      },
      supabase
    );

    await createContentStudioNotification({
      workspaceId: workspace.id,
      userId: user.id,
      type:
        providerResult.status === 'setup_required'
          ? 'publishing_setup_required'
          : providerResult.status === 'approval_pending'
            ? 'approval_pending'
            : 'publishing_failed',
      severity:
        providerResult.status === 'approval_pending'
          ? 'warning'
          : providerResult.status === 'setup_required'
            ? 'error'
            : 'critical',
      title:
        providerResult.status === 'setup_required'
          ? 'Publishing setup required'
          : providerResult.status === 'approval_pending'
            ? 'Provider approval pending'
            : 'Publishing action failed',
      message: providerResult.message,
      itemId: item.id,
      metadata: {
        category: 'publishing',
        platform: item.platform,
        content_type: item.content_type,
        provider_status: providerResult.status,
      },
      client: supabase,
    });

    revalidatePath('/dashboard/content-studio');
    return {
      ...initialState,
      error: providerResult.message,
      message: providerResult.message,
      itemId: item.id,
      outcome: providerResult.status,
    };
  } catch (error) {
    return {
      ...initialState,
      error: error instanceof Error ? error.message : 'Could not publish.',
      outcome: 'failed',
    };
  }
}

export async function createContentStudioTaskAction(
  itemId: string,
  _state: ContentStudioActionState,
  formData: FormData
): Promise<ContentStudioActionState> {
  try {
    const kind = readField(formData, 'task_kind') as ContentStudioTaskKind;
    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canCreateTasks(role)) {
      return {
        ...initialState,
        error: 'ما عندكش صلاحية لإنشاء مهام من Content Studio. Task creation is restricted for your workspace role.',
      };
    }

    const itemResult = await getContentStudioItemById(workspace.id, itemId, supabase);

    if (itemResult.error || !itemResult.data) {
      return {
        ...initialState,
        error: itemResult.error ?? 'Content item not found.',
      };
    }

    const agentResult = await getTaskAgentId(supabase, kind);

    if (agentResult.error || !agentResult.agentType) {
      return {
        ...initialState,
        error: agentResult.error ?? 'No task agent is available.',
      };
    }

    const taskResult = await createTask(
      {
        workspaceId: workspace.id,
        userId: user.id,
        agentType: agentResult.agentType,
        title: buildTaskTitle(itemResult.data, kind),
        description: buildTaskDescription(itemResult.data, kind),
        priority: 'Normal',
        inputData: {
          source: 'content_studio',
          content_studio_item_id: itemResult.data.id,
          content_type: itemResult.data.content_type,
          task_kind: kind,
          linked_asset_ids: itemResult.data.asset_ids,
        },
      },
      supabase
    );

    if (taskResult.error || !taskResult.data) {
      return {
        ...initialState,
        error: taskResult.error ?? 'Task could not be created.',
      };
    }

    revalidatePath('/dashboard/content-studio');
    revalidatePath('/dashboard/tasks');
    revalidatePath(`/dashboard/tasks/${taskResult.data.id}`);

    return {
      error: null,
      message: `${kind.replace('_', ' ')} task created.`,
      itemId: itemResult.data.id,
      taskId: taskResult.data.id,
    };
  } catch (error) {
    return {
      ...initialState,
      error: error instanceof Error ? error.message : 'Task could not be created.',
    };
  }
}

export async function generateContentStudioFieldAction(
  itemId: string,
  formData: FormData
): Promise<GenerateContentStudioFieldState> {
  try {
    const kind = readField(formData, 'generation_kind') as ContentGenerationKind;

    if (
      ![
        'script',
        'caption',
        'ad_copy',
        'creative_brief',
        'campaign_brief',
        'instagram_ad',
        'facebook_ad',
        'google_search_ad',
        'pinterest_pin_copy',
        'reel_script',
        'hook',
        'headlines',
        'descriptions',
        'keywords',
        'hashtags',
        'cta',
        'audience_suggestions',
        'full_campaign_package',
      ].includes(kind)
    ) {
      return {
        ...initialGenerateState,
        error: 'Choose a valid generation action first.',
        requestId: `${Date.now()}`,
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canUseAIGeneration(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'content_generation',
        entityId: itemId,
        message: 'Blocked content field generation.',
        metadata: { role },
      });

      return {
        ...initialGenerateState,
        error: 'ما عندكش صلاحية لاستعمال توليد المحتوى. AI generation is restricted for your workspace role.',
      };
    }

    if (!(await checkGenerationLimit(workspace.id, user.id)).allowed) {
      return {
        ...initialGenerateState,
        error: 'وصلتي للحد المؤقت لتوليد المحتوى. عاود المحاولة بعد شوية.',
      };
    }

    const [itemResult, brandKitResult] = await Promise.all([
      getContentStudioItemById(workspace.id, itemId, supabase),
      getBrandKitForWorkspace(supabase, workspace.id),
    ]);

    if (itemResult.error || !itemResult.data) {
      return {
        ...initialGenerateState,
        error: itemResult.error ?? 'Content item not found.',
      };
    }

    const item = itemResult.data;
    const contentType = readContentType(formData) ?? item.content_type;
    const platform = inferPlatformFromContentType(contentType);
    const assetIds = readAssetIds(formData);
    let creativeAssetSummary = 'No linked creative assets.';

    if (assetIds.length > 0) {
      const { data: assets, error: assetsError } = await supabase
        .from('creative_assets')
        .select('id, title, asset_type, platform')
        .eq('workspace_id', workspace.id)
        .in('id', assetIds);

      if (assetsError) {
        return {
          ...initialGenerateState,
          error: assetsError.message,
        };
      }

      creativeAssetSummary =
        assets && assets.length > 0
          ? assets
              .map(
                (asset) =>
                  `${asset.title} (${asset.platform.replace(/_/g, ' ')}, ${asset.asset_type.replace(/_/g, ' ')})`
              )
              .join('; ')
          : creativeAssetSummary;
    }

    const generationResult = await generateContentStudioText(kind, {
      title: readField(formData, 'title') || item.title,
      platform,
      contentType,
      objective: emptyToNull(readField(formData, 'objective')) ?? item.objective,
      prompt: emptyToNull(readField(formData, 'prompt')) ?? item.prompt,
      script: emptyToNull(readField(formData, 'script')) ?? item.script,
      caption: emptyToNull(readField(formData, 'caption')) ?? item.caption,
      adCopy: emptyToNull(readField(formData, 'ad_copy')) ?? item.ad_copy,
      creativeBrief:
        emptyToNull(readField(formData, 'creative_brief')) ?? item.creative_brief,
      targetAudience: readCampaignTextField(formData, 'target_audience'),
      offer: readCampaignTextField(formData, 'offer'),
      destinationUrl: readCampaignTextField(formData, 'destination_url'),
      hook: readCampaignTextField(formData, 'hook'),
      primaryText: readCampaignTextField(formData, 'primary_text'),
      headlines: readCampaignListField(formData, 'headlines'),
      descriptions: readCampaignListField(formData, 'descriptions'),
      keywords: readCampaignListField(formData, 'keywords'),
      hashtags: readCampaignListField(formData, 'hashtags'),
      cta: readCampaignTextField(formData, 'cta'),
      sceneBreakdown: readCampaignTextField(formData, 'scene_breakdown'),
      voiceoverScript: readCampaignTextField(formData, 'voiceover_script'),
      onScreenText: readCampaignTextField(formData, 'on_screen_text'),
      platformPackage: readCampaignTextField(formData, 'platform_package'),
      creativeAssetSummary,
      brandKit: brandKitResult.data.brandKit,
    });

    if (generationResult.status === 'setup_required') {
      return {
        ...initialGenerateState,
        error: generationResult.error,
        field: generationFieldFromKind(kind),
        requestId: `${Date.now()}`,
      };
    }

    if (generationResult.status === 'failed') {
      return {
        ...initialGenerateState,
        error: generationResult.error,
        field: generationFieldFromKind(kind),
        requestId: `${Date.now()}`,
      };
    }

    return {
      error: null,
      message:
        generationResult.message ??
        generationMessageFromKind(kind),
      generatedText: generationResult.text,
      field: generationFieldFromKind(kind),
      requestId: `${Date.now()}`,
      providerUsed: generationResult.providerUsed ?? null,
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      ...initialGenerateState,
      error:
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
    };
  }
}

export async function generateCampaignPlanAction(
  formData: FormData
): Promise<CampaignPlannerGenerateState> {
  try {
    const plannerInput = readCampaignPlannerInput(formData);

    if (!plannerInput.productService && !plannerInput.goal && !plannerInput.offer) {
      return {
        error: 'Add a campaign idea, goal, product, or offer before generating.',
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canUseAIGeneration(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'campaign_generation',
        message: 'Blocked campaign plan generation.',
        metadata: { role },
      });

      return {
        error: 'ما عندكش صلاحية لتوليد الحملات. Campaign generation is restricted for your workspace role.',
      };
    }

    if (!(await checkGenerationLimit(workspace.id, user.id)).allowed) {
      return {
        error: 'وصلتي للحد المؤقت لتوليد الحملات. عاود المحاولة بعد شوية.',
      };
    }

    const brandKitResult = await getBrandKitForWorkspace(supabase, workspace.id);
    const generationResult = await generateMarketingText({
      kind: 'one_click_campaign_planner',
      systemPrompt: buildPlannerSystemPrompt(),
      userPrompt: buildPlannerUserPrompt(plannerInput, brandKitResult.data.brandKit),
      maxTokens: 3800,
      temperature: 0.72,
    });

    if (generationResult.status !== 'generated') {
      return {
        error:
          generationResult.status === 'setup_required'
            ? setupBlockerMessage({
                missing: 'OpenAI server-side setup',
                reason: 'campaign planning uses OpenAI and cannot run until the server provider is ready',
                next: 'configure OpenAI in Vercel, redeploy, and retry Generate Campaign Plan',
              })
            : generationResult.error || setupBlockerMessage({
                missing: 'valid OpenAI campaign plan response',
                reason: 'OpenAI did not return a usable campaign plan',
                next: 'retry with a shorter brief, then check OpenAI quota/model access if it continues',
              }),
        providerUsed: generationResult.providerUsed,
        model: generationResult.model,
      };
    }

    const plan = parsePlannerJson(generationResult.text);

    if (!plan) {
      return {
        error: setupBlockerMessage({
          missing: 'valid campaign plan JSON from OpenAI',
          reason: 'the generated response could not be safely converted into campaign drafts',
          next: 'retry generation with clearer inputs before creating drafts',
        }),
        providerUsed: generationResult.providerUsed,
        fallbackUsed: false,
        model: generationResult.model,
      };
    }

    return {
      error: null,
      message: 'Campaign plan generated.',
      plan,
      providerUsed: generationResult.providerUsed,
      fallbackUsed: false,
      model: generationResult.model,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : setupBlockerMessage({
              missing: 'completed campaign generation',
              reason: 'the server could not safely finish the OpenAI campaign planning request',
              next: 'retry, then check OpenAI readiness and server logs if it continues',
            }),
    };
  }
}

export async function createCampaignPlanDraftsAction(
  formData: FormData
): Promise<CampaignPlannerDraftState> {
  try {
    const rawPlan = readField(formData, 'campaign_plan_json');
    const rawInput = readField(formData, 'planner_input_json');
    const scheduleDrafts = readField(formData, 'schedule_drafts') === 'true';

    if (!rawPlan || !rawInput) {
      return {
        error: 'Generate a campaign plan before creating drafts.',
        outcome: 'failed',
      };
    }

    const plan = JSON.parse(rawPlan) as CampaignPlannerResult;
    const plannerInput = JSON.parse(rawInput) as CampaignPlannerInput;

    if (!plan.overview || !plan.instagram || !plan.googleAds) {
      return {
        error: 'Campaign plan data is incomplete.',
        outcome: 'failed',
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!canEditContent(role)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'campaign_drafts',
        message: 'Blocked campaign draft creation.',
        metadata: { role },
      });

      return {
        error: 'ما عندكش صلاحية لإنشاء مسودات الحملات. Campaign draft creation is restricted for your workspace role.',
        outcome: 'failed',
      };
    }

    const planId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `planner-${crypto.randomUUID()}`
        : `planner-${Date.now()}`;
    const drafts = buildDraftsFromPlan({
      plannerInput,
      plan,
      planId,
      scheduleDrafts,
    });
    const itemIds: string[] = [];

    for (const draft of drafts) {
      const result = await createContentStudioItem(
        {
          workspaceId: workspace.id,
          userId: user.id,
          title: draft.title,
          platform: draft.platform,
          contentType: draft.contentType,
          status: 'draft',
          objective: draft.objective,
          prompt: draft.prompt,
          script: 'script' in draft ? draft.script ?? null : null,
          caption: 'caption' in draft ? draft.caption ?? null : null,
          adCopy: 'adCopy' in draft ? draft.adCopy ?? null : null,
          creativeBrief: draft.creativeBrief,
          scheduleAt: draft.scheduleAt,
          providerStatus: draft.contentType === 'linkedin_post_planner' ? 'manual_only' : 'planner_draft',
          providerError:
            draft.contentType === 'linkedin_post_planner'
              ? 'LinkedIn is manual-only / copy-ready.'
              : null,
          metadata: draft.metadata,
        },
        supabase
      );

      if (result.error || !result.data) {
        return {
          error: result.error ?? 'Could not create campaign planner drafts.',
          itemIds,
          outcome: 'failed',
        };
      }

      itemIds.push(result.data.id);
    }

    revalidatePath('/dashboard/content-studio');
    revalidatePath('/dashboard/calendar');
    revalidatePath('/dashboard');

    return {
      error: null,
      message: scheduleDrafts
        ? 'Campaign drafts created and added to the calendar as draft plans.'
        : 'Campaign drafts created. Nothing was published.',
      itemIds,
      outcome: 'success',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Could not create campaign planner drafts.',
      outcome: 'failed',
    };
  }
}
