import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase-server';
import {
  createCreativeAssetSignedUrl,
} from '@/lib/storage/creative-assets';
import type { JsonObject } from '@/types';
import type {
  CreativeAssetAspectRatio,
  CreativeAssetOutputStyle,
  CreativeAssetPlatform,
  CreativeAssetRecord,
  CreativeAssetSource,
  CreativeAssetStatus,
  CreativeAssetType,
  Database,
} from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

type CreativeAssetsClient = SupabaseClient<Database>;
const CREATIVE_ASSETS_DATA_TRACE_PREFIX = '[creative-assets-data]';

export interface ListCreativeAssetsOptions {
  limit?: number;
  includeSignedUrls?: boolean;
}

export interface CreateCreativeAssetInput {
  workspaceId: string;
  userId: string;
  title: string;
  asset_type: CreativeAssetType;
  platform?: CreativeAssetPlatform;
  status?: CreativeAssetStatus;
  source?: CreativeAssetSource;
  goal?: string | null;
  offer?: string | null;
  target_audience?: string | null;
  market?: string | null;
  tone?: string | null;
  style?: string | null;
  visual_direction?: string | null;
  text_overlay?: string | null;
  brand_colors?: string | null;
  notes?: string | null;
  prompt?: string | null;
  negative_prompt?: string | null;
  aspect_ratio?: CreativeAssetAspectRatio | null;
  output_style?: CreativeAssetOutputStyle | null;
  image_url?: string | null;
  storage_path?: string | null;
  linked_reel_id?: string | null;
  linked_task_id?: string | null;
  linked_campaign_task_id?: string | null;
  metadata?: JsonObject;
}

export interface UpdateCreativeAssetInput {
  workspaceId?: string;
  userId?: string;
  title?: string;
  asset_type?: CreativeAssetType;
  platform?: CreativeAssetPlatform;
  status?: CreativeAssetStatus;
  source?: CreativeAssetSource;
  goal?: string | null;
  offer?: string | null;
  target_audience?: string | null;
  market?: string | null;
  tone?: string | null;
  style?: string | null;
  visual_direction?: string | null;
  text_overlay?: string | null;
  brand_colors?: string | null;
  notes?: string | null;
  prompt?: string | null;
  negative_prompt?: string | null;
  aspect_ratio?: CreativeAssetAspectRatio | null;
  output_style?: CreativeAssetOutputStyle | null;
  image_url?: string | null;
  storage_path?: string | null;
  linked_reel_id?: string | null;
  linked_task_id?: string | null;
  linked_campaign_task_id?: string | null;
  model?: string | null;
  size?: string | null;
  quality?: string | null;
  estimated_cost_usd?: number | null;
  error_message?: string | null;
  metadata?: JsonObject;
}

async function getClient(client?: CreativeAssetsClient) {
  return client ?? (await createSupabaseServerClient());
}

async function withSignedImageUrl(
  asset: CreativeAssetRecord,
  client: CreativeAssetsClient
): Promise<CreativeAssetRecord> {
  const isVideoAsset =
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(asset.metadata?.video);

  if (!asset.storage_path || isVideoAsset) {
    return asset;
  }

  const signedUrlResult = await createCreativeAssetSignedUrl(client, asset.storage_path);

  return {
    ...asset,
    image_url: signedUrlResult.signedUrl ?? asset.image_url,
  };
}

async function withSignedImageUrls(
  assets: CreativeAssetRecord[],
  client: CreativeAssetsClient
) {
  return Promise.all(assets.map((asset) => withSignedImageUrl(asset, client)));
}

function assignDefined<T extends keyof Database['public']['Tables']['creative_assets']['Update']>(
  update: Database['public']['Tables']['creative_assets']['Update'],
  key: T,
  value: Database['public']['Tables']['creative_assets']['Update'][T] | undefined
) {
  if (value !== undefined) {
    update[key] = value;
  }
}

