import 'server-only';

import { createGoogleAdsCampaignDraft, getGoogleAdsExecutionReadiness } from '@/lib/ads/google-ads-publishing';
import {
  getMetaPublishingReadiness,
  publishFacebookPagePost,
  publishInstagramImagePost,
  publishInstagramReelPost,
} from '@/lib/ads/meta-publishing';
import {
  createPausedMetaAdDraft,
  getMetaPaidAdsReadiness,
  type MetaPaidDraftInput,
} from '@/lib/ads/meta-paid-drafts';
import { publishPinterestPin, getPinterestPublishingReadiness } from '@/lib/ads/pinterest-publishing';
import { checkOpenAIContentReadiness } from '@/lib/ai/openai-content';
import {
  mapContentTypeToPaidProvider,
  preflightPaidAdsAction,
} from '@/lib/production-readiness';
import { createCreativeAssetPublicUrl } from '@/lib/storage/creative-assets';
import type {
  ContentStudioExecutionAsset,
  ContentStudioExecutionContext,
  ProviderExecutionResult,
  ProviderReadinessResult,
} from './provider-types';

function isSignedSupabaseUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.pathname.includes('/storage/v1/object/sign/') || url.searchParams.has('token');
  } catch {
    return false;
  }
}

function getBestLinkedImage(assets: ContentStudioExecutionAsset[]) {
  for (const asset of assets) {
    if (isPublicHttpsUrl(asset.imageUrl) && !isSignedSupabaseUrl(asset.imageUrl)) {
      return {
        imageUrl: asset.imageUrl,
        warning: null,
      };
    }

    const metadata = asset.metadata ?? {};
    const maybeImageUrl = readMetadataString(metadata, [
      'public_image_url',
      'public_url',
      'image_url',
      'asset_url',
      'url',
    ]);

    if (isPublicHttpsUrl(maybeImageUrl) && !isSignedSupabaseUrl(maybeImageUrl)) {
      return {
        imageUrl: maybeImageUrl,
        warning: null,
      };
    }

    const publicStorageUrl = createCreativeAssetPublicUrl(asset.storagePath ?? null);

    if (isPublicHttpsUrl(publicStorageUrl)) {
      return {
        imageUrl: publicStorageUrl,
        warning: null,
      };
    }
  }

  const signedImage = assets.find((asset) => isPublicHttpsUrl(asset.imageUrl))?.imageUrl ?? null;

  return {
    imageUrl: signedImage,
    warning: signedImage
      ? 'This image URL may expire before Meta can process it. Use a public uploaded asset.'
      : null,
  };
}

function getBestLinkedPinterestImage(assets: ContentStudioExecutionAsset[]) {
  for (const asset of assets) {
    if (isPublicHttpsUrl(asset.imageUrl) && !isSignedSupabaseUrl(asset.imageUrl)) {
      return {
        imageUrl: asset.imageUrl,
        warning: null,
      };
    }

    const metadata = asset.metadata ?? {};
    const maybeImageUrl = readMetadataString(metadata, [
      'image_url',
      'public_image_url',
      'asset_url',
      'public_url',
      'url',
    ]);

    if (isPublicHttpsUrl(maybeImageUrl) && !isSignedSupabaseUrl(maybeImageUrl)) {
      const imageUrl = maybeImageUrl as string;

      if (!/\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(imageUrl)) {
        return {
          imageUrl,
          warning: null,
        };
      }
    }

    const publicStorageUrl = createCreativeAssetPublicUrl(asset.storagePath ?? null);

    if (
      isPublicHttpsUrl(publicStorageUrl) &&
      publicStorageUrl &&
      !/\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(publicStorageUrl)
    ) {
      return {
        imageUrl: publicStorageUrl,
        warning: null,
      };
    }
  }

  const signedImage = assets.find((asset) => isPublicHttpsUrl(asset.imageUrl))?.imageUrl ?? null;

  return {
    imageUrl: signedImage,
    warning: signedImage
      ? 'This image URL may expire before Pinterest can process it. Use a public uploaded asset.'
      : null,
  };
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readNestedMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  parentKey: string,
  keys: string[]
) {
  const parent = metadata?.[parentKey];

  if (!parent || Array.isArray(parent) || typeof parent !== 'object') {
    return null;
  }

  return readMetadataString(parent as Record<string, unknown>, keys);
}

function isPublicHttpsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isMetaPaidAdContentType(contentType: string) {
  return [
    'facebook_feed_ad',
    'instagram_feed_ad',
    'facebook_reel_ad',
    'instagram_reel_ad',
    'facebook_story_ad',
    'instagram_story_ad',
    'facebook_carousel_ad',
    'instagram_carousel_ad',
  ].includes(contentType);
}

