import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject, JsonValue } from '@/types';
import type { BrandKit } from '@/types/brand-kit';
import { defaultBrandKit } from '@/types/brand-kit';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type BrandKitClient = SupabaseClient<Database>;

export interface BrandKitState {
  brandKit: BrandKit;
  exists: boolean;
}

const BRAND_KIT_SETTINGS_KEY = 'brand_kit';

function readObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function cleanJsonObject(value: Record<string, JsonValue | undefined | null>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
  );
}

export function normalizeBrandKit(value: unknown): BrandKit {
  const raw = readObject(value);
  const campaignDefaults = readObject(raw.campaignDefaults);
  const aiPreferences = readObject(raw.aiPreferences);

  return {
    ...defaultBrandKit,
    brandName: readString(raw.brandName) ?? defaultBrandKit.brandName,
    description: readString(raw.description),
    websiteUrl: readString(raw.websiteUrl),
    offer: readString(raw.offer),
    services: readString(raw.services),
    industry: readString(raw.industry),
    targetMarket: readString(raw.targetMarket),
    targetAudience: readString(raw.targetAudience),
    painPoints: readString(raw.painPoints),
    audienceGoals: readString(raw.audienceGoals),
    audienceLanguage: readString(raw.audienceLanguage),
    market: readString(raw.market),
    toneOfVoice: readString(raw.toneOfVoice),
    writingStyle: readString(raw.writingStyle),
    brandPersonality: readString(raw.brandPersonality),
    wordsToUse: readString(raw.wordsToUse),
    wordsToAvoid: readString(raw.wordsToAvoid),
    defaultCta: readString(raw.defaultCta),
    defaultHashtags: readString(raw.defaultHashtags),
    primaryColor: readString(raw.primaryColor),
    secondaryColor: readString(raw.secondaryColor),
    accentColor: readString(raw.accentColor),
    backgroundColor: readString(raw.backgroundColor),
    logoAssetId: readString(raw.logoAssetId),
    logoUrl: readString(raw.logoUrl),
    visualStyle: readString(raw.visualStyle),
    imageStyleNotes: readString(raw.imageStyleNotes),
    designInspirationNotes: readString(raw.designInspirationNotes),
    campaignDefaults: {
      ...defaultBrandKit.campaignDefaults,
      defaultObjective: readString(campaignDefaults.defaultObjective),
      defaultDestinationUrl: readString(campaignDefaults.defaultDestinationUrl),
      defaultPlatforms:
        readStringList(campaignDefaults.defaultPlatforms).length > 0
          ? readStringList(campaignDefaults.defaultPlatforms)
          : defaultBrandKit.campaignDefaults.defaultPlatforms,
      defaultPostingStyle: readString(campaignDefaults.defaultPostingStyle),
      defaultCreativeDirection: readString(campaignDefaults.defaultCreativeDirection),
      defaultOffer: readString(campaignDefaults.defaultOffer),
      defaultDisclaimer: readString(campaignDefaults.defaultDisclaimer),
    },
    aiPreferences: {
      ...defaultBrandKit.aiPreferences,
      providerMode: 'openai',
      defaultLanguage:
        aiPreferences.defaultLanguage === 'arabic' ||
        aiPreferences.defaultLanguage === 'english' ||
        aiPreferences.defaultLanguage === 'french' ||
        aiPreferences.defaultLanguage === 'mixed'
          ? aiPreferences.defaultLanguage
          : defaultBrandKit.aiPreferences.defaultLanguage,
      contentLength:
        aiPreferences.contentLength === 'short' ||
        aiPreferences.contentLength === 'medium' ||
        aiPreferences.contentLength === 'detailed'
          ? aiPreferences.contentLength
          : defaultBrandKit.aiPreferences.contentLength,
      emojiUsage:
        aiPreferences.emojiUsage === 'none' ||
        aiPreferences.emojiUsage === 'minimal' ||
        aiPreferences.emojiUsage === 'normal'
          ? aiPreferences.emojiUsage
          : defaultBrandKit.aiPreferences.emojiUsage,
      hashtagCount: readNumber(aiPreferences.hashtagCount),
      ctaStyle: readString(aiPreferences.ctaStyle),
    },
    metadata: readObject(raw.metadata),
    updatedAt: readString(raw.updatedAt),
    updatedBy: readString(raw.updatedBy),
  };
}

export function serializeBrandKit(brandKit: BrandKit): JsonObject {
  return cleanJsonObject({
    brandName: brandKit.brandName,
    description: brandKit.description,
    websiteUrl: brandKit.websiteUrl,
    offer: brandKit.offer,
    services: brandKit.services,
    industry: brandKit.industry,
    targetMarket: brandKit.targetMarket,
    targetAudience: brandKit.targetAudience,
    painPoints: brandKit.painPoints,
    audienceGoals: brandKit.audienceGoals,
    audienceLanguage: brandKit.audienceLanguage,
    market: brandKit.market,
    toneOfVoice: brandKit.toneOfVoice,
    writingStyle: brandKit.writingStyle,
    brandPersonality: brandKit.brandPersonality,
    wordsToUse: brandKit.wordsToUse,
    wordsToAvoid: brandKit.wordsToAvoid,
    defaultCta: brandKit.defaultCta,
    defaultHashtags: brandKit.defaultHashtags,
    primaryColor: brandKit.primaryColor,
    secondaryColor: brandKit.secondaryColor,
    accentColor: brandKit.accentColor,
    backgroundColor: brandKit.backgroundColor,
    logoAssetId: brandKit.logoAssetId,
    logoUrl: brandKit.logoUrl,
    visualStyle: brandKit.visualStyle,
    imageStyleNotes: brandKit.imageStyleNotes,
    designInspirationNotes: brandKit.designInspirationNotes,
    campaignDefaults: brandKit.campaignDefaults,
    aiPreferences: brandKit.aiPreferences,
    metadata: brandKit.metadata,
    updatedAt: brandKit.updatedAt,
    updatedBy: brandKit.updatedBy,
  });
}

