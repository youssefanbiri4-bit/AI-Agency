'use server';

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { getContentStudioItemById } from '@/features/content-studio/data/content-studio';
import { getBrandKitForWorkspace } from '@/lib/data/brand-kit';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkWorkspaceUserRateLimit, RATE_LIMIT_ACTIONS } from '@/lib/sliding-window-rate-limit';
import { incrementUsage } from '@/lib/usage/quotas';
import { generateContentStudioText, type ContentGenerationKind } from '@/lib/ai/openai-content';
import {
  inferPlatformFromContentType,
} from '../shared';
import {
  type GenerateContentStudioFieldState,
  initialGenerateState,
  readField,
  emptyToNull,
  readContentType,
  readAssetIds,
  readCampaignTextField,
  readCampaignListField,
  getWorkspaceContext,
} from './shared';

function generationFieldFromKind(kind: ContentGenerationKind) {
  switch (kind) {
    case 'script':
      return 'script' as const;
    case 'caption':
      return 'caption' as const;
    case 'ad_copy':
      return 'ad_copy' as const;
    case 'creative_brief':
      return 'creative_brief' as const;
    case 'campaign_brief':
      return 'creative_brief' as const;
    case 'instagram_ad':
    case 'facebook_ad':
      return 'ad_copy' as const;
    case 'google_search_ad':
    case 'headlines':
      return 'headlines' as const;
    case 'pinterest_pin_copy':
      return 'caption' as const;
    case 'reel_script':
      return 'voiceover_script' as const;
    case 'hook':
      return 'hook' as const;
    case 'descriptions':
      return 'descriptions' as const;
    case 'keywords':
      return 'keywords' as const;
    case 'hashtags':
      return 'hashtags' as const;
    case 'cta':
      return 'cta' as const;
    case 'audience_suggestions':
      return 'target_audience' as const;
    case 'full_campaign_package':
      return 'platform_package' as const;
    default:
      return 'script' as const;
  }
}

function generationMessageFromKind(kind: ContentGenerationKind) {
  switch (kind) {
    case 'script':
      return 'Script generated.';
    case 'caption':
      return 'Caption generated.';
    case 'ad_copy':
      return 'Ad copy generated.';
    case 'creative_brief':
      return 'Creative brief generated.';
    case 'campaign_brief':
      return 'Campaign brief generated.';
    case 'instagram_ad':
      return 'Instagram ad copy generated.';
    case 'facebook_ad':
      return 'Facebook ad copy generated.';
    case 'google_search_ad':
      return 'Google Search ad package generated.';
    case 'pinterest_pin_copy':
      return 'Pinterest pin copy generated.';
    case 'reel_script':
      return 'Reel script generated.';
    case 'hook':
      return 'Hook generated.';
    case 'headlines':
      return 'Headlines generated.';
    case 'descriptions':
      return 'Descriptions generated.';
    case 'keywords':
      return 'Keywords generated.';
    case 'hashtags':
      return 'Hashtags generated.';
    case 'cta':
      return 'CTA generated.';
    case 'audience_suggestions':
      return 'Audience suggestions generated.';
    case 'full_campaign_package':
      return 'Full campaign package generated.';
    default:
      return 'Content generated.';
  }
}

