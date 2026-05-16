'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Check,
  ClipboardList,
  Copy,
  FileText,
  Library,
  ListChecks,
  Save,
  Search,
  Workflow,
} from 'lucide-react';
import { templates, categories, type AgentTemplate, type TemplateCategory } from '@/lib/agent-library/templates';
import type { AgentTemplateUsageActionType, AgentTemplateUsageSourcePage } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import {
  translateExecutionMode,
  translateSafetyLevel,
  translateTemplateCategory,
  translateTemplateField,
  translateTemplateList,
} from '@/i18n/dashboard-labels';
import { CreateTemplateTaskDialog } from './CreateTemplateTaskDialog';
import { WorkflowPlanDialog } from './WorkflowPlanDialog';
import {
  getTemplateUsageSummaryAction,
  trackTemplateUsageAction,
} from './usage-actions';
import type { TemplateUsageSummary, TemplateUsageSummaryItem } from './usage-types';

const categoryToneMap: Record<TemplateCategory | 'All', 'brand' | 'success' | 'violet' | 'emerald' | 'blue' | 'amber' | 'neutral'> = {
  All: 'neutral',
  'Research & Strategy': 'blue',
  'Content & Growth': 'emerald',
  'Sales & Operations': 'brand',
  'Reports & Analytics': 'blue',
  'Alex Assistant Skills': 'violet',
  'Developer/Code Agents': 'amber',
  'n8n Workflow Ideas': 'success',
};

function containsRtl(value: string) {
  return /[\u0590-\u08FF]/.test(value);
}

function formatList(title: string, values: string[]) {
  return `${title}\n${values.map((value) => `- ${value}`).join('\n')}`;
}

function formatTemplateForCopy(template: AgentTemplate) {
  const sections = [
    `Agent Template: ${template.name}`,
    `Category: ${template.category}`,
    `Safety: ${template.safety_level}`,
    `Execution mode: ${template.execution_mode}`,
    '',
    'Description',
    template.description,
    '',
    formatList('Recommended for', template.recommended_for),
    '',
    formatList('Inputs', template.inputs),
    '',
    formatList('Outputs', template.outputs),
    '',
    'Suggested prompt',
    template.suggested_prompt,
    '',
    formatList('Review checklist', template.review_checklist),
  ];

  return `${sections.join('\n').trim()}\n`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(containsRtl(text) ? 'تم النسخ بنجاح' : 'Copied successfully'),
    () => toast.error(containsRtl(text) ? 'تعذر النسخ' : 'Could not copy')
  );
}

function trackTemplateAction(
  template: AgentTemplate,
  actionType: AgentTemplateUsageActionType,
  sourcePage: AgentTemplateUsageSourcePage = 'agent_library',
  metadata?: Record<string, string | number | boolean | null>
) {
  void trackTemplateUsageAction({
    templateId: template.id,
    actionType,
    sourcePage,
    metadata: metadata ?? {},
  });
}