function paidProviderToContentStudioProvider(
  paidProvider: NonNullable<ReturnType<typeof mapContentTypeToPaidProvider>>,
  contentType: ContentStudioExecutionContext['contentType']
) {
  if (paidProvider === 'google_ads') return 'google_ads' as const;
  if (paidProvider === 'pinterest') return 'pinterest' as const;
  return contentType.startsWith('instagram') ? 'instagram' as const : 'facebook' as const;
}

function paidProviderActionType(
  paidProvider: NonNullable<ReturnType<typeof mapContentTypeToPaidProvider>>
) {
  return paidProvider === 'meta'
    ? 'create_paused_meta_ad_draft' as const
    : 'create_campaign_draft' as const;
}

function buildMetaPaidDraftInput(context: ContentStudioExecutionContext): MetaPaidDraftInput {
  return {
    workspaceId: context.workspaceId,
    userId: context.userId,
    itemId: context.itemId,
    contentType: context.contentType,
    title: context.title,
    objective: context.objective,
    destinationUrl: context.destinationUrl ?? null,
    caption: context.caption,
    adCopy: context.adCopy,
    creativeBrief: context.creativeBrief,
    dailyBudget: context.dailyBudget ?? null,
    lifetimeBudget: context.lifetimeBudget ?? null,
    targetAudience: context.targetAudience ?? null,
    countries: context.countries ?? ['US'],
    ageMin: context.ageMin ?? null,
    ageMax: context.ageMax ?? null,
    callToAction: context.callToAction ?? null,
    headline: context.headline ?? null,
    description: context.description ?? null,
    linkedAssets: context.linkedAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      imageUrl: asset.imageUrl,
      storagePath: asset.storagePath,
      metadata: asset.metadata,
    })),
  };
}

