'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Loader2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { reviewQualityAction } from './actions';
import {
  brandToneOptions,
  qualityReviewPlatforms,
  qualityReviewTypes,
  type QualityReviewPlatform,
  type QualityReviewResult,
  type QualityReviewType,
} from '@/lib/quality-review/review-types';
import { formatQualityReviewMarkdown } from '@/lib/quality-review/evaluation';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';

interface QualityReviewClientProps {
  initialContent?: string;
  initialReviewType?: QualityReviewType;
  initialPlatform?: QualityReviewPlatform;
  initialBrandTone?: string;
}

function safeFilename(result: QualityReviewResult | null) {
  const type = result?.review_type ?? 'quality-review';
  return `${type.replace(/_/g, '-')}-review.md`;
}

function statusTone(status: QualityReviewResult['status']) {
  if (status === 'excellent') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'good') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'needs_improvement') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'risky') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function scoreTone(score: number) {
  if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 70) return 'text-sky-700 bg-sky-50 border-sky-100';
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-rose-700 bg-rose-50 border-rose-100';
}

function copyText(text: string, message: string, errorMessage: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(message),
    () => toast.error(errorMessage)
  );
}

function downloadReview(result: QualityReviewResult, successMessage: string) {
  const markdown = formatQualityReviewMarkdown(result);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename(result);
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(successMessage);
}

function ResultList({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
              <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', warning ? 'bg-amber-500' : 'bg-emerald-500')} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{t('dashboardI18n.qualityReview.noneFound', 'None found.')}</p>
      )}
    </section>
  );
}