async function checkGenerationLimit(workspaceId: string, userId: string) {
  // Fixed-window rate limit (existing)
  const fixedResult = await checkRateLimit({
    key: `content-generation:${workspaceId}:${userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!fixedResult.allowed) {
    return fixedResult;
  }

  // Sliding window rate limit (more accurate)
  return checkWorkspaceUserRateLimit(
    workspaceId,
    userId,
    RATE_LIMIT_ACTIONS.CONTENT_GENERATE,
    { limit: 15, windowMs: 60_000 } // 15 generations per minute
  );
}

export async function generateContentStudioFieldAction(
  itemId: string,
  formData: FormData
): Promise<GenerateContentStudioFieldState> {
  try {
    const kind = readField(formData, 'generation_kind') as ContentGenerationKind;

    if (
      ![
        'script',
        'caption',
        'ad_copy',
        'creative_brief',
        'campaign_brief',
        'instagram_ad',
        'facebook_ad',
        'google_search_ad',
        'pinterest_pin_copy',
        'reel_script',
        'hook',
        'headlines',
        'descriptions',
        'keywords',
        'hashtags',
        'cta',
        'audience_suggestions',
        'full_campaign_package',
      ].includes(kind)
    ) {
      return {
        ...initialGenerateState,
        error: 'Choose a valid generation action first.',
        requestId: `${Date.now()}`,
      };
    }

    const { supabase, user, workspace, role } = await getWorkspaceContext();

    if (!hasPermission(role, 'editor')) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'content_generation',
        entityId: itemId,
        message: 'Blocked content field generation.',
        metadata: { role },
      });

      return {
        ...initialGenerateState,
        error: 'ما عندكش صلاحية لاستعمال توليد المحتوى. AI generation is restricted for your workspace role.',
      };
    }

    if (!(await checkGenerationLimit(workspace.id, user.id)).allowed) {
      return {
        ...initialGenerateState,
        error: 'وصلتي للحد المؤقت لتوليد المحتوى. عاود المحاولة بعد شوية.',
      };
    }

    const [itemResult, brandKitResult] = await Promise.all([
      getContentStudioItemById(workspace.id, itemId, supabase),
      getBrandKitForWorkspace(supabase, workspace.id),
    ]);

    if (itemResult.error || !itemResult.data) {
      return {
        ...initialGenerateState,
        error: itemResult.error ?? 'Content item not found.',
      };
    }

    const item = itemResult.data;
    const contentType = readContentType(formData) ?? item.content_type;
    const platform = inferPlatformFromContentType(contentType);
    const assetIds = readAssetIds(formData);
    let creativeAssetSummary = 'No linked creative assets.';

    if (assetIds.length > 0) {
      const { data: assets, error: assetsError } = await supabase
        .from('creative_assets')
        .select('id, title, asset_type, platform')
        .eq('workspace_id', workspace.id)
        .in('id', assetIds);

      if (assetsError) {
        return {
          ...initialGenerateState,
          error: assetsError.message,
        };
      }

      creativeAssetSummary =
        assets && assets.length > 0
          ? assets
              .map(
                (asset) =>
                  `${asset.title} (${asset.platform.replace(/_/g, ' ')}, ${asset.asset_type.replace(/_/g, ' ')})`
              )
              .join('; ')
          : creativeAssetSummary;
    }

    const generationResult = await generateContentStudioText(kind, {
      title: readField(formData, 'title') || item.title,
      platform,
      contentType,
      objective: emptyToNull(readField(formData, 'objective')) ?? item.objective,
      prompt: emptyToNull(readField(formData, 'prompt')) ?? item.prompt,
      script: emptyToNull(readField(formData, 'script')) ?? item.script,
      caption: emptyToNull(readField(formData, 'caption')) ?? item.caption,
      adCopy: emptyToNull(readField(formData, 'ad_copy')) ?? item.ad_copy,
      creativeBrief:
        emptyToNull(readField(formData, 'creative_brief')) ?? item.creative_brief,
      targetAudience: readCampaignTextField(formData, 'target_audience'),
      offer: readCampaignTextField(formData, 'offer'),
      destinationUrl: readCampaignTextField(formData, 'destination_url'),
      hook: readCampaignTextField(formData, 'hook'),
      primaryText: readCampaignTextField(formData, 'primary_text'),
      headlines: readCampaignListField(formData, 'headlines'),
      descriptions: readCampaignListField(formData, 'descriptions'),
      keywords: readCampaignListField(formData, 'keywords'),
      hashtags: readCampaignListField(formData, 'hashtags'),
      cta: readCampaignTextField(formData, 'cta'),
      sceneBreakdown: readCampaignTextField(formData, 'scene_breakdown'),
      voiceoverScript: readCampaignTextField(formData, 'voiceover_script'),
      onScreenText: readCampaignTextField(formData, 'on_screen_text'),
      platformPackage: readCampaignTextField(formData, 'platform_package'),
      creativeAssetSummary,
      brandKit: brandKitResult.data.brandKit,
    });

    if (generationResult.status === 'setup_required') {
      return {
        ...initialGenerateState,
        error: generationResult.error,
        field: generationFieldFromKind(kind),
        requestId: `${Date.now()}`,
      };
    }

    if (generationResult.status === 'failed') {
      return {
        ...initialGenerateState,
        error: generationResult.error,
        field: generationFieldFromKind(kind),
        requestId: `${Date.now()}`,
      };
    }

    await incrementUsage(workspace.id, 'ai_generations', 1, user.id).catch(() => {});

    return {
      error: null,
      message:
        generationResult.message ??
        generationMessageFromKind(kind),
      generatedText: generationResult.text,
      field: generationFieldFromKind(kind),
      requestId: `${Date.now()}`,
      providerUsed: generationResult.providerUsed ?? null,
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      ...initialGenerateState,
      error:
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
    };
  }
}
