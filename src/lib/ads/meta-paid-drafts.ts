import 'server-only';

import { decryptToken } from '@/lib/ads/encryption';
import { createCreativeAssetPublicUrl } from '@/lib/storage/creative-assets';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { ProviderExecutionResult, ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import type { ContentStudioType } from '@/types/database';
import type { JsonObject } from '@/types';

const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
const META_ADS_PERMISSION_REQUIRED = 'Meta Ads permission ads_management is missing.';
const META_AD_ACCOUNT_REQUIRED = 'Meta Ad Account is not selected.';
const FACEBOOK_PAGE_REQUIRED = 'Facebook Page is required for the ad creative.';
const INSTAGRAM_ACCOUNT_REQUIRED = 'Instagram account is required for Instagram placements.';
const DESTINATION_URL_REQUIRED = 'Destination URL is required.';
const BUDGET_REQUIRED = 'Budget is required.';
const CREATIVE_ASSET_REQUIRED = 'A creative asset is required.';
const CREATIVE_ASSET_PUBLIC_URL_REQUIRED = 'Creative asset must have a public HTTPS URL.';

interface MetaConnectionRow {
  status: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  metadata: unknown;
  access_token?: string;
}

export interface MetaPaidDraftAsset {
  id: string;
  title: string;
  imageUrl: string | null;
  storagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MetaPaidDraftInput {
  workspaceId: string;
  userId: string;
  itemId: string;
  contentType: ContentStudioType;
  title: string;
  objective: string | null;
  destinationUrl: string | null;
  caption: string | null;
  adCopy: string | null;
  creativeBrief: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  targetAudience: string | null;
  countries: string[];
  ageMin: number | null;
  ageMax: number | null;
  callToAction: string | null;
  headline: string | null;
  description: string | null;
  linkedAssets: MetaPaidDraftAsset[];
}

function getGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

function buildGraphUrl(path: string) {
  return new URL(`https://graph.facebook.com/${getGraphApiVersion()}/${path.replace(/^\/+/, '')}`);
}

function safeMetadata(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function isPublicHttpsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSignedSupabaseUrl(value: string | null | undefined) {
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

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.trim().replace(/^act_/i, '');
}

function isInstagramPlacement(contentType: ContentStudioType) {
  return contentType.startsWith('instagram_');
}

function metaPaidProvider(contentType: ContentStudioType) {
  return isInstagramPlacement(contentType) ? 'instagram' as const : 'facebook' as const;
}

function isMetaPaidAdType(contentType: ContentStudioType) {
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

function normalizeCallToAction(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/[^A-Z_]+/g, '_');
  const allowed = new Set([
    'APPLY_NOW',
    'BOOK_NOW',
    'CONTACT_US',
    'GET_OFFER',
    'GET_QUOTE',
    'LEARN_MORE',
    'SIGN_UP',
    'SUBSCRIBE',
    'WATCH_MORE',
  ]);

  return normalized && allowed.has(normalized) ? normalized : 'LEARN_MORE';
}

function getPublicImageAsset(assets: MetaPaidDraftAsset[]) {
  for (const asset of assets) {
    if (isPublicHttpsUrl(asset.imageUrl) && !isSignedSupabaseUrl(asset.imageUrl)) {
      return { asset, imageUrl: asset.imageUrl as string };
    }

    const publicUrl = createCreativeAssetPublicUrl(asset.storagePath ?? null);

    if (isPublicHttpsUrl(publicUrl)) {
      return { asset, imageUrl: publicUrl as string };
    }
  }

  return null;
}

async function loadMetaConnection(workspaceId: string, userId: string, includeToken = false) {
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    return { row: null, error: error ?? 'Supabase server credentials are not configured.' };
  }

  const select = includeToken
    ? 'status, token_expires_at, scopes, metadata, access_token'
    : 'status, token_expires_at, scopes, metadata';
  const { data, error: selectError } = await client
    .from('ad_connections')
    .select(select)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'meta')
    .maybeSingle();

  if (selectError) {
    return { row: null, error: 'Meta connection could not be verified.' };
  }

  return { row: (data as MetaConnectionRow | null) ?? null, error: null };
}

async function getMetaAccessToken(workspaceId: string, userId: string) {
  const { row, error } = await loadMetaConnection(workspaceId, userId, true);

  if (error) {
    throw new Error(error);
  }

  if (!row?.access_token || row.status !== 'connected') {
    throw new Error('Meta OAuth connection is missing.');
  }

  if (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now()) {
    throw new Error('Meta OAuth connection is missing.');
  }

  return {
    accessToken: decryptToken(row.access_token),
    metadata: safeMetadata(row.metadata),
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
  };
}

function readSelectedAdAccount(metadata: JsonObject) {
  return {
    id: safeString(metadata.selected_meta_ad_account_id),
    name: safeString(metadata.selected_meta_ad_account_name),
    currency: safeString(metadata.selected_meta_ad_account_currency),
    timezone: safeString(metadata.selected_meta_ad_account_timezone),
  };
}

function mapMetaPaidDraftError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : '';

  if (message.includes('ads_management') || message.includes('permission') || message.includes('scope')) {
    return META_ADS_PERMISSION_REQUIRED;
  }

  if (message.includes('token') || message.includes('oauth')) {
    return 'Meta OAuth connection is missing.';
  }

  if (message.includes('budget')) {
    return BUDGET_REQUIRED;
  }

  if (message.includes('ad account')) {
    return META_AD_ACCOUNT_REQUIRED;
  }

  if (message.includes('creative') || message.includes('image')) {
    return CREATIVE_ASSET_REQUIRED;
  }

  return 'Meta paid ad draft creation failed. Please review setup and try again.';
}

