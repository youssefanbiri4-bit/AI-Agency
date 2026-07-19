'use client';

import { Copy, SearchCheck, Wand2 } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Label, Textarea } from '@/components/ui/FormControls';
import type { ContentStudioItemView } from '../shared';
import type { ContentStudioType } from '@/types/database';
import type { BrandKit } from '@/types/brand-kit';
import { useLanguage } from '@/i18n/context';

interface CreativeMessageFieldsProps {
  selectedItem: ContentStudioItemView | null;
  selectedType: ContentStudioType;
  visibleFieldSet: Set<string>;
  selectedStudio: {
    generationActions: Array<{ kind: string; label: string }>;
    copyActions: Array<{ label: string; packageLabel: string; fields: string[] }>;
    visibleFields: string[];
  };
  savePending: boolean;
  isGenerating: boolean;
  taskPending: boolean;
  activeGenerationKind: string | null;
  brandDefaultCreativeDirection: string | null;
  readCampaignString: (item: ContentStudioItemView | null, key: string) => string;
  readCampaignList: (item: ContentStudioItemView | null, key: string) => string;
  readTemplateDefault: (name: string) => string;
  defaultBrandValue: (value: string | null | undefined) => string;
  defaultHashtagLines: (value: string | null | undefined) => string;
  onGenerate: (kind: string) => void;
  onCopyText: (label: string, value: string) => void;
  onOpenQualityReview: () => void;
  buildPlatformPackage: (label: string, fieldNames: string[]) => string;
  brandKit: BrandKit;
}

function CaptionLabel({ selectedType }: { selectedType: ContentStudioType }) {
  const { t } = useLanguage();
  if (selectedType === 'linkedin_post_planner') return <>{t('dashboardI18n.contentStudio.linkedinPostBody', 'LinkedIn Post Body')}</>;
  if (selectedType === 'pinterest_pin') return <>{t('dashboardI18n.contentStudio.pinDescription', 'Pin Description')}</>;
  return <>{t('dashboardI18n.contentStudio.caption', 'Caption')}</>;
}

function HeadlinesLabel({ selectedType }: { selectedType: ContentStudioType }) {
  const { t } = useLanguage();
  if (selectedType === 'pinterest_pin') return <>{t('dashboardI18n.contentStudio.pinTitle', 'Pin Title')}</>;
  return <>{t('dashboardI18n.contentStudio.headlines', 'Headlines')}</>;
}

function DescriptionsLabel({ selectedType }: { selectedType: ContentStudioType }) {
  const { t } = useLanguage();
  if (selectedType === 'pinterest_pin') return <>{t('dashboardI18n.contentStudio.pinDescription', 'Pin Description')}</>;
  return <>{t('dashboardI18n.contentStudio.descriptions', 'Descriptions')}</>;
}

