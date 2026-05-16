'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Files,
  FolderOpen,
  Search,
  SearchCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';
import { WorkflowDiagram } from '@/components/agent-library/WorkflowDiagram';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import { translateTemplateCategory } from '@/i18n/dashboard-labels';
import { createPendingTasksFromWorkflowAction } from '../workflows/actions';
import {
  deleteWorkflowPlaybookAction,
  duplicateWorkflowPlaybookAction,
  toggleFavoritePlaybookAction,
  type WorkflowPlaybookView,
} from './actions';
import type { TemplateCategory } from '@/lib/agent-library/templates';

interface PlaybooksClientProps {
  initialPlaybooks: WorkflowPlaybookView[];
  initialError: string | null;
}

type StatusFilter = 'all' | 'favorite' | 'draft' | 'ready' | 'archived';
type SortMode = 'updated' | 'used' | 'newest';

function safeFilename(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${slug || 'agentflow-playbook'}.md`;
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

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function list(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None';
}

function formatPlaybookMarkdown(playbook: WorkflowPlaybookView) {
  const readinessScore = typeof playbook.readinessSummary.readiness_score === 'number'
    ? `${playbook.readinessSummary.readiness_score}/100`
    : 'Not calculated';
  const readinessStatus = typeof playbook.readinessSummary.readiness_status === 'string'
    ? playbook.readinessSummary.readiness_status.replaceAll('_', ' ')
    : playbook.status;
  const safeNextActions = Array.isArray(playbook.readinessSummary.safe_next_actions)
    ? playbook.readinessSummary.safe_next_actions.filter((item): item is string => typeof item === 'string')
    : ['Open in Workflow Builder for review', 'Create pending tasks only after confirmation'];

  return [
    `# ${playbook.name}`,
    '',
    '## Goal',
    playbook.goal || 'No goal provided.',
    '',
    '## Description',
    playbook.description || 'No description provided.',
    '',
    '## Visual Diagram',
    playbook.diagram?.markdownDiagram ?? '```mermaid\nflowchart TD\n  A["No diagram available"]\n```',
    '',
    '## Selected Agent Templates',
    list(playbook.steps.map((step) => `${step.index}. ${step.template_name} (${step.template_category})`)),
    '',
    '## Notes',
    playbook.notes || 'No notes provided.',
    '',
    '## Readiness Summary',
    `- Status: ${readinessStatus}`,
    `- Score: ${readinessScore}`,
    typeof playbook.readinessSummary.review_summary === 'string'
      ? `- Summary: ${playbook.readinessSummary.review_summary}`
      : '- Summary: Open in Workflow Builder to refresh the review.',
    '',
    '## Safe Next Actions',
    list(safeNextActions),
    '',
    '## Safety',
    '- This playbook is a saved draft plan only.',
    '- Creating tasks from this playbook creates pending tasks only.',
    '- It does not run n8n, publish content, schedule posts, create ads, spend money, delete provider data, or change webhooks.',
    '- Keep API keys, tokens, webhook secrets, and private provider responses out of playbook notes.',
    '',
  ].join('\n');
}

