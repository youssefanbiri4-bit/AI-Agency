'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Bot,
  ClipboardCopy,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  buildIndustryPackMermaid,
  formatIndustryPackMarkdown,
  getAvailableAgentIdsForPack,
  getIndustryPackCategories,
  industryPacks,
  type IndustryPack,
} from '@/lib/industry-packs/packs';
import { getAgentTemplateById } from '@/lib/agent-library/templates';
import { useLanguage } from '@/i18n/context';

function safeFilename(value: string) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'industry-pack'}.md`;
}

function copyText(text: string, success: string, error: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(success),
    () => toast.error(error)
  );
}

function downloadMarkdown(pack: IndustryPack, success: string) {
  const blob = new Blob([formatIndustryPackMarkdown(pack)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename(pack.name);
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(success);
}

function promptIdeasMarkdown(pack: IndustryPack) {
  return [`# ${pack.name} Prompt Ideas`, '', ...pack.prompt_templates.map((item) => `- ${item}`)].join('\n');
}

function workflowMarkdown(pack: IndustryPack) {
  const workflow = pack.workflow_presets[0];
  const steps = workflow?.steps.map((step) => getAgentTemplateById(step)?.name ?? step) ?? [];
  return [`# ${pack.name} Workflow`, '', ...steps.map((step, index) => `${index + 1}. ${step}`), '', '```mermaid', buildIndustryPackMermaid(pack), '```'].join('\n');
}

export function IndustryPacksClient() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedPack, setSelectedPack] = useState<IndustryPack | null>(null);
  const categories = useMemo(() => getIndustryPackCategories(), []);
  const normalizedQuery = query.toLowerCase().trim();

  const filteredPacks = useMemo(() => {
    return industryPacks.filter((pack) => {
      const matchesCategory = category === 'all' || pack.category === category;
      const haystack = [
        pack.name,
        pack.category,
        pack.short_description,
        pack.best_for.join(' '),
        pack.prompt_templates.join(' '),
        pack.content_studio_templates.join(' '),
      ].join(' ').toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [category, normalizedQuery]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('dashboardI18n.industryPacks.eyebrow', 'Planning only')}
        title={t('dashboardI18n.industryPacks.title', 'Industry Packs')}
        description={t('dashboardI18n.industryPacks.description', 'Start campaigns, workflows, prompts, AI Studio ideas, and playbooks from reusable industry-specific packs.')}
        actions={
          <>
            <Link href="/dashboard/alex" className={buttonStyles({ variant: 'outline' })}>
              <Bot className="h-4 w-4" />
              {t('dashboardI18n.industryPacks.openAlex', 'Open Alex')}
            </Link>
            <Link href="/dashboard/agent-library/workflows" className={buttonStyles({ variant: 'outline' })}>
              <Workflow className="h-4 w-4" />
              {t('dashboardI18n.industryPacks.workflowBuilder', 'Workflow Builder')}
            </Link>
          </>
        }
      />

      <section className="rounded-2xl border border-black/7 bg-white/90 p-4 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative block">
            <span className="sr-only">{t('dashboardI18n.industryPacks.search', 'Search packs')}</span>
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('dashboardI18n.industryPacks.searchPlaceholder', 'Search industry, prompt, workflow...')}
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-10 text-sm font-semibold text-black outline-none transition focus:border-[#F7CBCA]/40 focus:ring-4 focus:ring-[#F7CBCA]/12"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-black outline-none transition focus:border-[#F7CBCA]/40 focus:ring-4 focus:ring-[#F7CBCA]/12"
            aria-label={t('dashboardI18n.industryPacks.categoryFilter', 'Category filter')}
          >
            <option value="all">{t('dashboardI18n.industryPacks.allCategories', 'All categories')}</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-black/55">
          {t('dashboardI18n.industryPacks.safetyNotice', 'All packs are planning-only. They do not run n8n, publish, schedule, create ads, spend money, send emails, delete data, write to GitHub, or change providers.')}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredPacks.map((pack) => (
          <PackCard key={pack.id} pack={pack} onOpen={() => setSelectedPack(pack)} />
        ))}
      </section>

      {filteredPacks.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-black/12 bg-white/80 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-[#F7CBCA]" />
          <h2 className="mt-3 text-lg font-black text-[#5D6B6B]">{t('dashboardI18n.industryPacks.emptyTitle', 'No packs found')}</h2>
          <p className="mt-2 text-sm leading-6 text-black/55">{t('dashboardI18n.industryPacks.emptyDescription', 'Try a broader search or choose all categories.')}</p>
        </section>
      ) : null}

      {selectedPack ? (
        <PackDetailsModal pack={selectedPack} onClose={() => setSelectedPack(null)} />
      ) : null}
    </div>
  );
}

