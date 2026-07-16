'use client';

import {
  BarChart3,
  Bot,
  Database,
  FileText,
  MessageSquare,
  PenSquare,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Wand2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { AgentBuilderFormValues } from './AgentBuilderForm';
import { useLanguage } from '@/i18n/context';

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

interface AgentPreviewProps {
  form: AgentBuilderFormValues;
}

export function AgentPreview({ form }: AgentPreviewProps) {
  const { t } = useLanguage();
  const Icon = iconMap[form.icon] ?? Bot;
  const inputs = form.inputs.split('\n').map((item) => item.trim()).filter(Boolean);
  const outputs = form.outputs.split('\n').map((item) => item.trim()).filter(Boolean);
  const tags = form.tags.split(',').map((item) => item.trim()).filter(Boolean);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t('dashboardI18n.agentBuilder.preview', 'Live preview')}</p>

      <div className="mt-4 flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: form.accentColor }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-snug text-slate-950">{form.name || t('dashboardI18n.agentBuilder.name', 'Agent name')}</h3>
          <p className="text-sm font-bold text-slate-500">{form.role || '—'}</p>
        </div>
      </div>

      {form.description ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">{form.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{form.category}</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{form.safetyLevel}</span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{form.executionMode}</span>
      </div>

      {form.instructions ? (
        <p className="mt-4 line-clamp-6 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {form.instructions}
        </p>
      ) : null}

      {inputs.length > 0 || outputs.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {inputs.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.inputs', 'Inputs')}</p>
              <ul className="mt-1 space-y-1">
                {inputs.map((item) => (
                  <li key={item} className="line-clamp-1 text-sm text-slate-600">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {outputs.length > 0 ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.agentBuilder.outputs', 'Outputs')}</p>
              <ul className="mt-1 space-y-1">
                {outputs.map((item) => (
                  <li key={item} className="line-clamp-1 text-sm text-slate-600">{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">#{tag}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