export default function AgentLibraryPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [usageSummary, setUsageSummary] = useState<TemplateUsageSummary | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUsageSummary() {
      setIsUsageLoading(true);
      const result = await getTemplateUsageSummaryAction();
      if (cancelled) return;
      setUsageSummary(result.data);
      setUsageError(result.error);
      setIsUsageLoading(false);
    }

    void loadUsageSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<TemplateCategory, number>>((counts, category) => {
      counts[category] = templates.filter((template) => template.category === category).length;
      return counts;
    }, {} as Record<TemplateCategory, number>);
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return templates.filter((template) => {
      const matchesCategory = activeCategory === 'All' || template.category === activeCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query) ||
        template.recommended_for.some((item) => item.toLowerCase().includes(query)) ||
        template.inputs.some((item) => item.toLowerCase().includes(query)) ||
        template.outputs.some((item) => item.toLowerCase().includes(query))
      );
    });
  }, [activeCategory, searchQuery]);

  const groupedByCategory = useMemo(() => {
    const groups = categories.reduce<Record<TemplateCategory, AgentTemplate[]>>((groupMap, category) => {
      groupMap[category] = [];
      return groupMap;
    }, {} as Record<TemplateCategory, AgentTemplate[]>);

    for (const template of filteredTemplates) {
      groups[template.category].push(template);
    }

    return groups;
  }, [filteredTemplates]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t('dashboardI18n.agentLibrary.eyebrow')}
        title={t('dashboardI18n.agentLibrary.title')}
        description={t('dashboardI18n.agentLibrary.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/agent-library/workflows"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <Workflow className="h-4 w-4" />
              {t('dashboardI18n.agentLibrary.openWorkflowBuilder')}
            </Link>
            <Link
              href="/dashboard/agent-library/playbooks"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <Save className="h-4 w-4" />
              {t('dashboardI18n.agentLibrary.savedPlaybooks')}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('dashboardI18n.agentLibrary.dashboard')}
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{t('dashboardI18n.agentLibrary.searchSr')}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={t('dashboardI18n.agentLibrary.searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {t('common.clear')}
              </button>
            ) : null}
          </label>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            {filteredTemplates.length} {t('dashboardI18n.common.of')} {templates.length} {t('dashboardI18n.common.templates')}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <CategoryFilter
            label={translateTemplateCategory(t, 'All')}
            count={templates.length}
            active={activeCategory === 'All'}
            onClick={() => setActiveCategory('All')}
          />
          {categories.map((category) => (
            <CategoryFilter
              key={category}
              label={translateTemplateCategory(t, category)}
              count={categoryCounts[category]}
              active={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>
      </section>

      <TemplateUsageAnalytics
        summary={usageSummary}
        isLoading={isUsageLoading}
        error={usageError}
      />

      {filteredTemplates.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
          <Library className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-black text-slate-900">{t('dashboardI18n.agentLibrary.noTemplatesTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t('dashboardI18n.agentLibrary.noTemplatesDescription')}</p>
        </section>
      ) : activeCategory === 'All' ? (
        categories.map((category) => {
          const items = groupedByCategory[category];
          if (!items.length) return null;

          return (
            <CategorySection
              key={category}
              category={category}
              templates={items}
              expandedTemplate={expandedTemplate}
              onToggleExpand={setExpandedTemplate}
            />
          );
        })
      ) : (
        <CategorySection
          category={activeCategory}
          templates={filteredTemplates}
          expandedTemplate={expandedTemplate}
          onToggleExpand={setExpandedTemplate}
        />
      )}
    </div>
  );
}

function CategoryFilter({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-100',
        active
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
      )}
    >
      {label} <span className="text-current/55">{count}</span>
    </button>
  );
}

