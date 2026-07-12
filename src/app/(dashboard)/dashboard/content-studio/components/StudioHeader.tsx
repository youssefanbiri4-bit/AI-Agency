'use client';

import Link from 'next/link';
import { CalendarDays, Sparkles } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ContentStudioItemView } from '../shared';
import type { PlatformStudioKey } from '../ContentStudioClient';
import { useLanguage } from '@/i18n/context';

interface StudioHeaderProps {
  selectedItem: ContentStudioItemView | null;
  selectedStudio: { title: string; summary: string };
  selectedPlatformKey: PlatformStudioKey;
}

export function StudioHeader({ selectedItem, selectedStudio, selectedPlatformKey }: StudioHeaderProps) {
  const { t } = useLanguage();

  return (
    <Card className="border-[#F7CBCA]/16 bg-[#D5E5E5]/42">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#F7CBCA] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-black">
              {selectedItem ? `${t('common.edit')} ${t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)}` : t(`action.${selectedPlatformKey === 'google_ads' ? 'googleAdsStudio' : selectedPlatformKey === 'linkedin' ? 'linkedinPlanner' : `${selectedPlatformKey}Studio`}`, selectedStudio.title)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-black/62">
              {selectedStudio.summary} Draft here, then use the platform-specific actions below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/calendar" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <CalendarDays className="h-4 w-4" />
            {t('dashboardI18n.contentStudio.viewCalendar')}
          </Link>
          {selectedItem ? (
            <StatusBadge status={selectedItem.status} type="task" size="sm" />
          ) : (
            <StatusBadge status="Ready" type="system" size="sm" />
          )}
        </div>
      </div>
    </Card>
  );
}