function looksLikeVideoAsset(asset: ContentStudioExecutionAsset) {
  const metadata = asset.metadata ?? {};
  const mimeType =
    readNestedMetadataString(metadata, 'video', ['mime_type', 'content_type']) ??
    readMetadataString(metadata, ['mime_type', 'content_type', 'file_mime_type']);
  const mediaType = readMetadataString(metadata, ['media_type', 'asset_kind', 'file_kind', 'kind']);
  const videoUrl =
    readNestedMetadataString(metadata, 'video', [
      'public_url',
      'public_video_url',
      'video_url',
      'source_video_url',
      'asset_url',
      'url',
    ]) ??
    readMetadataString(metadata, [
      'video_url',
      'public_video_url',
      'source_video_url',
      'asset_url',
      'public_url',
      'url',
    ]);

  if (asset.assetType === 'video' || asset.assetType === 'reel_video') {
    return true;
  }

  if (mimeType?.toLowerCase().startsWith('video/')) {
    return true;
  }

  if (mediaType?.toLowerCase() === 'video') {
    return true;
  }

  if (videoUrl && /\.(mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(videoUrl)) {
    return true;
  }

  return false;
}

function validateInstagramReelVideoAsset(assets: ContentStudioExecutionAsset[]) {
  const videoAsset = assets.find(looksLikeVideoAsset);

  if (!videoAsset) {
    return {
      videoUrl: null,
      coverUrl: null,
      error: 'A video asset is required for Instagram Reels.',
    };
  }

  const metadata = videoAsset.metadata ?? {};
  const videoUrl =
    readNestedMetadataString(metadata, 'video', [
      'public_url',
      'public_video_url',
      'video_url',
      'source_video_url',
      'asset_url',
      'url',
    ]) ??
    readMetadataString(metadata, [
      'video_url',
      'public_video_url',
      'source_video_url',
      'asset_url',
      'public_url',
      'url',
    ]);

  if (!isPublicHttpsUrl(videoUrl)) {
    return {
      videoUrl: null,
      coverUrl: null,
      error: 'Video URL must be public HTTPS.',
    };
  }
  const publicVideoUrl = videoUrl as string;

  const mimeType =
    readNestedMetadataString(metadata, 'video', ['mime_type', 'content_type']) ??
    readMetadataString(metadata, ['mime_type', 'content_type', 'file_mime_type']);
  const supportedMime = !mimeType || ['video/mp4', 'video/quicktime'].includes(mimeType);
  const supportedUrl = /\.(mp4|mov)(?:[?#].*)?$/i.test(publicVideoUrl);

  if (!supportedMime || !supportedUrl) {
    return {
      videoUrl: null,
      coverUrl: null,
      error: 'Unsupported video format.',
    };
  }

  return {
    videoUrl: publicVideoUrl,
    coverUrl: isPublicHttpsUrl(videoAsset.imageUrl) ? videoAsset.imageUrl : null,
    error: null,
  };
}

export function getOpenAIProviderReadiness(): ProviderReadinessResult {
  const readiness = checkOpenAIContentReadiness();

  if (!readiness.isReady) {
    return {
      provider: 'openai',
      state: 'quota_limit',
      message: readiness.message,
      missing: ['OPENAI_API_KEY or active quota/quota'],
    };
  }

  return {
    provider: 'openai',
    state: 'ready',
    message: readiness.message,
    missing: [],
  };
}

export async function getContentStudioProviderReadiness(
  context: Pick<ContentStudioExecutionContext, 'workspaceId' | 'userId' | 'contentType'> &
    Partial<Pick<ContentStudioExecutionContext, 'itemId' | 'title' | 'caption' | 'script' | 'adCopy' | 'creativeBrief' | 'objective' | 'destinationUrl' | 'budgetNotes' | 'dailyBudget' | 'lifetimeBudget' | 'targetAudience' | 'countries' | 'keywords' | 'ageMin' | 'ageMax' | 'callToAction' | 'headline' | 'description' | 'linkedAssets'>> & {
      validateContent?: boolean;
    }
): Promise<ProviderReadinessResult> {
  if (isMetaPaidAdContentType(context.contentType)) {
    if (!context.validateContent) {
      return {
        provider: context.contentType.startsWith('instagram') ? 'instagram' : 'facebook',
        state: 'manual_only',
        message: 'Meta paid ads require manual confirmation and are not auto-created by scheduler.',
        missing: [],
      };
    }

    return getMetaPaidAdsReadiness(
      buildMetaPaidDraftInput({
        workspaceId: context.workspaceId,
        userId: context.userId,
        itemId: context.itemId ?? '',
        title: context.title ?? 'Meta paid ad draft',
        contentType: context.contentType,
        objective: context.objective ?? null,
        caption: context.caption ?? null,
        script: context.script ?? null,
        adCopy: context.adCopy ?? null,
        creativeBrief: context.creativeBrief ?? null,
        destinationUrl: context.destinationUrl ?? null,
        dailyBudget: context.dailyBudget ?? null,
        lifetimeBudget: context.lifetimeBudget ?? null,
        targetAudience: context.targetAudience ?? null,
        countries: context.countries ?? ['US'],
        ageMin: context.ageMin ?? null,
        ageMax: context.ageMax ?? null,
        callToAction: context.callToAction ?? null,
        headline: context.headline ?? null,
        description: context.description ?? null,
        linkedAssets: context.linkedAssets ?? [],
      })
    );
  }

  switch (context.contentType) {
    case 'facebook_post':
    case 'facebook_reel':
    case 'instagram_post':
    case 'instagram_reel': {
      const readiness = await getMetaPublishingReadiness({
        workspaceId: context.workspaceId,
        userId: context.userId,
        contentType: context.contentType,
      });

      if (readiness.state !== 'ready' || !context.validateContent) {
        if (context.contentType === 'instagram_reel') {
          const hasMissingPublishScope = readiness.missing.some((missing) =>
            ['instagram_content_publish', 'instagram_basic', 'pages_show_list', 'pages_read_engagement'].includes(missing)
          );

          if (readiness.message.includes('permission') || hasMissingPublishScope) {
            return {
              provider: 'instagram',
              state: 'setup_required',
              message: 'Meta publishing permission is missing.',
              missing: readiness.missing.length > 0 ? readiness.missing : ['Instagram content publish permission'],
            };
          }

          if (readiness.message.includes('Instagram')) {
            return {
              provider: 'instagram',
              state: 'setup_required',
              message: 'Instagram account is not selected.',
              missing: ['Selected Instagram Business Account'],
            };
          }
        }

        return readiness;
      }

      const linkedAssets = context.linkedAssets ?? [];
      const image = getBestLinkedImage(linkedAssets);
      const hasPostText = Boolean(
        context.caption?.trim() ||
          context.script?.trim() ||
          context.adCopy?.trim() ||
          context.objective?.trim()
      );

      if (context.contentType === 'facebook_post' && !hasPostText && !image.imageUrl) {
        return {
          provider: 'facebook',
          state: 'setup_required',
          message: 'Facebook Page setup required: add post text or a linked image asset.',
          missing: ['Post text or linked image asset'],
        };
      }

      if (context.contentType === 'instagram_post') {
        if (!context.caption?.trim()) {
          return {
            provider: 'instagram',
            state: 'setup_required',
            message: 'Instagram Business Account setup required: caption is required before publishing.',
            missing: ['Caption'],
          };
        }

        if (!image.imageUrl) {
          return {
            provider: 'instagram',
            state: 'setup_required',
            message: 'Image asset required.',
            missing: ['Public image asset'],
          };
        }

        if (image.warning) {
          return {
            provider: 'instagram',
            state: 'setup_required',
            message: image.warning,
            missing: ['Stable public image URL'],
          };
        }
      }

      if (context.contentType === 'instagram_reel') {
        if (!context.caption?.trim()) {
          return {
            provider: 'instagram',
            state: 'setup_required',
            message: 'Caption is required for Instagram Reels.',
            missing: ['Caption'],
          };
        }

        const video = validateInstagramReelVideoAsset(linkedAssets);

        if (video.error) {
          return {
            provider: 'instagram',
            state: 'setup_required',
            message: video.error,
            missing: [video.error],
          };
        }
      }

      return readiness;
    }
    case 'facebook_feed_ad':
    case 'instagram_feed_ad':
    case 'facebook_reel_ad':
    case 'instagram_reel_ad':
    case 'facebook_story_ad':
    case 'instagram_story_ad':
    case 'facebook_carousel_ad':
    case 'instagram_carousel_ad':
      return {
        provider: context.contentType.startsWith('instagram') ? 'instagram' : 'facebook',
        state: 'manual_only',
        message: 'Meta paid ads require manual confirmation and are not auto-created by scheduler.',
        missing: [],
      };
    case 'google_ads_campaign_draft':
      {
        const readiness = await getGoogleAdsExecutionReadiness({
        workspaceId: context.workspaceId,
        userId: context.userId,
      });

        if (readiness.state !== 'ready' || !context.validateContent) {
          return readiness;
        }

        const missing = [];

        if (!context.destinationUrl?.trim()) {
          missing.push('Destination URL');
        }

        if (!context.budgetNotes?.trim() && !context.dailyBudget && !context.lifetimeBudget) {
          missing.push('Budget notes');
        }

        if (
          !(context.keywords ?? []).some((keyword) => keyword.trim().length > 0) &&
          !context.adCopy?.trim() &&
          !context.headline?.trim() &&
          !context.description?.trim()
        ) {
          missing.push('Keywords or ad copy');
        }

        if (missing.length > 0) {
          return {
            provider: 'google_ads',
            state: 'setup_required',
            message: `Google Ads campaign draft setup is incomplete: ${missing.join(', ')} required.`,
            missing,
          };
        }

        return readiness;
      }
    case 'pinterest_pin':
      {
        const readiness = await getPinterestPublishingReadiness({
          workspaceId: context.workspaceId,
          userId: context.userId,
        });

        if (readiness.state !== 'ready' || !context.validateContent) {
          return readiness;
        }

        const image = getBestLinkedPinterestImage(context.linkedAssets ?? []);
        const hasPinText = Boolean(
          context.caption?.trim() ||
            context.adCopy?.trim() ||
            context.script?.trim() ||
            context.objective?.trim()
        );

        if (!hasPinText) {
          return {
            provider: 'pinterest',
            state: 'setup_required',
            message: 'Pinterest provider setup is incomplete.',
            missing: ['Pin title or description'],
          };
        }

        if (!image.imageUrl) {
          return {
            provider: 'pinterest',
            state: 'setup_required',
            message: 'A publishable image asset is required.',
            missing: ['Publishable image asset'],
          };
        }

        if (image.warning) {
          return {
            provider: 'pinterest',
            state: 'setup_required',
            message: image.warning,
            missing: ['Stable public image URL'],
          };
        }

        if (!isPublicHttpsUrl(image.imageUrl)) {
          return {
            provider: 'pinterest',
            state: 'setup_required',
            message: 'Image URL must be public HTTPS.',
            missing: ['Public HTTPS image URL'],
          };
        }

        return readiness;
      }
    case 'linkedin_post_planner':
      return {
        provider: 'linkedin',
        state: 'manual_only',
        message: 'LinkedIn is currently manual mode only.',
        missing: [],
      };
    default:
      return {
        provider: 'linkedin',
        state: 'unsupported',
        message: 'This provider is not supported.',
        missing: [],
      };
  }
}

export async function executeContentStudioProviderAction(
  context: ContentStudioExecutionContext
): Promise<ProviderExecutionResult> {
  const paidProvider = mapContentTypeToPaidProvider(context.contentType);

  if (paidProvider) {
    if (!context.supabase || !context.role) {
      return {
        provider: paidProviderToContentStudioProvider(paidProvider, context.contentType),
        actionType: paidProviderActionType(paidProvider),
        status: 'setup_required',
        message:
          'Paid ads action blocked: production preflight context is missing. بوابة الإعلانات المدفوعة غير مكتملة.',
      };
    }

    const preflight = await preflightPaidAdsAction({
      supabase: context.supabase,
      workspaceId: context.workspaceId,
      userId: context.userId,
      role: context.role,
      provider: paidProvider,
      actionLabel: context.contentType,
      explicitConfirmation: context.explicitConfirmation === true,
    });

    if (!preflight.allowed) {
      return {
        provider: paidProviderToContentStudioProvider(paidProvider, context.contentType),
        actionType: paidProviderActionType(paidProvider),
        status: 'setup_required',
        message: preflight.message,
      };
    }
  }

  switch (context.contentType) {
    case 'facebook_post': {
      const image = getBestLinkedImage(context.linkedAssets);

      return publishFacebookPagePost({
        workspaceId: context.workspaceId,
        userId: context.userId,
        title: context.title,
        caption: context.caption,
        script: context.script,
        adCopy: context.adCopy,
        objective: context.objective,
        imageUrl: image.imageUrl,
      });
    }
    case 'instagram_post': {
      const image = getBestLinkedImage(context.linkedAssets);

      if (image.warning) {
        return {
          provider: 'instagram',
          actionType: 'publish_post',
          status: 'setup_required',
          message: image.warning,
        };
      }

      return publishInstagramImagePost({
        workspaceId: context.workspaceId,
        userId: context.userId,
        title: context.title,
        caption: context.caption,
        script: context.script,
        adCopy: context.adCopy,
        objective: context.objective,
        imageUrl: image.imageUrl,
      });
    }
    case 'facebook_reel':
      return {
        provider: 'facebook',
        actionType: 'publish_reel',
        status: 'unsupported',
        message: 'Facebook Reel publishing is not supported in this phase. Use Facebook Page posts instead.',
      };
    case 'instagram_reel': {
      const video = validateInstagramReelVideoAsset(context.linkedAssets);

      if (video.error || !video.videoUrl) {
        return {
          provider: 'instagram',
          actionType: 'publish_reel',
          status: 'setup_required',
          message: video.error ?? 'A video asset is required for Instagram Reels.',
        };
      }

      if (!context.caption?.trim()) {
        return {
          provider: 'instagram',
          actionType: 'publish_reel',
          status: 'setup_required',
          message: 'Caption is required for Instagram Reels.',
        };
      }

      return publishInstagramReelPost({
        workspaceId: context.workspaceId,
        userId: context.userId,
        itemId: context.itemId,
        title: context.title,
        caption: context.caption,
        script: context.script,
        adCopy: context.adCopy,
        objective: context.objective,
        videoUrl: video.videoUrl,
        coverUrl: video.coverUrl,
      });
    }
    case 'google_ads_campaign_draft':
      return createGoogleAdsCampaignDraft({
        workspaceId: context.workspaceId,
        userId: context.userId,
        title: context.title,
      });
    case 'facebook_feed_ad':
    case 'instagram_feed_ad':
    case 'facebook_reel_ad':
    case 'instagram_reel_ad':
    case 'facebook_story_ad':
    case 'instagram_story_ad':
    case 'facebook_carousel_ad':
    case 'instagram_carousel_ad':
      return createPausedMetaAdDraft(buildMetaPaidDraftInput(context));
    case 'pinterest_pin':
      {
        const image = getBestLinkedPinterestImage(context.linkedAssets);

        if (!image.imageUrl) {
          return {
            provider: 'pinterest',
            actionType: 'publish_pin',
            status: 'setup_required',
            message: 'A publishable image asset is required.',
          };
        }

        if (image.warning) {
          return {
            provider: 'pinterest',
            actionType: 'publish_pin',
            status: 'setup_required',
            message: image.warning,
          };
        }

        return publishPinterestPin({
          workspaceId: context.workspaceId,
          userId: context.userId,
          title: context.title,
          description: context.caption ?? context.adCopy ?? context.creativeBrief ?? context.objective,
          destinationUrl: context.destinationUrl,
          imageUrl: image.imageUrl,
        });
      }
    case 'linkedin_post_planner':
      return {
        provider: 'linkedin',
        actionType: 'manual_handoff',
        status: 'manual_only',
        message: 'LinkedIn is currently manual mode only.',
      };
    default:
      return {
        provider: 'linkedin',
        actionType: 'manual_handoff',
        status: 'unsupported',
        message: 'This provider is not supported.',
      };
  }
}
