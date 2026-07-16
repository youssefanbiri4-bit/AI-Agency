import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const REELS_BUCKET = 'reels'; // or reuse creative-assets if preferred
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export interface ReelsStorageReadiness {
  isConfigured: boolean;
  status: 'configured' | 'not_detected';
  message: string;
}

export async function checkReelsStorageReadiness(
  client: SupabaseClient<Database>,
  workspaceId: string
): Promise<ReelsStorageReadiness> {
  const { error } = await client.storage
    .from(REELS_BUCKET)
    .list(workspaceId, { limit: 1 });

  if (error) {
    return {
      isConfigured: false,
      status: 'not_detected',
      message:
        'reels storage bucket was not detected for this workspace session.',
    };
  }

  return {
    isConfigured: true,
    status: 'configured',
    message: 'Reels storage bucket is ready.',
  };
}

export async function uploadReelVideo(
  client: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  file: File | Buffer,
  filename: string
) {
  const path = `${workspaceId}/${userId}/${Date.now()}-${filename}`;
  const { error } = await client.storage
    .from(REELS_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file instanceof File ? file.type : 'video/mp4',
      upsert: false,
    });

  if (error) throw error;

  return { path, publicUrl: await createReelSignedUrl(client, path) };
}

export async function uploadReelCover(
  client: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  file: File | Buffer,
  filename: string
) {
  const path = `${workspaceId}/${userId}/${Date.now()}-${filename}`;
  const { error } = await client.storage
    .from(REELS_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file instanceof File ? file.type : 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  return { path, publicUrl: await createReelSignedUrl(client, path) };
}

export async function createReelSignedUrl(
  client: SupabaseClient<Database>,
  path: string
): Promise<string> {
  const { data, error } = await client.storage
    .from(REELS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) throw error || new Error('Failed to create signed URL');
  return data.signedUrl;
}

export async function deleteReelStorageObject(
  client: SupabaseClient<Database>,
  path: string
) {
  const { error } = await client.storage.from(REELS_BUCKET).remove([path]);
  if (error) throw error;
}
