import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createContentStudioPublishAttempt,
  updateContentStudioPublishAttempt,
  type ContentStudioPublishAttemptActionType,
  type ContentStudioPublishAttemptProvider,
  type ContentStudioPublishAttemptStatus,
} from '@/lib/data/content-studio-publish-attempts';
import {
  executeContentStudioProviderAction,
  getContentStudioProviderReadiness,
} from '@/lib/content-studio/provider-actions';
import { reportAppError, reportAppEvent } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { JsonObject } from '@/types';
import type {
  ContentStudioItemRecord,
  ContentStudioType,
  CreativeAssetRecord,
  Database,
} from '@/types/database';
import type { ContentStudioSchedulerSummary } from './scheduler-types';

const DEFAULT_BATCH_SIZE = 10;
const SCHEDULER_ROUTE_PATH = '/api/cron/content-studio-scheduler';

type SchedulerClient = SupabaseClient<Database>;
type ScheduledExecutionStatus = NonNullable<
  Database['public']['Tables']['content_studio_items']['Row']['scheduled_execution_status']
>;

type LinkedAssetSummary = Pick<
  CreativeAssetRecord,
  'id' | 'title' | 'asset_type' | 'platform' | 'image_url' | 'storage_path' | 'metadata'
>;

export interface ContentStudioSchedulerReadiness {
  isConfigured: boolean;
  cronSecretConfigured: boolean;
  message: string;
  routePath: string;
  recommendedSchedule: string;
}

