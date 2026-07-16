'use client';

import { useState, useTransition } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ContentStudioPlatform, CreativeAssetRecord } from '@/types/database';
import type { ContentStudioItemView } from '@/app/(dashboard)/dashboard/content-studio/shared';
import { toast } from '@/components/ui/toast';
import {
  linkCreativeAssetToDraftAction,
  removeCreativeAssetFromDraftAction,
} from '@/app/(dashboard)/dashboard/content-studio/actions';
import { isSignedImageUrl, isPublicImageUrl } from './shared';

interface UseContentStudioAssetSelectionOptions {
  selectedItem: ContentStudioItemView | null;
  creativeAssets: CreativeAssetRecord[];
  selectedPlatform: ContentStudioPlatform;
  router: AppRouterInstance;
}

interface UseContentStudioAssetSelectionReturn {
  assetSelection: { itemId: string | null; ids: string[] };
  currentSelectedAssetIds: string[];
  selectedAssetIdSet: Set<string>;
  selectedAssetNames: string[];
  selectedAssets: CreativeAssetRecord[];
  selectedPublicImageAsset: CreativeAssetRecord | undefined;
  selectedSignedImageAsset: CreativeAssetRecord | undefined;
  selectedHasAnyImageAsset: boolean;
  isRemovingAsset: boolean;
  isLinkingAsset: boolean;
  removingAssetId: string | null;
  linkingAssetId: string | null;
  handleAssetCheckboxChange: (assetId: string, checked: boolean) => void;
  removeAssetFromDraft: (assetId: string) => void;
  linkAssetToDraft: (assetId: string) => void;
}

export function useContentStudioAssetSelection({
  selectedItem,
  creativeAssets,
  router,
}: UseContentStudioAssetSelectionOptions): UseContentStudioAssetSelectionReturn {
  const safeCreativeAssets = creativeAssets ?? [];

  const [assetSelection, setAssetSelection] = useState<{
    itemId: string | null;
    ids: string[];
  }>({
    itemId: selectedItem?.id ?? null,
    ids: selectedItem?.asset_ids ?? [],
  });
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [linkingAssetId, setLinkingAssetId] = useState<string | null>(null);
  const [isRemovingAsset, startRemoveAssetTransition] = useTransition();
  const [isLinkingAsset, startLinkAssetTransition] = useTransition();

  const currentSelectedAssetIds =
    assetSelection.itemId === (selectedItem?.id ?? null)
      ? assetSelection.ids ?? []
      : selectedItem?.asset_ids ?? [];
  const selectedAssetIdSet = new Set(currentSelectedAssetIds);
  const selectedAssetNames = safeCreativeAssets
    .filter((asset) => selectedAssetIdSet.has(asset.id))
    .map((asset) => asset.title);
  const selectedAssets = safeCreativeAssets.filter((asset) => selectedAssetIdSet.has(asset.id));
  const selectedPublicImageAsset = selectedAssets.find((asset) => isPublicImageUrl(asset.image_url));
  const selectedSignedImageAsset = selectedAssets.find((asset) => isSignedImageUrl(asset.image_url));
  const selectedHasAnyImageAsset = selectedAssets.some((asset) => Boolean(asset.image_url));

  const removeAssetFromDraft = (assetId: string) => {
    const nextItemId = selectedItem?.id ?? null;

    if (!assetId) {
      toast.error('Could not remove creative asset from draft.');
      return;
    }

    if (!nextItemId) {
      setAssetSelection((current) => ({
        itemId: nextItemId,
        ids: (current.itemId === nextItemId ? current.ids ?? [] : []).filter((id) => id !== assetId),
      }));
      return;
    }

    setRemovingAssetId(assetId);
    startRemoveAssetTransition(async () => {
      const result = await removeCreativeAssetFromDraftAction(nextItemId, assetId);

      if (result.error) {
        toast.error('Could not remove creative asset from draft.');
        setRemovingAssetId(null);
        return;
      }

      setAssetSelection((current) => {
        const currentIds =
          result.assetIds ??
          (current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? []);

        return {
          itemId: nextItemId,
          ids: currentIds.filter((id) => id !== assetId),
        };
      });
      toast.success('Creative asset removed from draft.');
      setRemovingAssetId(null);
      router.refresh();
    });
  };

  const linkAssetToDraft = (assetId: string) => {
    const nextItemId = selectedItem?.id ?? null;

    if (!assetId) {
      toast.error('Could not link creative asset to draft.');
      return;
    }

    setAssetSelection((current) => {
      const currentIds = current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? [];

      return {
        itemId: nextItemId,
        ids: Array.from(new Set([...currentIds, assetId])),
      };
    });

    if (!nextItemId) {
      return;
    }

    setLinkingAssetId(assetId);
    startLinkAssetTransition(async () => {
      const result = await linkCreativeAssetToDraftAction(nextItemId, assetId);

      if (result.error) {
        setAssetSelection((current) => {
          const currentIds = current.itemId === nextItemId ? current.ids ?? [] : selectedItem?.asset_ids ?? [];

          return {
            itemId: nextItemId,
            ids: currentIds.filter((id) => id !== assetId),
          };
        });
        toast.error('Could not link creative asset to draft.');
        setLinkingAssetId(null);
        return;
      }

      setAssetSelection({
        itemId: nextItemId,
        ids: result.assetIds ?? [],
      });
      setLinkingAssetId(null);
      router.refresh();
    });
  };

  const handleAssetCheckboxChange = (assetId: string, checked: boolean) => {
    if (!assetId) {
      toast.error('Could not update creative asset selection.');
      return;
    }

    if (checked) {
      linkAssetToDraft(assetId);
      return;
    }

    removeAssetFromDraft(assetId);
  };

  return {
    assetSelection,
    currentSelectedAssetIds,
    selectedAssetIdSet,
    selectedAssetNames,
    selectedAssets,
    selectedPublicImageAsset,
    selectedSignedImageAsset,
    selectedHasAnyImageAsset,
    isRemovingAsset,
    isLinkingAsset,
    removingAssetId,
    linkingAssetId,
    handleAssetCheckboxChange,
    removeAssetFromDraft,
    linkAssetToDraft,
  };
}