export function CreativeMessageFields({
  selectedItem,
  selectedType,
  visibleFieldSet,
  selectedStudio,
  savePending,
  isGenerating,
  taskPending,
  activeGenerationKind,
  brandDefaultCreativeDirection,
  readCampaignString,
  readCampaignList,
  readTemplateDefault,
  defaultBrandValue,
  defaultHashtagLines,
  onGenerate,
  onCopyText,
  onOpenQualityReview,
  buildPlatformPackage,
  brandKit,
}: CreativeMessageFieldsProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title={t('dashboardI18n.contentStudio.creativeMessage', 'Creative & Message')}
        description="Build the ad/package copy, structured campaign fields, and production notes for every channel."
        action={<Wand2 className="h-5 w-5 text-[#F7CBCA]" />}
      />

      {selectedItem ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectedStudio.generationActions.map((action) => (
            <Button
              key={action.kind}
              type="button"
              variant="soft"
              disabled={isGenerating || savePending || taskPending}
              className="justify-start"
              onClick={() => void onGenerate(action.kind)}
            >
              <Wand2 className="h-4 w-4" />
              {activeGenerationKind === action.kind
                ? `${action.label.replace('Generate ', 'Generating ')}...`
                : action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {selectedItem ? (
        <div className="mb-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/38">
            {t('dashboardI18n.contentStudio.existingContentPreserved', 'Existing field content is preserved. New AI generations are appended below a divider for review before saving.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedStudio.copyActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="outline"
                disabled={savePending || isGenerating || taskPending}
                className="justify-start"
                onClick={() =>
                  void onCopyText(
                    action.label,
                    buildPlatformPackage(action.packageLabel, action.fields)
                  )
                }
              >
                <Copy className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
            <button
              type="button"
              onClick={onOpenQualityReview}
              className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full justify-start' })}
            >
              <SearchCheck className="h-4 w-4" />
              Review Quality
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {visibleFieldSet.has('hook') ? (
        <div>
          <Label htmlFor="hook">{t('dashboardI18n.contentStudio.hook', 'Hook')}</Label>
          <Textarea
            id="hook"
            name="hook"
            rows={4}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'hook')}
            placeholder="Lead with the sharpest angle, pattern interrupt, or strongest opening line"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('primary_text') ? (
        <div>
          <Label htmlFor="primary_text">{t('dashboardI18n.contentStudio.primaryText', 'Primary Text')}</Label>
          <Textarea
            id="primary_text"
            name="primary_text"
            rows={4}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'primary_text')}
            placeholder="Primary text for ads and promoted posts"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('ad_copy') ? (
        <div>
          <Label htmlFor="ad_copy">{t('dashboardI18n.contentStudio.adCopy', 'Ad Copy')}</Label>
          <Textarea
            id="ad_copy"
            name="ad_copy"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={selectedItem?.ad_copy ?? readTemplateDefault('ad_copy')}
            placeholder="Primary copy, angle notes, testing notes, and variations"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('caption') ? (
        <div>
          <Label htmlFor="caption">
            <CaptionLabel selectedType={selectedType} />
          </Label>
          <Textarea
            id="caption"
            name="caption"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={selectedItem?.caption ?? readTemplateDefault('caption')}
            placeholder="Post caption, reel caption, or copy-ready LinkedIn text"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('script') ? (
        <div>
          <Label htmlFor="script">{t('dashboardI18n.contentStudio.scriptForReels', 'Script for Reels')}</Label>
          <Textarea
            id="script"
            name="script"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={selectedItem?.script ?? readTemplateDefault('script')}
            placeholder="Working script, structured talking points, or short-form flow"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('headlines') ? (
        <div>
          <Label htmlFor="headlines"><HeadlinesLabel selectedType={selectedType} /></Label>
          <Textarea
            id="headlines"
            name="headlines"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignList(selectedItem, 'headlines')}
            placeholder="One headline per line"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('descriptions') ? (
        <div>
          <Label htmlFor="descriptions"><DescriptionsLabel selectedType={selectedType} /></Label>
          <Textarea
            id="descriptions"
            name="descriptions"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignList(selectedItem, 'descriptions')}
            placeholder="Google Ads descriptions, supportive copy, or pin description variants"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('cta') ? (
        <div>
          <Label htmlFor="cta">{t('dashboardI18n.contentStudio.cta', 'CTA')}</Label>
          <Textarea
            id="cta"
            name="cta"
            rows={4}
            disabled={savePending || isGenerating}
            defaultValue={
              readCampaignString(selectedItem, 'cta') ||
              (!selectedItem ? defaultBrandValue(brandKit.defaultCta) : '')
            }
            placeholder="Call-to-action options or the preferred CTA"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('hashtags') ? (
        <div>
          <Label htmlFor="hashtags">{t('dashboardI18n.contentStudio.hashtags')}</Label>
          <Textarea
            id="hashtags"
            name="hashtags"
            rows={4}
            disabled={savePending || isGenerating}
            defaultValue={
              readCampaignList(selectedItem, 'hashtags') ||
              (!selectedItem ? defaultHashtagLines(brandKit.defaultHashtags) : '')
            }
            placeholder="One hashtag per line"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('keywords') ? (
        <div>
          <Label htmlFor="keywords">{t('dashboardI18n.contentStudio.keywords', 'Keywords')}</Label>
          <Textarea
            id="keywords"
            name="keywords"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignList(selectedItem, 'keywords') || readTemplateDefault('keywords')}
            placeholder="Search keyword ideas, one per line"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('creative_brief') ? (
        <div>
          <Label htmlFor="creative_brief">{t('dashboardI18n.contentStudio.creativeBrief', 'Creative Brief')}</Label>
          <Textarea
            id="creative_brief"
            name="creative_brief"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={
              selectedItem?.creative_brief ??
              (readTemplateDefault('creative_brief') ||
              (!selectedItem ? defaultBrandValue(brandDefaultCreativeDirection) : '')
              )
            }
            placeholder="Concept, visual direction, audience insight, and production notes"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('scene_breakdown') ? (
        <div>
          <Label htmlFor="scene_breakdown">Scene Breakdown</Label>
          <Textarea
            id="scene_breakdown"
            name="scene_breakdown"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'scene_breakdown')}
            placeholder="Scene-by-scene beats for reels, stories, or motion creative"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('on_screen_text') ? (
        <div>
          <Label htmlFor="on_screen_text">On-screen Text</Label>
          <Textarea
            id="on_screen_text"
            name="on_screen_text"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'on_screen_text')}
            placeholder="Text overlays, card copy, or slide text"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('voiceover_script') ? (
        <div>
          <Label htmlFor="voiceover_script">Voiceover Script</Label>
          <Textarea
            id="voiceover_script"
            name="voiceover_script"
            rows={5}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'voiceover_script')}
            placeholder="Voiceover lines for reels or short-form video"
          />
        </div>
        ) : null}

        {visibleFieldSet.has('platform_package') ? (
        <div className="md:col-span-2">
          <Label htmlFor="platform_package">Platform Package</Label>
          <Textarea
            id="platform_package"
            name="platform_package"
            rows={6}
            disabled={savePending || isGenerating}
            defaultValue={readCampaignString(selectedItem, 'platform_package') || readTemplateDefault('platform_package')}
            placeholder="Optional AI-generated or manually assembled platform package notes"
          />
        </div>
        ) : null}
      </div>
    </Card>
  );
}
