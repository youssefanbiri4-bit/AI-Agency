import type { JsonObject } from './index';

export type BrandAIProviderMode = 'openai';
export type BrandDefaultLanguage = 'arabic' | 'english' | 'french' | 'mixed';
export type BrandContentLength = 'short' | 'medium' | 'detailed';
export type BrandEmojiUsage = 'none' | 'minimal' | 'normal';

export interface BrandKitCampaignDefaults extends JsonObject {
  defaultObjective: string | null;
  defaultDestinationUrl: string | null;
  defaultPlatforms: string[];
  defaultPostingStyle: string | null;
  defaultCreativeDirection: string | null;
  defaultOffer: string | null;
  defaultDisclaimer: string | null;
}

export interface BrandKitAIPreferences extends JsonObject {
  providerMode: BrandAIProviderMode;
  defaultLanguage: BrandDefaultLanguage;
  contentLength: BrandContentLength;
  emojiUsage: BrandEmojiUsage;
  hashtagCount: number | null;
  ctaStyle: string | null;
}

export interface BrandKit {
  brandName: string;
  description: string | null;
  websiteUrl: string | null;
  offer: string | null;
  services: string | null;
  industry: string | null;
  targetMarket: string | null;
  targetAudience: string | null;
  painPoints: string | null;
  audienceGoals: string | null;
  audienceLanguage: string | null;
  market: string | null;
  toneOfVoice: string | null;
  writingStyle: string | null;
  brandPersonality: string | null;
  wordsToUse: string | null;
  wordsToAvoid: string | null;
  defaultCta: string | null;
  defaultHashtags: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  logoAssetId: string | null;
  logoUrl: string | null;
  visualStyle: string | null;
  imageStyleNotes: string | null;
  designInspirationNotes: string | null;
  campaignDefaults: BrandKitCampaignDefaults;
  aiPreferences: BrandKitAIPreferences;
  metadata: JsonObject;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const defaultBrandKit: BrandKit = {
  brandName: 'AgentFlow AI',
  description:
    'A professional AI agency dashboard for managing agents, tasks, content, creative assets, campaign drafts, publishing readiness, and scheduling from one place.',
  websiteUrl: null,
  offer:
    'One dashboard to manage AI agency operations, content planning, creative assets, ads, and scheduling.',
  services: 'AI agency operations, content planning, creative assets, campaign drafts, publishing readiness, scheduling',
  industry: 'AI agency software',
  targetMarket: 'AI agency owners, freelancers, marketers, automation consultants, SaaS builders, and content creators',
  targetAudience:
    'AI agency owners, freelancers, marketers, automation consultants, SaaS builders, and content creators.',
  painPoints: null,
  audienceGoals: null,
  audienceLanguage: null,
  market: null,
  toneOfVoice: 'Professional, clear, premium, confident, and conversion-focused.',
  writingStyle: null,
  brandPersonality: null,
  wordsToUse: null,
  wordsToAvoid: null,
  defaultCta: 'Start Planning Smarter',
  defaultHashtags:
    '#AgentFlowAI #AIAgency #AItools #Automation #DigitalMarketing #SaaS #ContentMarketing',
  primaryColor: '#CA2851',
  secondaryColor: '#FF6766',
  accentColor: '#FFB173',
  backgroundColor: '#FFF8F2',
  logoAssetId: null,
  logoUrl: null,
  visualStyle: 'Premium SaaS dashboard, clean cards, warm off-white background, confident editorial composition',
  imageStyleNotes: null,
  designInspirationNotes: null,
  campaignDefaults: {
    defaultObjective: null,
    defaultDestinationUrl: null,
    defaultPlatforms: ['instagram', 'facebook', 'google_ads', 'pinterest', 'linkedin'],
    defaultPostingStyle: null,
    defaultCreativeDirection: null,
    defaultOffer: null,
    defaultDisclaimer: null,
  },
  aiPreferences: {
    providerMode: 'openai',
    defaultLanguage: 'english',
    contentLength: 'medium',
    emojiUsage: 'minimal',
    hashtagCount: 7,
    ctaStyle: 'Clear, direct, conversion-focused',
  },
  metadata: {},
  updatedAt: null,
  updatedBy: null,
};