function CategorySection({
  category,
  templates: items,
  expandedTemplate,
  onToggleExpand,
}: {
  category: TemplateCategory;
  templates: AgentTemplate[];
  expandedTemplate: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={categoryToneMap[category]}>{translateTemplateCategory(t, category)}</Badge>
        <span className="text-sm font-bold text-slate-500">
          {items.length} {items.length === 1 ? t('dashboardI18n.agentLibrary.templateCountSingular') : t('dashboardI18n.agentLibrary.templateCountPlural')}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isExpanded={expandedTemplate === template.id}
            onToggleExpand={() => {
              const willExpand = expandedTemplate !== template.id;
              if (willExpand) {
                trackTemplateAction(template, 'view_template', 'agent_library', { surface: 'card_details' });
              }
              onToggleExpand(willExpand ? template.id : null);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  template,
  isExpanded,
  onToggleExpand,
}: {
  template: AgentTemplate;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useLanguage();
  const copiedText = formatTemplateForCopy(template);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isWorkflowPlanOpen, setIsWorkflowPlanOpen] = useState(false);

  return (
    <>
      <article className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <Badge tone={categoryToneMap[template.category]}>{translateTemplateCategory(t, template.category)}</Badge>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-black',
              template.safety_level === 'requires_review'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            )}
          >
            {translateSafetyLevel(t, template.safety_level)}
          </span>
        </div>

      <h3 className="mt-4 text-lg font-black leading-snug text-slate-950">{translateTemplateField(t, template, 'name', template.name)}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{translateTemplateField(t, template, 'description', template.description)}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {translateTemplateList(t, template, 'recommended_for', template.recommended_for).slice(0, 3).map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <PreviewList label={t('dashboardI18n.agentLibrary.inputs')} items={translateTemplateList(t, template, 'inputs', template.inputs)} />
        <PreviewList label={t('dashboardI18n.agentLibrary.outputs')} items={translateTemplateList(t, template, 'outputs', template.outputs)} />
      </div>

      {isExpanded ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <DetailBlock title={t('dashboardI18n.agentLibrary.suggestedPrompt')}>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{translateTemplateField(t, template, 'suggested_prompt', template.suggested_prompt)}</p>
          </DetailBlock>

          <DetailBlock title={t('dashboardI18n.agentLibrary.reviewChecklist')}>
            <ul className="space-y-2">
              {translateTemplateList(t, template, 'review_checklist', template.review_checklist).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </DetailBlock>

          <DetailBlock title={t('dashboardI18n.agentLibrary.sourceInspiration')}>
            <p className="text-sm leading-6 text-slate-500">{translateTemplateField(t, template, 'source_inspiration', template.source_inspiration)}</p>
          </DetailBlock>
        </div>
      ) : null}

      <div className="flex-1" />

      <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            copyToClipboard(copiedText);
            trackTemplateAction(template, 'copy_prompt');
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <Copy className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.copyPrompt')}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <Workflow className="h-4 w-4" />
          {isExpanded ? t('dashboardI18n.agentLibrary.hidePlan') : t('dashboardI18n.agentLibrary.viewPlan')}
        </button>
        <Link
          href={`/dashboard/alex?template=${encodeURIComponent(template.id)}`}
          onClick={() => trackTemplateAction(template, 'use_with_alex')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <Bot className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.useWithAlex')}
        </Link>
        <Link
          href={`/dashboard/content-studio?template=${encodeURIComponent(template.id)}`}
          onClick={() => trackTemplateAction(template, 'send_to_content_studio')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <FileText className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.sendToContentStudio')}
        </Link>
        <button
          type="button"
          onClick={() => setIsCreateTaskOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <ListChecks className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.createTask')}
        </button>
        <Link
          href={`/dashboard/agent-library/workflows?templates=${encodeURIComponent(template.id)}`}
          onClick={() => trackTemplateAction(template, 'add_template_to_workflow')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <Workflow className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.addToWorkflow')}
        </Link>
        <button
          type="button"
          onClick={() => {
            trackTemplateAction(template, 'export_n8n_plan');
            setIsWorkflowPlanOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <Workflow className="h-4 w-4" />
          {t('dashboardI18n.agentLibrary.exportN8nPlan')}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
        <ClipboardList className="h-3.5 w-3.5" />
        {translateExecutionMode(t, template.execution_mode)}
      </div>
      </article>
      <CreateTemplateTaskDialog
        template={template}
        createdFrom="agent_library"
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        onTaskCreated={(taskId) => {
          trackTemplateAction(template, 'create_task', 'agent_library', { task_id: taskId });
        }}
      />
      <WorkflowPlanDialog
        template={template}
        open={isWorkflowPlanOpen}
        onOpenChange={setIsWorkflowPlanOpen}
        sourcePage="agent_library"
      />
    </>
  );
}

function TemplateUsageAnalytics({
  summary,
  isLoading,
  error,
}: {
  summary: TemplateUsageSummary | null;
  isLoading: boolean;
  error: string | null;
}) {
  const { t } = useLanguage();
  const total = summary?.total_events ?? 0;
  const actionCounts = summary?.action_counts;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-600">{t('dashboardI18n.agentLibrary.templateAnalytics')}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{t('dashboardI18n.agentLibrary.usageSignals')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {t('dashboardI18n.agentLibrary.analyticsNotice')}
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700">
          {isLoading ? t('common.loading') : `${total} ${t('dashboardI18n.agentLibrary.totalActions')}`}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
          {t('dashboardI18n.agentLibrary.noUsage')}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            <AnalyticsCard title={t('dashboardI18n.agentLibrary.mostUsed')} items={summary?.most_used_templates ?? []} />
            <AnalyticsCard title={t('dashboardI18n.agentLibrary.recentlyUsed')} items={summary?.recently_used_templates ?? []} showDate />
            <CategoryBars items={summary?.top_categories ?? []} total={total} />
            <ActionCounts
              counts={[
                [t('dashboardI18n.agentLibrary.usedWithAlex'), actionCounts?.use_with_alex ?? 0],
                [t('dashboardI18n.agentLibrary.tasksCreated'), actionCounts?.create_task ?? 0],
                [t('dashboardI18n.agentLibrary.sentToContentStudio'), actionCounts?.send_to_content_studio ?? 0],
                [t('dashboardI18n.agentLibrary.n8nPlansExported'), actionCounts?.export_n8n_plan ?? 0],
                [t('dashboardI18n.agentLibrary.promptsCopied'), actionCounts?.copy_prompt ?? 0],
              ]}
            />
          </div>
          <Recommendations items={summary?.recommended_next_templates ?? []} />
        </div>
      )}
    </section>
  );
}

function AnalyticsCard({
  title,
  items,
  showDate = false,
}: {
  title: string;
  items: TemplateUsageSummaryItem[];
  showDate?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.template_id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black leading-5 text-slate-800">{item.template_name}</p>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{item.count}</span>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {showDate && item.last_used_at ? new Date(item.last_used_at).toLocaleDateString() : item.template_category}
            </p>
          </div>
        )) : (
          <p className="text-sm leading-6 text-slate-500">{t('dashboardI18n.agentLibrary.noData')}</p>
        )}
      </div>
    </div>
  );
}

function CategoryBars({ items, total }: { items: Array<{ category: string; count: number }>; total: number }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-slate-900">{t('dashboardI18n.agentLibrary.topCategories')}</h3>
      <div className="mt-3 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
              <span>{translateTemplateCategory(t, item.category as TemplateCategory)}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.max(4, Math.round((item.count / Math.max(total, 1)) * 100))}%` }}
              />
            </div>
          </div>
        )) : (
          <p className="text-sm leading-6 text-slate-500">{t('dashboardI18n.agentLibrary.noCategoryData')}</p>
        )}
      </div>
    </div>
  );
}

function ActionCounts({ counts }: { counts: Array<[string, number]> }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <h3 className="text-sm font-black text-slate-900">{t('dashboardI18n.agentLibrary.actionCounts')}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <dt className="text-xs font-bold leading-4 text-slate-400">{label}</dt>
            <dd className="mt-1 text-lg font-black text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Recommendations({ items }: { items: TemplateUsageSummaryItem[] }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-950">{t('dashboardI18n.agentLibrary.recommendedNext')}</h3>
      <p className="mt-1 text-sm leading-6 text-emerald-800">
        {t('dashboardI18n.agentLibrary.recommendedNextDescription')}
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <Link
            key={item.template_id}
            href={`/dashboard/alex?template=${encodeURIComponent(item.template_id)}`}
            className="block rounded-xl border border-emerald-100 bg-white px-3 py-2 transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <p className="text-sm font-black leading-5 text-slate-800">{item.template_name}</p>
            <p className="mt-1 text-xs font-bold text-emerald-700">{translateTemplateCategory(t, item.template_category as TemplateCategory)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PreviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.slice(0, 2).map((item) => (
          <li key={item} className="line-clamp-1 text-sm leading-6 text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-slate-400">{title}</p>
      {children}
    </div>
  );
}
