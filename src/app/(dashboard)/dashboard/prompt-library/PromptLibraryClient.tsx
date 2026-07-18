'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clipboard,
  FileText,
  Plus,
  Search,
  SearchCheck,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import {
  promptCategories,
  promptTargetTools,
} from '@/lib/data/prompt-library';
import type { PromptCategory, PromptLibraryRecord, PromptTargetTool } from '@/types/database';
import { PromptForm } from './PromptForm';
import { PromptCategoryBadge, PromptToolBadge, TagList } from './PromptBadge';
import { useLanguage } from '@/i18n/context';
import { translatePromptCategory, translatePromptTool } from './prompt-i18n';
import {
  deletePromptAction,
  importStarterPromptsAction,
  markPromptCopiedAction,
  togglePromptFavoriteAction,
} from './actions';

interface PromptLibraryClientProps {
  prompts: PromptLibraryRecord[];
  error?: string | null;
}

const quickFilters: Array<{ value: 'all' | 'favorites' | PromptCategory; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'common.all', fallback: 'All' },
  { value: 'favorites', labelKey: 'dashboardI18n.promptLibrary.favorites', fallback: 'Favorites' },
  { value: 'development', labelKey: 'mappings.promptCategory.development', fallback: 'Development' },
  { value: 'deployment', labelKey: 'mappings.promptCategory.deployment', fallback: 'Deployment' },
  { value: 'bug_fix', labelKey: 'mappings.promptCategory.bugFix', fallback: 'Bug Fix' },
  { value: 'ui_ux', labelKey: 'mappings.promptCategory.uiUx', fallback: 'UI/UX' },
  { value: 'supabase', labelKey: 'mappings.promptCategory.supabase', fallback: 'Supabase' },
  { value: 'vercel', labelKey: 'mappings.promptCategory.vercel', fallback: 'Vercel' },
  { value: 'n8n', labelKey: 'mappings.promptCategory.n8n', fallback: 'n8n' },
  { value: 'reports', labelKey: 'mappings.promptCategory.reports', fallback: 'Reports' },
  { value: 'provider_setup', labelKey: 'mappings.promptCategory.providerSetup', fallback: 'Provider Setup' },
];

