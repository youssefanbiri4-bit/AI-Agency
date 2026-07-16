import 'server-only';

import { startSpan } from '@sentry/nextjs';
import {
  withCircuitBreaker,
  CIRCUIT_BREAKER_PROVIDERS,
} from '@/lib/circuit-breaker';

import type {
  CreativeAssetAspectRatio,
  CreativeAssetOutputStyle,
  CreativeAssetPlatform,
  CreativeAssetType,
} from '@/types/database';
import type { JsonObject } from '@/types';
import {
  CONCURRENCY_SLOTS,
  ConcurrencyLimitError,
  withConcurrencyLimit,
} from '@/lib/concurrency-limiter';

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5';
const DEFAULT_GPT_IMAGE_QUALITY = 'auto';
const DEFAULT_LEGACY_IMAGE_QUALITY = 'standard';
const DEFAULT_ASPECT_RATIO: CreativeAssetAspectRatio = '1:1';
const MAX_PROMPT_CHARS = 32000;

export interface OpenAIImageEnv {
  apiKeyConfigured: boolean;
  model: string;
  size: string | null;
  quality: string;
}

export interface OpenAIImageReadiness {
  isReady: boolean;
  status: 'ready' | 'setup_required';
  message: string;
  model: string;
  size: string | null;
  quality: string;
}

export interface CreativeBriefPromptInput {
  title: string;
  asset_type: CreativeAssetType;
  platform: CreativeAssetPlatform;
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
}

export interface BuiltCreativePrompt {
  prompt: string;
  negativePrompt: string;
}

export interface GenerateImageWithOpenAIInput {
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio?: CreativeAssetAspectRatio | null;
  model?: string | null;
  userId?: string;
}

export type GenerateImageWithOpenAIResult =
  | {
      status: 'setup_required';
      error: string;
      readiness: OpenAIImageReadiness;
    }
  | {
      status: 'failed';
      error: string;
      model: string;
      size: string;
      quality: string;
    }
  | {
      status: 'generated';
      b64Json: string | null;
      imageUrl: string | null;
      contentType: string;
      revisedPrompt: string | null;
      model: string;
      size: string;
      quality: string;
      metadata: JsonObject;
    };

const assetTypeLabels: Record<CreativeAssetType, string> = {
  image: 'image asset',
  video: 'video asset',
  reel_cover: 'Instagram Reel cover',
  reel_video: 'Instagram Reel video',
  ad_creative: 'paid ad creative',
  thumbnail: 'thumbnail',
  campaign_visual: 'campaign hero visual',
  carousel_slide: 'carousel slide',
  story_visual: 'story visual',
};

const platformLabels: Record<CreativeAssetPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  general: 'general digital marketing',
};

const outputStyleNotes: Record<CreativeAssetOutputStyle, string> = {
  premium_saas: 'premium SaaS, polished product marketing, crisp interface-inspired composition',
  realistic: 'realistic photography direction, natural lighting, believable materials',
  minimal: 'minimal composition, refined whitespace, restrained graphic system',
  bold_ad: 'bold advertising layout, strong focal point, high conversion clarity',
  clean_corporate: 'clean corporate editorial style, professional and trustworthy',
  luxury: 'luxury visual system, elevated lighting, careful restraint, premium finish',
};

function readOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function normalizeModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

function normalizeQuality(model: string) {
  const configuredQuality = process.env.OPENAI_IMAGE_QUALITY?.trim();

  if (configuredQuality) {
    return configuredQuality;
  }

  return model.startsWith('dall-e')
    ? DEFAULT_LEGACY_IMAGE_QUALITY
    : DEFAULT_GPT_IMAGE_QUALITY;
}

export function mapAspectRatioToOpenAIImageSize(
  aspectRatio?: CreativeAssetAspectRatio | null
) {
  switch (aspectRatio || DEFAULT_ASPECT_RATIO) {
    case '16:9':
      return '1536x1024';
    case '4:5':
    case '9:16':
      return '1024x1536';
    case '1:1':
    default:
      return '1024x1024';
  }
}

