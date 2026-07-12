'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  buildBrandKitGenerationContext,
  getBrandKitForWorkspace,
} from '@/lib/data/brand-kit';
import { createNotification } from '@/lib/data/notifications';
import {
  archiveCreativeAsset,
  createCreativeAsset,
  deleteCreativeAsset,
  getCreativeAssetById,
  markCreativeAssetFailed,
  markCreativeAssetGenerated,
  markCreativeAssetGenerating,
  markCreativeAssetPromptReady,
  unlinkCreativeAssetFromContentStudioItems,
  updateCreativeAsset,
  type CreateCreativeAssetInput,
  type UpdateCreativeAssetInput,
} from '@/lib/data/creative-assets';
import {
  buildImagePromptFromCreativeBrief,
  checkOpenAIImageReadiness,
  generateImageWithOpenAI,
} from '@/lib/ai/openai-images';
import {
  deleteCreativeAssetStorageObject,
  uploadCreativeAssetImage,
} from '@/lib/storage/creative-assets';
import type { JsonObject } from '@/types';
import type {
  CreativeAssetAspectRatio,
  CreativeAssetOutputStyle,
  CreativeAssetPlatform,
  CreativeAssetRecord,
  CreativeAssetType,
  NotificationType,
} from '@/types/database';

export interface CreativeAssetActionState {
  error: string | null;
  message?: string | null;
  warning?: string | null;
  asset?: CreativeAssetRecord | null;
  setupRequired?: boolean;
}

const assetTypes: CreativeAssetType[] = [
  'image',
  'video',
  'reel_cover',
  'reel_video',
  'ad_creative',
  'thumbnail',
  'campaign_visual',
  'carousel_slide',
  'story_visual',
];

const platforms: CreativeAssetPlatform[] = [
  'instagram',
  'facebook',
  'google_ads',
  'pinterest',
  'general',
];

const aspectRatios: CreativeAssetAspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
const outputStyles: CreativeAssetOutputStyle[] = [
  'premium_saas',
  'realistic',
  'minimal',
  'bold_ad',
  'clean_corporate',
  'luxury',
];
const uploadContentTypes = ['image/png', 'image/jpeg', 'image/webp'];
const uploadVideoContentTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function emptyToNull(value: string) {
  return value.length > 0 ? value : null;
}

function readAssetType(formData: FormData): CreativeAssetType {
  const value = readField(formData, 'asset_type') as CreativeAssetType;
  return assetTypes.includes(value) ? value : 'ad_creative';
}

function readPlatform(formData: FormData): CreativeAssetPlatform {
  const value = readField(formData, 'platform') as CreativeAssetPlatform;
  return platforms.includes(value) ? value : 'general';
}

function readAspectRatio(formData: FormData): CreativeAssetAspectRatio | null {
  const value = readField(formData, 'aspect_ratio') as CreativeAssetAspectRatio;
  return aspectRatios.includes(value) ? value : null;
}

function readOutputStyle(formData: FormData): CreativeAssetOutputStyle | null {
  const value = readField(formData, 'output_style') as CreativeAssetOutputStyle;
  return outputStyles.includes(value) ? value : null;
}

function readGenerationMode(formData: FormData) {
  return readField(formData, 'generation_mode') === 'generate_image'
    ? 'generate_image'
    : 'prompt_only';
}

function readIntent(formData: FormData) {
  const intent = readField(formData, 'intent');

  if (
    intent === 'update_asset' ||
    intent === 'generate_prompt' ||
    intent === 'generate_image' ||
    intent === 'save_to_assets'
  ) {
    return intent;
  }

  return 'save_draft';
}

function validateCreativeAssetForm(formData: FormData) {
  const title = readField(formData, 'title');

  if (title.length < 3) {
    return { error: 'Creative asset title must be at least 3 characters.' };
  }

  if (title.length > 200) {
    return { error: 'Creative asset title must be 200 characters or fewer.' };
  }

  return { error: null };
}

