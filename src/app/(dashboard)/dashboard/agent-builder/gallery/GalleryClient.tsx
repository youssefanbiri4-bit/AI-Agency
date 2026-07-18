'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Copy,
  Globe,
  Plus,
  Sparkles,
  Store,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import type { AgentBuilderAgentRecord } from '@/types/database';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import { useLanguage } from '@/i18n/context';
import {
  cloneSharedAgentAction,
  createAgentFromTemplateAction,
} from '../actions';

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Sparkles,
  Workflow,
};

type Tab = 'marketplace' | 'builtIn' | 'workspace';

interface GalleryClientProps {
  builtInTemplates: AgentTemplate[];
  marketplaceAgents: AgentBuilderAgentRecord[];
  workspaceAgents: AgentBuilderAgentRecord[];
  error?: string | null;
}

export function GalleryClient({
  builtInTemplates,
  marketplaceAgents,
  workspaceAgents,
  error,
}: GalleryClientProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [tab, setTab] = useState<Tab>('marketplace');
  const [isPending, startTransition] = useTransition();

  const handleUseTemplate = (templateId: string) => {
    const formData = new FormData();
    formData.set('templateId', templateId);

    startTransition(async () => {
      const result = await createAgentFromTemplateAction(
        { error: null, message: null, agentId: null, shareSlug: null, promptId: null },
        formData
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? 'Agent created from template.');
      router.push('/dashboard/agent-builder');
    });
  };

  const handleClone = (slug: string) => {
    const formData = new FormData();
    formData.set('slug', slug);

    startTransition(async () => {
      const result = await cloneSharedAgentAction(
        { error: null, message: null, agentId: null, shareSlug: null, promptId: null },
        formData
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? 'Template cloned to your workspace.');
      router.push('/dashboard/agent-builder');
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t('common.copied', 'Copied successfully')),
      () => toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy.'))
    );
  };

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'marketplace', label: t('dashboardI18n.marketplace.marketplaceTab', 'Marketplace'), count: marketplaceAgents.length },
    { key: 'builtIn', label: t('dashboardI18n.marketplace.builtInTab', 'Built-in'), count: builtInTemplates.length },
    { key: 'workspace', label: t('dashboardI18n.marketplace.workspaceTab', 'My Workspace'), count: workspaceAgents.length },
  ];

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        eyebrow={t('dashboardI18n.marketplace.eyebrow', 'Templates')}
        title={t('dashboardI18n.marketplace.title', 'Templates Gallery & Marketplace')}
        description={t('dashboardI18n.marketplace.description', 'Browse built-in templates, community Marketplace templates, and your own workspace agents.')}
        actions={
          <>
            <Link href="/dashboard/agent-builder" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('dashboardI18n.agentBuilder.title', 'AI Agent Builder')}
            </Link>
            <Link href="/dashboard/agent-builder" className={buttonStyles()}>
              <Plus className="h-4 w-4" />
              {t('dashboardI18n.agentBuilder.newAgent', 'New Agent')}
            </Link>
          </>
        }
      />

      {error ? (
        <Notice tone="warning" title={t('dashboardI18n.marketplace.title', 'Templates Gallery & Marketplace')}>
          {t('dashboardI18n.promptLibrary.unavailableDescription', 'Data could not be loaded.')}
        </Notice>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              'shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-sky-100 ' +
              (tab === item.key
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700')
            }
          >
            {item.label} <span className="opacity-55">{item.count}</span>
          </button>
        ))}
      </div>

      {tab === 'builtIn' ? (
        builtInTemplates.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-6 w-6" />} title={t('dashboardI18n.marketplace.builtIn', 'Built-in Templates')} description={t('common.noData', 'No data available.')} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {builtInTemplates.map((template) => {
              const Icon = Bot;
              return (
                <article key={template.id} className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black leading-snug text-slate-950">{template.name}</h3>
                        <p className="text-xs font-bold text-slate-500">{template.category}</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{template.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{template.safety_level}</span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{template.execution_mode}</span>
                  </div>
                  <div className="mt-4 flex-1" />
                  <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleUseTemplate(template.id)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    >
                      <Plus className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.useTemplate', 'Use Template')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(template.suggested_prompt)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
                    >
                      <Copy className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.copyInstructions', 'Copy Instructions')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : null}

      {tab === 'marketplace' ? (
        marketplaceAgents.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title={t('dashboardI18n.marketplace.community', 'Marketplace')}
            description={t('dashboardI18n.marketplace.noMarketplace', 'No published templates yet. Publish one from the Agent Builder.')}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {marketplaceAgents.map((agent) => {
              const Icon = iconMap[agent.icon] ?? Bot;
              return (
                <article key={agent.id} className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: agent.accent_color }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black leading-snug text-slate-950">{agent.name}</h3>
                        <p className="text-xs font-bold text-slate-500">{agent.category}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                      <Globe className="h-3.5 w-3.5" />
                      {t('dashboardI18n.marketplace.published', 'Published')}
                    </span>
                  </div>
                  {agent.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{agent.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{agent.safety_level}</span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{agent.execution_mode}</span>
                  </div>
                  <div className="mt-4 flex-1" />
                  <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => agent.share_slug && handleClone(agent.share_slug)}
                      disabled={isPending || !agent.share_slug}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.cloneToWorkspace', 'Clone to Workspace')}
                    </button>
                    {agent.share_slug ? (
                      <Link
                        href={`/dashboard/agent-builder/shared/${agent.share_slug}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
                      >
                        <Globe className="h-4 w-4" />
                        {t('dashboardI18n.marketplace.viewShared', 'View Shared')}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleCopy(agent.instructions)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 sm:col-span-2"
                    >
                      <Copy className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.copyInstructions', 'Copy Instructions')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : null}

      {tab === 'workspace' ? (
        workspaceAgents.length === 0 ? (
          <EmptyState icon={<Bot className="h-6 w-6" />} title={t('dashboardI18n.marketplace.yourWorkspace', 'Your Workspace Agents')} description={t('dashboardI18n.agentBuilder.emptyDescription', 'Build your first no-code AI agent, then publish it as a template.')} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {workspaceAgents.map((agent) => {
              const Icon = iconMap[agent.icon] ?? Bot;
              return (
                <article key={agent.id} className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: agent.accent_color }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black leading-snug text-slate-950">{agent.name}</h3>
                        <p className="text-xs font-bold text-slate-500">{agent.category}</p>
                      </div>
                    </div>
                    {agent.visibility === 'marketplace' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                        <Globe className="h-3.5 w-3.5" />
                        {t('dashboardI18n.marketplace.published', 'Published')}
                      </span>
                    ) : null}
                  </div>
                  {agent.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{agent.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{agent.safety_level}</span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{agent.execution_mode}</span>
                  </div>
                  <div className="mt-4 flex-1" />
                  <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <Link
                      href="/dashboard/agent-builder"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    >
                      <Workflow className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.openAgent', 'Open Agent')}
                    </Link>
                    {agent.share_slug ? (
                      <Link
                        href={`/dashboard/agent-builder/shared/${agent.share_slug}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
                      >
                        <Globe className="h-4 w-4" />
                        {t('dashboardI18n.marketplace.viewShared', 'View Shared')}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleCopy(agent.instructions)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 sm:col-span-2"
                    >
                      <Copy className="h-4 w-4" />
                      {t('dashboardI18n.marketplace.copyInstructions', 'Copy Instructions')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
