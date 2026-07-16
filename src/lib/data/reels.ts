import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { JsonObject } from '@/types';
import type { Database, ReelRecord, ReelStatus } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface ListReelsOptions {
  workspaceId?: string;
  userId?: string;
  status?: ReelStatus;
  limit?: number;
  offset?: number;
}

export interface CreateReelInput {
  workspaceId: string;
  userId: string;
  title: string;
  offer?: string;
  goal?: string;
  target_audience?: string;
  market?: string;
  tone?: string;
  cta?: string;
  hook?: string;
  main_message?: string;
  script?: string;
  storyboard?: string;
  caption?: string;
  hashtags?: string[];
  duration_seconds?: number | null;
  creative_type?: string;
  video_url?: string;
  cover_url?: string;
  subtitles?: string;
  music_note?: string;
  scheduled_for?: string | null;
  status?: ReelStatus;
  metadata?: JsonObject;
}

export interface UpdateReelInput {
  reelId: string;
  workspaceId: string;
  userId?: string;
  title?: string;
  offer?: string | null;
  goal?: string | null;
  target_audience?: string | null;
  market?: string | null;
  tone?: string | null;
  cta?: string | null;
  hook?: string | null;
  main_message?: string | null;
  script?: string | null;
  storyboard?: string | null;
  caption?: string | null;
  hashtags?: string[];
  duration_seconds?: number | null;
  creative_type?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
  subtitles?: string | null;
  music_note?: string | null;
  status?: ReelStatus;
  scheduled_for?: string | null;
  published_at?: string | null;
  published_media_id?: string | null;
  published_permalink?: string | null;
  error_message?: string | null;
  metadata?: JsonObject;
}

export interface CountReelsInput {
  workspaceId: string;
  userId?: string;
  status?: ReelStatus;
}

export interface ReelCountResult {
  draft: number;
  ready: number;
  scheduled: number;
  published: number;
  failed: number;
}

export async function listReels(
  options: ListReelsOptions = {},
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  let query = client
    .from('reels')
    .select('id, workspace_id, user_id, platform, type, status, title, offer, goal, target_audience, market, tone, cta, hook, main_message, script, storyboard, caption, hashtags, duration_seconds, creative_type, video_url, cover_url, subtitles, music_note, scheduled_for, published_at, published_media_id, published_permalink, error_message, metadata, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (options.workspaceId) {
    query = query.eq('workspace_id', options.workspaceId);
  }

  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}

export async function listReelsForWorkspace(
  workspaceId: string,
  userId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>,
  options: { limit?: number; offset?: number } = {}
): Promise<DataResult<ReelRecord[]>> {
  return listReels({ workspaceId, userId, ...options }, client);
}

