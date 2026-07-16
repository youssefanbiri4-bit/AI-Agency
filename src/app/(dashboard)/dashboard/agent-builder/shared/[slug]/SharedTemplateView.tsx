'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Copy,
  Globe,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/toast';
import type { AgentBuilderAgentRecord } from '@/types/database';
import { useLanguage } from '@/i18n/context';
import { cloneSharedAgentAction } from '../../actions';

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Sparkles: Bot,
  Workflow: Bot,
};

interface SharedTemplateViewProps {
  agent: AgentBuilderAgentRecord | null;
}

export function SharedTemplateView({ agent }: SharedTemplateViewProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [isPending, startTransition] = useTransition();

  if (!agent) {
    return (
      <div className="space-y-8" dir={dir}>
        <PageHeader
          eyebrow={t('dashboardI18n.marketplace.eyebrow', 'Templates')}
          title={t('dashboardI18n.marketplace.sharedTitle', 'Shared Agent Template')}
        />
        <EmptyState icon={Globe} title={t('dashboardI18n.marketplace.notFound', 'Template not found')} description={t('dashboardI18n.marketplace.notFoundDescription', 'This shared template may have been removed or is not public.')} />
      </div>
    );
  }

  const Icon = iconMap[agent.icon] ?? Bot;

  const handleCopy = () => {
    navigator.clipboard.writeText(agent.instructions).then(
      () => toast.success(t('common.copied', 'Copied successfully')),
      () => toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy instructions.'))
    );
  };

  const handleClone = () => {
    if (!agent.share_slug) return;
    const formData = new FormData();
    formData.set('slug', agent.share_slug);

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

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        eyebrow={t('dashboardI18n.marketplace.eyebrow', 'Templates')}
        title={t('dashboardI18n.marketplace.sharedTitle', 'Shared Agent Template')}
        description={t('dashboardI18n.marketplace.sharedDescription', 'A read-only view of a published agent template. Clone it to your workspace or copy its instructions.')}
        actions={
          <>
            <Link href="/dashboard/agent-builder/gallery" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('dashboardI18n.marketplace.title', 'Templates Gallery & Marketplace')}
            </Link>
            <button type="button" onClick={handleClone} disabled={isPending} className={buttonStyles()}>
              <Plus className="h-4 w-4" />
              {t('dashboardI18n.marketplace.cloneToWorkspace', 'Clone to Workspace')}
            </button>
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: agent.accent_color }}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">{agent.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                <Globe className="h-3.5 w-3.5" />
                {t('dashboardI18n.marketplace.published', 'Published')}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-500">{agent.role} · {agent.category}</p>
          </div>
        </div>

        {agent.description ? <p className="mt-4 text-sm leading-6 text-slate-600">{agent.description}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{agent.safety_level}</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{agent.execution_mode}</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {agent.inputs.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.inputs', 'Inputs')}</p>
              <ul className="mt-2 space-y-1">
                {agent.inputs.map((item) => (
                  <li key={item} className="text-sm text-slate-600">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {agent.outputs.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.outputs', 'Outputs')}</p>
              <ul className="mt-2 space-y-1">
                {agent.outputs.map((item) => (
                  <li key={item} className="text-sm text-slate-600">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.instructions', 'Instructions (system prompt)')}</p>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{agent.instructions}</p>
        </div>

        {agent.review_checklist.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.reviewChecklist', 'Review checklist')}</p>
            <ul className="mt-2 space-y-1">
              {agent.review_checklist.map((item) => (
                <li key={item} className="text-sm text-slate-600">{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={handleCopy} disabled={isPending} className={buttonStyles({ variant: 'outline' })}>
            <Copy className="h-4 w-4" />
            {t('dashboardI18n.marketplace.copyInstructions', 'Copy Instructions')}
          </button>
          <Link href="/dashboard/agent-builder" className={buttonStyles({ variant: 'outline' })}>
            {t('dashboardI18n.marketplace.backToBuilder', 'Open in Agent Builder')}
          </Link>
        </div>
      </article>
    </div>
  );
}