function createEmptySummary(): ContentStudioSchedulerSummary {
  return {
    scanned: 0,
    executed: 0,
    skipped: 0,
    succeeded: 0,
    failed: 0,
    setup_required: 0,
    approval_pending: 0,
    token_missing: 0,
    quota_limit: 0,
    manual_only: 0,
    unsupported: 0,
    error: 0,
  };
}

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getProviderName(contentType: ContentStudioType): ContentStudioPublishAttemptProvider {
  switch (contentType) {
    case 'facebook_post':
    case 'facebook_reel':
    case 'instagram_post':
    case 'instagram_reel':
      return 'meta';
    case 'google_ads_campaign_draft':
      return 'google_ads';
    case 'facebook_feed_ad':
    case 'instagram_feed_ad':
    case 'facebook_reel_ad':
    case 'instagram_reel_ad':
    case 'facebook_story_ad':
    case 'instagram_story_ad':
    case 'facebook_carousel_ad':
    case 'instagram_carousel_ad':
      return 'meta';
    case 'pinterest_pin':
      return 'pinterest';
    case 'linkedin_post_planner':
    default:
      return 'linkedin';
  }
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
      return 'manual_handoff';
    case 'pinterest_pin':
      return 'publish_pin';
    case 'linkedin_post_planner':
    default:
      return 'manual_handoff';
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

function isMetaPaidAdContentType(contentType: ContentStudioType) {
  return (
    contentType === 'facebook_feed_ad' ||
    contentType === 'instagram_feed_ad' ||
    contentType === 'facebook_reel_ad' ||
    contentType === 'instagram_reel_ad' ||
    contentType === 'facebook_story_ad' ||
    contentType === 'instagram_story_ad' ||
    contentType === 'facebook_carousel_ad' ||
    contentType === 'instagram_carousel_ad'
  );
}

function sanitizeSummary(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function readJsonObject(value: unknown): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as JsonObject;
}

function readItemCampaignString(item: ContentStudioItemRecord, key: string) {
  const campaign = readJsonObject(readJsonObject(item.metadata).campaign);
  const value = campaign[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapReadinessStateToAttemptStatus(state: string): ContentStudioPublishAttemptStatus {
  switch (state) {
    case 'setup_required':
    case 'approval_pending':
    case 'quota_limit':
    case 'token_missing':
    case 'manual_only':
    case 'unsupported':
      return state;
    default:
      return 'error';
  }
}

function recordSummaryStatus(
  summary: ContentStudioSchedulerSummary,
  status: ContentStudioPublishAttemptStatus
) {
  switch (status) {
    case 'succeeded':
      summary.succeeded += 1;
      break;
    case 'failed':
      summary.failed += 1;
      break;
    case 'setup_required':
      summary.setup_required += 1;
      break;
    case 'approval_pending':
      summary.approval_pending += 1;
      break;
    case 'token_missing':
      summary.token_missing += 1;
      break;
    case 'quota_limit':
      summary.quota_limit += 1;
      break;
    case 'manual_only':
      summary.manual_only += 1;
      break;
    case 'unsupported':
      summary.unsupported += 1;
      break;
    case 'error':
      summary.error += 1;
      break;
    default:
      break;
  }
}

function incrementSkippedStatus(
  summary: ContentStudioSchedulerSummary,
  status: ContentStudioPublishAttemptStatus
) {
  summary.skipped += 1;
  recordSummaryStatus(summary, status);
}

function getContentStudioSchedulerReadiness(): ContentStudioSchedulerReadiness {
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());

  return {
    isConfigured: cronSecretConfigured,
    cronSecretConfigured,
    message: cronSecretConfigured
      ? 'Secure cron execution is configured.'
      : 'Scheduler setup required: CRON_SECRET / Vercel Cron',
    routePath: SCHEDULER_ROUTE_PATH,
    recommendedSchedule: '*/15 * * * *',
  };
}

async function listDueScheduledItems(client: SchedulerClient, batchSize: number) {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from('content_studio_items')
    .select('*')
    .eq('status', 'scheduled')
    .lte('schedule_at', nowIso)
    .or('scheduled_execution_status.is.null,scheduled_execution_status.eq.pending')
    .order('schedule_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ContentStudioItemRecord[];
}

async function claimScheduledItem(
  client: SchedulerClient,
  item: ContentStudioItemRecord
) {
  const startedAt = new Date().toISOString();
  const nextAttempts = (item.scheduled_execution_attempts ?? 0) + 1;
  const { data, error } = await client
    .from('content_studio_items')
    .update({
      scheduled_execution_status: 'processing',
      scheduled_execution_started_at: startedAt,
      scheduled_execution_finished_at: null,
      scheduled_execution_error: null,
      scheduled_execution_attempts: nextAttempts,
    })
    .eq('id', item.id)
    .eq('workspace_id', item.workspace_id)
    .eq('status', 'scheduled')
    .or('scheduled_execution_status.is.null,scheduled_execution_status.eq.pending')
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ContentStudioItemRecord | null) ?? null;
}

async function loadLinkedAssets(
  client: SchedulerClient,
  workspaceId: string,
  itemId: string
): Promise<LinkedAssetSummary[]> {
  const { data: links, error: linksError } = await client
    .from('content_studio_item_assets')
    .select('creative_asset_id')
    .eq('content_item_id', itemId);

  if (linksError) {
    throw new Error(linksError.message);
  }

  const assetIds = Array.from(
    new Set((links ?? []).map((link) => link.creative_asset_id).filter(Boolean))
  );

  if (assetIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('creative_assets')
    .select('id, title, asset_type, platform, image_url, storage_path, metadata')
    .eq('workspace_id', workspaceId)
    .in('id', assetIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LinkedAssetSummary[];
}

async function finalizeScheduledItem(
  client: SchedulerClient,
  item: ContentStudioItemRecord,
  input: {
    scheduledExecutionStatus: ScheduledExecutionStatus;
    scheduledExecutionError?: string | null;
    status?: ContentStudioItemRecord['status'];
    publishedAt?: string | null;
    providerExternalId?: string | null;
    providerResponseSummary?: JsonObject;
    lastProviderActionAt?: string | null;
    providerStatus?: string | null;
    providerError?: string | null;
  }
) {
  const { error } = await client
    .from('content_studio_items')
    .update({
      status: input.status,
      published_at: input.publishedAt,
      provider_external_id: input.providerExternalId,
      provider_response_summary: input.providerResponseSummary,
      last_provider_action_at: input.lastProviderActionAt,
      provider_status: input.providerStatus,
      provider_error: input.providerError,
      scheduled_execution_status: input.scheduledExecutionStatus,
      scheduled_execution_finished_at: new Date().toISOString(),
      scheduled_execution_error: input.scheduledExecutionError ?? null,
    })
    .eq('id', item.id)
    .eq('workspace_id', item.workspace_id);

  if (error) {
    throw new Error(error.message);
  }
}

async function markSchedulerItemError(
  client: SchedulerClient,
  item: ContentStudioItemRecord,
  message: string
) {
  await finalizeScheduledItem(client, item, {
    scheduledExecutionStatus: 'error',
    scheduledExecutionError: message,
    providerStatus: 'error',
    providerError: message,
  });
}

async function handleScheduledItem(
  client: SchedulerClient,
  item: ContentStudioItemRecord,
  summary: ContentStudioSchedulerSummary
) {
  const actionType = getProviderActionType(item.content_type);
  const provider = getProviderName(item.content_type);

  let attemptId: string | null = null;

  try {
    const attemptResult = await createContentStudioPublishAttempt(
      {
        workspaceId: item.workspace_id,
        contentItemId: item.id,
        provider,
        actionType,
        status: 'pending',
        requestSummary: {
          source: 'scheduled_execution',
          content_type: item.content_type,
          title: item.title,
          scheduled_for: item.schedule_at,
        },
        createdBy: null,
      },
      client
    );

    if (attemptResult.error || !attemptResult.data) {
      throw new Error(attemptResult.error ?? 'Publish attempt could not be recorded.');
    }

    attemptId = attemptResult.data.id;

    if (isMetaPaidAdContentType(item.content_type)) {
      const message =
        'Meta paid ads require manual confirmation and are not auto-created by scheduler.';

      await updateContentStudioPublishAttempt(
        attemptId,
        item.workspace_id,
        {
          status: 'manual_only',
          providerResponseSummary: {
            source: 'scheduled_execution',
            readiness_state: 'manual_only',
          },
          errorMessage: message,
        },
        client
      );

      await finalizeScheduledItem(client, item, {
        scheduledExecutionStatus: 'manual_only',
        scheduledExecutionError: message,
        providerStatus: 'manual_only',
        providerError: message,
      });

      incrementSkippedStatus(summary, 'manual_only');
      return;
    }

    if (!isPublishedContentType(item.content_type)) {
      const message =
        'Scheduled execution is limited to organic publishable content. Paid drafts and manual-only planners are not auto-created by scheduler.';

      await updateContentStudioPublishAttempt(
        attemptId,
        item.workspace_id,
        {
          status: 'manual_only',
          providerResponseSummary: {
            source: 'scheduled_execution',
            readiness_state: 'manual_only',
            content_type: item.content_type,
          },
          errorMessage: message,
        },
        client
      );

      await finalizeScheduledItem(client, item, {
        scheduledExecutionStatus: 'manual_only',
        scheduledExecutionError: message,
        providerStatus: 'manual_only',
        providerError: message,
      });

      incrementSkippedStatus(summary, 'manual_only');
      return;
    }

    const linkedAssets = await loadLinkedAssets(client, item.workspace_id, item.id);
    const executionAssets = linkedAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      assetType: asset.asset_type,
      platform: asset.platform,
      imageUrl: asset.image_url,
      storagePath: asset.storage_path,
      metadata: asset.metadata as Record<string, unknown> | null,
    }));
    const readiness = await getContentStudioProviderReadiness({
      workspaceId: item.workspace_id,
      userId: item.created_by,
      contentType: item.content_type,
      caption: item.caption,
      script: item.script,
      adCopy: item.ad_copy,
      objective: item.objective,
      linkedAssets: executionAssets,
      destinationUrl: readItemCampaignString(item, 'destination_url'),
      validateContent: true,
    });

    if (readiness.state !== 'ready') {
      const attemptStatus = mapReadinessStateToAttemptStatus(readiness.state);

      await updateContentStudioPublishAttempt(
        attemptId,
        item.workspace_id,
        {
          status: attemptStatus,
          providerResponseSummary: {
            source: 'scheduled_execution',
            readiness_state: readiness.state,
          },
          errorMessage: readiness.message,
        },
        client
      );

      await finalizeScheduledItem(client, item, {
        scheduledExecutionStatus: attemptStatus,
        scheduledExecutionError: readiness.message,
        status:
          readiness.state === 'approval_pending'
            ? 'approval_pending'
            : readiness.state === 'setup_required'
              ? 'setup_required'
              : item.status,
        providerStatus: readiness.state,
        providerError: readiness.message,
      });

      incrementSkippedStatus(summary, attemptStatus);
      return;
    }

    const providerResult = await executeContentStudioProviderAction({
      workspaceId: item.workspace_id,
      userId: item.created_by,
      itemId: item.id,
      title: item.title,
      contentType: item.content_type,
      objective: item.objective,
      caption: item.caption,
      script: item.script,
      adCopy: item.ad_copy,
      creativeBrief: item.creative_brief,
      destinationUrl: readItemCampaignString(item, 'destination_url'),
      linkedAssets: executionAssets,
    });

    await updateContentStudioPublishAttempt(
      attemptId,
      item.workspace_id,
      {
        status: providerResult.status,
        providerExternalId: trimToNull(providerResult.providerExternalId),
        providerResponseSummary: sanitizeSummary(providerResult.providerResponseSummary),
        errorMessage: providerResult.status === 'succeeded' ? null : providerResult.message,
      },
      client
    );

    if (providerResult.status === 'succeeded') {
      const completedAt = new Date().toISOString();
      const shouldMarkPublished = isPublishedContentType(item.content_type);

      await finalizeScheduledItem(client, item, {
        scheduledExecutionStatus: 'succeeded',
        scheduledExecutionError: null,
        status: shouldMarkPublished ? 'published' : item.status,
        publishedAt: shouldMarkPublished ? completedAt : item.published_at,
        providerExternalId: trimToNull(providerResult.providerExternalId),
        providerResponseSummary: sanitizeSummary(providerResult.providerResponseSummary),
        lastProviderActionAt: completedAt,
        providerStatus: 'ready',
        providerError: null,
      });

      summary.executed += 1;
      recordSummaryStatus(summary, 'succeeded');
      return;
    }

    await finalizeScheduledItem(client, item, {
      scheduledExecutionStatus: providerResult.status,
      scheduledExecutionError: providerResult.message,
      status:
        providerResult.status === 'failed'
          ? 'failed'
          : providerResult.status === 'approval_pending'
            ? 'approval_pending'
            : providerResult.status === 'setup_required'
              ? 'setup_required'
              : item.status,
      providerExternalId: trimToNull(providerResult.providerExternalId),
      providerResponseSummary: sanitizeSummary(providerResult.providerResponseSummary),
      providerStatus: providerResult.status,
      providerError: providerResult.message,
    });

    if (providerResult.status === 'failed') {
      summary.executed += 1;
      recordSummaryStatus(summary, 'failed');
      return;
    }

    incrementSkippedStatus(summary, providerResult.status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Scheduled execution failed unexpectedly.';

    if (attemptId) {
      try {
        await updateContentStudioPublishAttempt(
          attemptId,
          item.workspace_id,
          {
            status: 'error',
            errorMessage: message,
          },
          client
        );
      } catch (attemptUpdateError) {
        reportAppError('Scheduled publish attempt update failed', attemptUpdateError, {
          contentItemId: item.id,
          workspaceId: item.workspace_id,
        });
      }
    }

    try {
      await markSchedulerItemError(client, item, message);
    } catch (markError) {
      reportAppError('Scheduled content item error finalization failed', markError, {
        contentItemId: item.id,
        workspaceId: item.workspace_id,
      });
    }

    summary.executed += 1;
    recordSummaryStatus(summary, 'error');
    reportAppError('Scheduled content execution failed', error, {
      contentItemId: item.id,
      workspaceId: item.workspace_id,
      contentType: item.content_type,
    });
  }
}

export async function runContentStudioScheduler(input?: { batchSize?: number }) {
  const summary = createEmptySummary();
  const { client, error } = getSupabaseAdmin();

  if (!client) {
    throw new Error(error ?? 'Supabase server credentials are not configured.');
  }

  const batchSize = Math.max(1, Math.min(input?.batchSize ?? DEFAULT_BATCH_SIZE, 25));
  const dueItems = await listDueScheduledItems(client, batchSize);
  summary.scanned = dueItems.length;

  for (const item of dueItems) {
    const claimedItem = await claimScheduledItem(client, item);

    if (!claimedItem) {
      summary.skipped += 1;
      continue;
    }

    await handleScheduledItem(client, claimedItem, summary);
  }

  reportAppEvent('content_studio_scheduler_run_completed', { ...summary });
  return summary;
}

export {
  DEFAULT_BATCH_SIZE as CONTENT_STUDIO_SCHEDULER_BATCH_SIZE,
  SCHEDULER_ROUTE_PATH as CONTENT_STUDIO_SCHEDULER_ROUTE_PATH,
  getContentStudioSchedulerReadiness,
};