export function PlaybooksClient({ initialPlaybooks, initialError }: PlaybooksClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState(initialPlaybooks);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => {
    return [...new Set(playbooks.flatMap((playbook) => playbook.categories))].sort();
  }, [playbooks]);

  const filteredPlaybooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return playbooks
      .filter((playbook) => {
        const matchesQuery = !query || [
          playbook.name,
          playbook.description,
          playbook.goal,
          playbook.notes,
          playbook.categories.join(' '),
        ].join(' ').toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all'
          || (statusFilter === 'favorite' ? playbook.isFavorite : playbook.status === statusFilter);
        const matchesCategory = categoryFilter === 'all' || playbook.categories.includes(categoryFilter);

        return matchesQuery && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (sortMode === 'used') return b.usageCount - a.usageCount;
        if (sortMode === 'newest') return b.createdAt.localeCompare(a.createdAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [categoryFilter, playbooks, searchQuery, sortMode, statusFilter]);

  function updateLocal(playbook: WorkflowPlaybookView) {
    setPlaybooks((current) => current.map((item) => item.id === playbook.id ? playbook : item));
  }

  function duplicatePlaybook(playbookId: string) {
    startTransition(async () => {
      const result = await duplicateWorkflowPlaybookAction(playbookId);

      if (result.error || !result.playbook) {
        toast.error('Could not duplicate playbook', { description: result.error ?? undefined });
        return;
      }

      setPlaybooks((current) => [result.playbook!, ...current]);
      toast.success('Playbook duplicated successfully', {
        action: { label: 'Open', href: `/dashboard/agent-library/workflows?playbook=${result.playbook.id}` },
      });
    });
  }

  function toggleFavorite(playbookId: string) {
    startTransition(async () => {
      const result = await toggleFavoritePlaybookAction(playbookId);

      if (result.error || !result.playbook) {
        toast.error('Could not update favorite', { description: result.error ?? undefined });
        return;
      }

      updateLocal(result.playbook);
      toast.success(result.message ?? 'Favorite updated');
    });
  }

  function exportMarkdown(playbook: WorkflowPlaybookView) {
    downloadMarkdown(safeFilename(playbook.name), formatPlaybookMarkdown(playbook));
    toast.success('Playbook Markdown exported');
  }

  function copyMarkdown(playbook: WorkflowPlaybookView) {
    navigator.clipboard.writeText(formatPlaybookMarkdown(playbook)).then(
      () => toast.success('Playbook copied successfully'),
      () => toast.error('Could not copy playbook')
    );
  }

  function createPendingTasks(playbook: WorkflowPlaybookView) {
    const confirmed = window.confirm(
      `Create ${playbook.steps.length} pending tasks from "${playbook.name}"?\n\nThis will not run n8n, publish, schedule, spend money, or change webhooks.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await createPendingTasksFromWorkflowAction({
        workflowName: playbook.name,
        goal: playbook.goal,
        notes: playbook.notes,
        templateIds: playbook.templateIds,
        priority: 'Normal',
        manualApprovalConfirmed: true,
      });

      if (result.error) {
        toast.error('Could not create pending tasks', { description: result.error });
        return;
      }

      toast.success('Pending tasks created from playbook', {
        description: result.message,
        action: { label: 'View Tasks', href: '/dashboard/tasks' },
      });
    });
  }

  function deletePlaybook(playbook: WorkflowPlaybookView) {
    const confirmed = window.confirm(
      `Delete saved playbook "${playbook.name}"?\n\nOnly the saved playbook will be removed. Tasks, content, providers, and n8n workflows are not affected.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteWorkflowPlaybookAction(playbook.id);
      if (result.error) {
        toast.error('Could not delete playbook', { description: result.error });
        return;
      }

      setPlaybooks((current) => current.filter((item) => item.id !== playbook.id));
      toast.success('Playbook deleted');
      router.refresh();
    });
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t('dashboardI18n.agentLibrary.savedPlaybooks')}
        title={t('dashboardI18n.playbooks.title', 'Workflow History & Playbooks')}
        description={t('dashboardI18n.playbooks.description', 'Save, reopen, duplicate, export, and reuse safe Agent Library workflow drafts.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/agent-library/workflows"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <FolderOpen className="h-4 w-4" />
              {t('dashboardI18n.playbooks.openBuilder', 'Open Builder')}
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

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
        {t('dashboardI18n.playbooks.safetyNotice', 'Saved playbooks preserve workflow steps, notes, diagrams, readiness summaries, and safe next actions. They do not run n8n, publish content, create ads, spend money, delete data, or change webhooks.')}
      </section>

      {initialError ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          {initialError}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <label className="relative block">
            <span className="sr-only">{t('dashboardI18n.playbooks.searchSr', 'Search playbooks')}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('dashboardI18n.playbooks.searchPlaceholder', 'Search saved playbooks...')}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 text-sm font-medium text-slate-950 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <option value="all">{t('dashboardI18n.playbooks.allStatuses', 'All statuses')}</option>
            <option value="favorite">{t('dashboardI18n.playbooks.favorites', 'Favorites')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="ready">{t('status.ready')}</option>
            <option value="archived">{t('status.archived')}</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <option value="all">{t('dashboardI18n.playbooks.allCategories', 'All categories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{translateTemplateCategory(t, category as TemplateCategory)}</option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            <option value="updated">{t('dashboardI18n.playbooks.recentlyUpdated', 'Recently updated')}</option>
            <option value="used">{t('dashboardI18n.playbooks.mostUsed', 'Most used')}</option>
            <option value="newest">{t('dashboardI18n.playbooks.newest', 'Newest')}</option>
          </select>
        </div>
      </section>

      {filteredPlaybooks.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Files className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-950">{t('dashboardI18n.playbooks.emptyTitle', 'No saved playbooks yet')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            {t('dashboardI18n.playbooks.emptyDescription', 'Build a workflow, save it as a playbook, and it will appear here with its visual diagram and readiness snapshot.')}
          </p>
          <Link
            href="/dashboard/agent-library/workflows"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
          >
            <FolderOpen className="h-4 w-4" />
            {t('dashboardI18n.agentLibrary.openWorkflowBuilder')}
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredPlaybooks.map((playbook) => (
            <article
              key={playbook.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={playbook.status === 'ready' ? 'emerald' : 'blue'}>
                      {playbook.status === 'ready' ? t('status.ready') : playbook.status === 'archived' ? t('status.archived') : t('status.draft')}
                    </Badge>
                    {playbook.isFavorite ? <Badge tone="amber">{t('dashboardI18n.playbooks.favorite', 'Favorite')}</Badge> : null}
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                      {playbook.steps.length} steps
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-slate-950">{playbook.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                    {playbook.description || playbook.goal || 'Reusable AgentFlow workflow playbook.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(playbook.id)}
                  disabled={isPending}
                  className={cn(
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition',
                    playbook.isFavorite
                      ? 'border-amber-200 bg-amber-50 text-amber-600'
                      : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                  )}
                  aria-label={playbook.isFavorite ? 'Unfavorite playbook' : 'Favorite playbook'}
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>

              {playbook.diagram ? (
                <div className="mt-4">
                  <WorkflowDiagram diagram={playbook.diagram} compact />
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Metric label={t('dashboardI18n.playbooks.updated', 'Updated')} value={formatDate(playbook.updatedAt)} />
                <Metric label={t('dashboardI18n.playbooks.opened', 'Opened')} value={formatDate(playbook.lastOpenedAt)} />
                <Metric label={t('dashboardI18n.playbooks.usage', 'Usage')} value={`${playbook.usageCount}`} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {playbook.categories.map((category) => (
                  <span key={category} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                    {translateTemplateCategory(t, category as TemplateCategory)}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  href={`/dashboard/agent-library/workflows?playbook=${playbook.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('common.open')}
                </Link>
                <button
                  type="button"
                  onClick={() => duplicatePlaybook(playbook.id)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Files className="h-4 w-4" />
                  {t('dashboardI18n.playbooks.duplicate', 'Duplicate')}
                </button>
                <button
                  type="button"
                  onClick={() => copyMarkdown(playbook)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-50"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {t('common.copy')}
                </button>
                <button
                  type="button"
                  onClick={() => exportMarkdown(playbook)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <Download className="h-4 w-4" />
                  {t('dashboardI18n.playbooks.exportMd', 'Export .md')}
                </button>
                <Link
                  href={`/dashboard/knowledge-base?query=${encodeURIComponent(playbook.name)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                >
                  <SearchCheck className="h-4 w-4" />
                  Use in Knowledge Base
                </Link>
                <button
                  type="button"
                  onClick={() => createPendingTasks(playbook)}
                  disabled={isPending || playbook.steps.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {t('dashboardI18n.workflowBuilder.createPendingTasks', 'Create Pending Tasks')}
                </button>
                <button
                  type="button"
                  onClick={() => deletePlaybook(playbook)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}
