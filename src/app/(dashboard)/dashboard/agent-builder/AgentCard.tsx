'use client';

import { useState, useTransition } from 'react';
import {
  BarChart3,
  Bot,
  Check,
  Copy,
  Database,
  FileText,
  Globe,
  MessageSquare,
  Pencil,
  PenSquare,
  Rocket,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { AgentBuilderAgentRecord } from '@/types/database';
import { toast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import {
  deleteAgentAction,
  publishTemplateAction,
  saveAgentToPromptLibraryAction,
} from './actions';

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Sparkles,
  Workflow,
  FileText,
  Search,
  MessageSquare,
  PenSquare,
  BarChart3,
  Rocket,
  ShieldAlert,
  Wand2,
  Database,
};

interface AgentCardProps {
  agent: AgentBuilderAgentRecord;
  onEdit: (agent: AgentBuilderAgentRecord) => void;
}

export function AgentCard({ agent, onEdit }: AgentCardProps) {
  const { t, dir } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [shareSlug, setShareSlug] = useState<string | null>(agent.share_slug);
  const Icon = iconMap[agent.icon] ?? Bot;
  const isPublished = agent.visibility === 'marketplace';

  const handlePublish = () => {
    const formData = new FormData();
    formData.set('agentId', agent.id);
    formData.set('visibility', isPublished ? 'workspace' : 'marketplace');

    startTransition(async () => {
      const result = await publishTemplateAction(
        { error: null, message: null, agentId: null, shareSlug: null, promptId: null },
        formData
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setShareSlug(result.shareSlug ?? null);
      toast.success(result.message ?? 'Template updated.');
    });
  };

  const handleShare = () => {
    if (!shareSlug) {
      toast.warning(t('dashboardI18n.agentBuilder.publishToMarketplace', 'Publish to Marketplace'));
      return;
    }

    const url = `${window.location.origin}/dashboard/agent-builder/shared/${shareSlug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('dashboardI18n.marketplace.shareLinkCopied', 'Share link copied')),
      () => toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy link.'))
    );
  };

  const handleSaveToPromptLibrary = () => {
    const formData = new FormData();
    formData.set('agentId', agent.id);
    formData.set('name', agent.name);
    formData.set('instructions', agent.instructions);
    formData.set('description', agent.description ?? '');
    formData.set('tags', agent.tags.join(', '));

    startTransition(async () => {
      const result = await saveAgentToPromptLibraryAction(
        { error: null, message: null, agentId: null, shareSlug: null, promptId: null },
        formData
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(t('dashboardI18n.agentBuilder.savedToPromptLibrary', 'Saved to Prompt Library'));
    });
  };

  const handleCopyInstructions = () => {
    navigator.clipboard.writeText(agent.instructions).then(
      () => toast.success(t('common.copied', 'Copied successfully')),
      () => toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy instructions.'))
    );
  };

  const handleDelete = () => {
    if (!window.confirm(t('dashboardI18n.agentBuilder.confirmDelete', 'Delete this agent?'))) return;

    startTransition(async () => {
      const result = await deleteAgentAction(agent.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? 'Agent deleted.');
    });
  };

  return (
    <article className="flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: agent.accent_color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black leading-snug text-slate-950">{agent.name}</h3>
            <p className="text-xs font-bold text-slate-500">{agent.role}</p>
          </div>
        </div>
        {isPublished ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
            <Globe className="h-3.5 w-3.5" />
            {t('dashboardI18n.marketplace.published', 'Published')}
          </span>
        ) : null}
      </div>

      {agent.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{agent.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{agent.category}</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{agent.safety_level}</span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{agent.execution_mode}</span>
      </div>

      <p className="mt-3 line-clamp-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        {agent.instructions}
      </p>

      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-400">
        <span>{t('dashboardI18n.agentBuilder.usedTimes', 'Used {count} times').replace('{count}', String(agent.usage_count))}</span>
        <span dir={dir}>{t('dashboardI18n.agentBuilder.updated', 'Updated')} {formatDateTime(agent.updated_at)}</span>
      </div>

      <div className="mt-4 flex-1" />

      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onEdit(agent)}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <Pencil className="h-4 w-4" />
          {t('common.edit', 'Edit')}
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <Globe className="h-4 w-4" />
          {isPublished
            ? t('dashboardI18n.agentBuilder.unpublish', 'Move to Workspace')
            : t('dashboardI18n.agentBuilder.publishToMarketplace', 'Publish to Marketplace')}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={isPending || !isPublished}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {t('dashboardI18n.agentBuilder.shareTemplate', 'Share Template')}
        </button>
        <button
          type="button"
          onClick={handleSaveToPromptLibrary}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          <Check className="h-4 w-4" />
          {t('dashboardI18n.agentBuilder.saveToPromptLibrary', 'Save to Prompt Library')}
        </button>
        <button
          type="button"
          onClick={handleCopyInstructions}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <Copy className="h-4 w-4" />
          {t('dashboardI18n.marketplace.copyInstructions', 'Copy Instructions')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
        >
          <Trash2 className="h-4 w-4" />
          {t('common.delete', 'Delete')}
        </button>
      </div>
    </article>
  );
}
