import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listCreativeAssetsForWorkspace } from '@/lib/data/creative-assets';
import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import { checkOpenAIVideoReadiness } from '@/lib/ai/openai-video';
import { AIStudioClient } from '@/components/ai-studio/AIStudioClient';
import type { AIStudioAssetView } from './actions';
import type { CreativeAssetRecord } from '@/types/database';

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
  const mode =
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

export default async function AIStudioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/ai-studio');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const [assetsResult, imageReadiness, videoReadiness] = await Promise.all([
    listCreativeAssetsForWorkspace(workspaceResult.data.id, user.id, supabase),
    Promise.resolve(checkOpenAIImageReadiness()),
    Promise.resolve(checkOpenAIVideoReadiness()),
  ]);

  const history = (assetsResult.data ?? [])
    .filter((asset) => metadataObject(asset.metadata).origin === 'ai_studio')
    .slice(0, 18)
    .map(assetToView);

  return (
    <AIStudioClient
      initialHistory={history}
      readiness={{
        image: {
          isReady: imageReadiness.isReady,
          message: imageReadiness.message,
          model: imageReadiness.model,
          quality: imageReadiness.quality,
        },
        video: {
          isReady: videoReadiness.isReady,
          message: videoReadiness.message,
          model: videoReadiness.model,
        },
      }}
    />
  );
}
