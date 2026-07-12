'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useLanguage } from '@/i18n/context';

interface ContentLibraryBannerProps {
  itemCount: number;
}

export function ContentLibraryBanner({ itemCount }: ContentLibraryBannerProps) {
  const { t } = useLanguage();

  return (
    <Card className="border-[#F7CBCA]/12 bg-[#F1F7F7]">
      <CardHeader
        title={t('dashboardI18n.contentStudio.contentLibrarySeparate', 'Content Library is separate')}
        description="Use this studio for platform-specific creation and editing. Manage saved drafts, filters, provider status, assets, and planned times in the dedicated library."
        action={<FileText className="h-5 w-5 text-[#F7CBCA]" />}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-6 text-black/58">
          {itemCount} item{itemCount === 1 ? '' : 's'} match this studio view. Opening an item from the library returns here on the correct platform tab.
        </p>
        <Link href="/dashboard/content-library" className={buttonStyles({ variant: 'secondary' })}>
          <FileText className="h-4 w-4" />
          {t('dashboardI18n.contentStudio.openContentLibrary')}
        </Link>
      </div>
    </Card>
  );
}
