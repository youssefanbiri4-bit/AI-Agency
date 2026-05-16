'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  ClipboardCopy,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { searchKnowledgeAction, refreshKnowledgeBaseAction } from './actions';
import {
  knowledgeSourceOptions,
  type KnowledgeSearchResult,
  type KnowledgeSourceType,
} from '@/lib/knowledge-base/types';
import {
  formatKnowledgeResultMarkdown,
  formatKnowledgeSummaryMarkdown,
} from '@/lib/knowledge-base/format';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';

interface KnowledgeBaseClientProps {
  initialResults: KnowledgeSearchResult[];
  initialTotalEntries: number;
  initialQuery?: string;
}

function sourceLabel(t: (key: string, fallback?: string) => string, source: KnowledgeSourceType) {
  const option = knowledgeSourceOptions.find((item) => item.value === source);
  return t(`mappings.knowledgeSource.${source}`, option?.label ?? source);
}

function copyText(value: string, message: string, errorMessage: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(message),
    () => toast.error(errorMessage)
  );
}

function ResultCard({ result }: { result: KnowledgeSearchResult }) {
  const { t } = useLanguage();
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">{sourceLabel(t, result.source_type)}</Badge>
            <Badge tone="blue">{t('dashboardI18n.knowledgeBase.score', 'Score')} {result.score}</Badge>
          </div>
          <h2 className="mt-3 break-words text-lg font-black text-slate-950">{result.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary}</p>
        </div>
        <div className="text-xs font-bold text-slate-400">{new Date(result.updated_at).toLocaleDateString()}</div>
      </div>

      {result.highlights.length ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t('dashboardI18n.knowledgeBase.keyDetails', 'Key details')}</p>
          <ul className="mt-2 space-y-1">
            {result.highlights.map((highlight) => (
              <li key={highlight} className="text-sm leading-6 text-slate-600">{highlight}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {result.tags.slice(0, 6).map((tag) => (
          <span key={tag} className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copyText(formatKnowledgeResultMarkdown(result), t('dashboardI18n.knowledgeBase.resultCopied', 'Knowledge result copied'), t('dashboardI18n.knowledgeBase.copyFailed', 'Could not copy knowledge text'))}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <ClipboardCopy className="h-4 w-4" />
          {t('dashboardI18n.knowledgeBase.copyResultSummary', 'Copy Result Summary')}
        </button>
        {result.href ? (
          <Link href={result.href} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <ExternalLink className="h-4 w-4" />
            {t('dashboardI18n.knowledgeBase.openSource', 'Open Source')}
          </Link>
        ) : null}
        <Link
          href={`/dashboard/alex?knowledgeQuery=${encodeURIComponent(result.title)}`}
          className={buttonStyles({ variant: 'soft', size: 'sm' })}
        >
          <Bot className="h-4 w-4" />
          {t('dashboardI18n.industryPacks.useWithAlex', 'Use with Alex')}
        </Link>
      </div>
    </article>
  );
}

export function KnowledgeBaseClient({ initialResults, initialTotalEntries, initialQuery = '' }: KnowledgeBaseClientProps) {
  const { t, dir } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [selectedSources, setSelectedSources] = useState<KnowledgeSourceType[]>([]);
  const [results, setResults] = useState(initialResults);
  const [totalEntries, setTotalEntries] = useState(initialTotalEntries);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summaryMarkdown = useMemo(() => formatKnowledgeSummaryMarkdown(results, query), [query, results]);

  function toggleSource(source: KnowledgeSourceType) {
    setSelectedSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source]
    );
  }

  function searchKnowledge() {
    setError(null);
    setRefreshMessage(null);
    startTransition(async () => {
      const response = await searchKnowledgeAction({
        query,
        sourceTypes: selectedSources,
        maxResults: 8,
      });
      setResults(response.results);
      setTotalEntries(response.totalEntries);
      setError(response.error);
    });
  }

  function refreshKnowledge() {
    setError(null);
    startTransition(async () => {
      const response = await refreshKnowledgeBaseAction();
      setTotalEntries(response.totalEntries);
      setRefreshMessage(response.message);
      setError(response.error);
    });
  }

  return (
    <div dir={dir} className="space-y-7">
      <PageHeader
        eyebrow={t('nav.knowledgeBase')}
        title={t('dashboardI18n.knowledgeBase.title', 'Search safe internal workspace knowledge')}
        description={t('dashboardI18n.knowledgeBase.description', 'Find prompts, agent templates, playbooks, blueprints, tasks, content, AI Studio metadata, reports, and system health summaries without indexing secrets.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshKnowledge} disabled={isPending} className={buttonStyles({ variant: 'soft' })}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('dashboardI18n.knowledgeBase.refreshKnowledge', 'Refresh Knowledge')}
            </button>
            <Link href="/dashboard/alex?knowledgeQuery=Search my knowledge base" className={buttonStyles({ variant: 'outline' })}>
              <Bot className="h-4 w-4" />
              {t('dashboardI18n.knowledgeBase.searchWithAlex', 'Search with Alex')}
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
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              {t('dashboardI18n.knowledgeBase.privacySafety', 'Privacy and safety')}
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              {t('dashboardI18n.knowledgeBase.safetyNotice', 'Knowledge Base searches safe internal workspace data only. It does not index secrets, API keys, tokens, webhook secrets, or private provider credentials.')}
            </p>
          </div>
          <Badge tone="emerald" className="shrink-0">{t('dashboardI18n.knowledgeBase.liveEntries', '{count} live entries').replace('{count}', String(totalEntries))}</Badge>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">{t('dashboardI18n.knowledgeBase.searchKnowledge', 'Search Knowledge')}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') searchKnowledge();
              }}
              placeholder={t('dashboardI18n.knowledgeBase.searchPlaceholder', 'Search prompts, playbooks, tasks, blueprints, provider blockers...')}
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-11 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <button type="button" onClick={searchKnowledge} disabled={isPending} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t('dashboardI18n.knowledgeBase.searchKnowledge', 'Search Knowledge')}
          </button>
          <button
            type="button"
            onClick={() => copyText(summaryMarkdown, t('dashboardI18n.knowledgeBase.summaryCopied', 'Knowledge summary copied'), t('dashboardI18n.knowledgeBase.copyFailed', 'Could not copy knowledge text'))}
            disabled={results.length === 0}
            className={buttonStyles({ variant: 'outline', size: 'lg' })}
          >
            <ClipboardCopy className="h-4 w-4" />
            {t('dashboardI18n.knowledgeBase.copySummary', 'Copy Knowledge Summary')}
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {knowledgeSourceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSource(option.value)}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-100',
                selectedSources.includes(option.value)
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
              )}
            >
              {t(`mappings.knowledgeSource.${option.value}`, option.label)}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
        ) : null}
        {refreshMessage ? (
          <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">{refreshMessage}</div>
        ) : null}
      </section>

      {isPending && results.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-500" />
          <h2 className="mt-4 text-lg font-black text-slate-900">{t('dashboardI18n.knowledgeBase.searching', 'Searching safe knowledge')}</h2>
        </section>
      ) : results.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <Database className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-black text-slate-900">{t('dashboardI18n.knowledgeBase.emptyTitle', 'No knowledge results found')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('dashboardI18n.knowledgeBase.emptyDescription', 'Try a broader query or remove source filters.')}</p>
        </section>
      ) : (
        <div className="grid gap-5">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
