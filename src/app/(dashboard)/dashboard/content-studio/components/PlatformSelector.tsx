'use client';

import Link from 'next/link';
import { Pin } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { contentStudioTabOptions, type ContentStudioTab } from '../shared';
import { platformStudioConfig, type PlatformStudioKey } from '../ContentStudioClient';
import type { ContentStudioType, ContentStudioStatus } from '@/types/database';
import { useLanguage } from '@/i18n/context';

interface PlatformSelectorProps {
  activeTab: ContentStudioTab;
  buildQueryHref: (params: {
    pathname: string;
    searchParams: URLSearchParams;
    tab?: ContentStudioTab | null;
    status?: ContentStudioStatus | 'all' | null;
    contentType?: ContentStudioType | 'all' | null;
    query?: string | null;
    itemId?: string | null;
  }) => string;
  pathname: string;
  searchParams: URLSearchParams;
}

function isPlatformStudioTab(tab: ContentStudioTab): tab is PlatformStudioKey {
  return tab !== 'all';
}

export function PlatformSelector({
  activeTab,
  buildQueryHref,
  pathname,
  searchParams,
}: PlatformSelectorProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title={t('dashboardI18n.contentStudio.platformWorkspace')}
        description={t('dashboardI18n.contentStudio.platformWorkspaceDescription')}
        action={<Pin className="h-5 w-5 text-[#F7CBCA]" />}
      />
      <div className="dashboard-card-grid">
        {contentStudioTabOptions
          .filter((option): option is { value: PlatformStudioKey; label: string } =>
            isPlatformStudioTab(option.value)
          )
          .map((option) => (
            <Link
              key={option.value}
              href={buildQueryHref({
                pathname,
                searchParams: new URLSearchParams(searchParams.toString()),
                tab: option.value,
                contentType: 'all',
                itemId: null,
              })}
              className={buttonStyles({
                variant: activeTab === option.value ? 'primary' : 'outline',
                size: 'sm',
              })}
            >
                {t(`action.${option.value === 'google_ads' ? 'googleAdsStudio' : option.value === 'linkedin' ? 'linkedinPlanner' : `${option.value}Studio`}`, platformStudioConfig[option.value].title)}
            </Link>
          ))}
      </div>
    </Card>
  );
}