export async function getBrandKitForWorkspace(
  client: BrandKitClient,
  workspaceId: string
): Promise<DataResult<BrandKitState>> {
  const { data, error } = await client
    .from('integration_settings')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult({ brandKit: defaultBrandKit, exists: false }, error.message);
  }

  const settings = readObject(data?.settings);
  const rawBrandKit = settings[BRAND_KIT_SETTINGS_KEY];

  return emptyDataResult(
    {
      brandKit: rawBrandKit ? normalizeBrandKit(rawBrandKit) : defaultBrandKit,
      exists: Boolean(rawBrandKit),
    },
    true
  );
}

export async function saveBrandKitForWorkspace(
  client: BrandKitClient,
  workspaceId: string,
  userId: string,
  brandKit: BrandKit
): Promise<DataResult<BrandKitState>> {
  const { data: existing, error: existingError } = await client
    .from('integration_settings')
    .select('settings, supabase_status, n8n_status')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) {
    return errorDataResult({ brandKit, exists: false }, existingError.message);
  }

  const settings = readObject(existing?.settings);
  const nextBrandKit = normalizeBrandKit({
    ...serializeBrandKit(brandKit),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
  const nextSettings: JsonObject = {
    ...settings,
    [BRAND_KIT_SETTINGS_KEY]: serializeBrandKit(nextBrandKit),
  };

  const { error } = await client.from('integration_settings').upsert({
    workspace_id: workspaceId,
    supabase_status: existing?.supabase_status ?? 'configured',
    n8n_status: existing?.n8n_status ?? 'not_connected',
    settings: nextSettings,
    updated_by: userId,
  });

  if (error) {
    return errorDataResult({ brandKit: nextBrandKit, exists: false }, error.message);
  }

  return emptyDataResult({ brandKit: nextBrandKit, exists: true }, true);
}

export function buildBrandKitGenerationContext(brandKit: BrandKit | null | undefined) {
  if (!brandKit?.brandName) {
    return null;
  }

  return [
    `Brand name: ${brandKit.brandName}`,
    brandKit.description ? `Description: ${brandKit.description}` : null,
    brandKit.websiteUrl ? `Website URL: ${brandKit.websiteUrl}` : null,
    brandKit.offer ? `Main offer: ${brandKit.offer}` : null,
    brandKit.services ? `Services: ${brandKit.services}` : null,
    brandKit.industry ? `Industry: ${brandKit.industry}` : null,
    brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
    brandKit.painPoints ? `Customer pain points: ${brandKit.painPoints}` : null,
    brandKit.audienceGoals ? `Customer goals: ${brandKit.audienceGoals}` : null,
    brandKit.audienceLanguage ? `Audience language: ${brandKit.audienceLanguage}` : null,
    brandKit.market ? `Market/location: ${brandKit.market}` : null,
    brandKit.toneOfVoice ? `Tone of voice: ${brandKit.toneOfVoice}` : null,
    brandKit.writingStyle ? `Writing style: ${brandKit.writingStyle}` : null,
    brandKit.brandPersonality ? `Brand personality: ${brandKit.brandPersonality}` : null,
    brandKit.wordsToUse ? `Words to use: ${brandKit.wordsToUse}` : null,
    brandKit.wordsToAvoid ? `Words to avoid: ${brandKit.wordsToAvoid}` : null,
    brandKit.defaultCta ? `Default CTA: ${brandKit.defaultCta}` : null,
    brandKit.defaultHashtags ? `Default hashtags: ${brandKit.defaultHashtags}` : null,
    brandKit.primaryColor || brandKit.secondaryColor || brandKit.accentColor
      ? `Brand colors: ${[
          brandKit.primaryColor,
          brandKit.secondaryColor,
          brandKit.accentColor,
          brandKit.backgroundColor,
        ]
          .filter(Boolean)
          .join(', ')}`
      : null,
    brandKit.visualStyle ? `Visual style: ${brandKit.visualStyle}` : null,
    brandKit.imageStyleNotes ? `Image style notes: ${brandKit.imageStyleNotes}` : null,
    brandKit.designInspirationNotes
      ? `Design inspiration notes: ${brandKit.designInspirationNotes}`
      : null,
    brandKit.campaignDefaults.defaultDisclaimer
      ? `Default disclaimer/notes: ${brandKit.campaignDefaults.defaultDisclaimer}`
      : null,
    `Default language: ${brandKit.aiPreferences.defaultLanguage}`,
    `Default content length: ${brandKit.aiPreferences.contentLength}`,
    `Emoji usage: ${brandKit.aiPreferences.emojiUsage}`,
    brandKit.aiPreferences.hashtagCount
      ? `Default hashtag count: ${brandKit.aiPreferences.hashtagCount}`
      : null,
    brandKit.aiPreferences.ctaStyle ? `CTA style: ${brandKit.aiPreferences.ctaStyle}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