export async function getMetaPaidAdsReadiness(input: MetaPaidDraftInput): Promise<ProviderReadinessResult> {
  if (!isMetaPaidAdType(input.contentType)) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'unsupported',
      message: 'This Meta paid ad type is not supported.',
      missing: [],
    };
  }

  const { row, error } = await loadMetaConnection(input.workspaceId, input.userId);

  if (error) {
    return { provider: metaPaidProvider(input.contentType), state: 'error', message: error, missing: [] };
  }

  if (!row || row.status !== 'connected') {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'token_missing',
      message: 'Meta OAuth connection is missing.',
      missing: ['Meta OAuth connection'],
    };
  }

  if (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now()) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'token_missing',
      message: 'Meta OAuth connection is missing.',
      missing: ['Valid Meta access token'],
    };
  }

  const scopes = Array.isArray(row.scopes) ? row.scopes : [];

  if (!scopes.includes('ads_management')) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: META_ADS_PERMISSION_REQUIRED,
      missing: ['ads_management'],
    };
  }

  const metadata = safeMetadata(row.metadata);
  const adAccount = readSelectedAdAccount(metadata);

  if (!adAccount.id) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: META_AD_ACCOUNT_REQUIRED,
      missing: ['Selected Meta Ad Account'],
    };
  }

  if (!safeString(metadata.selected_facebook_page_id)) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: FACEBOOK_PAGE_REQUIRED,
      missing: ['Selected Facebook Page'],
    };
  }

  if (isInstagramPlacement(input.contentType) && !safeString(metadata.selected_instagram_business_account_id)) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: INSTAGRAM_ACCOUNT_REQUIRED,
      missing: ['Selected Instagram account'],
    };
  }

  if (!input.destinationUrl) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: DESTINATION_URL_REQUIRED,
      missing: ['Destination URL'],
    };
  }

  if (!input.objective?.trim()) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: 'Campaign objective is required.',
      missing: ['Campaign objective'],
    };
  }

  if (!input.dailyBudget && !input.lifetimeBudget) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: BUDGET_REQUIRED,
      missing: ['Daily or lifetime budget'],
    };
  }

  if (!(input.caption?.trim() || input.adCopy?.trim())) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: 'Primary text or ad copy is required.',
      missing: ['Primary text or ad copy'],
    };
  }

  if (input.linkedAssets.length === 0) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: CREATIVE_ASSET_REQUIRED,
      missing: ['Creative asset'],
    };
  }

  if (!getPublicImageAsset(input.linkedAssets)) {
    return {
      provider: metaPaidProvider(input.contentType),
      state: 'setup_required',
      message: CREATIVE_ASSET_PUBLIC_URL_REQUIRED,
      missing: ['Public HTTPS creative asset URL'],
    };
  }

  return {
    provider: metaPaidProvider(input.contentType),
    state: 'ready',
    message: 'Meta paid ad draft is ready to create as PAUSED.',
    missing: [],
    details: {
      selectedAdAccountId: adAccount.id,
      selectedAdAccountName: adAccount.name,
      selectedAdAccountCurrency: adAccount.currency,
      selectedAdAccountTimezone: adAccount.timezone,
      hasAdsManagement: true,
    },
  };
}

