'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  Copy,
  FileCheck2,
  FileText,
  Filter,
  Image as ImageIcon,
  Megaphone,
  Pin,
  Play,
  Plus,
  SearchCheck,
  Send,
  Sparkles,
  Unlink2,
  Wand2,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { useActionToast } from '@/components/ui/useActionToast';
import { formatDateTime } from '@/lib/utils';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import {
  campaignTemplateCategories,
  campaignTemplates,
  type CampaignTemplate,
  type CampaignTemplateCategory,
  type CampaignTemplateFieldSet,
} from '@/lib/content-studio/campaign-templates';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import type { BrandKit } from '@/types/brand-kit';
import type {
  ContentStudioPlatform,
  ContentStudioStatus,
  ContentStudioType,
  CreativeAssetRecord,
} from '@/types/database';
import {
  createContentStudioItemAction,
  createContentStudioTaskAction,
  executeContentStudioProviderActionAction,
  generateContentStudioFieldAction,
  linkCreativeAssetToDraftAction,
  removeCreativeAssetFromDraftAction,
  updateContentStudioItemAction,
  type ContentStudioActionState,
} from './actions';
import {
  contentStudioStatusOptions,
  contentStudioTabOptions,
  contentStudioTaskOptions,
  contentStudioTypeOptions,
  type ContentStudioItemView,
  formatContentStudioPlatformLabel,
  type ContentStudioTab,
} from './shared';
import { CampaignPlanner } from './CampaignPlanner';
import { TemplateContextBanner } from './components/TemplateContextBanner';
import { PlatformSelector } from './components/PlatformSelector';
import { StudioHeader } from './components/StudioHeader';
import { BrandContextCard } from './components/BrandContextCard';
import { TemplatePickerCard } from './components/TemplatePickerCard';
import { CampaignBasicsFields, preservedFieldNames } from './components/CampaignBasicsFields';
import { CreativeMessageFields } from './components/CreativeMessageFields';
import { CreativeAssetsSection } from './components/CreativeAssetsSection';
import { ReadinessPanel } from './components/ReadinessPanel';
import { ExecutionActionsPanel } from './components/ExecutionActionsPanel';
import { ContentLibraryBanner } from './components/ContentLibraryBanner';
import { trackTemplateUsageAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import { useLanguage } from '@/i18n/context';
import {
  translateContentStudioStatus,
  translateContentStudioType,
  translateTemplateCategory,
} from '@/i18n/dashboard-labels';
import {
  useContentStudioFormActions,
  useContentStudioContentType,
  useContentStudioAssetSelection,
  useContentStudioGeneration,
  useContentStudioTemplates,
  filterAssetsForPlatform,
  readCampaignString,
  readCampaignList,
  readMetaAdsNumber,
  readMetaAdsList,
  readCreativeAssetVideo,
  isCreativeVideoAsset,
  isPublicImageUrl,
  buildQueryHref,
} from '@/hooks/content-studio';

interface ContentStudioClientProps {
  items: ContentStudioItemView[];
  selectedItem: ContentStudioItemView | null;
  creativeAssets: CreativeAssetRecord[];
  activeTab: ContentStudioTab;
  activeStatus: ContentStudioStatus | 'all';
  activeContentType?: ContentStudioType;
  searchQuery: string;
  initialDraftType?: ContentStudioType;
  schedulerReady: boolean;
  schedulerMessage: string;
  providerReadiness: Record<string, ProviderReadinessResult>;
  selectedItemProviderReadiness?: ProviderReadinessResult | null;
  brandKit: BrandKit;
  brandKitExists: boolean;
  agentTemplate?: AgentTemplate | null;
  templateNotFound?: boolean;
}

// Re-exports for sub-components (these are defined in hooks/content-studio)
export { platformStudioConfig, isMetaAdContentType, providerActionLabel, providerActionProgressLabel, safeProviderActionLabel } from '@/hooks/content-studio';
export type { PlatformStudioKey } from '@/hooks/content-studio';

// Inline utilities used only by JSX (not extracted to hooks)
function defaultBrandValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function defaultHashtagLines(value: string | null | undefined) {
  return value
    ?.split(/[\s,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n') ?? '';
}

function taskSuccessTitle(state: ContentStudioActionState) {
  return state.taskId ? 'AI task created' : 'Saved';
}

function formatDatetimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isTextControl(
  element: Element | RadioNodeList | null
): element is HTMLInputElement | HTMLTextAreaElement {
  return Boolean(
    element &&
      'value' in element &&
      (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
  );
}

export function ContentStudioClient({
  items,
  selectedItem,
  creativeAssets,
  activeTab,
  initialDraftType,
  schedulerReady,
  schedulerMessage,
  providerReadiness,
  selectedItemProviderReadiness,
  brandKit,
  brandKitExists,
  agentTemplate,
  templateNotFound = false,
}: ContentStudioClientProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    formRef, saveState, saveFormAction, savePending,
    taskState, taskFormAction, taskPending,
    providerState, providerFormAction, providerPending,
    templatePrefill, scheduleToastMethod,
  } = useContentStudioFormActions({ selectedItem, agentTemplate, schedulerReady, schedulerMessage });

  const {
    draftType, setDraftType, selectedType, selectedPlatform, selectedPlatformKey,
    selectedStudio, visibleFieldSet, availableTypeOptions,
  } = useContentStudioContentType({ selectedItem, initialDraftType, templatePrefill, activeTab });

  const {
    selectedAssetIdSet, selectedAssetNames, selectedAssets,
    selectedPublicImageAsset, selectedSignedImageAsset, selectedHasAnyImageAsset,
    isRemovingAsset, isLinkingAsset, removingAssetId, linkingAssetId,
    handleAssetCheckboxChange, removeAssetFromDraft,
  } = useContentStudioAssetSelection({ selectedItem, creativeAssets, selectedPlatform, router });

  const { activeGenerationKind, isGenerating, handleGenerate } = useContentStudioGeneration({
    selectedItem, formRef, savePending, taskPending,
  });

  const safeCreativeAssets = creativeAssets ?? [];
  const assetOptions = filterAssetsForPlatform(safeCreativeAssets, selectedPlatform);
  const selectedProviderReadiness =
    selectedItemProviderReadiness ?? providerReadiness[selectedPlatform];
  const selectedDestinationUrl = readCampaignString(selectedItem, 'destination_url');
  const selectedPinterestBoardName =
    typeof selectedProviderReadiness?.details?.selectedBoardName === 'string'
      ? selectedProviderReadiness.details.selectedBoardName
      : null;
  const selectedMetaAdAccountName =
    typeof selectedProviderReadiness?.details?.selectedAdAccountName === 'string'
      ? selectedProviderReadiness.details.selectedAdAccountName
      : null;
  const selectedHasBudget = Boolean(
    readMetaAdsNumber(selectedItem, 'daily_budget') ||
      readMetaAdsNumber(selectedItem, 'lifetime_budget')
  );
  const selectedHasCaption = Boolean(selectedItem?.caption?.trim());
  const selectedHasFacebookBody = Boolean(
    selectedItem?.caption?.trim() ||
      selectedItem?.script?.trim() ||
      selectedItem?.ad_copy?.trim() ||
      selectedItem?.objective?.trim() ||
      selectedHasAnyImageAsset
  );
  const brandDefaultOffer = brandKit.campaignDefaults.defaultOffer ?? brandKit.offer;
  const brandDefaultCreativeDirection =
    brandKit.campaignDefaults.defaultCreativeDirection ?? brandKit.visualStyle;

  function getSelectedAssetNames() {
    if (!formRef.current) {
      return [];
    }

    const formData = new FormData(formRef.current);
    const assetIds = new Set(
      formData
        .getAll('asset_ids')
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter(Boolean)
    );

    return safeCreativeAssets
      .filter((asset) => assetIds.has(asset.id))
      .map((asset) => asset.title);
  }

  function readFormValue(name: string) {
    if (!formRef.current) {
      return '';
    }

    const element = formRef.current.elements.namedItem(name);
    return isTextControl(element) ? element.value.trim() : '';
  }

  function writeFormValue(name: string, nextValue: string) {
    if (!formRef.current) {
      return false;
    }

    const element = formRef.current.elements.namedItem(name);

    if (!isTextControl(element)) {
      return false;
    }

    element.value = nextValue;
    return true;
  }

  const { activeTemplateCategory, setActiveTemplateCategory, visibleCampaignTemplates, handleUseTemplate } = useContentStudioTemplates({
    brandKit,
    brandKitExists,
    selectedItem,
    savePending,
    isGenerating,
    setDraftType,
    readFormValue,
    writeFormValue,
  });

  function readStoredFieldValue(name: string) {
    switch (name) {
      case 'caption':
        return selectedItem?.caption ?? '';
      case 'script':
        return selectedItem?.script ?? '';
      case 'ad_copy':
        return selectedItem?.ad_copy ?? '';
      case 'creative_brief':
        return selectedItem?.creative_brief ?? '';
      case 'headlines':
      case 'descriptions':
      case 'keywords':
      case 'hashtags':
        return readCampaignList(selectedItem, name);
      default:
        return readCampaignString(selectedItem, name);
    }
  }

  function readTemplateDefault(name: string) {
    if (selectedItem || !templatePrefill) return '';

    switch (name) {
      case 'title':
        return templatePrefill.title;
      case 'objective':
        return templatePrefill.objective;
      case 'prompt':
        return templatePrefill.prompt;
      case 'caption':
        return templatePrefill.caption;
      case 'script':
        return templatePrefill.script;
      case 'ad_copy':
        return templatePrefill.adCopy;
      case 'creative_brief':
        return templatePrefill.creativeBrief;
      case 'platform_package':
        return templatePrefill.platformPackage;
      case 'keywords':
        return templatePrefill.keywords;
      default:
        return '';
    }
  }

  function buildPlatformPackage(label: string, fieldNames: string[]) {
    const assetNames = getSelectedAssetNames();
    const lines = [
      `${label} Package`,
      '',
      `Campaign Name: ${readFormValue('title') || 'Not provided'}`,
      `Objective: ${readFormValue('objective') || 'Not provided'}`,
      `Destination URL: ${readFormValue('destination_url') || 'Not provided'}`,
    ];

    if (label === 'Pinterest Pin') {
      lines.push(`Board: ${selectedPinterestBoardName ?? 'Not selected'}`);
      lines.push(`Linked Image Asset: ${assetNames[0] ?? 'None linked'}`);
      lines.push(`Provider Readiness: ${selectedProviderReadiness?.state ?? 'unsupported'}`);
    }

    if (label === 'Meta Ads') {
      lines.push(`Meta Ad Account: ${selectedMetaAdAccountName ?? 'Not selected'}`);
      lines.push(`Budget: ${readFormValue('daily_budget') || readFormValue('lifetime_budget') || 'Not provided'}`);
      lines.push(`Audience: ${readFormValue('target_audience') || 'Not provided'}`);
      lines.push(`Linked Creative Assets: ${assetNames.length > 0 ? assetNames.join(', ') : 'None linked'}`);
      lines.push(`Provider Readiness: ${selectedProviderReadiness?.state ?? 'unsupported'}`);
    }

    for (const fieldName of fieldNames) {
      lines.push('');
      lines.push(
        fieldName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (value) => value.toUpperCase())
      );
      lines.push(readFormValue(fieldName) || 'Not provided');
    }

    return lines.join('\n');
  }

  async function copyText(label: string, value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      toast.info('Nothing to copy yet.', {
        description: `Add ${label.toLowerCase()} content first, then try again.`,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success(label === 'Pinterest Pin Package' ? 'Copied Pinterest package.' : 'Copied to clipboard.');
    } catch {
      toast.error('Could not copy to clipboard.', {
        description: 'Your browser blocked clipboard access. Try again after granting permission.',
      });
    }
  }

  function openQualityReview() {
    const reviewType = selectedType === 'google_ads_campaign_draft' || selectedType.includes('ad') ? 'ad_copy' : 'marketing_content';
    const reviewPlatform =
      selectedPlatformKey === 'google_ads'
        ? 'google_ads'
        : selectedPlatformKey === 'instagram' || selectedPlatformKey === 'facebook' || selectedPlatformKey === 'linkedin'
          ? selectedPlatformKey
          : 'generic';
    const packageContent = buildPlatformPackage('Content Studio Draft', selectedStudio.visibleFields).slice(0, 6000);
    router.push(`/dashboard/quality-review?type=${reviewType}&platform=${reviewPlatform}&content=${encodeURIComponent(packageContent)}`);
  }

  return (
    <div className="space-y-6">
      {templateNotFound ? (
        <Notice tone="warning" title={t('dashboardI18n.contentStudio.templateNotFound')}>
          {t('dashboardI18n.contentStudio.templateNotFoundDescription')}
        </Notice>
      ) : null}

      {agentTemplate && templatePrefill ? (
        <TemplateContextBanner agentTemplate={agentTemplate} templatePrefill={templatePrefill} />
      ) : null}

      <PlatformSelector
        activeTab={activeTab}
        buildQueryHref={buildQueryHref}
        pathname={pathname}
        searchParams={searchParams}
      />

      <div className="grid gap-8">
      <div className="space-y-6">
        <div key={selectedItem?.id ?? 'new-item'} className="space-y-6">
          {(saveState.error || taskState.error) && (
            <Notice tone="danger" title={t('dashboardI18n.contentStudio.actionFailed')}>
              {saveState.error || taskState.error}
            </Notice>
          )}

          {saveState.message && !saveState.error && (
            <Notice tone="success" title={t('dashboardI18n.contentStudio.itemSaved')}>
              {saveState.message}
            </Notice>
          )}

          {taskState.message && !taskState.error && (
            <Notice tone="success" title={taskSuccessTitle(taskState)}>
              <span>{taskState.message}</span>
              {taskState.taskId ? (
                <Link
                  href={`/dashboard/tasks/${taskState.taskId}`}
                  className="ms-2 inline-flex font-bold text-[#F7CBCA] hover:text-black"
                >
                  {t('dashboardI18n.contentStudio.openTask')}
                </Link>
              ) : null}
            </Notice>
          )}

          {providerState.error && (
            <Notice tone="warning" title={t('dashboardI18n.contentStudio.providerActionUpdate')}>
              {providerState.error}
            </Notice>
          )}

          {providerState.message && !providerState.error && providerState.outcome === 'success' && (
            <Notice tone="success" title={t('dashboardI18n.contentStudio.providerActionCompleted')}>
              {providerState.message}
            </Notice>
          )}

          <StudioHeader
            selectedItem={selectedItem}
            selectedStudio={selectedStudio}
            selectedPlatformKey={selectedPlatformKey}
          />

          <BrandContextCard brandKit={brandKit} brandKitExists={brandKitExists} />

          <CampaignPlanner
            brandKit={brandKit}
            brandKitExists={brandKitExists}
            providerReadiness={providerReadiness}
          />

          <TemplatePickerCard
            visibleCampaignTemplates={visibleCampaignTemplates}
            activeTemplateCategory={activeTemplateCategory}
            savePending={savePending}
            isGenerating={isGenerating}
            onCategoryChange={setActiveTemplateCategory}
            onUseTemplate={handleUseTemplate}
          />

          <form ref={formRef} action={saveFormAction} className="space-y-6">
            {preservedFieldNames
              .filter((fieldName) => !visibleFieldSet.has(fieldName))
              .map((fieldName) => (
                <input
                  key={fieldName}
                  type="hidden"
                  name={fieldName}
                  defaultValue={readStoredFieldValue(fieldName)}
                />
              ))}

            <CampaignBasicsFields
              selectedItem={selectedItem}
              selectedType={selectedType}
              availableTypeOptions={availableTypeOptions}
              savePending={savePending}
              isGenerating={isGenerating}
              schedulerReady={schedulerReady}
              schedulerMessage={schedulerMessage}
              brandKit={brandKit}
              brandDefaultOffer={brandDefaultOffer}
              readCampaignString={readCampaignString}
              readMetaAdsNumber={readMetaAdsNumber}
              readMetaAdsList={readMetaAdsList}
              readTemplateDefault={readTemplateDefault}
              formatDatetimeLocal={formatDatetimeLocal}
              defaultBrandValue={defaultBrandValue}
              onDraftTypeChange={setDraftType}
            />

            <CreativeMessageFields
              visibleFieldSet={visibleFieldSet}
              readCampaignString={readCampaignString}
              readCampaignList={readCampaignList}
              readTemplateDefault={readTemplateDefault}
              defaultBrandValue={defaultBrandValue}
              defaultHashtagLines={defaultHashtagLines}
              brandDefaultCreativeDirection={brandDefaultCreativeDirection}
              brandKit={brandKit}
              selectedItem={selectedItem}
              selectedType={selectedType}
              selectedStudio={selectedStudio}
              savePending={savePending}
              isGenerating={isGenerating}
              taskPending={taskPending}
              activeGenerationKind={activeGenerationKind}
              onGenerate={(kind) => void handleGenerate(kind)}
              onCopyText={(label, value) => void copyText(label, value)}
              onOpenQualityReview={openQualityReview}
              buildPlatformPackage={buildPlatformPackage}
            />

            <CreativeAssetsSection
              selectedStudio={selectedStudio}
              selectedType={selectedType}
              selectedAssetNames={selectedAssetNames}
              selectedAssetIdSet={selectedAssetIdSet}
              selectedPublicImageAsset={selectedPublicImageAsset}
              selectedSignedImageAsset={selectedSignedImageAsset}
              selectedPinterestBoardName={selectedPinterestBoardName}
              selectedDestinationUrl={selectedDestinationUrl}
              selectedProviderReadiness={selectedProviderReadiness}
              assetOptions={assetOptions}
              savePending={savePending}
              isGenerating={isGenerating}
              isRemovingAsset={isRemovingAsset}
              isLinkingAsset={isLinkingAsset}
              removingAssetId={removingAssetId}
              linkingAssetId={linkingAssetId}
              onAssetCheckboxChange={handleAssetCheckboxChange}
              onRemoveAsset={removeAssetFromDraft}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {selectedItem ? (
                <Link
                  href={buildQueryHref({
                    pathname,
                    searchParams: new URLSearchParams(searchParams.toString()),
                    itemId: null,
                  })}
                  onClick={() =>
                    toast.info('Starting a new draft.', {
                      description: 'Your current item stays saved in Content Library.',
                    })
                  }
                  className={buttonStyles({ variant: 'outline' })}
                >
                  <Plus className="h-4 w-4" />
                  {t('dashboardI18n.contentStudio.newDraft')}
                </Link>
              ) : null}
              <Button
                type="submit"
                disabled={savePending || isGenerating}
                size="lg"
              >
                <Plus className="h-4 w-4" />
                {savePending
                  ? t('dashboardI18n.contentStudio.saving')
                  : selectedItem
                    ? t('dashboardI18n.contentStudio.updateContentItem')
                    : t('dashboardI18n.contentStudio.createContentItem')}
              </Button>
            </div>
          </form>

          <ReadinessPanel
            selectedPlatformKey={selectedPlatformKey}
            selectedPlatform={selectedPlatform}
            selectedType={selectedType}
            selectedProviderReadiness={selectedProviderReadiness}
            providerReadiness={providerReadiness}
            selectedStudio={selectedStudio}
          />

          {selectedItem ? (
            <Card>
              <CardHeader
                title={t('dashboardI18n.contentStudio.aiTaskActions', 'AI Task Actions')}
                description="Create normal task records linked to this content item. Existing task execution, callback, and webhook behavior remain untouched."
                action={<FileText className="h-5 w-5 text-[#F7CBCA]" />}
              />

              <form action={taskFormAction} className="grid gap-3 sm:grid-cols-2">
                {contentStudioTaskOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="submit"
                    name="task_kind"
                    value={option.value}
                    variant="soft"
                    disabled={taskPending || savePending}
                    className="justify-start"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('action.createTask')} {option.label}
                  </Button>
                ))}
              </form>
            </Card>
          ) : null}

          {selectedItem ? (
            <ExecutionActionsPanel
              selectedItem={selectedItem}
              selectedType={selectedType}
              selectedProviderReadiness={selectedProviderReadiness}
              selectedAssets={selectedAssets}
              selectedPublicImageAsset={selectedPublicImageAsset}
              selectedSignedImageAsset={selectedSignedImageAsset}
              selectedMetaAdAccountName={selectedMetaAdAccountName}
              selectedPinterestBoardName={selectedPinterestBoardName}
              selectedHasFacebookBody={selectedHasFacebookBody}
              selectedHasCaption={selectedHasCaption}
              selectedHasBudget={selectedHasBudget}
              readCampaignString={readCampaignString}
              readCampaignList={readCampaignList}
              providerPending={providerPending}
              taskPending={taskPending}
              savePending={savePending}
              isGenerating={isGenerating}
              schedulerReady={schedulerReady}
              schedulerMessage={schedulerMessage}
              providerFormAction={providerFormAction}
              scheduleToastMethod={scheduleToastMethod}
            />
          ) : null}
        </div>
      </div>

      <ContentLibraryBanner itemCount={items.length} />
      </div>
    </div>
  );
}
