'use client';

import { Megaphone } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import {
  contentStudioStatusOptions,
  contentStudioTypeOptions,
  type ContentStudioItemView,
} from '../shared';
import { isMetaAdContentType } from '../ContentStudioClient';
import type { ContentStudioType } from '@/types/database';
import type { BrandKit } from '@/types/brand-kit';
import { useLanguage } from '@/i18n/context';
import {
  translateContentStudioStatus,
  translateContentStudioType,
} from '@/i18n/dashboard-labels';

interface CampaignBasicsFieldsProps {
  selectedItem: ContentStudioItemView | null;
  selectedType: ContentStudioType;
  availableTypeOptions: Array<{ value: ContentStudioType; label: string }>;
  savePending: boolean;
  isGenerating: boolean;
  schedulerReady: boolean;
  schedulerMessage: string;
  brandKit: BrandKit;
  brandDefaultOffer: string | null;
  readCampaignString: (item: ContentStudioItemView | null, key: string) => string;
  readMetaAdsNumber: (item: ContentStudioItemView | null, key: string) => string;
  readMetaAdsList: (item: ContentStudioItemView | null, key: string) => string;
  readTemplateDefault: (name: string) => string;
  formatDatetimeLocal: (value?: string | null) => string;
  defaultBrandValue: (value: string | null | undefined) => string;
  onDraftTypeChange: (type: ContentStudioType) => void;
}