async function postMetaGraph<T>({
  path,
  accessToken,
  body,
}: {
  path: string;
  accessToken: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(buildGraphUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as T & {
    error?: { message?: string };
  };

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || 'Meta Marketing API request failed.');
  }

  return payload;
}

export async function createPausedMetaCampaign(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  objective: string;
}) {
  return postMetaGraph<{ id?: string }>({
    path: `/act_${normalizeAdAccountId(input.adAccountId)}/campaigns`,
    accessToken: input.accessToken,
    body: {
      name: input.name,
      objective: input.objective,
      status: 'PAUSED',
      special_ad_categories: [],
    },
  });
}

export async function createPausedMetaAdSet(input: {
  accessToken: string;
  adAccountId: string;
  campaignId: string;
  name: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  destinationUrl: string;
  countries: string[];
  ageMin: number | null;
  ageMax: number | null;
}) {
  return postMetaGraph<{ id?: string }>({
    path: `/act_${normalizeAdAccountId(input.adAccountId)}/adsets`,
    accessToken: input.accessToken,
    body: {
      name: input.name,
      campaign_id: input.campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      status: 'PAUSED',
      promoted_object: {
        website_url: input.destinationUrl,
      },
      ...(input.dailyBudget ? { daily_budget: input.dailyBudget } : {}),
      ...(input.lifetimeBudget ? { lifetime_budget: input.lifetimeBudget } : {}),
      targeting: {
        geo_locations: {
          countries: input.countries.length > 0 ? input.countries : ['US'],
        },
        ...(input.ageMin ? { age_min: input.ageMin } : {}),
        ...(input.ageMax ? { age_max: input.ageMax } : {}),
      },
    },
  });
}

export async function createMetaAdCreative(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  pageId: string;
  instagramActorId?: string | null;
  imageUrl: string;
  destinationUrl: string;
  message: string;
  headline: string;
  description?: string | null;
  callToAction?: string | null;
}) {
  return postMetaGraph<{ id?: string }>({
    path: `/act_${normalizeAdAccountId(input.adAccountId)}/adcreatives`,
    accessToken: input.accessToken,
    body: {
      name: input.name,
      object_story_spec: {
        page_id: input.pageId,
        ...(input.instagramActorId ? { instagram_actor_id: input.instagramActorId } : {}),
        link_data: {
          image_url: input.imageUrl,
          link: input.destinationUrl,
          message: input.message,
          name: input.headline,
          description: input.description ?? undefined,
          call_to_action: {
            type: normalizeCallToAction(input.callToAction),
            value: {
              link: input.destinationUrl,
            },
          },
        },
      },
    },
  });
}

export async function createPausedMetaAd(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;
}) {
  return postMetaGraph<{ id?: string }>({
    path: `/act_${normalizeAdAccountId(input.adAccountId)}/ads`,
    accessToken: input.accessToken,
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: {
        creative_id: input.creativeId,
      },
      status: 'PAUSED',
    },
  });
}

