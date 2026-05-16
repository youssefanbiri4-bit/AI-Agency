'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Info,
  ListChecks,
  Network,
  Search,
  SearchCheck,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  automationBlueprintCategories,
  automationBlueprints,
  formatAutomationBlueprintMarkdown,
  type AutomationBlueprint,
} from '@/lib/automation-blueprints/blueprints';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonStyles } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';

const allCategoriesLabel = 'All';

function safeFilename(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${slug || 'automation-blueprint'}.md`;
}

function copyText(text: string, successMessage: string, errorMessage: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(successMessage),
    () => toast.error(errorMessage)
  );
}

function downloadMarkdown(blueprint: AutomationBlueprint, successMessage: string) {
  const markdown = formatAutomationBlueprintMarkdown(blueprint);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename(blueprint.name);
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(successMessage);
}

function callbackPayloadPreview(blueprint: AutomationBlueprint) {
  return JSON.stringify(blueprint.callback_payload_example, null, 2);
}

function MiniDiagram({ steps }: { steps: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => (
          <div key={`${step}-${index}`} className="flex items-center gap-2">
            <div className="w-40 rounded-lg border border-emerald-100 bg-white px-3 py-2 shadow-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
                {index + 1}
              </span>
              <p className="mt-2 text-xs font-black leading-5 text-slate-900">{step}</p>
            </div>
            {index < steps.length - 1 ? <span className="text-sm font-black text-slate-300">-&gt;</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlueprintCard({
  blueprint,
  isExpanded,
  onToggle,
}: {
  blueprint: AutomationBlueprint;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const markdown = useMemo(() => formatAutomationBlueprintMarkdown(blueprint), [blueprint]);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">{blueprint.category}</Badge>
            <Badge tone="blue">{t('mappings.executionMode.planningOnly', blueprint.execution_mode)}</Badge>
          </div>
          <h2 className="mt-3 text-xl font-black tracking-normal text-slate-950">{blueprint.name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{blueprint.description}</p>
          <p className="mt-3 text-sm font-bold text-slate-700">
            {t('dashboardI18n.automationBlueprints.trigger', 'Trigger')}: <span className="font-medium text-slate-600">{blueprint.trigger}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {blueprint.recommended_for.slice(0, 4).map((item) => (
              <span key={item} className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                {item}
              </span>
            ))}
          </div>
        </div>

        <MiniDiagram steps={blueprint.workflow_steps} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copyText(markdown, t('dashboardI18n.automationBlueprints.blueprintCopied', 'Blueprint copied'), t('dashboardI18n.common.copyFailed', 'Could not copy'))}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <ClipboardCopy className="h-4 w-4" />
          {t('dashboardI18n.automationBlueprints.copyBlueprint', 'Copy Blueprint')}
        </button>
        <button
          type="button"
          onClick={() => copyText(blueprint.visual_diagram_mermaid, t('dashboardI18n.automationBlueprints.mermaidCopied', 'Mermaid diagram copied'), t('dashboardI18n.common.copyFailed', 'Could not copy'))}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <Network className="h-4 w-4" />
          {t('dashboardI18n.automationBlueprints.copyMermaid', 'Copy Mermaid Diagram')}
        </button>
        <button
          type="button"
          onClick={() => downloadMarkdown(blueprint, t('dashboardI18n.automationBlueprints.downloaded', 'Markdown blueprint downloaded'))}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <Download className="h-4 w-4" />
          {t('dashboardI18n.automationBlueprints.downloadMarkdown', 'Download Markdown')}
        </button>
        <Link
          href={`/dashboard/agent-library/workflows?from=automation-blueprints&blueprint=${encodeURIComponent(blueprint.id)}`}
          className={buttonStyles({ variant: 'soft', size: 'sm' })}
        >
          <Workflow className="h-4 w-4" />
          {t('dashboardI18n.automationBlueprints.openWorkflowBuilder', 'Open in Workflow Builder')}
        </Link>
        <Link
          href={`/dashboard/quality-review?type=automation_blueprint&platform=generic&content=${encodeURIComponent(markdown.slice(0, 6000))}`}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <SearchCheck className="h-4 w-4" />
          {t('dashboardI18n.automationBlueprints.reviewBlueprint', 'Review Blueprint')}
        </Link>
        <button
          type="button"
          disabled
          title={t('dashboardI18n.automationBlueprints.createDisabledTitle', 'Direct task creation is disabled because these blueprints are planning-only and are not mapped to a reviewed pending-task server action.')}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <ListChecks className="h-4 w-4" />
          {t('dashboardI18n.workflowBuilder.createPendingTasks', 'Create Pending Tasks')}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={buttonStyles({ variant: 'ghost', size: 'sm', className: 'ms-auto' })}
          aria-expanded={isExpanded}
        >
          <Info className="h-4 w-4" />
          {isExpanded ? t('dashboardI18n.automationBlueprints.hideDetails', 'Hide details') : t('common.details')}
        </button>
      </div>

      {!isExpanded ? (
        <p className="mt-3 text-xs font-bold text-slate-500">
          {t('dashboardI18n.automationBlueprints.pendingDisabledNotice', 'Pending-task creation is intentionally disabled here. Use the Workflow Builder for manual review before any safe task drafting.')}
        </p>
      ) : null}

      {isExpanded ? (
        <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
          <DetailList title={t('dashboardI18n.workflowPlan.requiredInputs')} items={blueprint.required_inputs} />
          <DetailList title={t('dashboardI18n.automationBlueprints.workflowSteps', 'Workflow steps')} items={blueprint.workflow_steps} />
          <DetailList title={t('dashboardI18n.workflowPlan.suggestedNodes')} items={blueprint.suggested_n8n_nodes} />
          <DetailList title={t('dashboardI18n.automationBlueprints.errorHandling', 'Error handling')} items={blueprint.error_handling} />
          <DetailList title={t('dashboardI18n.workflowPlan.testingChecklist')} items={blueprint.testing_checklist} />
          <DetailList title={t('dashboardI18n.workflowPlan.safetyRules')} items={blueprint.safety_rules} />
          <section className="lg:col-span-2">
            <h3 className="text-sm font-black text-slate-950">{t('dashboardI18n.workflowPlan.callbackPayload')}</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              <code>{callbackPayloadPreview(blueprint)}</code>
            </pre>
          </section>
          <section className="lg:col-span-2">
            <h3 className="text-sm font-black text-slate-950">{t('dashboardI18n.automationBlueprints.mermaidDiagram', 'Mermaid diagram')}</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
              <code>{blueprint.visual_diagram_mermaid}</code>
            </pre>
          </section>
        </div>
      ) : null}
    </article>
  );
}

export function AutomationBlueprintsClient() {
  const { t, dir } = useLanguage();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(allCategoriesLabel);
  const [expandedId, setExpandedId] = useState<string | null>(automationBlueprints[0]?.id ?? null);

  const filteredBlueprints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return automationBlueprints.filter((blueprint) => {
      const matchesCategory = category === allCategoriesLabel || blueprint.category === category;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      return [
        blueprint.name,
        blueprint.category,
        blueprint.description,
        blueprint.trigger,
        blueprint.recommended_for.join(' '),
        blueprint.workflow_steps.join(' '),
        blueprint.suggested_n8n_nodes.join(' '),
      ].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [category, query]);

  return (
    <div className="space-y-7" dir={dir}>
      <PageHeader
        eyebrow={t('nav.automationBlueprints')}
        title={t('dashboardI18n.automationBlueprints.title', 'Planning-only automation blueprints')}
        description={t('dashboardI18n.automationBlueprints.description', 'Reusable workflow plans for AgentFlow AI. These diagrams and exports are safe references only; they do not run n8n, publish, schedule, spend, or mutate provider state.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/agent-library/workflows" className={buttonStyles({ variant: 'soft' })}>
              <Workflow className="h-4 w-4" />
              {t('dashboardI18n.agentLibrary.openWorkflowBuilder')}
            </Link>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('nav.dashboard')}
            </Link>
          </div>
        }
      />

      <section className="rounded-lg border border-emerald-100 bg-[#F1F7F7] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              {t('dashboardI18n.automationBlueprints.safetyBoundary', 'Safety boundary')}
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              {t('dashboardI18n.automationBlueprints.safetyNotice', 'This route contains static planning data and browser-only copy/export actions. Webhook URLs, callbacks, n8n workflows, schedulers, publishing providers, ads, and GitHub writes are not touched.')}
            </p>
          </div>
          <Badge tone="emerald" className="shrink-0">{t('dashboardI18n.automationBlueprints.starterCount', '10 starter blueprints')}</Badge>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{t('dashboardI18n.automationBlueprints.searchSr', 'Search automation blueprints')}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('dashboardI18n.automationBlueprints.searchPlaceholder', 'Search by workflow, input, node, category...')}
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-11 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {t('common.clear')}
              </button>
            ) : null}
          </label>
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
            {filteredBlueprints.length} {t('dashboardI18n.common.of')} {automationBlueprints.length} {t('dashboardI18n.automationBlueprints.blueprints', 'blueprints')}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[allCategoriesLabel, ...automationBlueprintCategories].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-100',
                category === item
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
              )}
            >
              {item === allCategoriesLabel ? t('common.all') : item}
            </button>
          ))}
        </div>
      </section>

      {filteredBlueprints.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-black text-slate-900">{t('dashboardI18n.automationBlueprints.emptyTitle', 'No blueprints found')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('dashboardI18n.automationBlueprints.emptyDescription', 'Try a different search term or category.')}</p>
        </section>
      ) : (
        <div className="grid gap-5">
          {filteredBlueprints.map((blueprint) => (
            <BlueprintCard
              key={blueprint.id}
              blueprint={blueprint}
              isExpanded={expandedId === blueprint.id}
              onToggle={() => setExpandedId((current) => current === blueprint.id ? null : blueprint.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
