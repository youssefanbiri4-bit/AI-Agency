'use server';

import { revalidatePath } from 'next/cache';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import {
  addContentStudioItemAsset,
  createContentStudioItem,
  getContentStudioItemById,
  removeContentStudioItemAsset,
  replaceContentStudioItemAssets,
  updateContentStudioItem,
} from '@/features/content-studio/data/content-studio';
import { getContentStudioProviderReadiness } from '@/lib/content-studio/provider-actions';
import { incrementUsage } from '@/lib/usage/quotas';
import {
  inferPlatformFromContentType,
} from '../shared';
import type {
  ContentStudioStatus,
  ContentStudioType,
  NotificationType,
} from '@/types/database';
import type { JsonObject } from '@/types';
import {
  type ContentStudioActionState,
  initialState,
  readField,
  emptyToNull,
  toJsonObject,
  readCampaignTextField,
  readCampaignNumberField,
  readCampaignListField,
  readStatus,
  readContentType,
  readAssetIds,
  readScheduleAt,
  getWorkspaceContext,
  createContentStudioNotification,
} from './shared';

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

  if (!hasPermission(role, 'editor')) {
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

  if (requestedStatus === 'scheduled' && !hasPermission(role, 'operator')) {
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

  if (!itemId) {
    await incrementUsage(workspace.id, 'content_items', 1, user.id).catch(() => {});
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

    if (!hasPermission(role, 'editor')) {
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

    if (!hasPermission(role, 'editor')) {
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
