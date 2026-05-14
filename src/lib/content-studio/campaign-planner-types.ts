import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';

export type CampaignPlannerLength = 'one_post' | '3_day' | '7_day' | '14_day';

export interface CampaignPlannerInput {
  campaignName: string;
  goal: string;
  productService: string;
  targetAudience: string;
  offer: string;
  destinationUrl: string;
  platforms: ContentStudioPlatform[];
  campaignLength: CampaignPlannerLength;
  tone: string;
  language: string;
  cta: string;
  notes: string;
  templateId: string;
}

export interface CampaignCalendarPlanItem {
  day: string;
  platform: ContentStudioPlatform;
  contentType: ContentStudioType;
  title: string;
  plannedTime: string;
  status: 'draft' | 'ready';
  notes: string;
}

export interface CampaignPlannerResult {
  overview: {
    campaignName: string;
    goal: string;
    audience: string;
    offer: string;
    cta: string;
    platforms: string[];
    campaignAngle: string;
  };
  instagram: {
    postCaption: string;
    hook: string;
    hashtags: string[];
    cta: string;
    creativeDirection: string;
    reelScript: string;
    sceneBreakdown: string[];
    onScreenText: string[];
    voiceoverScript: string;
  };
  facebook: {
    postCopy: string;
    headline: string;
    description: string;
    cta: string;
    creativeDirection: string;
  };
  googleAds: {
    campaignObjective: string;
    keywords: string[];
    headlines: string[];
    descriptions: string[];
    cta: string;
    destinationUrl: string;
    budgetNotes: string;
    pausedDraftReminder: string;
  };
  pinterest: {
    pinTitle: string;
    pinDescription: string;
    destinationUrl: string;
    creativeDirection: string;
    boardSuggestion: string;
  };
  linkedin: {
    post: string;
    hook: string;
    cta: string;
    hashtags: string[];
    manualOnlyNote: string;
  };
  creativeBrief: {
    imageVideoDirection: string;
    visualStyle: string;
    colors: string[];
    designNotes: string;
    suggestedAssetTypes: string[];
  };
  calendarPlan: CampaignCalendarPlanItem[];
}

export interface CampaignPlannerDraftInput {
  plan: CampaignPlannerResult;
  plannerInput: CampaignPlannerInput;
  scheduleDrafts: boolean;
}