function readUploadedImageFields(formData: FormData, workspaceId: string, userId: string) {
  const storagePath = emptyToNull(readField(formData, 'uploaded_storage_path'));
  const imageUrl = emptyToNull(readField(formData, 'uploaded_image_url'));
  const filename = emptyToNull(readField(formData, 'uploaded_filename'));
  const contentType = emptyToNull(readField(formData, 'uploaded_content_type'));
  const rawSizeBytes = readField(formData, 'uploaded_size_bytes');
  const sizeBytes = Number.parseInt(rawSizeBytes, 10);

  if (!storagePath) {
    return { error: null, upload: null };
  }

  if (!storagePath.startsWith(`${workspaceId}/${userId}/`)) {
    return {
      error: 'Uploaded image does not belong to the active workspace.',
      upload: null,
    };
  }

  if (!/\.(png|jpe?g|webp)$/i.test(storagePath)) {
    return { error: 'Unsupported file type', upload: null };
  }

  if (contentType && !uploadContentTypes.includes(contentType)) {
    return { error: 'Unsupported file type', upload: null };
  }

  return {
    error: null,
    upload: {
      storagePath,
      imageUrl,
      filename,
      contentType,
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
    },
  };
}

function readUploadedVideoFields(formData: FormData, workspaceId: string, userId: string) {
  const storagePath = emptyToNull(readField(formData, 'uploaded_video_storage_path'));
  const publicUrl = emptyToNull(readField(formData, 'uploaded_video_public_url'));
  const filename = emptyToNull(readField(formData, 'uploaded_video_filename'));
  const contentType = emptyToNull(readField(formData, 'uploaded_video_content_type'));
  const rawSizeBytes = readField(formData, 'uploaded_video_size_bytes');
  const rawDuration = readField(formData, 'uploaded_video_duration');
  const sizeBytes = Number.parseInt(rawSizeBytes, 10);
  const duration = Number.parseFloat(rawDuration);

  if (!storagePath) {
    return { error: null, upload: null };
  }

  if (!storagePath.startsWith(`${workspaceId}/${userId}/videos/`)) {
    return {
      error: 'Uploaded video does not belong to the active workspace.',
      upload: null,
    };
  }

  if (!/\.(mp4|mov|webm)$/i.test(storagePath)) {
    return { error: 'Unsupported video type.', upload: null };
  }

  if (contentType && !uploadVideoContentTypes.includes(contentType)) {
    return { error: 'Unsupported video type.', upload: null };
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_VIDEO_UPLOAD_BYTES) {
    return { error: 'Video is too large.', upload: null };
  }

  if (!publicUrl || !publicUrl.startsWith('https://')) {
    return { error: 'Video URL must be public HTTPS.', upload: null };
  }

  return {
    error: null,
    upload: {
      storagePath,
      publicUrl,
      filename,
      contentType,
      sizeBytes,
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    },
  };
}

function buildPromptInputFromFields(
  input: CreateCreativeAssetInput | CreativeAssetRecord,
  brandKitContext?: string | null
) {
  const combinedNotes = [input.notes, brandKitContext ? `Brand Kit context:\n${brandKitContext}` : null]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: input.title,
    asset_type: input.asset_type,
    platform: input.platform ?? 'general',
    goal: input.goal,
    offer: input.offer,
    target_audience: input.target_audience,
    market: input.market,
    tone: input.tone,
    style: input.style,
    visual_direction: input.visual_direction,
    text_overlay: input.text_overlay,
    brand_colors: input.brand_colors,
    notes: combinedNotes || input.notes,
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    aspect_ratio: input.aspect_ratio,
    output_style: input.output_style,
  };
}

