'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ClipboardCopy, Download, FileJson, ShieldCheck, Workflow, X } from 'lucide-react';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import {
  formatWorkflowPlanJson,
  formatWorkflowPlanMarkdown,
  generateN8nWorkflowPlan,
} from '@/lib/agent-library/workflow-plan';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { trackTemplateUsageAction } from './usage-actions';
import type { AgentTemplateUsageSourcePage } from '@/types/database';
import { buildWorkflowDiagramFromLabels } from '@/lib/agent-library/workflow-diagram';
import { WorkflowDiagram } from '@/components/agent-library/WorkflowDiagram';
import { useLanguage } from '@/i18n/context';
import { translateTemplateCategory } from '@/i18n/dashboard-labels';

interface WorkflowPlanDialogProps {
  template: AgentTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePage: AgentTemplateUsageSourcePage;
}

function safeFilename(value: string, extension: 'md' | 'json') {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

  return `${slug || 'agentflow-workflow-plan'}.${extension}`;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function copyPlan(
  template: AgentTemplate,
  sourcePage: AgentTemplateUsageSourcePage,
  markdown: string,
  messages: { success: string; error: string }
) {
  navigator.clipboard.writeText(markdown).then(
    () => {
      toast.success(messages.success);
      void trackTemplateUsageAction({
        templateId: template.id,
        actionType: 'copy_workflow_plan',
        sourcePage,
        metadata: { format: 'markdown' },
      });
    },
    () => toast.error(messages.error)
  );
}

export function WorkflowPlanDialog({ template, open, onOpenChange, sourcePage }: WorkflowPlanDialogProps) {
  const { t } = useLanguage();
  const plan = useMemo(() => generateN8nWorkflowPlan(template), [template]);
  const markdown = useMemo(() => formatWorkflowPlanMarkdown(plan), [plan]);
  const json = useMemo(() => formatWorkflowPlanJson(plan), [plan]);
  const diagram = useMemo(() => buildWorkflowDiagramFromLabels(plan.suggested_n8n_nodes, 'n8n plan'), [plan.suggested_n8n_nodes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-3 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.22)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
              <Workflow className="h-4 w-4" />
              {t('dashboardI18n.workflowPlan.blueprint')}
            </div>
            <h2 className="mt-2 text-lg font-black leading-snug text-slate-950">{plan.workflow_title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              {translateTemplateCategory(t, template.category)} - {t('dashboardI18n.workflowPlan.referenceExport')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100"
            aria-label={t('dashboardI18n.workflowPlan.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 sm:px-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p>
              {t('dashboardI18n.workflowPlan.safetyNotice')}
            </p>
          </div>

          <div className="mb-5">
            <WorkflowDiagram diagram={diagram} compact />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="space-y-4">
              <PlanSection title={t('dashboardI18n.workflowPlan.purpose')}>
                <p>{plan.purpose}</p>
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.trigger')}>
                <p>{plan.recommended_trigger}</p>
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.suggestedNodes')}>
                <BulletList items={plan.suggested_n8n_nodes} />
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.flow')}>
                <NumberedList items={plan.step_by_step_flow} />
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.callbackPayload')}>
                <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
                  {JSON.stringify(plan.callback_payload_example, null, 2)}
                </pre>
              </PlanSection>
            </section>

            <aside className="space-y-4">
              <PlanSection title={t('dashboardI18n.workflowPlan.requiredInputs')}>
                <BulletList items={plan.required_inputs} compact />
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.expectedOutputs')}>
                <BulletList items={plan.expected_outputs} compact />
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.safetyRules')}>
                <BulletList items={plan.safety_rules} compact />
              </PlanSection>
              <PlanSection title={t('dashboardI18n.workflowPlan.testingChecklist')}>
                <BulletList items={plan.testing_checklist} compact />
              </PlanSection>
            </aside>
          </div>
        </div>

        <footer className="grid shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:grid-cols-3 sm:px-6">
          <button
            type="button"
            onClick={() => copyPlan(template, sourcePage, markdown, {
              success: t('dashboardI18n.workflowPlan.copied'),
              error: t('dashboardI18n.workflowPlan.copyFailed'),
            })}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <ClipboardCopy className="h-4 w-4" />
            {t('dashboardI18n.workflowPlan.copyPlan')}
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(safeFilename(template.name, 'md'), markdown, 'text/markdown;charset=utf-8')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <Download className="h-4 w-4" />
            {t('dashboardI18n.workflowPlan.downloadMd')}
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(safeFilename(template.name, 'json'), json, 'application/json;charset=utf-8')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <FileJson className="h-4 w-4" />
            {t('dashboardI18n.workflowPlan.downloadJson')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PlanSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

function BulletList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  return (
    <ul className={cn('space-y-2', compact && 'space-y-1.5')}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
