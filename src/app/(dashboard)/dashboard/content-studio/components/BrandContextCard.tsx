'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import type { BrandKit } from '@/types/brand-kit';
import { useLanguage } from '@/i18n/context';

interface BrandContextCardProps {
  brandKit: BrandKit;
  brandKitExists: boolean;
}

export function BrandContextCard({ brandKit, brandKitExists }: BrandContextCardProps) {
  const { t } = useLanguage();

  return (
    <Card className="border-[#F7CBCA]/12 bg-white/90">
      <CardHeader
        title={t('dashboardI18n.contentStudio.brandContext')}
        description={
          brandKitExists
            ? 'Brand Kit applied to empty draft defaults and AI generation prompts.'
            : 'Sample brand defaults are available until you save a Brand Kit in Settings.'
        }
        action={<Sparkles className="h-5 w-5 text-[#F7CBCA]" />}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="muted-panel p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.brand')}</p>
          <p className="mt-1 text-sm font-semibold text-black">{brandKit.brandName}</p>
        </div>
        <div className="muted-panel p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.tone')}</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {brandKit.toneOfVoice ?? t('dashboardI18n.common.notSet')}
          </p>
        </div>
        <div className="muted-panel p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.defaultCta')}</p>
          <p className="mt-1 text-sm font-semibold text-black">
            {brandKit.defaultCta ?? t('dashboardI18n.common.notSet')}
          </p>
        </div>
        <div className="muted-panel p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">{t('dashboardI18n.contentStudio.hashtags')}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-black">
            {brandKit.defaultHashtags ?? t('dashboardI18n.common.notSet')}
          </p>
        </div>
      </div>
    </Card>
  );
}
