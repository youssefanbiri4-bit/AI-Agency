'use server';

import { checkOpenAIImageReadiness } from '@/lib/ai/openai-images';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { checkCreativeAssetsStorageReadiness } from '@/lib/storage/creative-assets';
import type { AIImageGenerationReadinessState } from './_shared';

export async function getAIImageGenerationReadinessAction(): Promise<AIImageGenerationReadinessState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      openAIKeyStatus: 'missing',
      generationStatus: 'disabled',
      storageStatus: 'required',
      message: 'Sign in to check image generation readiness.',
      storageMessage: 'creative-assets bucket status could not be checked.',
    };
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const readiness = checkOpenAIImageReadiness();

  if (!workspaceResult.data) {
    return {
      openAIKeyStatus: readiness.isReady ? 'configured' : 'missing',
      generationStatus: readiness.isReady ? 'ready' : 'disabled',
      storageStatus: 'required',
      message: readiness.message,
      storageMessage: 'creative-assets bucket status could not be checked.',
    };
  }

  const storageReadiness = await checkCreativeAssetsStorageReadiness(
    supabase,
    workspaceResult.data.id
  );

  return {
    openAIKeyStatus: readiness.isReady ? 'configured' : 'missing',
    generationStatus: readiness.isReady ? 'ready' : 'disabled',
    storageStatus: storageReadiness.isConfigured ? 'configured' : 'required',
    message: readiness.message,
    storageMessage: storageReadiness.message,
  };
}