export async function listCreativeAssetsForWorkspace(
  workspaceId: string,
  userId?: string,
  client?: CreativeAssetsClient,
  options: ListCreativeAssetsOptions = {}
): Promise<DataResult<CreativeAssetRecord[]>> {
  console.info(CREATIVE_ASSETS_DATA_TRACE_PREFIX, 'before list assets', {
    workspaceId,
    userId: userId ?? null,
    limit: options.limit ?? null,
    includeSignedUrls: options.includeSignedUrls ?? true,
  });

  if (!isSupabaseServerConfigured) {
    console.warn(CREATIVE_ASSETS_DATA_TRACE_PREFIX, 'Supabase is not configured');
    return emptyDataResult([], false);
  }

  const supabase = await getClient(client);
  let query = supabase
    .from('creative_assets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  console.info(CREATIVE_ASSETS_DATA_TRACE_PREFIX, 'after list assets', {
    workspaceId,
    count: data?.length ?? 0,
    error: error?.message ?? null,
  });

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(
    options.includeSignedUrls === false ? (data ?? []) : await withSignedImageUrls(data ?? [], supabase),
    true
  );
}

export async function getCreativeAssetById(
  workspaceId: string,
  userId: string,
  assetId: string,
  client?: CreativeAssetsClient
): Promise<DataResult<CreativeAssetRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from('creative_assets')
    .select('*')
    .eq('id', assetId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ? await withSignedImageUrl(data, supabase) : null, true);
}

export async function createCreativeAsset(
  input: CreateCreativeAssetInput,
  client?: CreativeAssetsClient
): Promise<DataResult<CreativeAssetRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const insert: Database['public']['Tables']['creative_assets']['Insert'] = {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    title: input.title,
    asset_type: input.asset_type,
    platform: input.platform ?? 'general',
    status: input.status ?? 'draft',
    source: input.source ?? 'prompt_only',
    goal: input.goal ?? null,
    offer: input.offer ?? null,
    target_audience: input.target_audience ?? null,
    market: input.market ?? null,
    tone: input.tone ?? null,
    style: input.style ?? null,
    visual_direction: input.visual_direction ?? null,
    text_overlay: input.text_overlay ?? null,
    brand_colors: input.brand_colors ?? null,
    notes: input.notes ?? null,
    prompt: input.prompt ?? null,
    negative_prompt: input.negative_prompt ?? null,
    aspect_ratio: input.aspect_ratio ?? null,
    output_style: input.output_style ?? null,
    image_url: input.image_url ?? null,
    storage_path: input.storage_path ?? null,
    linked_reel_id: input.linked_reel_id ?? null,
    linked_task_id: input.linked_task_id ?? null,
    linked_campaign_task_id: input.linked_campaign_task_id ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from('creative_assets')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateCreativeAsset(
  assetId: string,
  input: UpdateCreativeAssetInput,
  client?: CreativeAssetsClient
): Promise<DataResult<CreativeAssetRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const update: Database['public']['Tables']['creative_assets']['Update'] = {};

  assignDefined(update, 'title', input.title);
  assignDefined(update, 'asset_type', input.asset_type);
  assignDefined(update, 'platform', input.platform);
  assignDefined(update, 'status', input.status);
  assignDefined(update, 'source', input.source);
  assignDefined(update, 'goal', input.goal);
  assignDefined(update, 'offer', input.offer);
  assignDefined(update, 'target_audience', input.target_audience);
  assignDefined(update, 'market', input.market);
  assignDefined(update, 'tone', input.tone);
  assignDefined(update, 'style', input.style);
  assignDefined(update, 'visual_direction', input.visual_direction);
  assignDefined(update, 'text_overlay', input.text_overlay);
  assignDefined(update, 'brand_colors', input.brand_colors);
  assignDefined(update, 'notes', input.notes);
  assignDefined(update, 'prompt', input.prompt);
  assignDefined(update, 'negative_prompt', input.negative_prompt);
  assignDefined(update, 'aspect_ratio', input.aspect_ratio);
  assignDefined(update, 'output_style', input.output_style);
  assignDefined(update, 'image_url', input.image_url);
  assignDefined(update, 'storage_path', input.storage_path);
  assignDefined(update, 'linked_reel_id', input.linked_reel_id);
  assignDefined(update, 'linked_task_id', input.linked_task_id);
  assignDefined(update, 'linked_campaign_task_id', input.linked_campaign_task_id);
  assignDefined(update, 'model', input.model);
  assignDefined(update, 'size', input.size);
  assignDefined(update, 'quality', input.quality);
  assignDefined(update, 'estimated_cost_usd', input.estimated_cost_usd);
  assignDefined(update, 'error_message', input.error_message);
  assignDefined(update, 'metadata', input.metadata);

  let query = supabase.from('creative_assets').update(update).eq('id', assetId);

  if (input.workspaceId) {
    query = query.eq('workspace_id', input.workspaceId);
  }

  if (input.userId) {
    query = query.eq('user_id', input.userId);
  }

  const { data, error } = await query.select('*').maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ? await withSignedImageUrl(data, supabase) : null, true);
}