export async function createPausedMetaAdDraft(input: MetaPaidDraftInput): Promise<ProviderExecutionResult> {
  try {
    const readiness = await getMetaPaidAdsReadiness(input);

    if (readiness.state !== 'ready') {
      const guardedStatus =
        readiness.state === 'approval_pending'
          ? 'approval_pending'
          : readiness.state === 'manual_only' || readiness.state === 'unsupported'
            ? readiness.state
            : 'setup_required';

      return {
        provider: metaPaidProvider(input.contentType),
        actionType: 'create_paused_meta_ad_draft',
        status: guardedStatus,
        message: readiness.message,
      };
    }

    const { accessToken, metadata } = await getMetaAccessToken(input.workspaceId, input.userId);
    const adAccount = readSelectedAdAccount(metadata);
    const pageId = safeString(metadata.selected_facebook_page_id);
    const instagramActorId = safeString(metadata.selected_instagram_business_account_id);
    const imageAsset = getPublicImageAsset(input.linkedAssets);

    if (!adAccount.id || !pageId || !imageAsset || !input.destinationUrl) {
      return {
        provider: metaPaidProvider(input.contentType),
        actionType: 'create_paused_meta_ad_draft',
        status: 'setup_required',
        message: 'Meta paid ad draft setup is incomplete.',
      };
    }

    const campaign = await createPausedMetaCampaign({
      accessToken,
      adAccountId: adAccount.id,
      name: input.title,
      objective: input.objective ?? 'OUTCOME_TRAFFIC',
    });
    const campaignId = campaign.id;

    if (!campaignId) {
      throw new Error('Meta campaign creation failed.');
    }

    const adSet = await createPausedMetaAdSet({
      accessToken,
      adAccountId: adAccount.id,
      campaignId,
      name: `${input.title} Ad Set`,
      dailyBudget: input.dailyBudget,
      lifetimeBudget: input.lifetimeBudget,
      destinationUrl: input.destinationUrl,
      countries: input.countries,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
    });
    const adSetId = adSet.id;

    if (!adSetId) {
      throw new Error('Meta ad set creation failed.');
    }

    const creative = await createMetaAdCreative({
      accessToken,
      adAccountId: adAccount.id,
      name: `${input.title} Creative`,
      pageId,
      instagramActorId: isInstagramPlacement(input.contentType) ? instagramActorId : null,
      imageUrl: imageAsset.imageUrl,
      destinationUrl: input.destinationUrl,
      message: input.caption ?? input.adCopy ?? input.title,
      headline: input.headline ?? input.title,
      description: input.description ?? input.creativeBrief,
      callToAction: normalizeCallToAction(input.callToAction),
    });
    const creativeId = creative.id;

    if (!creativeId) {
      throw new Error('Meta ad creative creation failed.');
    }

    const ad = await createPausedMetaAd({
      accessToken,
      adAccountId: adAccount.id,
      name: `${input.title} Ad`,
      adSetId,
      creativeId,
    });
    const adId = ad.id;

    if (!adId) {
      throw new Error('Meta ad creation failed.');
    }

    return {
      provider: metaPaidProvider(input.contentType),
      actionType: 'create_paused_meta_ad_draft',
      status: 'succeeded',
      message: 'Paused Meta ad draft created successfully.',
      providerExternalId: campaignId,
      providerResponseSummary: {
        safety_status: 'PAUSED',
        campaign_id: campaignId,
        ad_set_id: adSetId,
        ad_creative_id: creativeId,
        ad_id: adId,
        ad_account_id: adAccount.id,
        ad_account_name: adAccount.name,
        creative_asset_id: imageAsset.asset.id,
      },
    };
  } catch (error) {
    return {
      provider: metaPaidProvider(input.contentType),
      actionType: 'create_paused_meta_ad_draft',
      status: 'failed',
      message: mapMetaPaidDraftError(error),
    };
  }
}
