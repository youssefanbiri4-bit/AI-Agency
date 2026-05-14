import 'server-only';

import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';
import type { BrandKit } from '@/types/brand-kit';
import { buildBrandKitGenerationContext } from '@/lib/data/brand-kit';
import {
  checkOpenAITextProviderReadiness,
  generateMarketingText,
  type GenerateMarketingTextResult,
} from '@/lib/ai/text-provider';

const MAX_FIELD_OUTPUT_TOKENS = 900;

export type ContentGenerationKind =
  | 'script'
  | 'caption'
  | 'ad_copy'
  | 'creative_brief'
  | 'campaign_brief'
  | 'instagram_ad'
  | 'facebook_ad'
  | 'google_search_ad'
  | 'pinterest_pin_copy'
  | 'reel_script'
  | 'hook'
  | 'headlines'
  | 'descriptions'
  | 'keywords'
  | 'hashtags'
  | 'cta'
  | 'audience_suggestions'
  | 'full_campaign_package';

export interface ContentStudioGenerationInput {
  title: string;
  platform: ContentStudioPlatform;
  contentType: ContentStudioType;
  objective?: string | null;
  prompt?: string | null;
  script?: string | null;
  caption?: string | null;
  adCopy?: string | null;
  creativeBrief?: string | null;
  targetAudience?: string | null;
  offer?: string | null;
  destinationUrl?: string | null;
  hook?: string | null;
  primaryText?: string | null;
  headlines?: string[] | null;
  descriptions?: string[] | null;
  keywords?: string[] | null;
  hashtags?: string[] | null;
  cta?: string | null;
  sceneBreakdown?: string | null;
  voiceoverScript?: string | null;
  onScreenText?: string | null;
  platformPackage?: string | null;
  creativeAssetSummary?: string | null;
  brandKit?: BrandKit | null;
}

export interface OpenAIContentReadiness {
  isReady: boolean;
  status: 'ready' | 'setup_required';
  message: string;
  model: string;
}

export type GenerateContentStudioTextResult =
  | {
      status: 'setup_required';
      error: string;
      readiness: OpenAIContentReadiness;
    }
  | {
      status: 'failed';
      error: string;
      model: string;
    }
  | {
      status: 'generated';
      text: string;
      model: string;
      providerUsed?: 'openai' | 'nvidia';
      fallbackUsed?: boolean;
      message?: string;
    };

const platformLabels: Record<ContentStudioPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
};

const contentTypeLabels: Record<ContentStudioType, string> = {
  facebook_post: 'Facebook post',
  instagram_post: 'Instagram post',
  facebook_reel: 'Facebook Reel',
  instagram_reel: 'Instagram Reel',
  facebook_feed_ad: 'Facebook feed ad draft',
  instagram_feed_ad: 'Instagram feed ad draft',
  facebook_reel_ad: 'Facebook Reel ad draft',
  instagram_reel_ad: 'Instagram Reel ad draft',
  facebook_story_ad: 'Facebook Story ad draft',
  instagram_story_ad: 'Instagram Story ad draft',
  facebook_carousel_ad: 'Facebook carousel ad draft',
  instagram_carousel_ad: 'Instagram carousel ad draft',
  google_ads_campaign_draft: 'Google Ads campaign draft',
  pinterest_pin: 'Pinterest Pin',
  linkedin_post_planner: 'LinkedIn post planner',
};

export function checkOpenAIContentReadiness(): OpenAIContentReadiness {
  const readiness = checkOpenAITextProviderReadiness();
  return {
    isReady: readiness.isReady,
    status: readiness.isReady ? 'ready' : 'setup_required',
    message: readiness.message,
    model: readiness.model,
  };
}

