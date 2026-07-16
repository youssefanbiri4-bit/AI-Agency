'use client';

import Link from 'next/link';
import { Image as ImageIcon, Play, Unlink2 } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { formatDateTime } from '@/lib/utils';
import type { CreativeAssetRecord, ContentStudioType } from '@/types/database';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import { formatContentStudioPlatformLabel } from '../shared';
import { useLanguage } from '@/i18n/context';

interface CreativeAssetsSectionProps {
  selectedType: ContentStudioType;
  selectedStudio: { assetGuidance: string };
  selectedAssetNames: string[];
  assetOptions: CreativeAssetRecord[];
  selectedAssetIdSet: Set<string>;
  savePending: boolean;
  isGenerating: boolean;
  isRemovingAsset: boolean;
  isLinkingAsset: boolean;
  removingAssetId: string | null;
  linkingAssetId: string | null;
  selectedProviderReadiness: ProviderReadinessResult | null;
  selectedPublicImageAsset: CreativeAssetRecord | undefined;
  selectedSignedImageAsset: CreativeAssetRecord | undefined;
  selectedPinterestBoardName: string | null;
  selectedDestinationUrl: string;
  onAssetCheckboxChange: (assetId: string, checked: boolean) => void;
  onRemoveAsset: (assetId: string) => void;
}

function readCreativeAssetVideo(asset: CreativeAssetRecord) {
  const video = asset.metadata?.video;

  if (!video || Array.isArray(video) || typeof video !== 'object') {
    return null;
  }

  const metadata = video as Record<string, unknown>;
  const publicUrl =
    typeof metadata.public_url === 'string'
      ? metadata.public_url
      : typeof metadata.public_video_url === 'string'
        ? metadata.public_video_url
        : null;

  return {
    publicUrl,
    mimeType: typeof metadata.mime_type === 'string' ? metadata.mime_type : null,
  };
}

function isCreativeVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readCreativeAssetVideo(asset)?.publicUrl)
  );
}

