'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkWorkspaceUserRateLimit, RATE_LIMIT_ACTIONS } from '@/lib/sliding-window-rate-limit';
import { incrementUsage } from '@/lib/usage/quotas';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import {
  createCreativeAsset,
  getCreativeAssetById,
  listCreativeAssetsForWorkspace,
  markCreativeAssetFailed,
  markCreativeAssetGenerated,
  updateCreativeAsset,
} from '@/lib/data/creative-assets';
import {
  checkOpenAIImageReadiness,
  generateImageWithOpenAI,
} from '@/lib/ai/openai-images';
import {
  checkOpenAIVideoReadiness,
  createVideoWithOpenAI,
  downloadOpenAIVideoContent,
  getOpenAIVideoStatus,
  normalizeOpenAIVideoSeconds,
  normalizeOpenAIVideoSize,
} from '@/lib/ai/openai-video';
import {
  uploadCreativeAssetImage,
  uploadCreativeAssetVideo,
} from '@/lib/storage/creative-assets';
import type { JsonObject } from '@/types';
import type {
  CreativeAssetAspectRatio,
  CreativeAssetOutputStyle,
  CreativeAssetRecord,
} from '@/types/database';

export type AIStudioMode = 'image' | 'video';

export interface AIStudioAssetView {
  id: string;
  title: string;
  mode: AIStudioMode;
  prompt: string;
  negativePrompt: string | null;
  status: string;
  model: string | null;
  size: string | null;
  quality: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  openaiVideoId: string | null;
  progress: number | null;
  createdAt: string;
}

export interface AIStudioGenerateResult {
  error: string | null;
  message?: string | null;
  asset?: AIStudioAssetView | null;
  setupRequired?: boolean;
}