function buildCreateInput({
  formData,
  workspaceId,
  userId,
}: {
  formData: FormData;
  workspaceId: string;
  userId: string;
}): CreateCreativeAssetInput {
  return {
    workspaceId,
    userId,
    title: readField(formData, 'title'),
    asset_type: readAssetType(formData),
    platform: readPlatform(formData),
    goal: emptyToNull(readField(formData, 'goal')),
    offer: emptyToNull(readField(formData, 'offer')),
    target_audience: emptyToNull(readField(formData, 'target_audience')),
    market: emptyToNull(readField(formData, 'market')),
    tone: emptyToNull(readField(formData, 'tone')),
    style: emptyToNull(readField(formData, 'style')),
    visual_direction: emptyToNull(readField(formData, 'visual_direction')),
    text_overlay: emptyToNull(readField(formData, 'text_overlay')),
    brand_colors: emptyToNull(readField(formData, 'brand_colors')),
    notes: emptyToNull(readField(formData, 'notes')),
    prompt: emptyToNull(readField(formData, 'prompt')),
    negative_prompt: emptyToNull(readField(formData, 'negative_prompt')),
    aspect_ratio: readAspectRatio(formData),
    output_style: readOutputStyle(formData),
    metadata: {
      generation_mode: readGenerationMode(formData),
      can_use_as_reel_cover_later: true,
      can_use_as_campaign_creative_later: true,
    },
  };
}

function buildUpdateInput({
  formData,
  workspaceId,
  userId,
}: {
  formData: FormData;
  workspaceId: string;
  userId: string;
}): UpdateCreativeAssetInput {
  return {
    workspaceId,
    userId,
    title: readField(formData, 'title'),
    asset_type: readAssetType(formData),
    platform: readPlatform(formData),
    goal: emptyToNull(readField(formData, 'goal')),
    offer: emptyToNull(readField(formData, 'offer')),
    target_audience: emptyToNull(readField(formData, 'target_audience')),
    market: emptyToNull(readField(formData, 'market')),
    tone: emptyToNull(readField(formData, 'tone')),
    style: emptyToNull(readField(formData, 'style')),
    visual_direction: emptyToNull(readField(formData, 'visual_direction')),
    text_overlay: emptyToNull(readField(formData, 'text_overlay')),
    brand_colors: emptyToNull(readField(formData, 'brand_colors')),
    notes: emptyToNull(readField(formData, 'notes')),
    prompt: emptyToNull(readField(formData, 'prompt')),
    negative_prompt: emptyToNull(readField(formData, 'negative_prompt')),
    aspect_ratio: readAspectRatio(formData),
    output_style: readOutputStyle(formData),
    metadata: {
      generation_mode: readGenerationMode(formData),
      can_use_as_reel_cover_later: true,
      can_use_as_campaign_creative_later: true,
    },
  };
}

async function getCurrentWorkspaceContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    throw new Error('Workspace not found');
  }

  const membershipResult = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  const role = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  if (membershipResult.error || !membershipResult.data) {
    throw new Error('ما عندكش صلاحية لهذه المساحة. Workspace membership is required.');
  }

  return {
    supabase,
    user,
    workspace: workspaceResult.data,
    role,
  };
}

function assertCanEditAssets(role: StrictWorkspaceRole) {
  if (!hasPermission(role, 'editor')) {
    throw new Error('ما عندكش صلاحية لتعديل الأصول الإبداعية. Creative asset editing is restricted for your workspace role.');
  }
}

function assertCanGenerateAssets(role: StrictWorkspaceRole) {
  if (!hasPermission(role, 'editor')) {
    throw new Error('ما عندكش صلاحية لاستعمال توليد الذكاء الاصطناعي. AI generation is restricted for your workspace role.');
  }
}

