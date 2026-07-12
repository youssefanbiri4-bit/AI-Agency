import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';
import type { Database } from '@/types/database';
import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';

export type ProviderReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'unsupported'
  | 'manual_only'
  | 'error';

export interface ProviderReadinessResult {
  provider: ContentStudioPlatform | 'openai';
  state: ProviderReadinessState;
  message: string;
  missing: string[];
  details?: Record<string, string | number | boolean | null>;
}

export interface ProviderExecutionResult {
  provider: ContentStudioPlatform;
  actionType:
    | 'publish_post'
    | 'publish_reel'
    | 'create_campaign_draft'
    | 'create_paused_meta_ad_draft'
    | 'publish_pin'
    | 'manual_handoff';
  status: 'succeeded' | 'failed' | 'setup_required' | 'approval_pending' | 'manual_only' | 'unsupported';
  message: string;
  providerExternalId?: string | null;
  providerResponseSummary?: Record<string, unknown>;
}

export interface ContentStudioExecutionAsset {
  id: string;
  title: string;
  assetType?: string | null;
  platform: string;
  imageUrl: string | null;
  storagePath?: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ContentStudioExecutionContext {
  workspaceId: string;
  userId: string;
  itemId: string;
  title: string;
  contentType: ContentStudioType;
  objective: string | null;
  caption: string | null;
  script: string | null;
  adCopy: string | null;
  creativeBrief: string | null;
  destinationUrl?: string | null;
  budgetNotes?: string | null;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  targetAudience?: string | null;
  countries?: string[];
  keywords?: string[];
  ageMin?: number | null;
  ageMax?: number | null;
  callToAction?: string | null;
  headline?: string | null;
  description?: string | null;
  linkedAssets: ContentStudioExecutionAsset[];
  role?: StrictWorkspaceRole;
  explicitConfirmation?: boolean;
  supabase?: SupabaseClient<Database>;
}
