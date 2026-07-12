'use server';

import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  getContentStudioItemById,
  updateContentStudioItem,
} from '@/lib/data/content-studio';
import {
  createContentStudioPublishAttempt,
  updateContentStudioPublishAttempt,
  type ContentStudioPublishAttemptActionType,
} from '@/lib/data/content-studio-publish-attempts';
import {
  executeContentStudioProviderAction,
  getContentStudioProviderReadiness,
} from '@/lib/content-studio/provider-actions';
import type {
  ContentStudioItemRecord,
  ContentStudioType,
  CreativeAssetRecord,
} from '@/types/database';
import type { JsonObject } from '@/types';
import {
  type ContentStudioActionState,
  initialState,
  toJsonObject,
  getWorkspaceContext,
  createContentStudioNotification,
} from './shared';

async function loadLinkedAssets(
  workspaceId: string,
  assetIds: string[],
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createSupabaseServerClient>>
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

export async function executeContentStudioProviderActionAction(
  itemId: string,
  _state: ContentStudioActionState,
  formData?: FormData
): Promise<ContentStudioActionState> {
  void _state;

  try {
    const { supabase, user, workspace, role } = await getWorkspaceContext();
    const explicitConfirmation = formData?.get('provider_action_confirmed') === 'true';

    if (!hasPermission(role, 'operator')) {
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
