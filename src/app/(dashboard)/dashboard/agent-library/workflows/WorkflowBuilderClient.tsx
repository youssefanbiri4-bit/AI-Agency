'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  GripVertical,
  Plus,
  Save,
  Search,
  SearchCheck,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { templates, type AgentTemplate } from '@/lib/agent-library/templates';
import {
  buildAgentWorkflowDraft,
  formatAgentWorkflowMarkdown,
  workflowPresets,
} from '@/lib/agent-library/workflow-builder';
import { buildWorkflowDiagramFromDraft, type WorkflowDiagramModel } from '@/lib/agent-library/workflow-diagram';
import {
  formatWorkflowReviewMarkdown,
  reviewAgentWorkflow,
  type WorkflowReviewResult,
} from '@/lib/agent-library/workflow-review';
import {
  analyzeWorkflowReadiness,
  type WorkflowReadinessResult,
} from '@/lib/agent-library/workflow-readiness';
import { WorkflowDiagram } from '@/components/agent-library/WorkflowDiagram';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import { translatePriority, translateTemplateCategory } from '@/i18n/dashboard-labels';
import { trackTemplateUsageAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import {
  duplicateWorkflowPlaybookAction,
  saveWorkflowPlaybookAction,
  updateWorkflowPlaybookAction,
  type WorkflowPlaybookView,
} from '../playbooks/actions';
import { createPendingTasksFromWorkflowAction } from './actions';
import type { AgentTemplateUsageActionType, AgentWorkflowPlaybookStatus, TaskPriority } from '@/types/database';

interface WorkflowBuilderClientProps {
  initialTemplateIds: string[];
  initialPresetId: string | null;
  initialPlaybook?: WorkflowPlaybookView | null;
  initialPlaybookError?: string | null;
  openedFrom: 'alex' | 'agent_library';
}

const priorities: TaskPriority[] = ['Low', 'Normal', 'High'];

function safeFilename(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${slug || 'agentflow-workflow'}.md`;
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function trackWorkflowAction(templateId: string | undefined, actionType: AgentTemplateUsageActionType, metadata: Record<string, string | number | boolean | null>) {
  if (!templateId) return;
  void trackTemplateUsageAction({
    templateId,
    actionType,
    sourcePage: 'agent_library',
    metadata,
  });
}

export function WorkflowBuilderClient({
  initialTemplateIds,
  initialPresetId,
  initialPlaybook,
  initialPlaybookError,
  openedFrom,
}: WorkflowBuilderClientProps) {
  const { t } = useLanguage();
  const initialPreset = workflowPresets.find((preset) => preset.id === initialPresetId);
  const [currentPlaybookId, setCurrentPlaybookId] = useState(initialPlaybook?.id ?? null);
  const [goal, setGoal] = useState(initialPlaybook?.goal ?? initialPreset?.goal ?? '');
  const [workflowName, setWorkflowName] = useState(initialPlaybook?.name ?? initialPreset?.name ?? 'AgentFlow Draft Workflow');
  const [description, setDescription] = useState(initialPlaybook?.description ?? '');
  const [notes, setNotes] = useState(initialPlaybook?.notes ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialTemplateIds);
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [isPending, startTransition] = useTransition();

  const workflow = useMemo(() => buildAgentWorkflowDraft({
    name: workflowName,
    goal,
    notes,
    templateIds: selectedIds,
  }), [goal, notes, selectedIds, workflowName]);
  const markdown = useMemo(() => formatAgentWorkflowMarkdown(workflow), [workflow]);
  const review = useMemo(() => reviewAgentWorkflow(workflow), [workflow]);
  const reviewMarkdown = useMemo(() => formatWorkflowReviewMarkdown(review, workflow), [review, workflow]);
  const readiness = useMemo(() => analyzeWorkflowReadiness(workflow, review), [review, workflow]);
  const diagram = useMemo(() => buildWorkflowDiagramFromDraft(workflow), [workflow]);
  const [showDryRun, setShowDryRun] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => [
      template.name,
      template.category,
      template.description,
      template.recommended_for.join(' '),
    ].join(' ').toLowerCase().includes(query));
  }, [searchQuery]);

  function addTemplate(template: AgentTemplate) {
    if (selectedSet.has(template.id)) return;
    setSelectedIds((current) => [...current, template.id]);
    trackWorkflowAction(template.id, 'add_template_to_workflow', {
      workflow_name: workflowName,
      opened_from: openedFrom,
    });
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSelectedIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function applyPreset(presetId: string) {
    const preset = workflowPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setCurrentPlaybookId(null);
    setWorkflowName(preset.name);
    setDescription(preset.description);
    setGoal(preset.goal);
    setSelectedIds(preset.templateIds);
    trackWorkflowAction(preset.templateIds[0], 'create_workflow_draft', {
      workflow_name: preset.name,
      preset_id: preset.id,
      step_count: preset.templateIds.length,
      opened_from: openedFrom,
    });
  }

  function copyPlan() {
    navigator.clipboard.writeText(markdown).then(
      () => {
        toast.success('Workflow plan copied successfully');
        trackWorkflowAction(selectedIds[0], 'copy_workflow_plan', {
          workflow_name: workflow.name,
          step_count: workflow.steps.length,
        });
      },
      () => toast.error('Could not copy workflow plan')
    );
  }

  function downloadPlan() {
    downloadMarkdown(safeFilename(workflow.name), markdown);
    toast.success('Workflow plan downloaded');
    trackWorkflowAction(selectedIds[0], 'download_workflow_plan', {
      workflow_name: workflow.name,
      step_count: workflow.steps.length,
    });
  }

  function copyReview() {
    navigator.clipboard.writeText(reviewMarkdown).then(
      () => {
        toast.success('Workflow review copied successfully');
        trackWorkflowAction(selectedIds[0], 'copy_workflow_review', {
          workflow_name: workflow.name,
          readiness_score: review.readiness_score,
        });
      },
      () => toast.error('Could not copy workflow review')
    );
  }

  function playbookStatus(): AgentWorkflowPlaybookStatus {
    return readiness.readiness_status === 'ready_for_draft_tasks' && review.overall_status === 'ready'
      ? 'ready'
      : 'draft';
  }

  function savePlaybook() {
    if (workflow.steps.length === 0) {
      toast.error('Select templates before saving a playbook');
      return;
    }

    startTransition(async () => {
      const input = {
        name: workflow.name,
        description,
        goal: workflow.goal,
        notes,
        templateIds: selectedIds,
        status: playbookStatus(),
        isFavorite: initialPlaybook?.isFavorite ?? false,
      };
      const result = currentPlaybookId
        ? await updateWorkflowPlaybookAction(currentPlaybookId, input)
        : await saveWorkflowPlaybookAction(input);

      if (result.error || !result.playbookId) {
        toast.error('Could not save playbook', { description: result.error ?? undefined });
        return;
      }

      setCurrentPlaybookId(result.playbookId);
      toast.success(result.message ?? 'Playbook saved successfully', {
        action: { label: 'Open Playbooks', href: '/dashboard/agent-library/playbooks' },
      });
    });
  }

  function duplicateAsPlaybook() {
    if (currentPlaybookId) {
      startTransition(async () => {
        const result = await duplicateWorkflowPlaybookAction(currentPlaybookId);
        if (result.error || !result.playbookId) {
          toast.error('Could not duplicate playbook', { description: result.error ?? undefined });
          return;
        }

        setCurrentPlaybookId(result.playbookId);
        toast.success('Playbook duplicated successfully', {
          action: { label: 'Open Copy', href: `/dashboard/agent-library/workflows?playbook=${result.playbookId}` },
        });
      });
      return;
    }

    if (workflow.steps.length === 0) {
      toast.error('Select templates before saving a playbook');
      return;
    }

    startTransition(async () => {
      const result = await saveWorkflowPlaybookAction({
        name: `Copy of ${workflow.name}`.slice(0, 140),
        description,
        goal: workflow.goal,
        notes,
        templateIds: selectedIds,
        status: 'draft',
      });

      if (result.error || !result.playbookId) {
        toast.error('Could not save playbook copy', { description: result.error ?? undefined });
        return;
      }

      setCurrentPlaybookId(result.playbookId);
      toast.success('Playbook copy saved successfully', {
        action: { label: 'Open Playbooks', href: '/dashboard/agent-library/playbooks' },
      });
    });
  }

  function downloadReview() {
    downloadMarkdown(safeFilename(`${workflow.name}-review`), reviewMarkdown);
    toast.success('Workflow review downloaded');
    trackWorkflowAction(selectedIds[0], 'download_workflow_review', {
      workflow_name: workflow.name,
      readiness_score: review.readiness_score,
    });
  }

  function openApprovalGate() {
    if (workflow.steps.length === 0) {
      toast.error('Select templates first');
      return;
    }

    setApprovalChecked(false);
    setIsApprovalOpen(true);
    trackWorkflowAction(selectedIds[0], 'review_workflow', {
      workflow_name: workflow.name,
      readiness_score: review.readiness_score,
      status: review.overall_status,
    });

    if (review.overall_status === 'blocked') {
      trackWorkflowAction(selectedIds[0], 'blocked_unsafe_workflow_action', {
        workflow_name: workflow.name,
        status: review.overall_status,
      });
    }
  }

  function createTasks() {
    if (!approvalChecked) {
      toast.error('Confirm the review first');
      return;
    }

    trackWorkflowAction(selectedIds[0], 'approval_confirmed_for_pending_tasks', {
      workflow_name: workflow.name,
      readiness_score: review.readiness_score,
      status: review.overall_status,
    });
    startTransition(async () => {
      const result = await createPendingTasksFromWorkflowAction({
        workflowName: workflow.name,
        goal: workflow.goal,
        notes,
        templateIds: selectedIds,
        priority,
        manualApprovalConfirmed: true,
      });

      if (result.error) {
        toast.error('Could not create workflow tasks', { description: result.error });
        return;
      }

      toast.success('Pending workflow tasks created', {
        description: result.message,
        action: { label: 'View Tasks', href: '/dashboard/tasks' },
      });
      trackWorkflowAction(selectedIds[0], 'create_tasks_from_workflow', {
        workflow_name: workflow.name,
        task_count: result.taskIds.length,
        readiness_score: review.readiness_score,
      });
      setIsApprovalOpen(false);
    });
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t('dashboardI18n.workflowBuilder.eyebrow', 'Workflow Builder')}
        title={t('dashboardI18n.workflowBuilder.title', 'Agent Workflow Builder')}
        description={t('dashboardI18n.workflowBuilder.description', 'Combine Agent Library templates into safe draft workflows, export plans, and optionally create pending review tasks.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/agent-library/playbooks"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <Save className="h-4 w-4" />
              {t('dashboardI18n.agentLibrary.savedPlaybooks')}
            </Link>
            <Link
              href="/dashboard/agent-library"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('dashboardI18n.alex.agentLibrary')}
            </Link>
          </div>
        }
      />

      {initialPlaybookError ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          {initialPlaybookError}
        </section>
      ) : null}

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
        {t('dashboardI18n.workflowBuilder.safetyNotice', 'This workflow builder only creates draft plans and optional pending tasks. It does not run n8n, publish content, create ads, spend money, or change webhooks.')}
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <h2 className="text-sm font-black text-slate-900">{t('dashboardI18n.workflowBuilder.details', 'Workflow details')}</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">{t('dashboardI18n.workflowBuilder.workflowName', 'Workflow name')}</span>
                <input
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value.slice(0, 140))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">{t('dashboardI18n.workflowBuilder.playbookDescription', 'Playbook description')}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, 500))}
                  rows={2}
                  placeholder={t('dashboardI18n.workflowBuilder.playbookDescriptionPlaceholder', 'Short reusable summary for this saved playbook.')}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">{t('dashboardI18n.workflowBuilder.goal', 'Goal')}</span>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value.slice(0, 600))}
                  rows={3}
                  dir={/[\u0590-\u08FF]/.test(goal) ? 'rtl' : 'ltr'}
                  placeholder={t('dashboardI18n.workflowBuilder.goalPlaceholder', 'What should this workflow prepare?')}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">{t('dashboardI18n.workflowBuilder.notes', 'Notes / context')}</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 2000))}
                  rows={4}
                  dir={/[\u0590-\u08FF]/.test(notes) ? 'rtl' : 'ltr'}
                  placeholder={t('dashboardI18n.workflowBuilder.notesPlaceholder', 'Add safe context. Do not paste secrets.')}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">{t('dashboardI18n.workflowBuilder.taskPriority', 'Task priority')}</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  {priorities.map((item) => (
                    <option key={item} value={item}>{translatePriority(t, item)}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <h2 className="text-sm font-black text-slate-900">{t('dashboardI18n.workflowBuilder.presets', 'Preset workflows')}</h2>
            <div className="mt-4 space-y-2">
              {workflowPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-start transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <p className="text-sm font-black text-slate-900">{preset.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">{t('dashboardI18n.workflowBuilder.selectedSteps', 'Selected workflow steps')}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{workflow.steps.length} {t('dashboardI18n.workflowBuilder.selectedTemplateSteps', 'selected template steps')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={savePlaybook}
                  disabled={isPending || workflow.steps.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Save className="h-4 w-4" />
                  {currentPlaybookId ? t('dashboardI18n.workflowBuilder.updatePlaybook', 'Update Playbook') : t('dashboardI18n.workflowBuilder.savePlaybook', 'Save Playbook')}
                </button>
                <button
                  type="button"
                  onClick={duplicateAsPlaybook}
                  disabled={isPending || workflow.steps.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {t('dashboardI18n.workflowBuilder.duplicateAsNew', 'Duplicate as New')}
                </button>
                <button
                  type="button"
                  onClick={copyPlan}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {t('dashboardI18n.workflowBuilder.copyWorkflowPlan', 'Copy Workflow Plan')}
                </button>
                <button
                  type="button"
                  onClick={downloadPlan}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  {t('dashboardI18n.workflowPlan.downloadMd')}
                </button>
                <Link
                  href={`/dashboard/quality-review?type=workflow_plan&platform=generic&content=${encodeURIComponent(markdown.slice(0, 6000))}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                >
                  <SearchCheck className="h-4 w-4" />
                  Review Workflow Quality
                </Link>
                <button
                  type="button"
                  onClick={openApprovalGate}
                  disabled={isPending || workflow.steps.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Check className="h-4 w-4" />
                  {t('dashboardI18n.workflowBuilder.reviewCreateTasks', 'Review & Create Pending Tasks')}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <WorkflowDiagram diagram={diagram} />
            </div>

            <div className="mt-5 space-y-3">
              {workflow.steps.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">
                  {t('dashboardI18n.workflowBuilder.emptySteps', 'Choose a preset or add templates from search to build a safe workflow draft.')}
                </div>
              ) : workflow.steps.map((step, index) => (
                <article key={`${step.template.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-xs font-black text-sky-700">{step.index}</span>
                        <Badge tone="emerald">{translateTemplateCategory(t, step.template.category)}</Badge>
                      </div>
                      <h3 className="mt-3 text-base font-black text-slate-950">{step.template.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => moveStep(index, -1)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600">{t('dashboardI18n.workflowBuilder.up', 'Up')}</button>
                      <button type="button" onClick={() => moveStep(index, 1)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600">{t('dashboardI18n.workflowBuilder.down', 'Down')}</button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600"
                        aria-label="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <MiniList title={t('dashboardI18n.workflowPlan.requiredInputs')} items={step.requiredInputs} />
                    <MiniList title={t('dashboardI18n.workflowPlan.expectedOutputs')} items={step.expectedOutputs} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <WorkflowReviewPanel
            review={review}
            diagram={diagram}
            onCopy={copyReview}
            onDownload={downloadReview}
            onTrackReview={() => {
              trackWorkflowAction(selectedIds[0], 'review_workflow', {
                workflow_name: workflow.name,
                readiness_score: review.readiness_score,
                status: review.overall_status,
              });
            }}
          />

          <ExecutionReadinessPanel
            readiness={readiness}
            onDryRun={() => setShowDryRun((current) => !current)}
            showDryRun={showDryRun}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <label className="relative block">
              <span className="sr-only">{t('dashboardI18n.workflowBuilder.searchTemplates', 'Search templates')}</span>
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('dashboardI18n.workflowBuilder.searchPlaceholder', 'Search templates to add...')}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 text-sm font-medium text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
              />
            </label>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => addTemplate(template)}
                  disabled={selectedSet.has(template.id)}
                  className={cn(
                    'rounded-2xl border p-4 text-start transition',
                    selectedSet.has(template.id)
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900">{template.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{template.description}</p>
                    </div>
                    <Plus className="ms-auto h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
      {isApprovalOpen ? (
        <ApprovalGate
          workflowName={workflow.name}
          steps={workflow.steps.map((step) => step.template.name)}
          review={review}
          readiness={readiness}
          diagram={diagram}
          checked={approvalChecked}
          isPending={isPending}
          onCheckedChange={setApprovalChecked}
          onClose={() => setIsApprovalOpen(false)}
          onConfirm={createTasks}
        />
      ) : null}
    </div>
  );
}

function statusTone(status: WorkflowReviewResult['overall_status']) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'needs_inputs') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'risky') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function WorkflowReviewPanel({
  review,
  diagram,
  onCopy,
  onDownload,
  onTrackReview,
}: {
  review: WorkflowReviewResult;
  diagram: WorkflowDiagramModel;
  onCopy: () => void;
  onDownload: () => void;
  onTrackReview: () => void;
}) {
  const { t } = useLanguage();
  const warnings = [...review.weak_steps, ...review.duplicate_steps, ...review.unsafe_actions_detected];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-black text-slate-950">{t('dashboardI18n.workflowBuilder.reviewWorkflow', 'Review Workflow')}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {t('dashboardI18n.workflowBuilder.reviewDescription', 'Workflow review checks template metadata, missing inputs, and safe usage rules. It does not run n8n, publish content, create ads, spend money, or store private chat content.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTrackReview}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-black', statusTone(review.overall_status))}
          >
            {review.overall_status.replace('_', ' ')}
          </button>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
            {review.readiness_score}/100
          </span>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        {review.review_summary}
      </p>

      <div className="mt-4">
        <WorkflowDiagram diagram={diagram} compact />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReviewList title={t('dashboardI18n.workflowBuilder.missingInputs', 'Missing inputs')} items={review.missing_inputs} />
        <ReviewList title={t('dashboardI18n.workflowBuilder.risksWarnings', 'Risks & warnings')} items={warnings} icon="warn" />
        <ReviewList title={t('dashboardI18n.workflowBuilder.providerBlockers', 'Provider blockers')} items={review.provider_blockers} icon="warn" />
        <ReviewList title={t('dashboardI18n.workflowBuilder.requiredApprovals', 'Required approvals')} items={review.required_approvals} />
        <ReviewList title={t('dashboardI18n.workflowBuilder.recommendedFixes', 'Recommended fixes')} items={review.recommended_fixes} />
        <ReviewList title={t('dashboardI18n.workflowBuilder.safeNextActions', 'Safe next actions')} items={review.safe_next_actions} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
        >
          <ClipboardCopy className="h-4 w-4" />
          {t('dashboardI18n.workflowBuilder.copyReviewSummary', 'Copy Review Summary')}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          <Download className="h-4 w-4" />
          {t('dashboardI18n.workflowBuilder.downloadReviewMd', 'Download Review .md')}
        </button>
      </div>
    </section>
  );
}

function readinessTone(status: WorkflowReadinessResult['readiness_status']) {
  if (status === 'ready_for_draft_tasks') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'needs_inputs') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'review_required') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function ExecutionReadinessPanel({
  readiness,
  showDryRun,
  onDryRun,
}: {
  readiness: WorkflowReadinessResult;
  showDryRun: boolean;
  onDryRun: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">{t('dashboardI18n.workflowBuilder.executionReadiness', 'Execution Readiness')}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('dashboardI18n.workflowBuilder.executionDescription', 'Safe run preparation only. This does not run n8n, call providers, publish, schedule, spend money, or create tasks.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-3 py-1.5 text-xs font-black', readinessTone(readiness.readiness_status))}>
            {readiness.readiness_status.replaceAll('_', ' ')}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
            {readiness.readiness_score}/100
          </span>
        </div>
      </div>
      <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
        {readiness.dry_run_summary}
      </p>
      <button
        type="button"
        onClick={onDryRun}
        className="mt-4 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-50"
      >
        {t('dashboardI18n.workflowBuilder.previewDryRun', 'Preview Dry Run')}
      </button>
      {showDryRun ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ReviewList title={t('dashboardI18n.workflowBuilder.missingInputs', 'Missing inputs')} items={readiness.missing_inputs} icon="warn" />
          <ReviewList title={t('dashboardI18n.workflowBuilder.blockedActions', 'Blocked actions')} items={readiness.blocked_actions} icon="warn" />
          <ReviewList title={t('dashboardI18n.workflowBuilder.providerRequirements', 'Provider requirements')} items={readiness.provider_requirements} />
          <ReviewList title={t('dashboardI18n.workflowBuilder.approvalRequirements', 'Approval requirements')} items={readiness.approval_requirements} />
          <ReviewList title={t('dashboardI18n.workflowBuilder.safeExecutionSteps', 'Safe execution steps')} items={readiness.safe_execution_steps} />
          <ReviewList title={t('dashboardI18n.workflowBuilder.estimatedOutputs', 'Estimated outputs')} items={readiness.estimated_outputs} />
          <ReviewList title={t('dashboardI18n.workflowBuilder.contentStudioHandoffs', 'Content Studio handoffs')} items={readiness.content_studio_handoff_preview} />
          <ReviewList title={t('dashboardI18n.workflowBuilder.n8nPlanPreviews', 'n8n plan previews')} items={readiness.n8n_plan_preview} />
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.workflowBuilder.taskPayloadPreview', 'Task payload preview')}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {readiness.task_payload_preview.length ? readiness.task_payload_preview.map((task) => (
                <div key={`${task.template_id}-${task.title}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                  <p className="text-sm font-black text-slate-800">{task.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{task.status} - {task.execution_mode}</p>
                </div>
              )) : <p className="text-sm text-slate-500">{t('dashboardI18n.workflowBuilder.noTaskPayloads', 'No task payloads yet.')}</p>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReviewList({ title, items, icon }: { title: string; items: string[]; icon?: 'warn' }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.length ? items.slice(0, 8).map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600">
            {icon === 'warn' ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
            <span>{item}</span>
          </li>
        )) : (
          <li className="text-sm leading-5 text-slate-500">{t('dashboardI18n.common.none')}</li>
        )}
      </ul>
    </div>
  );
}

function ApprovalGate({
  workflowName,
  steps,
  review,
  readiness,
  diagram,
  checked,
  isPending,
  onCheckedChange,
  onClose,
  onConfirm,
}: {
  workflowName: string;
  steps: string[];
  review: WorkflowReviewResult;
  readiness: WorkflowReadinessResult;
  diagram: WorkflowDiagramModel;
  checked: boolean;
  isPending: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/30 px-3 py-4 backdrop-blur-sm sm:items-center">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <header className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-600">{t('dashboardI18n.workflowBuilder.approvalGate', 'Approval gate')}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{t('dashboardI18n.workflowBuilder.createPendingTasks', 'Create Pending Tasks')}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('dashboardI18n.workflowBuilder.reviewBeforeCreate', 'Review this workflow before creating pending draft tasks.')} {steps.length}
          </p>
        </header>
        <div className="max-h-[calc(100vh-13rem)] space-y-4 overflow-y-auto px-5 py-5">
          <div className={cn('rounded-2xl border px-4 py-3 text-sm font-bold', statusTone(review.overall_status))}>
            {workflowName} - {review.overall_status.replace('_', ' ')} - {review.readiness_score}/100
          </div>
          {review.missing_inputs.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {t('dashboardI18n.workflowBuilder.missingInputsDetected', 'Missing inputs detected. Creating pending tasks is still safe, but the tasks may need more context before review.')}
            </div>
          ) : null}
          <WorkflowDiagram diagram={diagram} compact />
          <div className={cn('rounded-2xl border px-4 py-3 text-sm font-bold', readinessTone(readiness.readiness_status))}>
            {readiness.readiness_status.replaceAll('_', ' ')} - {readiness.dry_run_summary}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">{t('dashboardI18n.workflowBuilder.stepsToCreate', 'Steps to create')}</p>
            <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
              {steps.map((step, index) => (
                <li key={`${step}-${index}`}>{index + 1}. {step}</li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            {t('dashboardI18n.workflowBuilder.approvalSafetyNote', 'Safety note: this creates pending tasks only. It does not run n8n, publish, schedule, create ads, spend money, delete data, write to GitHub, or change webhooks.')}
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onCheckedChange(event.currentTarget.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm font-semibold leading-6 text-slate-700">
              {t('dashboardI18n.workflowBuilder.approvalCheckbox', 'I reviewed the warnings and want to create pending draft tasks only.')}
            </span>
          </label>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!checked || isPending}
            className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isPending ? t('common.loading') : t('dashboardI18n.workflowBuilder.createPendingTasks', 'Create Pending Tasks')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.slice(0, 3).map((item) => (
          <li key={item} className="text-sm leading-5 text-slate-600">{item}</li>
        ))}
      </ul>
    </div>
  );
}
