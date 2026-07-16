'use client';

import { CalendarClock, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import type { ContentStudioItemView } from '../shared';
import type { ContentStudioType } from '@/types/database';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import {
  isMetaAdContentType,
  providerActionProgressLabel,
  safeProviderActionLabel,
} from '../ContentStudioClient';
import { useLanguage } from '@/i18n/context';

interface ExecutionActionsPanelProps {
  selectedItem: ContentStudioItemView;
  selectedType: ContentStudioType;
  selectedProviderReadiness: ProviderReadinessResult | null;
  providerPending: boolean;
  savePending: boolean;
  taskPending: boolean;
  isGenerating: boolean;
  schedulerReady: boolean;
  schedulerMessage: string;
  selectedHasFacebookBody: boolean;
  selectedHasCaption: boolean;
  selectedHasBudget: boolean;
  selectedMetaAdAccountName: string | null;
  selectedPinterestBoardName: string | null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- conditional type inference
  selectedAssets: ContentStudioItemView['asset_ids'] extends Array<infer _T> ? Array<{ id: string; metadata?: Record<string, unknown> }> : never;
  selectedPublicImageAsset: { id: string } | undefined;
  selectedSignedImageAsset: { id: string } | undefined;
  readCampaignString: (item: ContentStudioItemView | null, key: string) => string;
  readCampaignList: (item: ContentStudioItemView | null, key: string) => string;
  scheduleToastMethod: (message: string, options?: { description?: string }) => void;
  providerFormAction: (formData: FormData) => void;
}

function ReadinessCheckCard({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-bold text-black">{label}</p>
      <p className="mt-2 text-sm leading-6 text-black/58">{status}</p>
    </div>
  );
}

export function ExecutionActionsPanel({
  selectedItem,
  selectedProviderReadiness,
  providerPending,
  savePending,
  taskPending,
  isGenerating,
  schedulerReady,
  schedulerMessage,
  selectedHasFacebookBody,
  selectedHasCaption,
  selectedHasBudget,
  selectedMetaAdAccountName,
  selectedPinterestBoardName,
  selectedAssets,
  selectedPublicImageAsset,
  selectedSignedImageAsset,
  readCampaignString,
  readCampaignList,
  scheduleToastMethod,
  providerFormAction,
}: ExecutionActionsPanelProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title={t('dashboardI18n.contentStudio.executionActions', 'Execution Actions')}
        description="These actions now either execute the real provider call or explain exactly what setup is still missing."
        action={<Send className="h-5 w-5 text-[#F7CBCA]" />}
      />

      {selectedItem.content_type === 'facebook_post' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <ReadinessCheckCard
            label="Facebook Page"
            status={
              selectedProviderReadiness?.state === 'ready'
                ? selectedProviderReadiness.message
                : selectedProviderReadiness?.message ?? 'Facebook Page setup required.'
            }
          />
          <ReadinessCheckCard
            label="Text or image"
            status={
              selectedHasFacebookBody
                ? 'Ready: post text or a linked image is present.'
                : 'Add post text or link an image asset before publishing.'
            }
          />
        </div>
      ) : null}

      {selectedItem.content_type === 'instagram_post' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <ReadinessCheckCard
            label="Instagram account"
            status={
              selectedProviderReadiness?.state === 'ready'
                ? selectedProviderReadiness.message
                : selectedProviderReadiness?.message ??
                  'Instagram Business Account setup required.'
            }
          />
          <ReadinessCheckCard
            label="Image asset"
            status={
              selectedPublicImageAsset
                ? 'Ready: public HTTPS image asset linked.'
                : selectedSignedImageAsset
                  ? 'This image URL may expire before Meta can process it. Use a public uploaded asset.'
                  : 'Image asset required.'
            }
          />
          <ReadinessCheckCard
            label="Caption"
            status={selectedHasCaption ? 'Ready: caption present.' : 'Caption required.'}
          />
        </div>
      ) : null}

      {isMetaAdContentType(selectedItem.content_type) ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <ReadinessCheckCard
            label="Meta ad account"
            status={selectedMetaAdAccountName ?? 'Meta Ad Account is not selected.'}
          />
          <ReadinessCheckCard
            label="Permission"
            status={
              selectedProviderReadiness?.details?.hasAdsManagement
                ? 'ads_management permission is present.'
                : selectedProviderReadiness?.message ?? 'Meta Ads permission ads_management is missing.'
            }
          />
          <ReadinessCheckCard
            label="Budget"
            status={selectedHasBudget ? 'Budget is present.' : 'Budget is required.'}
          />
          <ReadinessCheckCard
            label="Creative asset"
            status={
              selectedPublicImageAsset
                ? 'Ready: public HTTPS creative asset linked.'
                : selectedSignedImageAsset
                  ? 'Creative asset must have a public HTTPS URL.'
                  : 'A creative asset is required.'
            }
          />
          <ReadinessCheckCard
            label="Destination URL"
            status={
              readCampaignString(selectedItem, 'destination_url')
                ? 'Destination URL is present.'
                : 'Destination URL is required.'
            }
          />
          <ReadinessCheckCard
            label="Safety"
            status="Created Meta campaign, ad set, and ad stay PAUSED."
          />
        </div>
      ) : null}

      {selectedItem.content_type === 'instagram_reel' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <ReadinessCheckCard
            label="Instagram Business Account"
            status={selectedProviderReadiness?.message ?? 'Instagram account setup required.'}
          />
          <ReadinessCheckCard
            label="Video asset"
            status={
              selectedAssets.some((asset) => isCreativeVideoAsset(asset))
                ? 'Video asset linked.'
                : 'Linked video asset required for reels.'
            }
          />
          <ReadinessCheckCard
            label="Public HTTPS media URL"
            status={
              selectedAssets.some((asset) => isPublicImageUrl(readCreativeAssetVideo(asset)?.publicUrl))
                ? 'Public HTTPS video URL present.'
                : 'Public HTTPS video URL required.'
            }
          />
        </div>
      ) : null}

      {selectedItem.content_type === 'google_ads_campaign_draft' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <ReadinessCheckCard
            label="OAuth connection"
            status={selectedProviderReadiness?.message ?? 'Google Ads OAuth connection required.'}
          />
          <ReadinessCheckCard
            label="Destination URL"
            status={readCampaignString(selectedItem, 'destination_url') ? 'Destination URL is present.' : 'Destination URL is required.'}
          />
          <ReadinessCheckCard
            label="Budget, ad copy, keywords"
            status={
              readCampaignString(selectedItem, 'offer') || readCampaignList(selectedItem, 'keywords') || selectedItem.ad_copy
                ? 'Draft inputs are present.'
                : 'Add budget notes, keywords, and ad copy before creating the paused draft.'
            }
          />
        </div>
      ) : null}

      {selectedItem.content_type === 'pinterest_pin' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <ReadinessCheckCard
            label="OAuth and board"
            status={`Board: ${selectedPinterestBoardName ?? 'not selected'}. ${selectedProviderReadiness?.message ?? ''}`}
          />
          <ReadinessCheckCard
            label="Image asset"
            status={selectedPublicImageAsset ? 'Public HTTPS image asset linked.' : 'Public HTTPS image asset required.'}
          />
          <ReadinessCheckCard
            label="Destination URL"
            status={readCampaignString(selectedItem, 'destination_url') ? 'Destination URL is present.' : 'Destination URL is recommended before publishing.'}
          />
        </div>
      ) : null}

      {selectedItem.content_type === 'linkedin_post_planner' ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <ReadinessCheckCard
            label="manual_only"
            status="LinkedIn publishing is not implemented, so this planner only supports copy-ready handoff."
          />
          <ReadinessCheckCard
            label="Future API setup"
            status="Real LinkedIn OAuth and publishing can be connected later without fake publish buttons now."
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() =>
            scheduleToastMethod(
              selectedItem.content_type === 'linkedin_post_planner' ||
                isMetaAdContentType(selectedItem.content_type)
                ? 'This item is manual-only and will not auto-publish.'
                : schedulerReady
                  ? 'Scheduled for real execution.'
                  : schedulerMessage,
              {
                description:
                  selectedItem.content_type === 'linkedin_post_planner' ||
                    isMetaAdContentType(selectedItem.content_type)
                    ? 'Use the copy-ready package and keep paid campaign creation safely blocked until provider support is ready.'
                    : schedulerReady
                      ? 'The secure cron job will execute this item after its planned time when the provider is ready.'
                      : 'Configure CRON_SECRET and Vercel Cron, then redeploy to enable automatic execution.',
              }
            )
          }
        >
          <CalendarClock className="h-4 w-4" />
          {t('dashboardI18n.contentStudio.schedule')}
        </Button>
        {selectedItem.content_type !== 'linkedin_post_planner' ? (
        <form
          action={providerFormAction}
          onSubmit={(event) => {
            const confirmed = window.confirm(
              isMetaAdContentType(selectedItem.content_type)
                ? 'This will create a PAUSED Meta campaign/ad draft. It will not spend money until you activate it manually in Meta Ads Manager. / سيتم إنشاء مسودة متوقفة فقط.'
                : 'Send this content to the configured provider now? / واش ترسل هذا المحتوى للمزوّد دابا؟'
            );

            if (!confirmed) {
              event.preventDefault();
              return;
            }

            let confirmationInput = event.currentTarget.querySelector<HTMLInputElement>(
              'input[name="provider_action_confirmed"]'
            );

            if (!confirmationInput) {
              confirmationInput = document.createElement('input');
              confirmationInput.type = 'hidden';
              confirmationInput.name = 'provider_action_confirmed';
              event.currentTarget.appendChild(confirmationInput);
            }

            confirmationInput.value = 'true';
          }}
        >
          <Button
            type="submit"
            variant="outline"
            className="w-full justify-start"
            disabled={providerPending || savePending || taskPending || isGenerating}
          >
            <Send className="h-4 w-4" />
            {providerPending
              ? providerActionProgressLabel(selectedItem)
              : safeProviderActionLabel(selectedItem, selectedProviderReadiness)}
          </Button>
        </form>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="justify-start"
          onClick={() =>
            t(
              selectedItem.content_type === 'linkedin_post_planner'
                ? 'dashboardI18n.contentStudio.copyLinkedinPackage'
                : 'dashboardI18n.contentStudio.copyReadyHandoff'
            )
          }
        >
          <Copy className="h-4 w-4" />
          {selectedItem.content_type === 'linkedin_post_planner'
            ? t('dashboardI18n.contentStudio.copyLinkedinPackage')
            : t('dashboardI18n.contentStudio.copyReadyHandoff')}
        </Button>
      </div>

      {selectedItem.provider_error ? (
        <p className="mt-4 text-sm leading-6 text-black/58">{selectedItem.provider_error}</p>
      ) : null}
      {selectedItem.status === 'scheduled' &&
      (selectedItem.content_type === 'linkedin_post_planner' ||
        isMetaAdContentType(selectedItem.content_type)) ? (
        <p className="mt-4 text-sm leading-6 text-black/58">
          This item is manual-only and will not auto-publish.
        </p>
      ) : null}
    </Card>
  );
}

function readCreativeAssetVideo(asset: { metadata?: Record<string, unknown> }) {
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

function isCreativeVideoAsset(asset: { asset_type?: string; metadata?: Record<string, unknown> }) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(readCreativeAssetVideo(asset)?.publicUrl)
  );
}

function isPublicImageUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