export function PromptLibraryClient({ prompts, error }: PromptLibraryClientProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(prompts.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'favorites' | PromptCategory>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PromptCategory>('all');
  const [toolFilter, setToolFilter] = useState<'all' | PromptTargetTool>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const recentlyUsed = prompts.filter((prompt) => prompt.last_used_at).length;
  const allTags = useMemo(
    () => Array.from(new Set(prompts.flatMap((prompt) => prompt.tags))).sort(),
    [prompts]
  );

  const filteredPrompts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedTag = tagFilter.trim().toLowerCase();

    return prompts.filter((prompt) => {
      const matchesQuick =
        quickFilter === 'all' ||
        (quickFilter === 'favorites' && prompt.is_favorite) ||
        prompt.category === quickFilter;
      const matchesCategory = categoryFilter === 'all' || prompt.category === categoryFilter;
      const matchesTool = toolFilter === 'all' || prompt.target_tool === toolFilter;
      const matchesTag =
        !normalizedTag || prompt.tags.some((tag) => tag.toLowerCase().includes(normalizedTag));
      const matchesSearch =
        !normalizedSearch ||
        prompt.title.toLowerCase().includes(normalizedSearch) ||
        (prompt.description ?? '').toLowerCase().includes(normalizedSearch) ||
        prompt.prompt_text.toLowerCase().includes(normalizedSearch);

      return matchesQuick && matchesCategory && matchesTool && matchesTag && matchesSearch;
    });
  }, [categoryFilter, prompts, quickFilter, searchQuery, tagFilter, toolFilter]);

  const handleCopyPrompt = async (prompt: PromptLibraryRecord) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      toast.success(t('dashboardI18n.promptLibrary.promptCopied', 'Prompt copied.'));
    } catch {
      toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy prompt.'), {
        description: t('dashboardI18n.promptLibrary.clipboardBlocked', 'Clipboard access was blocked by the browser.'),
      });
      return;
    }

    startTransition(async () => {
      const result = await markPromptCopiedAction(prompt.id);
      if (result.error) {
        toast.warning(t('dashboardI18n.promptLibrary.promptCopied', 'Prompt copied.'), {
          description: t('dashboardI18n.promptLibrary.usageUpdateFailed', 'Usage count could not be updated.'),
        });
      }
      router.refresh();
    });
  };

  const handleToggleFavorite = (prompt: PromptLibraryRecord) => {
    startTransition(async () => {
      const result = await togglePromptFavoriteAction(prompt.id, !prompt.is_favorite);
      if (result.error) {
        toast.error(t('dashboardI18n.promptLibrary.updateFailed', 'Could not update prompt.'), { description: result.error });
      }
      router.refresh();
    });
  };

  const handleDeletePrompt = (prompt: PromptLibraryRecord) => {
    if (!window.confirm(t('dashboardI18n.promptLibrary.deleteConfirm', 'Delete "{title}"?').replace('{title}', prompt.title))) return;

    startTransition(async () => {
      const result = await deletePromptAction(prompt.id);
      if (result.error) {
        toast.error(t('dashboardI18n.promptLibrary.deleteFailed', 'Could not delete prompt.'), { description: result.error });
        return;
      }
      toast.success(t('dashboardI18n.promptLibrary.deleted', 'Prompt deleted.'));
      router.refresh();
    });
  };

  const handleImportStarterPrompts = () => {
    if (!window.confirm(t('dashboardI18n.promptLibrary.importConfirm', 'Import starter prompts into this workspace? Existing starter prompts will be skipped.'))) {
      return;
    }

    startTransition(async () => {
      const result = await importStarterPromptsAction();
      if (result.error) {
        toast.error(t('dashboardI18n.promptLibrary.importFailed', 'Could not import starter prompts.'), { description: result.error });
        return;
      }
      toast.success(t('dashboardI18n.promptLibrary.imported', 'Starter prompts imported.'));
      router.refresh();
    });
  };

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        eyebrow={t('dashboardI18n.promptLibrary.eyebrow', 'Workspace knowledge')}
        title={t('dashboardI18n.promptLibrary.title', 'Prompt Library')}
        description={t('dashboardI18n.promptLibrary.description', 'Save, organize, search, and reuse your best prompts for development, deployment, automation, ads, reports, and project workflows.')}
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('nav.dashboard')}
            </Link>
            <a href="#new-prompt" className={buttonStyles()}>
              <Plus className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.newPrompt', 'New Prompt')}
            </a>
            <button type="button" onClick={handleImportStarterPrompts} className={buttonStyles({ variant: 'outline' })}>
              <Upload className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.importStarterPrompts', 'Import Starter Prompts')}
            </button>
          </>
        }
      />

      {error ? (
        <Notice tone="warning" title={t('dashboardI18n.promptLibrary.unavailable', 'Prompt Library unavailable')}>
          {t('dashboardI18n.promptLibrary.unavailableDescription', 'Prompt data could not be loaded for this workspace.')}
        </Notice>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title={t('dashboardI18n.promptLibrary.totalPrompts', 'Total Prompts')} value={prompts.length} icon={<FileText className="h-5 w-5" />} subtitle={t('dashboardI18n.promptLibrary.currentWorkspace', 'Current workspace')} />
        <StatCard title={t('dashboardI18n.promptLibrary.favorites', 'Favorites')} value={prompts.filter((prompt) => prompt.is_favorite).length} icon={<Star className="h-5 w-5" />} tone="brand" subtitle={t('dashboardI18n.promptLibrary.pinnedPrompts', 'Pinned prompts')} />
        <StatCard title={t('dashboardI18n.promptLibrary.developmentPrompts', 'Development Prompts')} value={prompts.filter((prompt) => prompt.category === 'development').length} icon={<Clipboard className="h-5 w-5" />} tone="accent" subtitle={t('dashboardI18n.promptLibrary.buildWorkflows', 'Build workflows')} />
        <StatCard title={t('dashboardI18n.promptLibrary.deploymentPrompts', 'Deployment Prompts')} value={prompts.filter((prompt) => prompt.category === 'deployment').length} icon={<Upload className="h-5 w-5" />} tone="dark" subtitle={t('dashboardI18n.promptLibrary.releaseWorkflows', 'Release workflows')} />
        <StatCard title={t('dashboardI18n.promptLibrary.recentlyUsed', 'Recently Used')} value={recentlyUsed} icon={<Clipboard className="h-5 w-5" />} tone="neutral" subtitle={t('dashboardI18n.promptLibrary.copiedAtLeastOnce', 'Copied at least once')} />
      </div>

      <Card className="border-[#F7CBCA]/14 bg-[#D5E5E5]/45">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#F7CBCA]">{t('dashboardI18n.promptLibrary.operations', 'Prompt operations')}</p>
            <p className="mt-2 text-sm leading-6 text-black/62">
              {t('dashboardI18n.promptLibrary.safetyText', 'Do not store API keys, tokens, passwords, or private credentials in prompts.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateForm((current) => !current)} variant={showCreateForm ? 'outline' : 'primary'}>
              <Plus className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.newPrompt', 'New Prompt')}
            </Button>
            <Button onClick={handleImportStarterPrompts} variant="outline" disabled={isPending}>
              <Upload className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.importStarterPrompts', 'Import Starter Prompts')}
            </Button>
          </div>
        </div>
      </Card>

      <div id="new-prompt">
        {showCreateForm && <PromptForm mode="create" onCancel={() => setShowCreateForm(false)} />}
      </div>

      <Card>
        <CardHeader
          title={t('dashboardI18n.promptLibrary.title', 'Prompt Library')}
          description={t('dashboardI18n.promptLibrary.listDescription', 'Search, filter, copy, and reuse saved prompts.')}
          action={<span className="text-sm font-bold text-black/56">{t('dashboardI18n.common.showing', 'Showing')} {filteredPrompts.length} {t('dashboardI18n.common.of', 'of')} {prompts.length}</span>}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setQuickFilter(filter.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-bold transition-colors',
                quickFilter === filter.value
                  ? 'border-[#F7CBCA] bg-[#F7CBCA] text-white'
                  : 'border-black/10 bg-white text-black/62 hover:border-[#F7CBCA]/30'
              )}
            >
              {t(filter.labelKey, filter.fallback)}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
          <div className="relative">
            <Label htmlFor="prompt-search">{t('dashboardI18n.promptLibrary.searchPrompts', 'Search prompts')}</Label>
            <Search className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
            <Input
              id="prompt-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('dashboardI18n.promptLibrary.searchPlaceholder', 'Search title, description, or prompt text')}
            />
          </div>
          <div>
            <Label htmlFor="category-filter">{t('dashboardI18n.promptLibrary.category', 'Category')}</Label>
            <Select id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | PromptCategory)}>
              <option value="all">{t('dashboardI18n.promptLibrary.allCategories', 'All Categories')}</option>
              {promptCategories.map((category) => (
                <option key={category} value={category}>{translatePromptCategory(t, category)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tool-filter">{t('dashboardI18n.promptLibrary.targetTool', 'Target tool')}</Label>
            <Select id="tool-filter" value={toolFilter} onChange={(event) => setToolFilter(event.target.value as 'all' | PromptTargetTool)}>
              <option value="all">{t('dashboardI18n.promptLibrary.allTools', 'All Tools')}</option>
              {promptTargetTools.map((tool) => (
                <option key={tool} value={tool}>{translatePromptTool(t, tool)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tag-filter">{t('dashboardI18n.promptLibrary.tag', 'Tag')}</Label>
            <Input
              id="tag-filter"
              list="prompt-tags"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder={t('dashboardI18n.promptLibrary.filterByTag', 'Filter by tag')}
            />
            <datalist id="prompt-tags">
              {allTags.map((tag) => <option key={tag} value={tag} />)}
            </datalist>
          </div>
        </div>
      </Card>

      {prompts.length === 0 ? (
        <EmptyState
          icon={Clipboard}
          title={t('dashboardI18n.promptLibrary.emptyTitle', 'No prompts saved yet')}
          description={t('dashboardI18n.promptLibrary.emptyDescription', 'Save your best prompts for development, deployment, ads, reports, provider setup, and project workflows.')}
          action={
            <>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                {t('dashboardI18n.promptLibrary.newPrompt', 'New Prompt')}
              </Button>
              <Button onClick={handleImportStarterPrompts} variant="outline">
                {t('dashboardI18n.promptLibrary.importStarterPrompts', 'Import Starter Prompts')}
              </Button>
            </>
          }
        />
      ) : filteredPrompts.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title={t('dashboardI18n.promptLibrary.noMatchTitle', 'No prompts match')} description={t('dashboardI18n.promptLibrary.noMatchDescription', 'Clear the search or adjust filters.')} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <article key={prompt.id} className="card-lift rounded-lg border border-[#F7CBCA]/10 bg-white/90 p-5 shadow-[0_18px_42px_rgba(93,107,107,0.06)]">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-black leading-snug text-[#5D6B6B]">{prompt.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PromptCategoryBadge category={prompt.category} />
                    <PromptToolBadge tool={prompt.target_tool} />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={prompt.is_favorite ? t('dashboardI18n.promptLibrary.removeFavorite', 'Remove favorite') : t('dashboardI18n.promptLibrary.addFavorite', 'Add favorite')}
                  onClick={() => handleToggleFavorite(prompt)}
                  disabled={isPending}
                  className={cn('rounded-lg border p-2', prompt.is_favorite ? 'border-[#F7CBCA]/20 bg-[#D5E5E5] text-[#F7CBCA]' : 'border-black/10 bg-white text-black/40')}
                >
                  <Star className={cn('h-4 w-4', prompt.is_favorite && 'fill-current')} />
                </button>
              </div>

              {prompt.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-black/62">{prompt.description}</p>}
              <p className="mt-4 line-clamp-4 rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3 font-mono text-xs leading-5 text-black/62">{prompt.prompt_text}</p>

              {prompt.tags.length > 0 && <div className="mt-4"><TagList tags={prompt.tags} compact /></div>}

              <div className="mt-4 grid gap-2 text-xs font-bold text-black/50 sm:grid-cols-2">
                <span>{t('dashboardI18n.promptLibrary.usedTimes', 'Used {count} times').replace('{count}', String(prompt.usage_count))}</span>
                <span className="sm:text-end">{t('dashboardI18n.promptLibrary.updated', 'Updated')} {formatDateTime(prompt.updated_at)}</span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => handleCopyPrompt(prompt)} disabled={isPending} size="sm">
                  <Clipboard className="h-4 w-4" />
                  {t('common.copy')}
                </Button>
                <Link href={`/dashboard/prompt-library/${prompt.id}`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                  {t('common.open')}
                </Link>
                <Link href={`/dashboard/prompt-library/${prompt.id}#edit-prompt`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                  {t('common.edit')}
                </Link>
                <Link
                  href={`/dashboard/quality-review?type=prompt_template&platform=generic&content=${encodeURIComponent(prompt.prompt_text.slice(0, 6000))}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}
                >
                  <SearchCheck className="h-4 w-4" />
                  {t('dashboardI18n.promptLibrary.reviewPrompt', 'Review Prompt')}
                </Link>
                <Link
                  href={`/dashboard/knowledge-base?query=${encodeURIComponent(prompt.title)}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}
                >
                  <SearchCheck className="h-4 w-4" />
                  {t('nav.knowledgeBase')}
                </Link>
                <Button onClick={() => handleDeletePrompt(prompt)} variant="danger" size="sm" disabled={isPending}>
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Notice tone="warning" title={t('dashboardI18n.promptLibrary.safetyTitle', 'Prompt safety')}>
        {t('dashboardI18n.promptLibrary.safetyExtended', 'Do not store API keys, tokens, passwords, authorization headers, or private credentials in prompts.')}
      </Notice>
    </div>
  );
}