export function CreativeAssetsSection({
  selectedType,
  selectedStudio,
  selectedAssetNames,
  assetOptions,
  selectedAssetIdSet,
  savePending,
  isGenerating,
  isRemovingAsset,
  isLinkingAsset,
  removingAssetId,
  linkingAssetId,
  selectedProviderReadiness,
  selectedPublicImageAsset,
  selectedSignedImageAsset,
  selectedPinterestBoardName,
  selectedDestinationUrl,
  onAssetCheckboxChange,
  onRemoveAsset,
}: CreativeAssetsSectionProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title={t('dashboardI18n.contentStudio.creativeAssets')}
        description={t('dashboardI18n.contentStudio.creativeAssetsDescription', 'Link existing creative assets, see what is attached, and route to Creative Assets when provider-ready media is still missing.')}
        action={<ImageIcon className="h-5 w-5 text-[#F7CBCA]" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-black/58">
        <span className="basis-full text-black/62">{selectedStudio.assetGuidance}</span>
        <span>
          {t('dashboardI18n.contentStudio.linkedAssetCount', 'Linked asset count')}: <strong className="text-black">{selectedAssetNames.length}</strong>
        </span>
        <span>
          {t('dashboardI18n.contentStudio.assetNames', 'Asset names')}:{' '}
          <strong className="text-black">{selectedAssetNames.join(', ') || t('dashboardI18n.contentStudio.noneLinkedYet', 'None linked yet')}</strong>
        </span>
        <Link href="/dashboard/creative-assets" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          Creative Assets
        </Link>
      </div>

      {[
        'instagram_post',
        'instagram_reel',
        'pinterest_pin',
      ].includes(selectedType) && selectedAssetNames.length === 0 ? (
        <Notice tone="warning" title={t('dashboardI18n.contentStudio.providerMediaRequired', 'Provider-ready media is still required')}>
          {t('dashboardI18n.contentStudio.providerMediaRequiredDescription', 'This content type needs a suitable linked asset before a real provider action can succeed.')}
        </Notice>
      ) : null}

      {selectedType === 'instagram_reel' || selectedType === 'instagram_reel_ad' ? (
        <Notice
          tone={selectedType === 'instagram_reel' ? 'warning' : 'info'}
          title={
            selectedType === 'instagram_reel'
              ? 'Linked video asset required'
              : 'Instagram Reel Ad is manual-only'
          }
        >
          {selectedType === 'instagram_reel'
            ? 'Organic Instagram Reels require a linked video asset, caption, and selected Instagram account before publishing.'
            : 'Keep this as ad planning and copy-ready handoff. Paid Meta ads are not implemented in this phase.'}
        </Notice>
      ) : null}

      {selectedType === 'pinterest_pin' ? (
        <Notice
          tone={selectedProviderReadiness?.state === 'ready' && selectedPublicImageAsset ? 'info' : 'warning'}
          title={
            selectedProviderReadiness?.state === 'ready' && selectedPublicImageAsset
              ? 'Pinterest Pin publishing ready'
              : 'Pinterest Pin publishing checks'
          }
        >
          Board: {selectedPinterestBoardName ?? 'not selected'}. Destination URL:{' '}
          {selectedDestinationUrl || 'not provided'}. Linked image:{' '}
          {selectedPublicImageAsset
            ? selectedPublicImageAsset.title
            : selectedSignedImageAsset
              ? 'signed URL may expire'
              : 'required'}.
        </Notice>
      ) : null}

      {assetOptions.length === 0 ? (
        <Notice tone="warning" title={t('dashboardI18n.contentStudio.noMatchingAssets', 'No matching creative assets yet')}>
          {t('dashboardI18n.contentStudio.noMatchingAssetsDescription', 'Create assets in Creative Assets first, then link them here.')}
        </Notice>
      ) : (
        <div className="grid gap-3">
          {assetOptions.map((asset) => {
            const video = readCreativeAssetVideo(asset);
            const isVideo = isCreativeVideoAsset(asset);
            const inputId = `content-studio-asset-${asset.id}`;

            return (
              <div
                key={asset.id}
                className="flex items-start gap-3 rounded-lg border border-black/8 bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#F7CBCA]/28 hover:bg-[#F9F7FB]"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  name="asset_ids"
                  value={asset.id}
                  checked={selectedAssetIdSet.has(asset.id)}
                  onChange={(event) => {
                    onAssetCheckboxChange(asset.id, event.currentTarget.checked);
                  }}
                  disabled={
                    savePending ||
                    isGenerating ||
                    isRemovingAsset ||
                    isLinkingAsset ||
                    removingAssetId === asset.id ||
                    linkingAssetId === asset.id
                  }
                  className="mt-1 h-4 w-4 rounded border-black/18 text-[#F7CBCA] focus:ring-[#F7CBCA]"
                />
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-[#D5E5E5]/36">
                  {isVideo && video?.publicUrl ? (
                    <video
                      src={video.publicUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full bg-black object-cover"
                    />
                  ) : asset.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.image_url}
                      alt={`${asset.title} thumbnail`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {isVideo ? (
                        <Play className="h-5 w-5 text-[#F7CBCA]" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-[#F7CBCA]" />
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor={inputId} className="block cursor-pointer break-words font-semibold text-black">
                    {asset.title}
                  </label>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/48">
                    <span>{formatContentStudioPlatformLabel(asset.platform, t)}</span>
                    <span>{asset.asset_type.replace(/_/g, ' ')}</span>
                    {isVideo ? <span>video asset</span> : null}
                    <span>{asset.status.replace(/_/g, ' ')}</span>
                    <span>
                      {isVideo
                        ? video?.publicUrl
                          ? 'public video URL'
                          : 'video URL missing'
                        : asset.image_url
                          ? 'image uploaded'
                          : 'no image'}
                    </span>
                    <span>{formatDateTime(asset.updated_at)}</span>
                  </div>
                  {selectedAssetIdSet.has(asset.id) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemoveAsset(asset.id);
                      }}
                      disabled={
                        savePending ||
                        isGenerating ||
                        isRemovingAsset ||
                        isLinkingAsset ||
                        removingAssetId === asset.id
                      }
                    >
                      <Unlink2 className="h-4 w-4" />
                      {removingAssetId === asset.id ? t('dashboardI18n.contentStudio.removing') : t('dashboardI18n.contentStudio.removeFromDraft')}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