export async function getReelById(
  workspaceId: string,
  userId: string,
  reelId: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('reels')
    .select('*')
    .eq('id', reelId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function createReel(
  input: CreateReelInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('reels')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      title: input.title,
      offer: input.offer ?? null,
      goal: input.goal ?? null,
      target_audience: input.target_audience ?? null,
      market: input.market ?? null,
      tone: input.tone ?? null,
      cta: input.cta ?? null,
      hook: input.hook ?? null,
      main_message: input.main_message ?? null,
      script: input.script ?? null,
      storyboard: input.storyboard ?? null,
      caption: input.caption ?? null,
      hashtags: input.hashtags ?? [],
      duration_seconds: input.duration_seconds ?? null,
      creative_type: input.creative_type ?? null,
      video_url: input.video_url ?? null,
      cover_url: input.cover_url ?? null,
      subtitles: input.subtitles ?? null,
      music_note: input.music_note ?? null,
      scheduled_for: input.scheduled_for ?? null,
      status: input.status ?? 'draft',
      platform: 'instagram',
      type: 'reel',
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateReel(
  input: UpdateReelInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const updateData: Database['public']['Tables']['reels']['Update'] = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.offer !== undefined) updateData.offer = input.offer;
  if (input.goal !== undefined) updateData.goal = input.goal;
  if (input.target_audience !== undefined) updateData.target_audience = input.target_audience;
  if (input.market !== undefined) updateData.market = input.market;
  if (input.tone !== undefined) updateData.tone = input.tone;
  if (input.cta !== undefined) updateData.cta = input.cta;
  if (input.hook !== undefined) updateData.hook = input.hook;
  if (input.main_message !== undefined) updateData.main_message = input.main_message;
  if (input.script !== undefined) updateData.script = input.script;
  if (input.storyboard !== undefined) updateData.storyboard = input.storyboard;
  if (input.caption !== undefined) updateData.caption = input.caption;
  if (input.hashtags !== undefined) updateData.hashtags = input.hashtags;
  if (input.duration_seconds !== undefined) updateData.duration_seconds = input.duration_seconds;
  if (input.creative_type !== undefined) updateData.creative_type = input.creative_type;
  if (input.video_url !== undefined) updateData.video_url = input.video_url;
  if (input.cover_url !== undefined) updateData.cover_url = input.cover_url;
  if (input.subtitles !== undefined) updateData.subtitles = input.subtitles;
  if (input.music_note !== undefined) updateData.music_note = input.music_note;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.scheduled_for !== undefined) updateData.scheduled_for = input.scheduled_for;
  if (input.published_at !== undefined) updateData.published_at = input.published_at;
  if (input.published_media_id !== undefined) {
    updateData.published_media_id = input.published_media_id;
  }
  if (input.published_permalink !== undefined) {
    updateData.published_permalink = input.published_permalink;
  }
  if (input.error_message !== undefined) updateData.error_message = input.error_message;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  let query = client
    .from('reels')
    .update(updateData)
    .eq('id', input.reelId)
    .eq('workspace_id', input.workspaceId);

  if (input.userId) {
    query = query.eq('user_id', input.userId);
  }

  const { data, error } = await query.select('*').single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function deleteReel(
  workspaceId: string,
  reelId: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { error } = await client
    .from('reels')
    .delete()
    .eq('id', reelId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(null, true);
}

export async function markReelReady(
  reelId: string,
  workspaceId: string,
  userId: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  return updateReel(
    {
      reelId,
      workspaceId,
      userId,
      status: 'ready',
    },
    client
  );
}

export async function markReelScheduled(
  reelId: string,
  workspaceId: string,
  userId: string,
  scheduledFor: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  return updateReel(
    {
      reelId,
      workspaceId,
      userId,
      status: 'scheduled',
      scheduled_for: scheduledFor,
    },
    client
  );
}

export async function markReelPublished(
  reelId: string,
  workspaceId: string,
  userId: string,
  publishedMediaId: string,
  permalink: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  return updateReel(
    {
      reelId,
      workspaceId,
      userId,
      status: 'published',
      published_at: new Date().toISOString(),
      published_media_id: publishedMediaId,
      published_permalink: permalink,
      error_message: null,
    },
    client
  );
}

export async function markReelFailed(
  reelId: string,
  workspaceId: string,
  userId: string,
  errorMessage: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelRecord | null>> {
  return updateReel(
    {
      reelId,
      workspaceId,
      userId,
      status: 'failed',
      error_message: errorMessage,
    },
    client
  );
}

export async function countReelsByStatus(
  input: CountReelsInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<ReelCountResult>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(
      {
        draft: 0,
        ready: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
      },
      false
    );
  }

  try {
    const [draftResult, readyResult, scheduledResult, publishedResult, failedResult] =
      await Promise.all([
        listReels({ workspaceId: input.workspaceId, userId: input.userId, status: 'draft' }, client),
        listReels({ workspaceId: input.workspaceId, userId: input.userId, status: 'ready' }, client),
        listReels({ workspaceId: input.workspaceId, userId: input.userId, status: 'scheduled' }, client),
        listReels({ workspaceId: input.workspaceId, userId: input.userId, status: 'published' }, client),
        listReels({ workspaceId: input.workspaceId, userId: input.userId, status: 'failed' }, client),
      ]);

    const result: ReelCountResult = {
      draft: draftResult.data?.length ?? 0,
      ready: readyResult.data?.length ?? 0,
      scheduled: scheduledResult.data?.length ?? 0,
      published: publishedResult.data?.length ?? 0,
      failed: failedResult.data?.length ?? 0,
    };

    return emptyDataResult(result, true);
  } catch (error) {
    return errorDataResult(
      {
        draft: 0,
        ready: 0,
        scheduled: 0,
        published: 0,
        failed: 0,
      },
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
