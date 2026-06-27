import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import type {
  ContentStudioItemAssetRecord,
  ContentStudioItemRecord,
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
  CreativeAssetRecord,
  Database,
} from '@/types/database';
import type { JsonObject } from '@/types';
import { logger } from '@/lib/logger';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type ContentStudioClient = SupabaseClient<Database>;
const contentStudioLog = logger.child('data:content-studio');

export interface ListContentStudioItemsOptions {
  limit?: number;
}

export interface ContentStudioItemWithAssets extends ContentStudioItemRecord {
  asset_ids: string[];
  asset_count: number;
}

export interface CreateContentStudioItemInput {
  workspaceId: string;
  userId: string;
  title: string;
  platform: ContentStudioPlatform;
  contentType: ContentStudioType;
  status?: ContentStudioStatus;
  objective?: string | null;
  prompt?: string | null;
  script?: string | null;
  caption?: string | null;
  adCopy?: string | null;
  creativeBrief?: string | null;
  scheduleAt?: string | null;
  publishedAt?: string | null;
  providerExternalId?: string | null;
  providerResponseSummary?: JsonObject;
  lastProviderActionAt?: string | null;
  providerStatus?: string | null;
  providerError?: string | null;
  scheduledExecutionStatus?: string | null;
  scheduledExecutionStartedAt?: string | null;
  scheduledExecutionFinishedAt?: string | null;
  scheduledExecutionError?: string | null;
  scheduledExecutionAttempts?: number;
  metadata?: JsonObject;
}

export interface UpdateContentStudioItemInput {
  title?: string;
  platform?: ContentStudioPlatform;
  contentType?: ContentStudioType;
  status?: ContentStudioStatus;
  objective?: string | null;
  prompt?: string | null;
  script?: string | null;
  caption?: string | null;
  adCopy?: string | null;
  creativeBrief?: string | null;
  scheduleAt?: string | null;
  publishedAt?: string | null;
  providerExternalId?: string | null;
  providerResponseSummary?: JsonObject;
  lastProviderActionAt?: string | null;
  providerStatus?: string | null;
  providerError?: string | null;
  scheduledExecutionStatus?: string | null;
  scheduledExecutionStartedAt?: string | null;
  scheduledExecutionFinishedAt?: string | null;
  scheduledExecutionError?: string | null;
  scheduledExecutionAttempts?: number;
  metadata?: JsonObject;
}

async function getClient(client?: ContentStudioClient) {
  return client ?? (await createSupabaseServerClient());
}

function assignDefined<T extends keyof Database['public']['Tables']['content_studio_items']['Update']>(
  update: Database['public']['Tables']['content_studio_items']['Update'],
  key: T,
  value: Database['public']['Tables']['content_studio_items']['Update'][T] | undefined
) {
  if (value !== undefined) {
    update[key] = value;
  }
}

function mapAssets(
  items: ContentStudioItemRecord[],
  links: ContentStudioItemAssetRecord[]
): ContentStudioItemWithAssets[] {
  const idsByItem = new Map<string, string[]>();

  for (const link of links) {
    const assetIds = idsByItem.get(link.content_item_id) ?? [];
    assetIds.push(link.creative_asset_id);
    idsByItem.set(link.content_item_id, assetIds);
  }

  return items.map((item) => {
    const assetIds = idsByItem.get(item.id) ?? [];

    return {
      ...item,
      asset_ids: assetIds,
      asset_count: assetIds.length,
    };
  });
}