function readStoredFieldValue(
  name: string,
  selectedItem: ContentStudioItemView | null,
  readCampaignString: (item: ContentStudioItemView | null, key: string) => string,
  readCampaignList: (item: ContentStudioItemView | null, key: string) => string
) {
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

const preservedFieldNames = [
  'hook',
  'primary_text',
  'offer',
  'destination_url',
  'ad_copy',
  'caption',
  'script',
  'headlines',
  'descriptions',
  'cta',
  'hashtags',
  'keywords',
  'creative_brief',
  'scene_breakdown',
  'on_screen_text',
  'voiceover_script',
  'platform_package',
];

export {
  preservedFieldNames,
  readStoredFieldValue,
};

export function CampaignBasicsFields({
  selectedItem,
  selectedType,
  availableTypeOptions,
  savePending,
  isGenerating,
  schedulerReady,
  schedulerMessage,
  brandKit,
  brandDefaultOffer,
  readCampaignString,
  readMetaAdsNumber,
  readMetaAdsList,
  readTemplateDefault,
  formatDatetimeLocal,
  defaultBrandValue,
  onDraftTypeChange,
}: CampaignBasicsFieldsProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title={t('dashboardI18n.contentStudio.campaignBasics')}
        description="Set the campaign foundation, platform, objective, destination, schedule, and status in one place."
        action={<Megaphone className="h-5 w-5 text-[#F7CBCA]" />}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="title">{t('dashboardI18n.contentStudio.campaignName')}</Label>
          <Input
            id="title"
            name="title"
            minLength={3}
            maxLength={200}
            required
            disabled={savePending || isGenerating}
            defaultValue={selectedItem?.title ?? readTemplateDefault('title')}
            placeholder="Spring launch carousel concept"
          />
        </div>

        <div>
          <Label htmlFor="content_type">{t('dashboardI18n.contentStudio.platformType')}</Label>
          {selectedItem ? (
            <input type="hidden" name="content_type" value={selectedType} />
          ) : null}
          <Select
            id="content_type"
            name="content_type"
            value={selectedType}
            onChange={(event) => onDraftTypeChange(event.target.value as ContentStudioType)}
            disabled={savePending || isGenerating || Boolean(selectedItem)}
          >
            {availableTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {translateContentStudioType(t, option.value)}
              </option>
            ))}
          </Select>
          {selectedItem ? (
            <p className="mt-2 text-xs text-black/44">
              {t('dashboardI18n.contentStudio.fixedType', 'Platform/type stays fixed after creation for this foundation.')}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="status">{t('dashboardI18n.contentStudio.status')}</Label>
          <Select
            id="status"
            name="status"
            defaultValue={selectedItem?.status ?? 'draft'}
            disabled={savePending || isGenerating}
          >
            {contentStudioStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {translateContentStudioStatus(t, option.value)}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-black/44">
            {schedulerReady
              ? 'Scheduled items are queued for secure server-side execution at or after the planned time.'
              : schedulerMessage}
          </p>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="objective">{t('dashboardI18n.contentStudio.objective')}</Label>
          <Textarea
            id="objective"
            name="objective"
            rows={3}
            disabled={savePending || isGenerating}
            defaultValue={
              selectedItem?.objective ??
              (readTemplateDefault('objective') ||
              defaultBrandValue(brandKit.campaignDefaults.defaultObjective)
              )
            }
            placeholder="Drive qualified traffic, increase saves, or prepare a draft campaign concept"
          />
        </div>

        <div>
          <Label htmlFor="target_audience">{t('dashboardI18n.contentStudio.targetAudience')}</Label>
          <Textarea
            id="target_audience"
            name="target_audience"
            rows={3}
            disabled={savePending || isGenerating}
            defaultValue={
              readCampaignString(selectedItem, 'target_audience') ||
              (!selectedItem ? defaultBrandValue(brandKit.targetAudience) : '')
            }
            placeholder="Who this campaign is for and what signals qualify them"
          />
        </div>

        {selectedType === 'pinterest_pin' || selectedType === 'google_ads_campaign_draft' || selectedType === 'facebook_feed_ad' || selectedType === 'instagram_feed_ad' || selectedType === 'facebook_reel_ad' || selectedType === 'instagram_reel_ad' || selectedType === 'facebook_story_ad' || selectedType === 'instagram_story_ad' || selectedType === 'facebook_carousel_ad' || selectedType === 'instagram_carousel_ad' ? (
          <div>
            <Label htmlFor="offer">{t('dashboardI18n.contentStudio.budgetValue')}</Label>
            <Textarea
              id="offer"
              name="offer"
              rows={3}
              disabled={savePending || isGenerating}
              defaultValue={
                readCampaignString(selectedItem, 'offer') ||
                (!selectedItem ? defaultBrandValue(brandDefaultOffer) : '')
              }
              placeholder="Budget notes, offer framing, differentiation, or promise"
            />
          </div>
        ) : null}

        {selectedType !== 'linkedin_post_planner' ? (
          <div className="md:col-span-2">
            <Label htmlFor="destination_url">{t('dashboardI18n.contentStudio.destinationUrl')}</Label>
            <Input
              id="destination_url"
              name="destination_url"
              type="url"
              disabled={savePending || isGenerating}
              defaultValue={
                readCampaignString(selectedItem, 'destination_url') ||
                (!selectedItem ? defaultBrandValue(brandKit.campaignDefaults.defaultDestinationUrl) : '')
              }
              placeholder="https://example.com/landing-page"
            />
          </div>
        ) : null}

        {isMetaAdContentType(selectedType) ? (
          <>
            <div>
              <Label htmlFor="daily_budget">Daily Budget</Label>
              <Input
                id="daily_budget"
                name="daily_budget"
                type="number"
                min="1"
                step="1"
                disabled={savePending || isGenerating}
                defaultValue={readMetaAdsNumber(selectedItem, 'daily_budget')}
                placeholder="5000"
              />
            </div>
            <div>
              <Label htmlFor="lifetime_budget">Lifetime Budget</Label>
              <Input
                id="lifetime_budget"
                name="lifetime_budget"
                type="number"
                min="1"
                step="1"
                disabled={savePending || isGenerating}
                defaultValue={readMetaAdsNumber(selectedItem, 'lifetime_budget')}
                placeholder="25000"
              />
            </div>
            <div>
              <Label htmlFor="countries">Countries</Label>
              <Input
                id="countries"
                name="countries"
                disabled={savePending || isGenerating}
                defaultValue={readMetaAdsList(selectedItem, 'countries')}
                placeholder="US, CA"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
              <Label htmlFor="age_min">Age Min</Label>
              <Input
                id="age_min"
                name="age_min"
                type="number"
                min="13"
                max="65"
                disabled={savePending || isGenerating}
                defaultValue={readMetaAdsNumber(selectedItem, 'age_min')}
                placeholder="25"
              />
              </div>
              <div>
                <Label htmlFor="age_max">Age Max</Label>
                <Input
                  id="age_max"
                  name="age_max"
                  type="number"
                  min="13"
                  max="65"
                  disabled={savePending || isGenerating}
                  defaultValue={readMetaAdsNumber(selectedItem, 'age_max')}
                  placeholder="55"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="md:col-span-2">
          <Label htmlFor="prompt">{t('dashboardI18n.contentStudio.promptDirection')}</Label>
          <Textarea
            id="prompt"
            name="prompt"
            rows={4}
            disabled={savePending || isGenerating}
            defaultValue={
              selectedItem?.prompt ??
              (readTemplateDefault('prompt') ||
              (!selectedItem
                ? defaultBrandValue(brandKit.campaignDefaults.defaultPostingStyle)
                : '')
              )
            }
            placeholder="Audience, hook, product angle, offer framing, constraints, and references"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="schedule_at">{t('dashboardI18n.contentStudio.plannedSchedule', 'Planned Schedule Time')}</Label>
          <Input
            id="schedule_at"
            name="schedule_at"
            type="datetime-local"
            disabled={savePending || isGenerating}
            defaultValue={formatDatetimeLocal(selectedItem?.schedule_at)}
          />
          <p className="mt-2 text-xs text-black/44">
            {t('dashboardI18n.contentStudio.scheduleGuard', 'Scheduled items are only processed when provider readiness allows it. Google Ads stays paused-only, and manual-only providers will never be marked published.')}
          </p>
        </div>
      </div>
    </Card>
  );
}