const imageAspectRatios: CreativeAssetAspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
const outputStyles: CreativeAssetOutputStyle[] = [
  'premium_saas',
  'realistic',
  'minimal',
  'bold_ad',
  'clean_corporate',
  'luxury',
];
const imageModels = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3'];
const videoModels = ['sora-2', 'sora-2-pro'];

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPrompt(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

function readImageAspectRatio(value: string): CreativeAssetAspectRatio {
  return imageAspectRatios.includes(value as CreativeAssetAspectRatio)
    ? (value as CreativeAssetAspectRatio)
    : '1:1';
}

function readOutputStyle(value: string): CreativeAssetOutputStyle {
  return outputStyles.includes(value as CreativeAssetOutputStyle)
    ? (value as CreativeAssetOutputStyle)
    : 'premium_saas';
}

function readModel(value: string, allowed: string[], fallback: string) {
  return allowed.includes(value) ? value : fallback;
}

function readVideoSeconds(value: string) {
  const parsed = Number.parseInt(value, 10);
  return normalizeOpenAIVideoSeconds(Number.isFinite(parsed) ? parsed : null);
}

function metadataObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function assetToView(asset: CreativeAssetRecord): AIStudioAssetView {
  const metadata = metadataObject(asset.metadata);
  const video = metadataObject(metadata.video);
  const openai = metadataObject(metadata.openai);
  const mode: AIStudioMode =
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    metadata.media_type === 'video'
      ? 'video'
      : 'image';

  return {
    id: asset.id,
    title: asset.title,
    mode,
    prompt: asset.prompt ?? '',
    negativePrompt: asset.negative_prompt,
    status: asset.status,
    model: asset.model ?? readString(metadata.model),
    size: asset.size ?? readString(metadata.size),
    quality: asset.quality,
    imageUrl: mode === 'image' ? asset.image_url : null,
    videoUrl: mode === 'video' ? readString(video.public_url) : null,
    openaiVideoId: readString(openai.video_id),
    progress: readNumber(openai.progress),
    createdAt: asset.created_at,
  };
}

async function getWorkspaceContext(redirectTo = '/dashboard/ai-studio', rateLimitGeneration = true) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const membershipResult = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  if (membershipResult.error || !membershipResult.data || !hasPermission(role, 'editor')) {
    throw new Error('ما عندكش صلاحية لاستعمال AI Studio. AI generation is restricted for your workspace role.');
  }

  if (rateLimitGeneration) {
    // Fixed-window rate limit (existing)
    const limiter = await checkRateLimit({
      key: `ai-studio:${workspaceResult.data.id}:${user.id}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!limiter.allowed) {
      throw new Error('وصلتي للحد المؤقت لتوليد AI Studio. عاود المحاولة بعد شوية.');
    }

    // Sliding window rate limit for AI Studio generations
    const slidingLimiter = await checkWorkspaceUserRateLimit(
      workspaceResult.data.id,
      user.id,
      RATE_LIMIT_ACTIONS.AI_GENERATE_IMAGE,
      { limit: 5, windowMs: 60_000 } // 5 AI Studio generations per minute
    );

    if (!slidingLimiter.allowed) {
      throw new Error(`AI Studio generation rate limit reached. Please wait ${Math.ceil(slidingLimiter.resetInMs / 1000)} seconds before retrying.`);
    }
  }

  return { supabase, user, workspace: workspaceResult.data, role };
}

function revalidateAIStudio() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/ai-studio');
  revalidatePath('/dashboard/creative-assets');
}

export async function generateAIStudioImageAction(
  formData: FormData
): Promise<AIStudioGenerateResult> {
  const prompt = cleanPrompt(readField(formData, 'prompt'));
  const negativePrompt = cleanPrompt(readField(formData, 'negative_prompt'));
  const aspectRatio = readImageAspectRatio(readField(formData, 'aspect_ratio'));
  const outputStyle = readOutputStyle(readField(formData, 'output_style'));
  const model = readModel(readField(formData, 'model'), imageModels, checkOpenAIImageReadiness().model);
  const title = readField(formData, 'title').slice(0, 120) || 'AI Studio Image';

  if (prompt.length < 10) {
    return { error: 'Describe the image in at least 10 characters.' };
  }

  const { supabase, user, workspace } = await getWorkspaceContext();
  const assetResult = await createCreativeAsset(
    {
      workspaceId: workspace.id,
      userId: user.id,
      title,
      asset_type: 'image',
      platform: 'general',
      status: 'generating',
      source: 'openai',
      prompt,
      negative_prompt: negativePrompt || null,
      aspect_ratio: aspectRatio,
      output_style: outputStyle,
      style: outputStyle,
      metadata: {
        origin: 'ai_studio',
        media_type: 'image',
        requested_model: model,
        requested_at: new Date().toISOString(),
      },
    },
    supabase
  );

  if (assetResult.error || !assetResult.data) {
    return { error: assetResult.error ?? 'Could not create AI Studio asset.' };
  }

  const generationResult = await generateImageWithOpenAI({
    prompt,
    negativePrompt,
    aspectRatio,
    model,
    userId: user.id,
  });

  if (generationResult.status === 'setup_required') {
    await markCreativeAssetFailed(assetResult.data.id, generationResult.error, supabase);
    revalidateAIStudio();
    return { error: generationResult.error, setupRequired: true };
  }

  if (generationResult.status === 'failed') {
    await markCreativeAssetFailed(assetResult.data.id, generationResult.error, supabase);
    revalidateAIStudio();
    return { error: generationResult.error };
  }

  let imageUrl = generationResult.imageUrl;
  let storagePath: string | null = null;

  if (generationResult.b64Json) {
    const uploadResult = await uploadCreativeAssetImage({
      client: supabase,
      workspaceId: workspace.id,
      assetId: assetResult.data.id,
      base64Data: generationResult.b64Json,
      contentType: generationResult.contentType,
    });

    if (uploadResult.error) {
      await markCreativeAssetFailed(assetResult.data.id, uploadResult.error, supabase);
      revalidateAIStudio();
      return { error: uploadResult.error };
    }

    imageUrl = uploadResult.imageUrl;
    storagePath = uploadResult.storagePath;
  }

  const metadata: JsonObject = {
    ...(assetResult.data.metadata ?? {}),
    ...generationResult.metadata,
    origin: 'ai_studio',
    media_type: 'image',
    model: generationResult.model,
    size: generationResult.size,
    quality: generationResult.quality,
    revised_prompt: generationResult.revisedPrompt,
    saved_to_creative_assets: true,
    generated_at: new Date().toISOString(),
  };

  const savedResult = await markCreativeAssetGenerated(
    assetResult.data.id,
    imageUrl,
    storagePath,
    metadata,
    supabase
  );

  revalidateAIStudio();

  await incrementUsage(workspace.id, 'ai_generations', 1, user.id).catch(() => {});

  if (savedResult.error || !savedResult.data) {
    return { error: savedResult.error ?? 'Generated image could not be saved.' };
  }

  return {
    error: null,
    message: 'Image generated and saved to Creative Assets.',
    asset: assetToView(savedResult.data),
  };
}

export async function generateAIStudioVideoAction(
  formData: FormData
): Promise<AIStudioGenerateResult> {
  const prompt = cleanPrompt(readField(formData, 'prompt'));
  const model = readModel(readField(formData, 'model'), videoModels, checkOpenAIVideoReadiness().model);
  const seconds = readVideoSeconds(readField(formData, 'seconds'));
  const size = normalizeOpenAIVideoSize(readField(formData, 'size'));
  const title = readField(formData, 'title').slice(0, 120) || 'AI Studio Video';

  if (prompt.length < 10) {
    return { error: 'Describe the video in at least 10 characters.' };
  }

  const { supabase, user, workspace } = await getWorkspaceContext();
  const assetResult = await createCreativeAsset(
    {
      workspaceId: workspace.id,
      userId: user.id,
      title,
      asset_type: 'video',
      platform: 'general',
      status: 'generating',
      source: 'openai',
      prompt,
      aspect_ratio: size === '720x1280' ? '9:16' : size === '1024x1024' ? '1:1' : '16:9',
      metadata: {
        origin: 'ai_studio',
        media_type: 'video',
        requested_model: model,
        requested_seconds: seconds,
        requested_size: size,
        requested_at: new Date().toISOString(),
      },
    },
    supabase
  );

  if (assetResult.error || !assetResult.data) {
    return { error: assetResult.error ?? 'Could not create AI Studio video asset.' };
  }

  const generationResult = await createVideoWithOpenAI({
    prompt,
    model,
    seconds,
    size,
    userId: user.id,
  });

  if (generationResult.status === 'setup_required') {
    await markCreativeAssetFailed(assetResult.data.id, generationResult.error, supabase);
    revalidateAIStudio();
    return { error: generationResult.error, setupRequired: true };
  }

  if (generationResult.status === 'failed') {
    await markCreativeAssetFailed(assetResult.data.id, generationResult.error, supabase);
    revalidateAIStudio();
    return { error: generationResult.error };
  }

  const metadata: JsonObject = {
    ...(assetResult.data.metadata ?? {}),
    ...generationResult.metadata,
    origin: 'ai_studio',
    media_type: 'video',
    model: generationResult.model,
    size: generationResult.size,
    openai: {
      video_id: generationResult.videoId,
      status: generationResult.providerStatus,
      progress: generationResult.progress,
      seconds: generationResult.seconds,
    },
    saved_to_creative_assets: true,
  };

  const savedResult = await updateCreativeAsset(
    assetResult.data.id,
    {
      workspaceId: workspace.id,
      userId: user.id,
      status: generationResult.providerStatus === 'failed' ? 'failed' : 'generating',
      model: generationResult.model,
      size: generationResult.size,
      metadata,
    },
    supabase
  );

  revalidateAIStudio();

  await incrementUsage(workspace.id, 'ai_generations', 1, user.id).catch(() => {});

  if (savedResult.error || !savedResult.data) {
    return { error: savedResult.error ?? 'Video job could not be saved.' };
  }

  return {
    error: null,
    message: 'Video generation started. Refresh the status from AI Studio history.',
    asset: assetToView(savedResult.data),
  };
}

export async function refreshAIStudioVideoAction(assetId: string): Promise<AIStudioGenerateResult> {
  const { supabase, user, workspace } = await getWorkspaceContext();
  const assetResult = await getCreativeAssetById(workspace.id, user.id, assetId, supabase);

  if (assetResult.error || !assetResult.data) {
    return { error: assetResult.error ?? 'Video asset was not found.' };
  }

  const metadata = metadataObject(assetResult.data.metadata);
  const openai = metadataObject(metadata.openai);
  const videoId = readString(openai.video_id);

  if (!videoId) {
    return { error: 'This asset does not have an OpenAI video job id.' };
  }

  const statusResult = await getOpenAIVideoStatus(videoId);

  if (statusResult.status === 'setup_required') {
    return { error: statusResult.error, setupRequired: true };
  }

  if (statusResult.status === 'failed') {
    await markCreativeAssetFailed(assetId, statusResult.error, supabase);
    revalidateAIStudio();
    return { error: statusResult.error };
  }

  const nextMetadata: JsonObject = {
    ...metadata,
    ...statusResult.metadata,
    origin: 'ai_studio',
    media_type: 'video',
    model: statusResult.model,
    openai: {
      ...openai,
      video_id: videoId,
      status: statusResult.providerStatus,
      progress: statusResult.progress,
      refreshed_at: new Date().toISOString(),
    },
  };

  if (statusResult.providerStatus === 'completed' && !metadataObject(metadata.video).public_url) {
    const downloadResult = await downloadOpenAIVideoContent(videoId);

    if (downloadResult.buffer) {
      const uploadResult = await uploadCreativeAssetVideo({
        client: supabase,
        workspaceId: workspace.id,
        assetId,
        fileBuffer: downloadResult.buffer,
        contentType: downloadResult.contentType ?? 'video/mp4',
      });

      if (!uploadResult.error) {
        nextMetadata.video = {
          storage_path: uploadResult.storagePath,
          public_url: uploadResult.publicUrl,
          mime_type: downloadResult.contentType ?? 'video/mp4',
          saved_at: new Date().toISOString(),
        };
      }
    }
  }

  const savedResult = await updateCreativeAsset(
    assetId,
    {
      workspaceId: workspace.id,
      userId: user.id,
      status: statusResult.providerStatus === 'completed' ? 'generated' : 'generating',
      model: statusResult.model,
      metadata: nextMetadata,
    },
    supabase
  );

  revalidateAIStudio();

  if (savedResult.error || !savedResult.data) {
    return { error: savedResult.error ?? 'Could not refresh video status.' };
  }

  return {
    error: null,
    message:
      statusResult.providerStatus === 'completed'
        ? 'Video is complete and saved to Creative Assets.'
        : 'Video status refreshed.',
    asset: assetToView(savedResult.data),
  };
}

export async function getAIStudioHistory(limit = 18) {
  const { supabase, user, workspace } = await getWorkspaceContext('/dashboard/ai-studio', false);
  const result = await listCreativeAssetsForWorkspace(workspace.id, user.id, supabase);

  if (result.error) {
    return { assets: [], error: result.error };
  }

  const assets = result.data
    .filter((asset) => metadataObject(asset.metadata).origin === 'ai_studio')
    .slice(0, limit)
    .map(assetToView);

  return { assets, error: null };
}