export async function listContentStudioItemsForWorkspace(
  workspaceId: string,
  client?: ContentStudioClient,
  options: ListContentStudioItemsOptions = {}
): Promise<DataResult<ContentStudioItemWithAssets[]>> {
  contentStudioLog.info('before list items', {
    workspaceId,
    limit: options.limit ?? null,
  });

  if (!isSupabaseServerConfigured) {
    contentStudioLog.warn('Supabase is not configured');
    return emptyDataResult([], false);
  }

  const supabase = await getClient(client);
  let query = supabase
    .from('content_studio_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data: items, error } = await query;
  contentStudioLog.info('after list items', {
    workspaceId,
    count: items?.length ?? 0,
    error: error?.message ?? null,
  });

  if (error) {
    return errorDataResult([], error.message);
  }

  const itemIds = (items ?? []).map((item) => item.id);

  if (itemIds.length === 0) {
    return emptyDataResult([], true);
  }

  contentStudioLog.info('before item asset links query', {
    workspaceId,
    itemCount: itemIds.length,
  });
  const { data: links, error: linksError } = await supabase
    .from('content_studio_item_assets')
    .select('*')
    .in('content_item_id', itemIds);
  contentStudioLog.info('after item asset links query', {
    workspaceId,
    linkCount: links?.length ?? 0,
    error: linksError?.message ?? null,
  });

  if (linksError) {
    return errorDataResult([], linksError.message);
  }

  return emptyDataResult(mapAssets(items ?? [], links ?? []), true);
}

export async function getContentStudioItemById(
  workspaceId: string,
  itemId: string,
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemWithAssets | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const { data: item, error } = await supabase
    .from('content_studio_items')
    .select('*')
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  if (!item) {
    return emptyDataResult(null, true);
  }

  const { data: links, error: linksError } = await supabase
    .from('content_studio_item_assets')
    .select('*')
    .eq('content_item_id', item.id);

  if (linksError) {
    return errorDataResult(null, linksError.message);
  }

  return emptyDataResult(mapAssets([item], links ?? [])[0] ?? null, true);
}

export async function createContentStudioItem(
  input: CreateContentStudioItemInput,
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const insert: Database['public']['Tables']['content_studio_items']['Insert'] = {
    workspace_id: input.workspaceId,
    created_by: input.userId,
    title: input.title,
    platform: input.platform,
    content_type: input.contentType,
    status: input.status ?? 'draft',
    objective: input.objective ?? null,
    prompt: input.prompt ?? null,
    script: input.script ?? null,
    caption: input.caption ?? null,
    ad_copy: input.adCopy ?? null,
    creative_brief: input.creativeBrief ?? null,
    schedule_at: input.scheduleAt ?? null,
    published_at: input.publishedAt ?? null,
    provider_external_id: input.providerExternalId ?? null,
    provider_response_summary: input.providerResponseSummary ?? {},
    last_provider_action_at: input.lastProviderActionAt ?? null,
    provider_status: input.providerStatus ?? null,
    provider_error: input.providerError ?? null,
    scheduled_execution_status: input.scheduledExecutionStatus ?? null,
    scheduled_execution_started_at: input.scheduledExecutionStartedAt ?? null,
    scheduled_execution_finished_at: input.scheduledExecutionFinishedAt ?? null,
    scheduled_execution_error: input.scheduledExecutionError ?? null,
    scheduled_execution_attempts: input.scheduledExecutionAttempts ?? 0,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from('content_studio_items')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateContentStudioItem(
  itemId: string,
  workspaceId: string,
  input: UpdateContentStudioItemInput,
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const update: Database['public']['Tables']['content_studio_items']['Update'] = {};

  assignDefined(update, 'title', input.title);
  assignDefined(update, 'platform', input.platform);
  assignDefined(update, 'content_type', input.contentType);
  assignDefined(update, 'status', input.status);
  assignDefined(update, 'objective', input.objective);
  assignDefined(update, 'prompt', input.prompt);
  assignDefined(update, 'script', input.script);
  assignDefined(update, 'caption', input.caption);
  assignDefined(update, 'ad_copy', input.adCopy);
  assignDefined(update, 'creative_brief', input.creativeBrief);
  assignDefined(update, 'schedule_at', input.scheduleAt);
  assignDefined(update, 'published_at', input.publishedAt);
  assignDefined(update, 'provider_external_id', input.providerExternalId);
  assignDefined(update, 'provider_response_summary', input.providerResponseSummary);
  assignDefined(update, 'last_provider_action_at', input.lastProviderActionAt);
  assignDefined(update, 'provider_status', input.providerStatus);
  assignDefined(update, 'provider_error', input.providerError);
  assignDefined(update, 'scheduled_execution_status', input.scheduledExecutionStatus);
  assignDefined(update, 'scheduled_execution_started_at', input.scheduledExecutionStartedAt);
  assignDefined(update, 'scheduled_execution_finished_at', input.scheduledExecutionFinishedAt);
  assignDefined(update, 'scheduled_execution_error', input.scheduledExecutionError);
  assignDefined(update, 'scheduled_execution_attempts', input.scheduledExecutionAttempts);
  assignDefined(update, 'metadata', input.metadata);

  const { data, error } = await supabase
    .from('content_studio_items')
    .update(update)
    .eq('id', itemId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function replaceContentStudioItemAssets(
  itemId: string,
  creativeAssetIds: string[],
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemAssetRecord[]>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult([], false);
  }

  const supabase = await getClient(client);
  const uniqueAssetIds = Array.from(new Set(creativeAssetIds));

  const { error: deleteError } = await supabase
    .from('content_studio_item_assets')
    .delete()
    .eq('content_item_id', itemId);

  if (deleteError) {
    return errorDataResult([], deleteError.message);
  }

  if (uniqueAssetIds.length === 0) {
    return emptyDataResult([], true);
  }

  const { data, error } = await supabase
    .from('content_studio_item_assets')
    .insert(
      uniqueAssetIds.map((creativeAssetId) => ({
        content_item_id: itemId,
        creative_asset_id: creativeAssetId,
      }))
    )
    .select('*');

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}

export async function addContentStudioItemAsset(
  itemId: string,
  workspaceId: string,
  creativeAssetId: string,
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemWithAssets | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  if (!itemId || !creativeAssetId) {
    return errorDataResult(null, 'Content item and creative asset are required.');
  }

  const supabase = await getClient(client);
  const itemResult = await getContentStudioItemById(workspaceId, itemId, supabase);

  if (itemResult.error || !itemResult.data) {
    return errorDataResult(null, itemResult.error ?? 'Content item not found.');
  }

  const { data: asset, error: assetError } = await supabase
    .from('creative_assets')
    .select('id')
    .eq('id', creativeAssetId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (assetError) {
    return errorDataResult(null, assetError.message);
  }

  if (!asset) {
    return errorDataResult(null, 'Creative asset not found.');
  }

  if (!itemResult.data.asset_ids.includes(creativeAssetId)) {
    const { error } = await supabase
      .from('content_studio_item_assets')
      .insert({
        content_item_id: itemId,
        creative_asset_id: creativeAssetId,
      });

    if (error) {
      return errorDataResult(null, error.message);
    }
  }

  const nextAssetIds = Array.from(new Set([...itemResult.data.asset_ids, creativeAssetId]));
  const metadata = {
    ...(itemResult.data.metadata ?? {}),
    linked_asset_ids: nextAssetIds,
    linked_asset_count: nextAssetIds.length,
  };
  const updateResult = await updateContentStudioItem(itemId, workspaceId, { metadata }, supabase);

  if (updateResult.error) {
    return errorDataResult(null, updateResult.error);
  }

  const refreshedItem = await getContentStudioItemById(workspaceId, itemId, supabase);
  return refreshedItem;
}

export async function removeContentStudioItemAsset(
  itemId: string,
  workspaceId: string,
  creativeAssetId: string,
  client?: ContentStudioClient
): Promise<DataResult<ContentStudioItemWithAssets | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  if (!itemId || !creativeAssetId) {
    return errorDataResult(null, 'Content item and creative asset are required.');
  }

  const supabase = await getClient(client);
  const itemResult = await getContentStudioItemById(workspaceId, itemId, supabase);

  if (itemResult.error || !itemResult.data) {
    return errorDataResult(null, itemResult.error ?? 'Content item not found.');
  }

  const { data: asset, error: assetError } = await supabase
    .from('creative_assets')
    .select('id')
    .eq('id', creativeAssetId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (assetError) {
    return errorDataResult(null, assetError.message);
  }

  if (!asset) {
    return errorDataResult(null, 'Creative asset not found.');
  }

  const { error } = await supabase
    .from('content_studio_item_assets')
    .delete()
    .eq('content_item_id', itemId)
    .eq('creative_asset_id', creativeAssetId);

  if (error) {
    return errorDataResult(null, error.message);
  }

  const nextAssetIds = itemResult.data.asset_ids.filter((assetId) => assetId !== creativeAssetId);
  const metadata = {
    ...(itemResult.data.metadata ?? {}),
    linked_asset_ids: nextAssetIds,
    linked_asset_count: nextAssetIds.length,
  };
  const updateResult = await updateContentStudioItem(
    itemId,
    workspaceId,
    { metadata },
    supabase
  );

  if (updateResult.error) {
    return errorDataResult(null, updateResult.error);
  }

  const refreshedItem = await getContentStudioItemById(workspaceId, itemId, supabase);
  return refreshedItem;
}

export function filterAvailableCreativeAssetsForSelection(
  assets: CreativeAssetRecord[],
  platform: ContentStudioPlatform
) {
  if (platform === 'linkedin') {
    return assets;
  }

  const allowedPlatforms: CreativeAssetRecord['platform'][] =
    platform === 'facebook' || platform === 'instagram'
      ? ['facebook', 'instagram', 'general']
      : [platform, 'general'];

  return assets.filter((asset) => allowedPlatforms.includes(asset.platform));
}
