'use client';

import { useState, useMemo } from 'react';
import type { ContentStudioType } from '@/types/database';
import type { ContentStudioItemView } from '@/app/(dashboard)/dashboard/content-studio/shared';
import type { BrandKit } from '@/types/brand-kit';
import {
  campaignTemplateCategories,
  campaignTemplates,
  type CampaignTemplate,
  type CampaignTemplateCategory,
  type CampaignTemplateFieldSet,
} from '@/lib/content-studio/campaign-templates';
import { toast } from '@/components/ui/toast';

const templateFieldLabels: Partial<Record<keyof CampaignTemplateFieldSet, string>> = {
  title: 'Campaign Name',
  objective: 'Objective',
  target_audience: 'Target Audience',
  offer: 'Offer / Budget Notes',
  destination_url: 'Destination URL',
  prompt: 'Prompt / Direction',
  hook: 'Hook',
  primary_text: 'Primary Text',
  caption: 'Caption',
  script: 'Script',
  scene_breakdown: 'Scene Breakdown',
  on_screen_text: 'On-screen Text',
  voiceover_script: 'Voiceover Script',
  headlines: 'Headlines',
  descriptions: 'Descriptions',
  keywords: 'Keywords',
  ad_copy: 'Ad Copy',
  cta: 'CTA',
  hashtags: 'Hashtags',
  creative_brief: 'Creative Brief',
  platform_package: 'Platform Package',
};

interface UseContentStudioTemplatesOptions {
  brandKit: BrandKit;
  brandKitExists: boolean;
  selectedItem: ContentStudioItemView | null;
  savePending: boolean;
  isGenerating: boolean;
  setDraftType: React.Dispatch<React.SetStateAction<ContentStudioType>>;
  readFormValue: (name: string) => string;
  writeFormValue: (name: string, nextValue: string) => boolean;
}

interface UseContentStudioTemplatesReturn {
  activeTemplateCategory: CampaignTemplateCategory | 'All';
  setActiveTemplateCategory: React.Dispatch<React.SetStateAction<CampaignTemplateCategory | 'All'>>;
  visibleCampaignTemplates: CampaignTemplate[];
  handleUseTemplate: (template: CampaignTemplate) => void;
}

export function useContentStudioTemplates({
  brandKit,
  brandKitExists,
  selectedItem,
  savePending,
  isGenerating,
  setDraftType,
  readFormValue,
  writeFormValue,
}: UseContentStudioTemplatesOptions): UseContentStudioTemplatesReturn {
  const [activeTemplateCategory, setActiveTemplateCategory] =
    useState<CampaignTemplateCategory | 'All'>('All');

  const visibleCampaignTemplates = useMemo(
    () =>
      campaignTemplates.filter((template) =>
        activeTemplateCategory === 'All'
          ? true
          : template.categories.includes(activeTemplateCategory)
      ),
    [activeTemplateCategory]
  );

  function applyTemplateFields(fields: CampaignTemplateFieldSet, overwriteFilledFields: boolean) {
    const skippedFields: string[] = [];

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) {
        continue;
      }

      const currentValue = readFormValue(fieldName);

      if (currentValue && !overwriteFilledFields) {
        skippedFields.push(templateFieldLabels[fieldName as keyof CampaignTemplateFieldSet] ?? fieldName);
        continue;
      }

      writeFormValue(fieldName, fieldValue);
    }

    return skippedFields;
  }

  function handleUseTemplate(template: CampaignTemplate) {
    if (savePending || isGenerating) {
      return;
    }

    const fields = template.buildFields(brandKit);
    const filledFields = Object.keys(fields).filter((fieldName) => Boolean(readFormValue(fieldName)));
    const overwriteFilledFields =
      filledFields.length > 0
        ? window.confirm(
            'Some draft fields already have text. Overwrite those fields with the template? Choose Cancel to fill only empty fields.'
          )
        : false;

    if (!selectedItem) {
      setDraftType(template.contentType);
    } else if (selectedItem.content_type !== template.contentType) {
      toast.info('Template platform kept copy-ready.', {
        description:
          'This saved item already has a fixed platform/type, so only compatible draft fields were filled.',
      });
    }

    window.setTimeout(() => {
      const skippedFields = applyTemplateFields(fields, overwriteFilledFields);

      if (brandKitExists) {
        toast.success('Template applied.');
        return;
      }

      toast.info('Template applied. Add a Brand Kit for more personalized content.', {
        description:
          skippedFields.length > 0
            ? `Kept existing text in: ${skippedFields.slice(0, 4).join(', ')}.`
            : undefined,
      });
    }, 0);
  }

  return {
    activeTemplateCategory,
    setActiveTemplateCategory,
    visibleCampaignTemplates,
    handleUseTemplate,
  };
}