export async function unlinkCreativeAssetFromContentStudioItems(
  assetId: string,
  workspaceId: string,
  client?: CreativeAssetsClient
): Promise<DataResult<null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const { data: existingLinks, error: existingLinksError } = await supabase
    .from('content_studio_item_assets')
    .select('content_item_id')
    .eq('creative_asset_id', assetId);

  if (existingLinksError) {
    return errorDataResult(null, existingLinksError.message);
  }

  const linkedItemIds = Array.from(
    new Set((existingLinks ?? []).map((link) => link.content_item_id))
  );

  const { error } = await supabase
    .from('content_studio_item_assets')
    .delete()
    .eq('creative_asset_id', assetId);

  if (error) {
    return errorDataResult(null, error.message);
  }

  if (linkedItemIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('content_studio_items')
      .select('id, metadata')
      .eq('workspace_id', workspaceId)
      .in('id', linkedItemIds);

    if (itemsError) {
      return errorDataResult(null, itemsError.message);
    }

    const validItemIds = (items ?? []).map((item) => item.id);
    const { data: remainingLinks, error: remainingLinksError } = await supabase
      .from('content_studio_item_assets')
      .select('content_item_id, creative_asset_id')
      .in('content_item_id', validItemIds);

    if (remainingLinksError) {
      return errorDataResult(null, remainingLinksError.message);
    }

    for (const item of items ?? []) {
      const nextAssetIds = (remainingLinks ?? [])
        .filter((link) => link.content_item_id === item.id)
        .map((link) => link.creative_asset_id);
      const metadata =
        item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
          ? item.metadata
          : {};

      const { error: updateError } = await supabase
        .from('content_studio_items')
        .update({
          metadata: {
            ...metadata,
            linked_asset_ids: nextAssetIds,
            linked_asset_count: nextAssetIds.length,
          },
        })
        .eq('id', item.id)
        .eq('workspace_id', workspaceId);

      if (updateError) {
        return errorDataResult(null, updateError.message);
      }
    }
  }

  return emptyDataResult(null, true);
}

export async function deleteCreativeAsset(
  assetId: string,
  workspaceId: string,
  userId: string,
  client?: CreativeAssetsClient
): Promise<DataResult<CreativeAssetRecord | null>> {
  if (!isSupabaseServerConfigured) {
    return emptyDataResult(null, false);
  }

  const supabase = await getClient(client);
  const { data, error } = await supabase
    .from('creative_assets')
    .delete()
    .eq('id', assetId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function markCreativeAssetPromptReady(
  assetId: string,
  prompt: string,
  negativePrompt?: string | null,
  client?: CreativeAssetsClient
) {
  return updateCreativeAsset(
    assetId,
    {
      status: 'prompt_ready',
      source: 'prompt_only',
      prompt,
      negative_prompt: negativePrompt ?? null,
      error_message: null,
    },
    client
  );
}

export async function markCreativeAssetGenerating(
  assetId: string,
  client?: CreativeAssetsClient
) {
  return updateCreativeAsset(
    assetId,
    {
      status: 'generating',
      error_message: null,
    },
    client
  );
}

export async function markCreativeAssetGenerated(
  assetId: string,
  imageUrl: string | null,
  storagePath: string | null,
  metadata: JsonObject,
  client?: CreativeAssetsClient
) {
  const model = typeof metadata.model === 'string' ? metadata.model : null;
  const size = typeof metadata.size === 'string' ? metadata.size : null;
  const quality = typeof metadata.quality === 'string' ? metadata.quality : null;

  return updateCreativeAsset(
    assetId,
    {
      status: 'generated',
      source: 'openai',
      image_url: imageUrl,
      storage_path: storagePath,
      model,
      size,
      quality,
      error_message: null,
      metadata,
    },
    client
  );
}

export async function markCreativeAssetFailed(
  assetId: string,
  safeError: string,
  client?: CreativeAssetsClient
) {
  return updateCreativeAsset(
    assetId,
    {
      status: 'failed',
      error_message: safeError.slice(0, 500),
    },
    client
  );
}

export async function archiveCreativeAsset(
  assetId: string,
  client?: CreativeAssetsClient
) {
  return updateCreativeAsset(
    assetId,
    {
      status: 'archived',
    },
    client
  );
}
