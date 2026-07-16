'use server';

import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { createContentStudioItem } from '@/features/content-studio/data/content-studio';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { checkRateLimit } from '@/lib/rate-limit';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { incrementUsage } from '@/lib/usage/quotas';
import { generateMarketingText } from '@/lib/ai/text-provider';
import { campaignTemplates } from '@/lib/content-studio/campaign-templates';
import type {
  CampaignCalendarPlanItem,
  CampaignPlannerInput,
  CampaignPlannerResult,
} from '@/lib/content-studio/campaign-planner-types';
import type { BrandKit } from '@/types/brand-kit';
import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';
import {
  type CampaignPlannerGenerateState,
  type CampaignPlannerDraftState,
  readField,
  getWorkspaceContext,
} from './shared';

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

function readPlannerPlatforms(formData: FormData): ContentStudioPlatform[] {
  const platforms = formData
    .getAll('preferred_platforms')
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter((value): value is ContentStudioPlatform =>
      allowedPlannerPlatforms.includes(value as ContentStudioPlatform)
    );

  return platforms.length > 0 ? Array.from(new Set(platforms)) : allowedPlannerPlatforms;
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
  campaign: import('@/types').JsonObject;
}) {
  return {
    source: 'campaign_planner',
    publishing_mode: 'draft_only',
    campaign: input.campaign,
    planner: {
      campaign_plan_id: input.planId,
      package: input.packageName,
      input: input.plannerInput as unknown as import('@/types').JsonObject,
      overview: input.plan.overview as unknown as import('@/types').JsonObject,
      calendar_plan: input.plan.calendarPlan as unknown as import('@/types').JsonObject[],
      no_publish: true,
      no_live_ads: true,
    },
  } as import('@/types').JsonObject;
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

function checkGenerationLimit(workspaceId: string, userId: string) {
  return checkRateLimit({
    key: `content-generation:${workspaceId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
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

    if (!hasPermission(role, 'editor')) {
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

    await incrementUsage(workspace.id, 'ai_generations', 1, user.id).catch(() => {});

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

    if (!hasPermission(role, 'editor')) {
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

    await incrementUsage(workspace.id, 'content_items', drafts.length, user.id).catch(() => {});

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