async function assertCreativeGenerationLimit(workspaceId: string, userId: string) {
  const limiter = await checkRateLimit({
    key: `creative-generation:${workspaceId}:${userId}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limiter.allowed) {
    throw new Error('وصلتي للحد المؤقت لتوليد الأصول الإبداعية. عاود المحاولة بعد شوية.');
  }
}

function assertCanDeleteAssets(role: StrictWorkspaceRole) {
  if (!hasPermission(role, 'admin')) {
    throw new Error('ما عندكش صلاحية لحذف الأصول الإبداعية. Deleting creative assets is restricted to workspace owners and admins.');
  }
}

async function createCreativeAssetNotification({
  workspaceId,
  userId,
  type,
  title,
  message,
  assetId,
  supabase,
}: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  assetId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  try {
    await createNotification(
      {
        workspaceId,
        userId,
        type,
        title,
        message,
        metadata: {
          creativeAssetId: assetId,
        },
      },
      supabase
    );
  } catch {
    // Notifications are best-effort and must not block creative workflows.
  }
}

function revalidateCreativeAssetPaths(assetId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/creative-assets');
  revalidatePath('/dashboard/content-studio');

  if (assetId) {
    revalidatePath(`/dashboard/creative-assets/${assetId}`);
  }
}

async function loadOwnedAsset(assetId: string) {
  const { supabase, user, workspace, role } = await getCurrentWorkspaceContext();
  const assetResult = await getCreativeAssetById(workspace.id, user.id, assetId, supabase);

  if (!assetResult.data) {
    throw new Error('You do not have permission to edit this asset.');
  }

  return {
    supabase,
    user,
    workspace,
    role,
    asset: assetResult.data,
  };
}

async function generatePromptForAsset(
  asset: CreativeAssetRecord,
  brandKitContext?: string | null
) {
  return buildImagePromptFromCreativeBrief(buildPromptInputFromFields(asset, brandKitContext));
}

async function generateImageForAsset(assetId: string): Promise<CreativeAssetActionState> {
  const { supabase, user, workspace, role, asset } = await loadOwnedAsset(assetId);
  assertCanGenerateAssets(role);
  await assertCreativeGenerationLimit(workspace.id, user.id);
  const readiness = checkOpenAIImageReadiness();

  if (!readiness.isReady) {
    return {
      error: readiness.message,
      asset,
      setupRequired: true,
    };
  }

  let prompt = asset.prompt?.trim() || '';
  let negativePrompt = asset.negative_prompt?.trim() || '';

  if (!prompt) {
    const brandKitResult = await getBrandKitForWorkspace(supabase, workspace.id);
    const builtPrompt = await generatePromptForAsset(
      asset,
      buildBrandKitGenerationContext(brandKitResult.data.brandKit)
    );
    prompt = builtPrompt.prompt;
    negativePrompt = builtPrompt.negativePrompt;

    await markCreativeAssetPromptReady(asset.id, prompt, negativePrompt, supabase);
  }

  const generatingResult = await markCreativeAssetGenerating(asset.id, supabase);

  if (generatingResult.error) {
    return { error: generatingResult.error, asset };
  }

  const generationResult = await generateImageWithOpenAI({
    prompt,
    negativePrompt,
    aspectRatio: asset.aspect_ratio,
    userId: user.id,
  });

  if (generationResult.status === 'setup_required') {
    return {
      error: generationResult.error,
      asset,
      setupRequired: true,
    };
  }

  if (generationResult.status === 'failed') {
    const failedResult = await markCreativeAssetFailed(
      asset.id,
      generationResult.error,
      supabase
    );

    await createCreativeAssetNotification({
      workspaceId: workspace.id,
      userId: user.id,
      assetId: asset.id,
      type: 'creative_image_failed',
      title: 'Creative Image Failed',
      message: `Image generation failed for "${asset.title}".`,
      supabase,
    });

    revalidateCreativeAssetPaths(asset.id);
    return { error: generationResult.error, asset: failedResult.data || asset };
  }

  let imageUrl = generationResult.imageUrl;
  let storagePath: string | null = null;

  if (generationResult.b64Json) {
    const uploadResult = await uploadCreativeAssetImage({
      client: supabase,
      workspaceId: workspace.id,
      assetId: asset.id,
      base64Data: generationResult.b64Json,
      contentType: generationResult.contentType,
    });

    if (uploadResult.error || !uploadResult.storagePath) {
      const safeError =
        'Supabase Storage creative-assets bucket setup is required before generated image data can be saved.';
      const failedResult = await markCreativeAssetFailed(asset.id, safeError, supabase);

      await createCreativeAssetNotification({
        workspaceId: workspace.id,
        userId: user.id,
        assetId: asset.id,
        type: 'creative_image_failed',
        title: 'Creative Image Failed',
        message: `Image generation failed for "${asset.title}".`,
        supabase,
      });

      revalidateCreativeAssetPaths(asset.id);
      return { error: safeError, asset: failedResult.data || asset };
    }

    imageUrl = uploadResult.imageUrl;
    storagePath = uploadResult.storagePath;
  }

  if (!imageUrl && !storagePath) {
    const safeError = 'OpenAI generated an image, but no storable image URL was available.';
    const failedResult = await markCreativeAssetFailed(asset.id, safeError, supabase);

    revalidateCreativeAssetPaths(asset.id);
    return { error: safeError, asset: failedResult.data || asset };
  }

  const metadata: JsonObject = {
    ...(asset.metadata ?? {}),
    ...generationResult.metadata,
    model: generationResult.model,
    size: generationResult.size,
    quality: generationResult.quality,
    generated_at: new Date().toISOString(),
  };

  if (generationResult.revisedPrompt) {
    metadata.revised_prompt = generationResult.revisedPrompt;
  }

  const generatedResult = await markCreativeAssetGenerated(
    asset.id,
    imageUrl,
    storagePath,
    metadata,
    supabase
  );

  await createCreativeAssetNotification({
    workspaceId: workspace.id,
    userId: user.id,
    assetId: asset.id,
    type: 'creative_image_generated',
    title: 'Creative Image Generated',
    message: `Image generated for "${asset.title}".`,
    supabase,
  });

  revalidateCreativeAssetPaths(asset.id);

  return {
    error: null,
    message: 'Image generated and saved to Creative Assets.',
    asset: generatedResult.data || asset,
  };
}

export async function createCreativeAssetAction(
  _state: CreativeAssetActionState,
  formData: FormData
): Promise<CreativeAssetActionState> {
  try {
    const validation = validateCreativeAssetForm(formData);

    if (validation.error) {
      return { error: validation.error };
    }

    const { supabase, user, workspace, role } = await getCurrentWorkspaceContext();
    assertCanEditAssets(role);
    const uploadedImage = readUploadedImageFields(formData, workspace.id, user.id);
    const uploadedVideo = readUploadedVideoFields(formData, workspace.id, user.id);

    if (uploadedImage.error) {
      return { error: uploadedImage.error };
    }

    if (uploadedVideo.error) {
      return { error: uploadedVideo.error };
    }

    const intent = readIntent(formData);
    const input = buildCreateInput({
      formData,
      workspaceId: workspace.id,
      userId: user.id,
    });

    if (intent === 'generate_prompt' || (intent === 'generate_image' && !uploadedImage.upload)) {
      const builtPrompt = buildImagePromptFromCreativeBrief(buildPromptInputFromFields(input));
      input.prompt = builtPrompt.prompt;
      input.negative_prompt = builtPrompt.negativePrompt;
      input.status = 'prompt_ready';
      input.source = 'prompt_only';
    }

    if (uploadedImage.upload) {
      input.status = 'generated';
      input.source = 'upload';
      input.image_url = uploadedImage.upload.imageUrl;
      input.storage_path = uploadedImage.upload.storagePath;
      input.metadata = {
        ...(input.metadata ?? {}),
        upload_kind: 'manual_image_upload',
        uploaded_at: new Date().toISOString(),
        original_filename: uploadedImage.upload.filename,
        upload_content_type: uploadedImage.upload.contentType,
        upload_size_bytes: uploadedImage.upload.sizeBytes,
      };
    }

    if (uploadedVideo.upload) {
      input.status = 'generated';
      input.source = 'upload';
      input.asset_type = input.asset_type === 'reel_cover' ? 'reel_video' : input.asset_type;
      input.storage_path = uploadedVideo.upload.storagePath;
      input.metadata = {
        ...(input.metadata ?? {}),
        upload_kind: 'manual_video_upload',
        media_type: 'video',
        uploaded_at: new Date().toISOString(),
        video: {
          storage_path: uploadedVideo.upload.storagePath,
          public_url: uploadedVideo.upload.publicUrl,
          mime_type: uploadedVideo.upload.contentType,
          size: uploadedVideo.upload.sizeBytes,
          duration: uploadedVideo.upload.duration,
          original_filename: uploadedVideo.upload.filename,
        },
      };
    }

    const result = await createCreativeAsset(input, supabase);

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to create creative asset.' };
    }

    const savedAsset = result.data;

    await createCreativeAssetNotification({
      workspaceId: workspace.id,
      userId: user.id,
      assetId: savedAsset.id,
      type: 'creative_asset_created',
      title: 'Creative Asset Created',
      message: `Creative asset "${savedAsset.title}" was created.`,
      supabase,
    });

    if (intent === 'generate_prompt' || intent === 'generate_image') {
      await createCreativeAssetNotification({
        workspaceId: workspace.id,
        userId: user.id,
        assetId: savedAsset.id,
        type: 'creative_prompt_ready',
        title: 'Creative Prompt Ready',
        message: `Prompt generated for "${savedAsset.title}".`,
        supabase,
      });
    }

    if (intent === 'generate_image' && !uploadedImage.upload) {
      const imageResult = await generateImageForAsset(savedAsset.id);
      return imageResult.asset
        ? imageResult
        : {
            ...imageResult,
            asset: savedAsset,
          };
    }

    revalidateCreativeAssetPaths(savedAsset.id);
    return {
      error: null,
      message:
        uploadedImage.upload
          ? 'Image uploaded successfully'
          : uploadedVideo.upload
          ? 'Video uploaded successfully.'
          : intent === 'generate_prompt'
          ? 'Creative asset saved and prompt generated.'
          : 'Creative asset draft saved.',
      asset: savedAsset,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to create creative asset.',
    };
  }
}

export async function updateCreativeAssetAction(
  assetId: string,
  _state: CreativeAssetActionState,
  formData: FormData
): Promise<CreativeAssetActionState> {
  try {
    const validation = validateCreativeAssetForm(formData);

    if (validation.error) {
      return { error: validation.error };
    }

    const { supabase, user, workspace, role, asset } = await loadOwnedAsset(assetId);
    assertCanEditAssets(role);
    const uploadedImage = readUploadedImageFields(formData, workspace.id, user.id);
    const uploadedVideo = readUploadedVideoFields(formData, workspace.id, user.id);

    if (uploadedImage.error) {
      return { error: uploadedImage.error, asset };
    }

    if (uploadedVideo.error) {
      return { error: uploadedVideo.error, asset };
    }

    const intent = readIntent(formData);
    const input = buildUpdateInput({
      formData,
      workspaceId: workspace.id,
      userId: user.id,
    });
    input.metadata = {
      ...(asset.metadata ?? {}),
      generation_mode: readGenerationMode(formData),
      can_use_as_reel_cover_later: true,
      can_use_as_campaign_creative_later: true,
    };

    if (intent === 'generate_prompt' || (intent === 'generate_image' && !uploadedImage.upload)) {
      const builtPrompt = buildImagePromptFromCreativeBrief({
        title: input.title ?? asset.title,
        asset_type: input.asset_type ?? asset.asset_type,
        platform: input.platform ?? asset.platform,
        goal: input.goal ?? asset.goal,
        offer: input.offer ?? asset.offer,
        target_audience: input.target_audience ?? asset.target_audience,
        market: input.market ?? asset.market,
        tone: input.tone ?? asset.tone,
        style: input.style ?? asset.style,
        visual_direction: input.visual_direction ?? asset.visual_direction,
        text_overlay: input.text_overlay ?? asset.text_overlay,
        brand_colors: input.brand_colors ?? asset.brand_colors,
        notes: input.notes ?? asset.notes,
        prompt: input.prompt ?? asset.prompt,
        negative_prompt: input.negative_prompt ?? asset.negative_prompt,
        aspect_ratio: input.aspect_ratio ?? asset.aspect_ratio,
        output_style: input.output_style ?? asset.output_style,
      });
      input.prompt = builtPrompt.prompt;
      input.negative_prompt = builtPrompt.negativePrompt;
      input.status = 'prompt_ready';
      input.source = 'prompt_only';
      input.error_message = null;
    }

    if (uploadedImage.upload) {
      input.status = 'generated';
      input.source = 'upload';
      input.image_url = uploadedImage.upload.imageUrl;
      input.storage_path = uploadedImage.upload.storagePath;
      input.error_message = null;
      input.metadata = {
        ...(asset.metadata ?? {}),
        ...(input.metadata ?? {}),
        upload_kind: 'manual_image_upload',
        uploaded_at: new Date().toISOString(),
        original_filename: uploadedImage.upload.filename,
        upload_content_type: uploadedImage.upload.contentType,
        upload_size_bytes: uploadedImage.upload.sizeBytes,
      };
    }

    if (uploadedVideo.upload) {
      input.status = 'generated';
      input.source = 'upload';
      input.asset_type = input.asset_type === 'reel_cover' ? 'reel_video' : input.asset_type;
      input.storage_path = uploadedVideo.upload.storagePath;
      input.error_message = null;
      input.metadata = {
        ...(asset.metadata ?? {}),
        ...(input.metadata ?? {}),
        upload_kind: 'manual_video_upload',
        media_type: 'video',
        uploaded_at: new Date().toISOString(),
        video: {
          storage_path: uploadedVideo.upload.storagePath,
          public_url: uploadedVideo.upload.publicUrl,
          mime_type: uploadedVideo.upload.contentType,
          size: uploadedVideo.upload.sizeBytes,
          duration: uploadedVideo.upload.duration,
          original_filename: uploadedVideo.upload.filename,
        },
      };
    }

    const result = await updateCreativeAsset(assetId, input, supabase);

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to update creative asset.' };
    }

    const savedAsset = result.data;

    if (intent === 'generate_prompt' || intent === 'generate_image') {
      await createCreativeAssetNotification({
        workspaceId: workspace.id,
        userId: user.id,
        assetId,
        type: 'creative_prompt_ready',
        title: 'Creative Prompt Ready',
        message: `Prompt generated for "${savedAsset.title}".`,
        supabase,
      });
    }

    if (intent === 'generate_image' && !uploadedImage.upload) {
      return generateImageForAsset(assetId);
    }

    revalidateCreativeAssetPaths(assetId);
    return {
      error: null,
      message:
        uploadedImage.upload
          ? 'Asset updated successfully.'
          : uploadedVideo.upload
          ? 'Asset updated successfully.'
          : intent === 'generate_prompt'
          ? 'Prompt regenerated.'
          : 'Asset updated successfully.',
      asset: savedAsset,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message === 'You do not have permission to edit this asset.'
            ? error.message
            : 'Could not update asset.'
          : 'Could not update asset.',
    };
  }
}

function resolveActionAssetId(assetIdOrFormData: string | FormData) {
  if (typeof assetIdOrFormData === 'string') {
    return assetIdOrFormData;
  }

  return readField(assetIdOrFormData, 'assetId');
}

export async function generatePromptAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    const { supabase, user, workspace, role, asset } = await loadOwnedAsset(assetId);
    assertCanGenerateAssets(role);
    const builtPrompt = await generatePromptForAsset(asset);
    const result = await markCreativeAssetPromptReady(
      asset.id,
      builtPrompt.prompt,
      builtPrompt.negativePrompt,
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to generate prompt.', asset };
    }

    await createCreativeAssetNotification({
      workspaceId: workspace.id,
      userId: user.id,
      assetId: asset.id,
      type: 'creative_prompt_ready',
      title: 'Creative Prompt Ready',
      message: `Prompt generated for "${asset.title}".`,
      supabase,
    });

    revalidateCreativeAssetPaths(asset.id);
    return { error: null, message: 'Prompt generated.', asset: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate prompt.',
    };
  }
}

export async function generateImageAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    return await generateImageForAsset(assetId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate image.',
    };
  }
}

export async function archiveCreativeAssetAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    const { supabase, role, asset } = await loadOwnedAsset(assetId);
    assertCanEditAssets(role);
    const result = await archiveCreativeAsset(asset.id, supabase);

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to archive creative asset.', asset };
    }

    revalidateCreativeAssetPaths(asset.id);
    return { error: null, message: 'Creative asset archived.', asset: result.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to archive creative asset.',
    };
  }
}

export async function removeCreativeAssetImageAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    const { supabase, workspace, user, role, asset } = await loadOwnedAsset(assetId);
    assertCanEditAssets(role);
    const oldStoragePath = asset.storage_path;
    const result = await updateCreativeAsset(
      asset.id,
      {
        workspaceId: workspace.id,
        userId: user.id,
        image_url: null,
        storage_path: null,
        metadata: {
          ...(asset.metadata ?? {}),
          image_removed_at: new Date().toISOString(),
        },
      },
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Could not remove image from asset.', asset };
    }

    const storageResult = await deleteCreativeAssetStorageObject(supabase, oldStoragePath);
    revalidateCreativeAssetPaths(asset.id);

    return {
      error: null,
      message: storageResult.error
        ? 'Image removed from asset, but the uploaded file could not be removed from storage.'
        : 'Image removed from asset.',
      warning: storageResult.error
        ? 'Asset updated, but the uploaded file could not be removed from storage.'
        : null,
      asset: result.data,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not remove image from asset.',
    };
  }
}

export async function deleteCreativeAssetAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    const { supabase, workspace, user, role, asset } = await loadOwnedAsset(assetId);
    assertCanDeleteAssets(role);
    const unlinkResult = await unlinkCreativeAssetFromContentStudioItems(
      asset.id,
      workspace.id,
      supabase
    );

    if (unlinkResult.error) {
      return { error: unlinkResult.error, asset };
    }

    const deleteResult = await deleteCreativeAsset(asset.id, workspace.id, user.id, supabase);

    if (deleteResult.error || !deleteResult.data) {
      return { error: deleteResult.error || 'Could not delete creative asset.', asset };
    }

    const storageResult = await deleteCreativeAssetStorageObject(supabase, asset.storage_path);
    revalidateCreativeAssetPaths(asset.id);

    return {
      error: null,
      message: storageResult.error
        ? 'Asset deleted, but the uploaded file could not be removed from storage.'
        : 'Creative asset deleted.',
      warning: storageResult.error
        ? 'Asset deleted, but the uploaded file could not be removed from storage.'
        : null,
      asset: null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete creative asset.',
    };
  }
}

export async function selectCreativeAssetAction(
  assetIdOrFormData: string | FormData
): Promise<CreativeAssetActionState> {
  try {
    const assetId = resolveActionAssetId(assetIdOrFormData);
    const { supabase, workspace, user, role, asset } = await loadOwnedAsset(assetId);
    assertCanEditAssets(role);
    const result = await updateCreativeAsset(
      asset.id,
      {
        workspaceId: workspace.id,
        userId: user.id,
        status: 'selected',
        error_message: null,
      },
      supabase
    );

    if (result.error || !result.data) {
      return { error: result.error || 'Failed to mark asset as selected.', asset };
    }

    revalidateCreativeAssetPaths(asset.id);
    return { error: null, message: 'Creative asset marked as selected.', asset: result.data };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to mark asset as selected.',
    };
  }
}
