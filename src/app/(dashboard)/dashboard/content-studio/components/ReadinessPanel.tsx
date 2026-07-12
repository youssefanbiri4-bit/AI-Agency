'use client';

import { Send } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ProviderReadinessResult } from '@/lib/content-studio/provider-types';
import type { ContentStudioPlatform, ContentStudioType } from '@/types/database';
import { formatContentStudioPlatformLabel } from '../shared';
import { isMetaAdContentType } from '../ContentStudioClient';
import { useLanguage } from '@/i18n/context';

interface ReadinessPanelProps {
  selectedPlatform: ContentStudioPlatform;
  selectedProviderReadiness: ProviderReadinessResult | null;
  providerReadiness: Record<string, ProviderReadinessResult>;
  selectedType: ContentStudioType;
  selectedPlatformKey: string;
  selectedStudio: { title: string };
}

export function ReadinessPanel({
  selectedPlatform,
  selectedProviderReadiness,
  providerReadiness,
  selectedType,
  selectedPlatformKey,
  selectedStudio,
}: ReadinessPanelProps) {
  const { t } = useLanguage();
  const readiness = selectedProviderReadiness ?? providerReadiness[selectedPlatform];

  return (
    <Card>
      <CardHeader
        title={`${t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)} ${t('dashboardI18n.contentStudio.readiness', 'Readiness')}`}
        description="This workspace shows the setup, asset, URL, provider, and manual-only checks that apply to the selected platform."
        action={<Send className="h-5 w-5 text-[#F7CBCA]" />}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div
          className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-black">
              {formatContentStudioPlatformLabel(selectedPlatform, t)}
            </p>
            <StatusBadge status={readiness.state} type="system" size="sm" />
          </div>
          <p className="mt-2 text-sm leading-6 text-black/58">{readiness.message}</p>
          {readiness.missing.length > 0 ? (
            <p className="mt-2 text-xs text-black/48">
              Missing: {readiness.missing.join(', ')}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-black/8 bg-white px-4 py-4 shadow-sm">
          <p className="font-semibold text-black">{t('dashboardI18n.contentStudio.actionType', 'Action Type')}</p>
          <p className="mt-2 text-sm leading-6 text-black/58">
            {selectedType === 'google_ads_campaign_draft'
              ? t('dashboardI18n.contentStudio.pausedAdDraft', 'paused ad draft')
              : selectedType === 'linkedin_post_planner'
                ? t('dashboardI18n.contentStudio.manualOnly', 'manual-only')
                : isMetaAdContentType(selectedType)
                  ? t('dashboardI18n.contentStudio.pausedAdDraft', 'paused ad draft')
                  : t('dashboardI18n.contentStudio.organicPublish', 'organic publish')}
          </p>
        </div>
      </div>
    </Card>
  );
}
