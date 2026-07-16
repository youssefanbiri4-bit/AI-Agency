'use client';

import { FileCheck2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import { useLanguage } from '@/i18n/context';
import { translateContentStudioType, translateTemplateCategory } from '@/i18n/dashboard-labels';

interface TemplateContextBannerProps {
  agentTemplate: AgentTemplate;
  templatePrefill: {
    contentType: import('@/types/database').ContentStudioType;
  };
}

export function TemplateContextBanner({ agentTemplate, templatePrefill }: TemplateContextBannerProps) {
  const { t } = useLanguage();

  return (
    <Card className="border-sky-200 bg-sky-50/70 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 ring-1 ring-sky-100">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-700">{t('dashboardI18n.contentStudio.templateContext')}</p>
            <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{agentTemplate.name}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{translateTemplateCategory(t, agentTemplate.category)}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{agentTemplate.description}</p>
          </div>
        </div>
        <div className="grid gap-2 rounded-2xl border border-white/80 bg-white/80 p-3 text-sm lg:w-72">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.contentStudio.suggestedOutputType')}</p>
            <p className="mt-1 font-bold text-slate-800">{translateContentStudioType(t, templatePrefill.contentType)}</p>
          </div>
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
            {t('dashboardI18n.contentStudio.prefillNotice')}
          </p>
        </div>
      </div>
    </Card>
  );
}
