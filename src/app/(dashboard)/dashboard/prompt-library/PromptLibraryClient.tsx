'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Clipboard,
  FileText,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Label, Select } from '@/components/ui/FormControls';
import { StatCard } from '@/components/ui/StatCard';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import {
  formatPromptCategory,
  formatPromptTargetTool,
  promptCategories,
  promptTargetTools,
} from '@/lib/data/prompt-library';
import type { PromptCategory, PromptLibraryRecord, PromptTargetTool } from '@/types/database';
import { PromptForm } from './PromptForm';
import { PromptCategoryBadge, PromptToolBadge, TagList } from './PromptBadge';
import {
  deletePromptAction,
  importStarterPromptsAction,
  markPromptCopiedAction,
  togglePromptFavoriteAction,
} from './actions';

interface PromptLibraryClientProps {
  prompts: PromptLibraryRecord[];
}

const quickFilters: Array<{ value: 'all' | 'favorites' | PromptCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'development', label: 'Development' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'bug_fix', label: 'Bug Fix' },
  { value: 'ui_ux', label: 'UI/UX' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'vercel', label: 'Vercel' },
  { value: 'n8n', label: 'n8n' },
  { value: 'reports', label: 'Reports' },
  { value: 'provider_setup', label: 'Provider Setup' },
];

export function PromptLibraryClient({ prompts }: PromptLibraryClientProps) {
  const router = useRouter();
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
      toast.success('Prompt copied.');
    } catch {
      toast.error('Could not copy prompt.', {
        description: 'Clipboard access was blocked by the browser.',
      });
      return;
    }

    startTransition(async () => {
      const result = await markPromptCopiedAction(prompt.id);
      if (result.error) {
        toast.warning('Prompt copied.', {
          description: 'Usage count could not be updated.',
        });
      }
      router.refresh();
    });
  };

  const handleToggleFavorite = (prompt: PromptLibraryRecord) => {
    startTransition(async () => {
      const result = await togglePromptFavoriteAction(prompt.id, !prompt.is_favorite);
      if (result.error) {
        toast.error('Could not update prompt.', { description: result.error });
      }
      router.refresh();
    });
  };

  const handleDeletePrompt = (prompt: PromptLibraryRecord) => {
    if (!window.confirm(`Delete "${prompt.title}"?`)) return;

    startTransition(async () => {
      const result = await deletePromptAction(prompt.id);
      if (result.error) {
        toast.error('Could not delete prompt.', { description: result.error });
        return;
      }
      toast.success('Prompt deleted.');
      router.refresh();
    });
  };

  const handleImportStarterPrompts = () => {
    if (!window.confirm('Import starter prompts into this workspace? Existing starter prompts will be skipped.')) {
      return;
    }

    startTransition(async () => {
      const result = await importStarterPromptsAction();
      if (result.error) {
        toast.error('Could not import starter prompts.', { description: result.error });
        return;
      }
      toast.success(result.message ?? 'Starter prompts imported.');
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Prompts" value={prompts.length} icon={FileText} subtitle="Current workspace" />
        <StatCard title="Favorites" value={prompts.filter((prompt) => prompt.is_favorite).length} icon={Star} tone="brand" subtitle="Pinned prompts" />
        <StatCard title="Development Prompts" value={prompts.filter((prompt) => prompt.category === 'development').length} icon={Clipboard} tone="accent" subtitle="Build workflows" />
        <StatCard title="Deployment Prompts" value={prompts.filter((prompt) => prompt.category === 'deployment').length} icon={Upload} tone="dark" subtitle="Release workflows" />
        <StatCard title="Recently Used" value={recentlyUsed} icon={Clipboard} tone="neutral" subtitle="Copied at least once" />
      </div>

      <Card className="border-[#F7CBCA]/14 bg-[#D5E5E5]/45">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#F7CBCA]">Prompt operations</p>
            <p className="mt-2 text-sm leading-6 text-black/62">
              Do not store API keys, tokens, passwords, or private credentials in prompts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateForm((current) => !current)} variant={showCreateForm ? 'outline' : 'primary'}>
              <Plus className="h-4 w-4" />
              New Prompt
            </Button>
            <Button onClick={handleImportStarterPrompts} variant="outline" disabled={isPending}>
              <Upload className="h-4 w-4" />
              Import Starter Prompts
            </Button>
          </div>
        </div>
      </Card>

      {showCreateForm && <PromptForm mode="create" onCancel={() => setShowCreateForm(false)} />}

      <Card>
        <CardHeader
          title="Prompt Library"
          description="Search, filter, copy, and reuse saved prompts."
          action={<span className="text-sm font-bold text-black/56">Showing {filteredPrompts.length} of {prompts.length}</span>}
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
              {filter.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
          <div className="relative">
            <Label htmlFor="prompt-search">Search prompts</Label>
            <Search className="pointer-events-none absolute bottom-3 end-3.5 h-4 w-4 text-black/34" />
            <Input
              id="prompt-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, description, or prompt text"
            />
          </div>
          <div>
            <Label htmlFor="category-filter">Category</Label>
            <Select id="category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | PromptCategory)}>
              <option value="all">All Categories</option>
              {promptCategories.map((category) => (
                <option key={category} value={category}>{formatPromptCategory(category)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tool-filter">Target tool</Label>
            <Select id="tool-filter" value={toolFilter} onChange={(event) => setToolFilter(event.target.value as 'all' | PromptTargetTool)}>
              <option value="all">All Tools</option>
              {promptTargetTools.map((tool) => (
                <option key={tool} value={tool}>{formatPromptTargetTool(tool)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tag-filter">Tag</Label>
            <Input
              id="tag-filter"
              list="prompt-tags"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Filter by tag"
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
          title="No prompts saved yet"
          description="Save your best prompts for development, deployment, ads, reports, provider setup, and project workflows."
          action={
            <>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                New Prompt
              </Button>
              <Button onClick={handleImportStarterPrompts} variant="outline">
                Import Starter Prompts
              </Button>
            </>
          }
        />
      ) : filteredPrompts.length === 0 ? (
        <EmptyState icon={Search} title="No prompts match" description="Clear the search or adjust filters." />
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
                  aria-label={prompt.is_favorite ? 'Remove favorite' : 'Add favorite'}
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
                <span>Used {prompt.usage_count} times</span>
                <span className="sm:text-right">Updated {formatDateTime(prompt.updated_at)}</span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => handleCopyPrompt(prompt)} disabled={isPending} size="sm">
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
                <Link href={`/dashboard/prompt-library/${prompt.id}`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                  Open
                </Link>
                <Link href={`/dashboard/prompt-library/${prompt.id}#edit-prompt`} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'w-full' })}>
                  Edit
                </Link>
                <Button onClick={() => handleDeletePrompt(prompt)} variant="danger" size="sm" disabled={isPending}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