function normalizeSize(aspectRatio?: CreativeAssetAspectRatio | null) {
  return process.env.OPENAI_IMAGE_SIZE?.trim() || mapAspectRatioToOpenAIImageSize(aspectRatio);
}

export function getOpenAIImageEnv(): OpenAIImageEnv {
  const model = normalizeModel();

  return {
    apiKeyConfigured: Boolean(readOpenAIKey()),
    model,
    size: process.env.OPENAI_IMAGE_SIZE?.trim() || null,
    quality: normalizeQuality(model),
  };
}

export function checkOpenAIImageReadiness(): OpenAIImageReadiness {
  const env = getOpenAIImageEnv();

  if (!env.apiKeyConfigured) {
    return {
      isReady: false,
      status: 'setup_required',
      message:
        'Image generation setup required. Add OPENAI_API_KEY in Vercel to enable real image generation.',
      model: env.model,
      size: env.size,
      quality: env.quality,
    };
  }

  return {
    isReady: true,
    status: 'ready',
    message: 'OpenAI image generation is configured server-side.',
    model: env.model,
    size: env.size,
    quality: env.quality,
  };
}

function valueOrFallback(value: string | null | undefined, fallback = 'Not specified') {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line): line is string => line !== null && line !== undefined).join('\n');
}

export function buildImagePromptFromCreativeBrief(
  input: CreativeBriefPromptInput
): BuiltCreativePrompt {
  const aspectRatio = input.aspect_ratio || DEFAULT_ASPECT_RATIO;
  const outputStyle = input.output_style || 'premium_saas';
  const basePrompt = input.prompt?.trim();
  const negativePrompt =
    input.negative_prompt?.trim() ||
    'Avoid clutter, distorted anatomy, broken text, misspelled words, watermarks, logos not provided by the brand, misleading product claims, low-resolution artifacts, and dark unreadable layouts.';

  const prompt = compactLines([
    'Main prompt',
    basePrompt ||
      `Create a professional ${assetTypeLabels[input.asset_type]} for ${platformLabels[input.platform]}.`,
    '',
    'Creative brief',
    `Title: ${valueOrFallback(input.title)}`,
    `Goal: ${valueOrFallback(input.goal)}`,
    `Offer: ${valueOrFallback(input.offer)}`,
    `Target audience: ${valueOrFallback(input.target_audience)}`,
    `Market: ${valueOrFallback(input.market)}`,
    `Tone: ${valueOrFallback(input.tone)}`,
    `Visual style: ${valueOrFallback(input.style, outputStyleNotes[outputStyle])}`,
    `Visual direction: ${valueOrFallback(input.visual_direction)}`,
    '',
    'Style notes',
    outputStyleNotes[outputStyle],
    'Premium SaaS finish, intentional spacing, strong hierarchy, polished lighting, and a conversion-focused focal point.',
    '',
    'Composition',
    `Use an ${aspectRatio} composition. Keep the primary subject clear, leave safe space for cropping, and make the layout readable on mobile and desktop placements.`,
    '',
    'Text overlay instruction',
    input.text_overlay?.trim()
      ? `Include only this short, legible text overlay: "${input.text_overlay.trim()}".`
      : 'Do not render large text unless the creative brief explicitly requires it.',
    '',
    'Aspect ratio',
    aspectRatio,
    '',
    'Brand color notes',
    valueOrFallback(input.brand_colors, 'Use refined neutrals with selective brand-color accents.'),
    input.notes?.trim() ? `Additional notes: ${input.notes.trim()}` : null,
  ]).slice(0, MAX_PROMPT_CHARS);

  return {
    prompt,
    negativePrompt,
  };
}

function buildProviderPrompt(prompt: string, negativePrompt?: string | null) {
  return compactLines([
    prompt.trim(),
    negativePrompt?.trim() ? `Negative prompt: ${negativePrompt.trim()}` : null,
  ]).slice(0, MAX_PROMPT_CHARS);
}

function imageContentTypeFromFormat(format?: unknown) {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
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

  return 'OpenAI image generation failed.';
}