function valueOrFallback(value: string | null | undefined, fallback = 'Not specified') {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function kindLabel(kind: ContentGenerationKind) {
  switch (kind) {
    case 'script':
      return 'Script';
    case 'caption':
      return 'Caption';
    case 'ad_copy':
      return 'Ad Copy';
    case 'creative_brief':
      return 'Creative Brief';
    case 'campaign_brief':
      return 'Campaign Brief';
    case 'instagram_ad':
      return 'Instagram Ad';
    case 'facebook_ad':
      return 'Facebook Ad';
    case 'google_search_ad':
      return 'Google Search Ad';
    case 'pinterest_pin_copy':
      return 'Pinterest Pin Copy';
    case 'reel_script':
      return 'Reel Script';
    case 'hook':
      return 'Hook';
    case 'headlines':
      return 'Headlines';
    case 'descriptions':
      return 'Descriptions';
    case 'keywords':
      return 'Keywords';
    case 'hashtags':
      return 'Hashtags';
    case 'cta':
      return 'CTA';
    case 'audience_suggestions':
      return 'Audience Suggestions';
    case 'full_campaign_package':
      return 'Full Campaign Package';
    default:
      return kind;
  }
}

function buildKindSpecificInstructions(kind: ContentGenerationKind, contentType: ContentStudioType) {
  switch (kind) {
    case 'script':
      return [
        'Write one polished, platform-aware script.',
        'Use concise, practical structure.',
        contentType.includes('reel')
          ? 'Include a hook, flow, and CTA suitable for short-form video.'
          : 'If the format is not video-first, structure it as short talking points or a post framework.',
        'Do not mention unsupported automation or publishing claims.',
      ].join('\n');
    case 'caption':
      return [
        'Write one strong marketing-ready caption.',
        'Keep it concise, clear, and professional.',
        'Include a subtle CTA if appropriate.',
        'Do not include fake urgency, fake claims, or unsupported platform promises.',
      ].join('\n');
    case 'ad_copy':
      return [
        'Write practical ad copy for this item.',
        'Return primary copy, 2-3 headline ideas, and a CTA line if useful.',
        'Keep claims credible and avoid policy-risky exaggeration.',
        'Do not mention ads_management or publishing APIs.',
      ].join('\n');
    case 'creative_brief':
      return [
        'Create a concise creative brief.',
        'Include concept, audience insight, message angle, visual direction, and production notes.',
        'Keep it easy for a designer or content producer to use immediately.',
      ].join('\n');
    case 'campaign_brief':
      return [
        'Create a concise campaign brief.',
        'Include objective, target audience, offer, destination URL angle, channel fit, messaging pillars, and creative direction.',
        'Keep it ready for cross-channel planning inside a SaaS dashboard.',
      ].join('\n');
    case 'instagram_ad':
    case 'facebook_ad':
      return [
        'Write one platform-aware ad package.',
        'Include hook, primary text, short headline ideas, and CTA suggestions.',
        'Keep claims credible and safe for ad review.',
      ].join('\n');
    case 'google_search_ad':
      return [
        'Write a Google Search ad package.',
        'Include headline options, description options, CTA ideas, and keyword themes.',
        'Keep it suitable for a paused draft campaign.',
      ].join('\n');
    case 'pinterest_pin_copy':
      return [
        'Write Pinterest-ready pin copy.',
        'Include title direction, description copy, and a destination-focused CTA.',
        'Keep it visual, clear, and click-worthy without spammy claims.',
      ].join('\n');
    case 'reel_script':
      return [
        'Write a short-form reel script.',
        'Include hook, beat-by-beat scene flow, on-screen text cues, voiceover, and CTA.',
        'Keep it fast, scannable, and production-friendly.',
      ].join('\n');
    case 'hook':
      return 'Write 5 hook options, each on its own line.';
    case 'headlines':
      return 'Write 8 headline options, each on its own line.';
    case 'descriptions':
      return 'Write 5 description options, each on its own line.';
    case 'keywords':
      return 'Write 12 keyword ideas, each on its own line.';
    case 'hashtags':
      return 'Write 12 hashtags, each on its own line, without commentary.';
    case 'cta':
      return 'Write 8 short CTA options, each on its own line.';
    case 'audience_suggestions':
      return [
        'Write paid social audience suggestions.',
        'Include countries, age range, interest clusters, exclusion ideas, and one short testing note.',
        'Keep it suitable for a PAUSED Meta ad draft that will be reviewed manually before activation.',
      ].join('\n');
    case 'full_campaign_package':
      return [
        'Write a full campaign package.',
        'Use compact plain text sections for campaign basics, messaging, channel-specific copy, CTA, keywords/hashtags, and creative production notes.',
        'Do not claim the campaign is already published or live.',
      ].join('\n');
    default:
      return 'Write clear professional marketing content.';
  }
}

function buildUserPrompt(kind: ContentGenerationKind, input: ContentStudioGenerationInput) {
  const brandContext = buildBrandKitGenerationContext(input.brandKit);

  return `
Generate ${kindLabel(kind)} for the following Content Studio item.

Brand Kit context:
${brandContext ?? 'No saved Brand Kit. Use the item fields only.'}

Platform:
${platformLabels[input.platform]}

Format:
${contentTypeLabels[input.contentType]}

Title:
${valueOrFallback(input.title)}

Objective:
${valueOrFallback(input.objective)}

Prompt / direction:
${valueOrFallback(input.prompt)}

Existing script:
${valueOrFallback(input.script)}

Existing caption:
${valueOrFallback(input.caption)}

Existing ad copy:
${valueOrFallback(input.adCopy)}

Existing creative brief:
${valueOrFallback(input.creativeBrief)}

Target audience:
${valueOrFallback(input.targetAudience)}

Offer / value proposition:
${valueOrFallback(input.offer)}

Destination URL:
${valueOrFallback(input.destinationUrl)}

Existing hook:
${valueOrFallback(input.hook)}

Existing primary text:
${valueOrFallback(input.primaryText)}

Existing headlines:
${valueOrFallback(input.headlines?.join('\n'))}

Existing descriptions:
${valueOrFallback(input.descriptions?.join('\n'))}

Existing keywords:
${valueOrFallback(input.keywords?.join('\n'))}

Existing hashtags:
${valueOrFallback(input.hashtags?.join('\n'))}

Existing CTA:
${valueOrFallback(input.cta)}

Existing scene breakdown:
${valueOrFallback(input.sceneBreakdown)}

Existing voiceover script:
${valueOrFallback(input.voiceoverScript)}

Existing on-screen text:
${valueOrFallback(input.onScreenText)}

Existing platform package:
${valueOrFallback(input.platformPackage)}

Linked creative assets summary:
${valueOrFallback(input.creativeAssetSummary, 'No linked creative assets.')}

Instructions:
${buildKindSpecificInstructions(kind, input.contentType)}

Output rules:
- Return plain text only
- No markdown code fences
- No surrounding commentary
- Keep the tone professional, concise, and practical
- Make the output platform-aware
- Do not claim publishing, scheduling, or unsupported API actions
`.trim();
}

function mapProviderResultToLegacyShape(
  result: GenerateMarketingTextResult
): GenerateContentStudioTextResult {
  if (result.status === 'generated') {
    return {
      status: 'generated',
      text: result.text,
      model: result.model,
      providerUsed: result.providerUsed,
      fallbackUsed: result.fallbackUsed,
      message: result.message,
    };
  }

  if (result.status === 'setup_required') {
    return {
      status: 'setup_required',
      error: result.error,
      readiness: checkOpenAIContentReadiness(),
    };
  }

  if (result.status === 'failed') {
    return {
      status: 'failed',
      error: result.error,
      model: result.model ?? checkOpenAIContentReadiness().model,
    };
  }

  return {
    status: 'failed',
    error: result.error,
    model: result.model ?? checkOpenAIContentReadiness().model,
  };
}

export async function generateContentStudioText(
  kind: ContentGenerationKind,
  input: ContentStudioGenerationInput
): Promise<GenerateContentStudioTextResult> {
  const userPrompt = buildUserPrompt(kind, input);
  const result = await generateMarketingText({
    kind,
    userPrompt,
    maxTokens: MAX_FIELD_OUTPUT_TOKENS,
    temperature: 0.7,
    systemPrompt:
      'You write polished marketing content for a premium SaaS workspace. Be clear, useful, concise, and platform-aware. Avoid fake claims or unsupported implementation promises.',
  });

  return mapProviderResultToLegacyShape(result);
}