function PackCard({ pack, onOpen }: { pack: IndustryPack; onOpen: () => void }) {
  const { t } = useLanguage();
  const agentCount = getAvailableAgentIdsForPack(pack).length;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_45px_rgba(93,107,107,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="blue">{pack.category}</Badge>
          <h2 className="mt-3 text-xl font-black leading-tight text-[#5D6B6B]">{pack.name}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-black/58">{pack.short_description}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D5E5E5]/70 text-[#F7CBCA]">
          <Library className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pack.best_for.slice(0, 3).map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric label={t('dashboardI18n.industryPacks.agents', 'Agents')} value={agentCount} />
        <Metric label={t('dashboardI18n.industryPacks.prompts', 'Prompts')} value={pack.prompt_templates.length} />
        <Metric label={t('dashboardI18n.industryPacks.workflows', 'Workflows')} value={pack.workflow_presets.length} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
        <ShieldCheck className="h-4 w-4" />
        {pack.safety_level} / {pack.execution_mode}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <button type="button" onClick={onOpen} className={buttonStyles({ size: 'sm' })}>
          <Eye className="h-4 w-4" />
          {t('dashboardI18n.industryPacks.viewDetails', 'View Details')}
        </button>
        <Link href={`/dashboard/alex?industryPack=${encodeURIComponent(pack.id)}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          <Bot className="h-4 w-4" />
          {t('dashboardI18n.industryPacks.useWithAlex', 'Use with Alex')}
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/7 bg-[#F1F7F7]/60 p-3">
      <p className="text-lg font-black text-[#5D6B6B]">{value}</p>
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</p>
    </div>
  );
}

function PackDetailsModal({ pack, onClose }: { pack: IndustryPack; onClose: () => void }) {
  const { t } = useLanguage();
  const agentIds = getAvailableAgentIdsForPack(pack);
  const firstPrompt = pack.prompt_templates[0] ?? pack.name;
  const firstVisual = pack.ai_studio_prompt_ideas[0] ?? pack.name;
  const firstContent = pack.content_studio_templates[0] ?? pack.name;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-black/7 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone="blue">{pack.category}</Badge>
            <h2 className="mt-3 text-2xl font-black text-[#5D6B6B]">{pack.name}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-black/58">{pack.short_description}</p>
          </div>
          <button type="button" onClick={onClose} className={buttonStyles({ variant: 'ghost', size: 'icon' })} aria-label={t('action.close', 'Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/dashboard/alex?industryPack=${encodeURIComponent(pack.id)}`} className={buttonStyles({ size: 'sm' })}>
            <Bot className="h-4 w-4" />
            {t('dashboardI18n.industryPacks.useWithAlex', 'Use with Alex')}
          </Link>
          <button type="button" onClick={() => copyText(formatIndustryPackMarkdown(pack), t('dashboardI18n.industryPacks.packCopied', 'Pack summary copied'), t('dashboardI18n.common.copyFailed', 'Could not copy'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <ClipboardCopy className="h-4 w-4" />
            {t('dashboardI18n.industryPacks.copyPack', 'Copy Pack Summary')}
          </button>
          <button type="button" onClick={() => copyText(promptIdeasMarkdown(pack), t('dashboardI18n.industryPacks.promptsCopied', 'Prompt ideas copied'), t('dashboardI18n.common.copyFailed', 'Could not copy'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <FileText className="h-4 w-4" />
            {t('dashboardI18n.industryPacks.copyPrompts', 'Copy Prompt Ideas')}
          </button>
          <button type="button" onClick={() => copyText(workflowMarkdown(pack), t('dashboardI18n.industryPacks.workflowCopied', 'Workflow copied'), t('dashboardI18n.common.copyFailed', 'Could not copy'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <Workflow className="h-4 w-4" />
            {t('dashboardI18n.industryPacks.copyWorkflow', 'Copy Workflow')}
          </button>
          <button type="button" onClick={() => downloadMarkdown(pack, t('dashboardI18n.industryPacks.downloaded', 'Pack markdown downloaded'))} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
            <Download className="h-4 w-4" />
            {t('dashboardI18n.industryPacks.downloadMarkdown', 'Download Markdown')}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <DetailSection title={t('dashboardI18n.industryPacks.recommendedAgents', 'Recommended Agents')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {agentIds.map((agentId) => {
                  const template = getAgentTemplateById(agentId);
                  return <div key={agentId} className="rounded-xl border border-black/7 bg-[#F1F7F7]/58 p-3 text-sm font-bold text-[#5D6B6B]">{template?.name ?? agentId}</div>;
                })}
              </div>
            </DetailSection>

            <DetailSection title={t('dashboardI18n.industryPacks.workflowDiagram', 'Workflow Diagram')}>
              <VisualWorkflow pack={pack} />
            </DetailSection>

            <DetailSection title={t('dashboardI18n.industryPacks.promptIdeas', 'Prompt Ideas')}>
              <List values={pack.prompt_templates} />
            </DetailSection>
          </div>

          <div className="space-y-5">
            <DetailSection title={t('dashboardI18n.industryPacks.integrations', 'Safe Integrations')}>
              <div className="grid gap-2">
                <Link href={`/dashboard/agent-library/workflows?preset=${encodeURIComponent(pack.workflow_presets[0]?.id ?? '')}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <Workflow className="h-4 w-4" />
                  {t('dashboardI18n.industryPacks.openWorkflowBuilder', 'Open Workflow Builder')}
                </Link>
                <Link href={`/dashboard/prompt-library?idea=${encodeURIComponent(firstPrompt)}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <Library className="h-4 w-4" />
                  {t('dashboardI18n.industryPacks.openPromptLibrary', 'Open in Prompt Library')}
                </Link>
                <Link href={`/dashboard/ai-studio?prompt=${encodeURIComponent(firstVisual)}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <ImageIcon className="h-4 w-4" />
                  {t('dashboardI18n.industryPacks.openAiStudio', 'Open in AI Studio')}
                </Link>
                <Link href={`/dashboard/content-studio?q=${encodeURIComponent(firstContent)}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <FileText className="h-4 w-4" />
                  {t('dashboardI18n.industryPacks.openContentStudio', 'Open in Content Studio')}
                </Link>
                <Link href={`/dashboard/quality-review?type=workflow_plan&content=${encodeURIComponent(formatIndustryPackMarkdown(pack).slice(0, 4000))}`} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  <ShieldCheck className="h-4 w-4" />
                  {t('dashboardI18n.industryPacks.reviewPack', 'Review Pack Output')}
                </Link>
                <DisabledAction label={t('dashboardI18n.industryPacks.createTasksSoon', 'Create Pending Tasks - coming soon')} />
                <DisabledAction label={t('dashboardI18n.industryPacks.savePlaybookSoon', 'Save as Playbook - coming soon')} />
              </div>
              <p className="text-xs font-semibold leading-5 text-black/50">
                {t('dashboardI18n.industryPacks.integrationNote', 'Links open safe planning surfaces only. Prompt Library, AI Studio, and Content Studio do not auto-save, auto-generate, publish, or schedule from this page.')}
              </p>
            </DetailSection>

            <DetailSection title={t('dashboardI18n.industryPacks.aiIdeas', 'AI Studio Ideas')}>
              <List values={pack.ai_studio_prompt_ideas} />
            </DetailSection>
            <DetailSection title={t('dashboardI18n.industryPacks.contentIdeas', 'Content Studio Ideas')}>
              <List values={pack.content_studio_templates} />
            </DetailSection>
            <DetailSection title={t('dashboardI18n.industryPacks.automationBlueprints', 'Automation Blueprints')}>
              <List values={pack.automation_blueprints} />
            </DetailSection>
            <DetailSection title={t('dashboardI18n.industryPacks.qualityChecklist', 'Quality Checklist')}>
              <List values={pack.quality_review_checklist} />
            </DetailSection>
            <DetailSection title={t('dashboardI18n.industryPacks.safeNextActions', 'Safe Next Actions')}>
              <List values={pack.safe_next_actions} />
            </DetailSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/7 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5D6B6B]/75">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function List({ values }: { values: string[] }) {
  return (
    <ul className="space-y-2">
      {values.map((value) => (
        <li key={value} className="rounded-xl border border-black/7 bg-[#F1F7F7]/55 px-3 py-2 text-sm font-semibold leading-6 text-black/62">
          {value}
        </li>
      ))}
    </ul>
  );
}

function VisualWorkflow({ pack }: { pack: IndustryPack }) {
  const steps = pack.workflow_presets[0]?.steps ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const template = getAgentTemplateById(step);
        return (
          <div key={`${step}-${index}`} className="flex items-center gap-2">
            <span className="rounded-xl border border-[#D5E5E5] bg-[#F1F7F7] px-3 py-2 text-xs font-black leading-5 text-[#5D6B6B]">
              {template?.name ?? step}
            </span>
            {index < steps.length - 1 ? <span className="text-sm font-black text-[#F7CBCA]">-&gt;</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function DisabledAction({ label }: { label: string }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      disabled
      className={cn(buttonStyles({ variant: 'outline', size: 'sm' }), 'w-full justify-start opacity-60')}
      title={t('dashboardI18n.industryPacks.disabledActionTitle', 'Integration is not wired for one-click save from Industry Packs yet.')}
    >
      {label}
    </button>
  );
}
