import 'server-only';

import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const CREATIVE_ASSETS_BUCKET = 'creative-assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export interface CreativeAssetsStorageReadiness {
  isConfigured: boolean;
  status: 'configured' | 'not_detected';
  message: string;
}

export async function checkCreativeAssetsStorageReadiness(
  client: SupabaseClient<Database>,
  workspaceId: string
): Promise<CreativeAssetsStorageReadiness> {
  const { error } = await client.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .list(workspaceId, { limit: 1 });

  if (error) {
    return {
      isConfigured: false,
      status: 'not_detected',
      message:
        'creative-assets storage bucket was not detected for this workspace session.',
    };
  }

  return {
    isConfigured: true,
    status: 'configured',
    message: 'creative-assets storage bucket is reachable.',
  };
}

export async function createCreativeAssetSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string | null
) {
  if (!storagePath) {
    return { signedUrl: null, error: null };
  }

  const { data, error } = await client.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  return {
    signedUrl: data?.signedUrl ?? null,
    error: error?.message ?? null,
  };
}

export function createCreativeAssetPublicUrl(storagePath: string | null) {
  if (!storagePath || !supabaseUrl) {
    return null;
  }

  const encodedPath = storagePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${supabaseUrl}/storage/v1/object/public/${CREATIVE_ASSETS_BUCKET}/${encodedPath}`;
}

export async function uploadCreativeAssetImage({
  client,
  workspaceId,
  assetId,
  base64Data,
  contentType = 'image/png',
}: {
  client: SupabaseClient<Database>;
  workspaceId: string;
  assetId: string;
  base64Data: string;
  contentType?: string;
}) {
  const extension =
    contentType === 'image/jpeg'
      ? 'jpg'
      : contentType === 'image/webp'
        ? 'webp'
        : 'png';
  const storagePath = `${workspaceId}/${assetId}/generated-${Date.now()}.${extension}`;
  const fileBuffer = Buffer.from(base64Data, 'base64');

  const { error } = await client.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .upload(storagePath, fileBuffer, {
      cacheControl: '31536000',
      contentType,
      upsert: true,
    });

  if (error) {
    return {
      imageUrl: null,
      storagePath: null,
      error: error.message,
    };
  }

  const signedUrlResult = await createCreativeAssetSignedUrl(client, storagePath);

  return {
    imageUrl: signedUrlResult.signedUrl,
    storagePath,
    error: signedUrlResult.error,
  };
}

export async function deleteCreativeAssetStorageObject(
  client: SupabaseClient<Database>,
  storagePath: string | null
) {
  if (!storagePath) {
    return { error: null };
  }

  const { error } = await client.storage
    .from(CREATIVE_ASSETS_BUCKET)
    .remove([storagePath]);

  return {
    error: error?.message ?? null,
  };
}
