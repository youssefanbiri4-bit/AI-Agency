'use client';

import { Filter, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  campaignTemplateCategories,
  type CampaignTemplate,
  type CampaignTemplateCategory,
} from '@/lib/content-studio/campaign-templates';
import { useLanguage } from '@/i18n/context';

interface TemplatePickerCardProps {
  visibleCampaignTemplates: CampaignTemplate[];
  activeTemplateCategory: string;
  savePending: boolean;
  isGenerating: boolean;
  onCategoryChange: (category: CampaignTemplateCategory | 'All') => void;
  onUseTemplate: (template: CampaignTemplate) => void;
}

export function TemplatePickerCard({
  visibleCampaignTemplates,
  activeTemplateCategory,
  savePending,
  isGenerating,
  onCategoryChange,
  onUseTemplate,
}: TemplatePickerCardProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader
        title="Start from a Template"
        description="Choose a campaign template and let AgentFlow AI prefill the right fields for your platform."
        action={<Filter className="h-5 w-5 text-[#F7CBCA]" />}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {campaignTemplateCategories.map((category) => (
          <Button
            key={category}
            type="button"
            variant={activeTemplateCategory === category ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(category)}
            disabled={savePending || isGenerating}
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleCampaignTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-lg border border-black/8 bg-surface-elevated px-4 py-4 shadow-sm transition-colors hover:border-[#F7CBCA]/24 hover:bg-[#F9F7FB]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-bold text-foreground">{template.name}</h3>
                  <Badge tone="brand">{template.platformLabel}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/62">{template.goal}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/36">
                  {t('dashboardI18n.contentStudio.bestFor')}
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground/58">{template.bestFor}</p>
              </div>
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => onUseTemplate(template)}
                disabled={savePending || isGenerating}
              >
                <Sparkles className="h-4 w-4" />
                {t('dashboardI18n.contentStudio.useTemplate')}
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {template.categories.map((category) => (
                <Badge key={category} tone="neutral">
                  {category}
                </Badge>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/36">
                {t('dashboardI18n.contentStudio.fieldsIncluded')}
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground/58">
                {template.fieldsIncluded.join(', ')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
