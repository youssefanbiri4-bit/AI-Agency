import 'server-only';

import { Buffer } from 'node:buffer';
import type { JsonObject } from '@/types';

const OPENAI_VIDEO_ENDPOINT = 'https://api.openai.com/v1/videos';
const DEFAULT_VIDEO_MODEL = 'sora-2';
const DEFAULT_VIDEO_SECONDS = 8;
const DEFAULT_VIDEO_SIZE = '1280x720';
const MAX_PROMPT_CHARS = 4000;

export type OpenAIVideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface OpenAIVideoReadiness {
  isReady: boolean;
  status: 'ready' | 'setup_required';
  message: string;
  model: string;
}

export interface CreateOpenAIVideoInput {
  prompt: string;
  model?: string | null;
  seconds?: number | null;
  size?: string | null;
  userId?: string;
}

export type CreateOpenAIVideoResult =
  | {
      status: 'setup_required';
      error: string;
      readiness: OpenAIVideoReadiness;
    }
  | {
      status: 'failed';
      error: string;
      model: string;
    }
  | {
      status: 'created';
      videoId: string;
      providerStatus: OpenAIVideoStatus;
      progress: number | null;
      model: string;
      seconds: number;
      size: string;
      metadata: JsonObject;
    };

export type GetOpenAIVideoResult =
  | {
      status: 'setup_required';
      error: string;
      readiness: OpenAIVideoReadiness;
    }
  | {
      status: 'failed';
      error: string;
      model: string;
    }
  | {
      status: 'found';
      videoId: string;
      providerStatus: OpenAIVideoStatus;
      progress: number | null;
      model: string;
      metadata: JsonObject;
    };

function readOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function getOpenAIVideoModel() {
  return process.env.OPENAI_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL;
}

export function checkOpenAIVideoReadiness(): OpenAIVideoReadiness {
  const model = getOpenAIVideoModel();

  if (!readOpenAIKey()) {
    return {
      isReady: false,
      status: 'setup_required',
      message:
        'Video generation setup required. Add OPENAI_API_KEY in Vercel to enable Sora video generation.',
      model,
    };
  }

  return {
    isReady: true,
    status: 'ready',
    message: 'OpenAI video generation is configured server-side.',
    model,
  };
}

export function normalizeOpenAIVideoSize(value?: string | null) {
  if (value === '720x1280' || value === '1280x720' || value === '1024x1024') {
    return value;
  }

  return process.env.OPENAI_VIDEO_SIZE?.trim() || DEFAULT_VIDEO_SIZE;
}

export function normalizeOpenAIVideoSeconds(value?: number | null) {
  if (value === 4 || value === 8 || value === 12) {
    return value;
  }

  return DEFAULT_VIDEO_SECONDS;
}

function normalizeProviderStatus(value: unknown): OpenAIVideoStatus {
  if (
    value === 'queued' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }

  return 'queued';
}

function safeProviderError(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object' &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  ) {
    return value.error.message.slice(0, 500);
  }

  return 'OpenAI video generation failed.';
}

function progressFromPayload(payload: Record<string, unknown> | null) {
  const progress = payload?.progress;
  return typeof progress === 'number' && Number.isFinite(progress) ? progress : null;
}

function metadataFromPayload(payload: Record<string, unknown> | null): JsonObject {
  return {
    provider: 'openai',
    provider_object: typeof payload?.object === 'string' ? payload.object : 'video',
    created_at_unix: typeof payload?.created_at === 'number' ? payload.created_at : null,
  };
}

export async function createVideoWithOpenAI(
  input: CreateOpenAIVideoInput
): Promise<CreateOpenAIVideoResult> {
  const readiness = checkOpenAIVideoReadiness();
  const apiKey = readOpenAIKey();
  const model = input.model?.trim() || readiness.model;
  const prompt = input.prompt.trim().slice(0, MAX_PROMPT_CHARS);
  const seconds = normalizeOpenAIVideoSeconds(input.seconds);
  const size = normalizeOpenAIVideoSize(input.size);

  if (!readiness.isReady || !apiKey) {
    return { status: 'setup_required', error: readiness.message, readiness };
  }

  if (prompt.length < 10) {
    return { status: 'failed', error: 'A detailed video prompt is required.', model };
  }

  try {
    const response = await fetch(OPENAI_VIDEO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        seconds,
        size,
        ...(input.userId ? { user: input.userId } : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      return { status: 'failed', error: safeProviderError(payload), model };
    }

    const videoId = typeof payload?.id === 'string' ? payload.id : null;

    if (!videoId) {
      return { status: 'failed', error: 'OpenAI returned no video job id.', model };
    }

    return {
      status: 'created',
      videoId,
      providerStatus: normalizeProviderStatus(payload?.status),
      progress: progressFromPayload(payload),
      model,
      seconds,
      size,
      metadata: metadataFromPayload(payload),
    };
  } catch {
    return { status: 'failed', error: 'OpenAI video generation request failed.', model };
  }
}

export async function getOpenAIVideoStatus(videoId: string): Promise<GetOpenAIVideoResult> {
  const readiness = checkOpenAIVideoReadiness();
  const apiKey = readOpenAIKey();
  const model = readiness.model;
  const cleanVideoId = videoId.trim();

  if (!readiness.isReady || !apiKey) {
    return { status: 'setup_required', error: readiness.message, readiness };
  }

  if (!cleanVideoId.startsWith('video_')) {
    return { status: 'failed', error: 'Invalid OpenAI video id.', model };
  }

  try {
    const response = await fetch(`${OPENAI_VIDEO_ENDPOINT}/${encodeURIComponent(cleanVideoId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      return { status: 'failed', error: safeProviderError(payload), model };
    }

    return {
      status: 'found',
      videoId: cleanVideoId,
      providerStatus: normalizeProviderStatus(payload?.status),
      progress: progressFromPayload(payload),
      model: typeof payload?.model === 'string' ? payload.model : model,
      metadata: metadataFromPayload(payload),
    };
  } catch {
    return { status: 'failed', error: 'OpenAI video status request failed.', model };
  }
}

export async function downloadOpenAIVideoContent(videoId: string) {
  const apiKey = readOpenAIKey();
  const cleanVideoId = videoId.trim();

  if (!apiKey || !cleanVideoId.startsWith('video_')) {
    return { buffer: null, contentType: null, error: 'Video download is not configured.' };
  }

  try {
    const response = await fetch(
      `${OPENAI_VIDEO_ENDPOINT}/${encodeURIComponent(cleanVideoId)}/content`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return { buffer: null, contentType: null, error: 'Generated video is not ready for download yet.' };
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
      error: null,
    };
  } catch {
    return { buffer: null, contentType: null, error: 'Could not download generated video.' };
  }
}