function usageToMetadata(value: unknown): JsonObject {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const usage = value as Record<string, unknown>;
  const metadata: JsonObject = {};

  for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) {
    const tokenValue = usage[key];

    if (typeof tokenValue === 'number') {
      metadata[key] = tokenValue;
    }
  }

  return metadata;
}

export async function generateImageWithOpenAI(
  input: GenerateImageWithOpenAIInput
): Promise<GenerateImageWithOpenAIResult> {
  const readiness = checkOpenAIImageReadiness();
  const model = input.model?.trim() || readiness.model;
  const size = normalizeSize(input.aspectRatio);
  const quality = normalizeQuality(model);
  const apiKey = readOpenAIKey();

  if (!readiness.isReady || !apiKey) {
    return {
      status: 'setup_required',
      error: readiness.message,
      readiness,
    };
  }

  const prompt = buildProviderPrompt(input.prompt, input.negativePrompt);

  if (!prompt) {
    return {
      status: 'failed',
      error: 'A prompt is required before image generation.',
      model,
      size,
      quality,
    };
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    quality,
  };

  if (input.userId) {
    body.user = input.userId;
  }

  if (model.startsWith('dall-e')) {
    body.response_format = 'b64_json';
  } else {
    body.output_format = 'png';
  }

  try {
    return await withConcurrencyLimit(
      CONCURRENCY_SLOTS.AI_GENERATION,
      async () => {
        try {
          const response = await startSpan(
            {
              op: 'ai.image.generation',
              name: `OpenAI ${model}`,
              attributes: {
                'ai.provider': 'openai',
                'ai.model': model,
                'ai.image.size': size,
                'ai.image.quality': quality,
              },
            },
            async (span) => {
              const result = await withCircuitBreaker(
                CIRCUIT_BREAKER_PROVIDERS.OPENAI_IMAGE,
                () =>
                  fetch(OPENAI_IMAGE_ENDPOINT, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                  }),
                { timeoutMs: 60_000 }
              );
              span.setAttribute('http.status_code', result.status);
              span.setAttribute('ai.success', result.ok);
              return result;
            }
          );

          const payload = (await response.json().catch(() => null)) as
            | Record<string, unknown>
            | null;

          if (!response.ok) {
            return {
              status: 'failed',
              error: safeProviderError(payload),
              model,
              size,
              quality,
            };
          }

          const data = Array.isArray(payload?.data) ? payload.data : [];
          const firstImage =
            data[0] && typeof data[0] === 'object'
              ? (data[0] as Record<string, unknown>)
              : null;
          const b64Json = typeof firstImage?.b64_json === 'string' ? firstImage.b64_json : null;
          const imageUrl = typeof firstImage?.url === 'string' ? firstImage.url : null;

          if (!b64Json && !imageUrl) {
            return {
              status: 'failed',
              error: 'OpenAI returned no image data.',
              model,
              size,
              quality,
            };
          }

          return {
            status: 'generated',
            b64Json,
            imageUrl,
            contentType: imageContentTypeFromFormat(payload?.output_format),
            revisedPrompt:
              typeof firstImage?.revised_prompt === 'string' ? firstImage.revised_prompt : null,
            model,
            size: typeof payload?.size === 'string' ? payload.size : size,
            quality: typeof payload?.quality === 'string' ? payload.quality : quality,
            metadata: {
              provider: 'openai',
              output_format:
                typeof payload?.output_format === 'string' ? payload.output_format : 'png',
              ...usageToMetadata(payload?.usage),
            },
          };
        } catch {
          return {
            status: 'failed',
            error: 'OpenAI image generation request failed.',
            model,
            size,
            quality,
          };
        }
      },
      // Queue (don't fail-fast): wait briefly for a free slot rather than reject.
      { failOnQueue: false, timeoutMs: 20_000 }
    );
  } catch (e) {
    if (e instanceof ConcurrencyLimitError) {
      return {
        status: 'failed',
        error:
          'Image generation is busy. Please try again shortly. التوليد المشغول، جرّب بعد قليل.',
        model,
        size,
        quality,
      };
    }
    return {
      status: 'failed',
      error: 'OpenAI image generation request failed.',
      model,
      size,
      quality,
    };
  }
}