export function QualityReviewClient({
  initialContent = '',
  initialReviewType = 'marketing_content',
  initialPlatform = 'generic',
  initialBrandTone = 'Clear and practical',
}: QualityReviewClientProps) {
  const { t, dir } = useLanguage();
  const [content, setContent] = useState(initialContent);
  const [reviewType, setReviewType] = useState<QualityReviewType>(initialReviewType);
  const [platform, setPlatform] = useState<QualityReviewPlatform>(initialPlatform);
  const [brandTone, setBrandTone] = useState(initialBrandTone);
  const [useAiAssist, setUseAiAssist] = useState(false);
  const [result, setResult] = useState<QualityReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reviewMarkdown = useMemo(() => result ? formatQualityReviewMarkdown(result) : '', [result]);
  const canReview = content.trim().length > 0 && !isPending;

  function submitReview() {
    setError(null);
    startTransition(async () => {
      const response = await reviewQualityAction({
        content,
        reviewType,
        platform,
        brandTone,
        useAiAssist,
      });

      if (response.error || !response.review) {
        setError(response.error ?? t('dashboardI18n.qualityReview.failedSafely', 'Quality review failed safely.'));
        return;
      }

      setResult(response.review);
      toast.success(t('dashboardI18n.qualityReview.readyToast', 'Quality review ready'));
    });
  }

  return (
    <div dir={dir} className="space-y-7">
      <PageHeader
        eyebrow={t('nav.qualityReview')}
        title={t('dashboardI18n.qualityReview.title', 'Evaluate drafts before you use them')}
        description={t('dashboardI18n.qualityReview.description', 'Score generated content, AI Studio prompts, prompt templates, workflow plans, automation blueprints, and Alex drafts with review-first safety checks.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/automation-blueprints" className={buttonStyles({ variant: 'soft' })}>
              <SearchCheck className="h-4 w-4" />
              {t('nav.automationBlueprints')}
            </Link>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('nav.dashboard')}
            </Link>
          </div>
        }
      />

      <section className="rounded-lg border border-emerald-100 bg-[#F1F7F7] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              {t('dashboardI18n.qualityReview.safetyBoundary', 'Review-only safety boundary')}
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              {t('dashboardI18n.qualityReview.safetyNotice', 'Reviews are draft analysis only. This page does not publish, schedule, spend, delete, run n8n, call webhooks, or change provider logic.')}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-white bg-white/70 px-3 py-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={useAiAssist}
              onChange={(event) => setUseAiAssist(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            {t('dashboardI18n.qualityReview.aiAssistLabel', 'AI-assisted review if server-side OpenAI is ready')}
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.qualityReview.reviewType', 'Review type')}</span>
              <select
                value={reviewType}
                onChange={(event) => setReviewType(event.target.value as QualityReviewType)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                {qualityReviewTypes.map((option) => (
                  <option key={option.value} value={option.value}>{t(`mappings.qualityReview.type.${option.value}`, option.label)}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.qualityReview.platform', 'Platform')}</span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as QualityReviewPlatform)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                {qualityReviewPlatforms.map((option) => (
                  <option key={option.value} value={option.value}>{t(`mappings.qualityReview.platform.${option.value}`, option.label)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.qualityReview.brandTone', 'Brand tone')}</span>
            <input
              list="brand-tone-options"
              value={brandTone}
              onChange={(event) => setBrandTone(event.target.value.slice(0, 120))}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              placeholder={t('dashboardI18n.qualityReview.brandTonePlaceholder', 'Optional brand tone')}
            />
            <datalist id="brand-tone-options">
              {brandToneOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.qualityReview.draftToReview', 'Draft to review')}</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value.slice(0, 12000))}
              rows={16}
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              placeholder={t('dashboardI18n.qualityReview.draftPlaceholder', 'Paste content, prompt, creative brief, AI Studio prompt, workflow plan, automation blueprint, or Alex draft...')}
            />
          </label>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submitReview}
            disabled={!canReview}
            className={buttonStyles({ variant: 'primary', size: 'lg', className: 'mt-5 w-full' })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isPending ? t('dashboardI18n.qualityReview.reviewing', 'Reviewing...') : t('dashboardI18n.qualityReview.reviewQuality', 'Review Quality')}
          </button>
        </div>

        <div className="space-y-5">
          {result ? (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t('dashboardI18n.qualityReview.overallScore', 'Overall Score')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <div className={cn('rounded-lg border px-4 py-3 text-3xl font-black', scoreTone(result.overall_score))}>
                        {result.overall_score}
                      </div>
                      <span className={cn('rounded-full border px-3 py-1 text-xs font-black uppercase', statusTone(result.status))}>
                        {t(`mappings.qualityReview.status.${result.status}`, result.status.replace(/_/g, ' '))}
                      </span>
                      <Badge tone={result.ai_assisted ? 'blue' : 'emerald'}>
                        {result.ai_assisted ? t('dashboardI18n.qualityReview.aiAssisted', 'AI-assisted') : t('dashboardI18n.qualityReview.deterministic', 'Deterministic')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyText(reviewMarkdown, t('dashboardI18n.qualityReview.copied', 'Quality review copied'), t('dashboardI18n.qualityReview.copyFailed', 'Could not copy review'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                      <ClipboardCopy className="h-4 w-4" />
                      {t('dashboardI18n.qualityReview.copyReview', 'Copy Review')}
                    </button>
                    <button type="button" onClick={() => downloadReview(result, t('dashboardI18n.qualityReview.downloaded', 'Quality review downloaded'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                      <Download className="h-4 w-4" />
                      {t('dashboardI18n.qualityReview.downloadReview', 'Download Review .md')}
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">{result.summary}</p>
                {result.ai_assist_note ? (
                  <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold leading-5 text-sky-700">
                    {result.ai_assist_note}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    [t('dashboardI18n.qualityReview.clarity', 'Clarity'), result.clarity_score],
                    [t('dashboardI18n.qualityReview.conversion', 'Conversion'), result.conversion_score],
                    [t('dashboardI18n.qualityReview.safety', 'Safety'), result.safety_score],
                  ].map(([label, score]) => (
                    <div key={label} className={cn('rounded-lg border p-3', scoreTone(Number(score)))}>
                      <p className="text-xs font-black uppercase tracking-[0.12em] opacity-70">{label}</p>
                      <p className="mt-1 text-2xl font-black">{score}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <ResultList title={t('dashboardI18n.qualityReview.strengths', 'Strengths')} items={result.strengths} />
                <ResultList title={t('dashboardI18n.qualityReview.issues', 'Issues')} items={result.issues} warning />
                <ResultList title={t('dashboardI18n.qualityReview.safetyWarnings', 'Safety Warnings')} items={result.safety_warnings} warning />
                <ResultList title={t('dashboardI18n.qualityReview.missingInputs', 'Missing Inputs')} items={result.missing_inputs} warning />
                <ResultList title={t('dashboardI18n.qualityReview.recommendedFixes', 'Recommended Fixes')} items={result.recommended_fixes} />
                <ResultList title={t('dashboardI18n.qualityReview.safeNextActions', 'Safe Next Actions')} items={result.safe_next_actions} />
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950">{t('dashboardI18n.qualityReview.fitNotes', 'Fit notes')}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{result.platform_fit}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{result.brand_fit}</p>
              </section>

              {result.improved_version ? (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-slate-950">{t('dashboardI18n.qualityReview.improvedVersion', 'Improved version')}</h3>
                  <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {result.improved_version}
                  </pre>
                </section>
              ) : null}
            </>
          ) : (
            <section className="flex min-h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
              <div className="max-w-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-950">{t('dashboardI18n.qualityReview.emptyTitle', 'Paste a draft and review it')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {t('dashboardI18n.qualityReview.emptyDescription', 'The first pass uses deterministic local checks. AI-assisted review is optional and only runs server-side when OpenAI text generation is configured.')}
                </p>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
