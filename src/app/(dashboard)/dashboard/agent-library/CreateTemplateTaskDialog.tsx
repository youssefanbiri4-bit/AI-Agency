'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, Loader2, X } from 'lucide-react';
import { createTaskFromTemplateAction, type CreateTemplateTaskInput } from './actions';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { TaskPriority } from '@/types/database';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/context';
import { translatePriority, translateTemplateCategory } from '@/i18n/dashboard-labels';

interface CreateTemplateTaskDialogProps {
  template: AgentTemplate;
  createdFrom: 'agent_library' | 'alex';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContext?: string;
  onTaskCreated?: (taskId: string) => void;
}

const priorities: TaskPriority[] = ['Low', 'Normal', 'High'];

function truncateContext(value: string) {
  return value.trim().slice(0, 2000);
}

export function CreateTemplateTaskDialog({
  template,
  createdFrom,
  open,
  onOpenChange,
  initialContext = '',
  onTaskCreated,
}: CreateTemplateTaskDialogProps) {
  if (!open) return null;

  return (
    <CreateTemplateTaskDialogContent
      key={`${template.id}-${createdFrom}`}
      template={template}
      createdFrom={createdFrom}
      onOpenChange={onOpenChange}
      initialContext={initialContext}
      onTaskCreated={onTaskCreated}
    />
  );
}

function CreateTemplateTaskDialogContent({
  template,
  createdFrom,
  onOpenChange,
  initialContext,
  onTaskCreated,
}: Omit<CreateTemplateTaskDialogProps, 'open'>) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(template.name);
  const [userContext, setUserContext] = useState(truncateContext(initialContext ?? ''));
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  const taskTitle = title.trim() || template.name;
  const preview = useMemo(() => {
    return [
      template.description,
      '',
      t('dashboardI18n.templateTask.createdFromTemplate'),
      t('dashboardI18n.templateTask.draftOnly'),
      userContext.trim() ? `\n${t('dashboardI18n.templateTask.userContext')}:\n${userContext.trim()}` : '',
    ].join('\n').trim();
  }, [t, template.description, userContext]);

  function submit() {
    const payload: CreateTemplateTaskInput = {
      templateId: template.id,
      title: taskTitle,
      userContext,
      priority,
      createdFrom,
      manualApprovalConfirmed: true,
    };

    startTransition(async () => {
      const result = await createTaskFromTemplateAction(payload);

      if (result.error || !result.taskId) {
        toast.error(t('dashboardI18n.templateTask.couldNotCreate'), {
          description: result.error ?? t('dashboardI18n.templateTask.reviewAndTry'),
        });
        return;
      }

      setCreatedTaskId(result.taskId);
      onTaskCreated?.(result.taskId);
      toast.success(t('dashboardI18n.templateTask.taskCreated'), {
        action: { label: t('dashboardI18n.templateTask.openTask'), href: `/dashboard/tasks/${result.taskId}` },
      });
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/24 px-3 py-4 backdrop-blur-sm sm:items-center">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-600">{t('dashboardI18n.templateTask.createDraftTask')}</p>
            <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">{template.name}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {t('dashboardI18n.templateTask.draftNotice')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto px-5 py-5">
          {createdTaskId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <h3 className="font-black text-emerald-900">{t('dashboardI18n.templateTask.taskCreated')}</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    {t('dashboardI18n.templateTask.taskPending')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/tasks/${createdTaskId}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <ClipboardList className="h-4 w-4" />
                      {t('dashboardI18n.templateTask.openTask')}
                    </Link>
                    <Link
                      href="/dashboard/tasks"
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      {t('dashboardI18n.templateTask.viewTasks')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.templateTask.taskTitle')}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
                disabled={isPending || Boolean(createdTaskId)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.templateTask.priority')}</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                disabled={isPending || Boolean(createdTaskId)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>{translatePriority(t, item)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-800">{t('dashboardI18n.templateTask.goalNotes')}</span>
            <textarea
              value={userContext}
              onChange={(event) => setUserContext(truncateContext(event.target.value))}
              rows={5}
              disabled={isPending || Boolean(createdTaskId)}
              placeholder={t('dashboardI18n.templateTask.goalPlaceholder')}
              dir={/[\u0590-\u08FF]/.test(userContext) ? 'rtl' : 'ltr'}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium leading-6 text-slate-950 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
            />
            <span className="mt-1 block text-xs font-semibold text-slate-400">{userContext.length}/2000</span>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-900">{t('dashboardI18n.templateTask.taskPreview')}</h3>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="font-black text-slate-400">{t('dashboardI18n.templateTask.template')}</dt>
                <dd className="mt-1 font-semibold text-slate-700">{template.name}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">{t('dashboardI18n.templateTask.category')}</dt>
                <dd className="mt-1 font-semibold text-slate-700">{translateTemplateCategory(t, template.category)}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">{t('dashboardI18n.templateTask.description')}</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{preview}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-400">{t('dashboardI18n.templateTask.storedAs')}</dt>
                <dd className="mt-1 font-semibold text-slate-700">{t('dashboardI18n.templateTask.storedAsDraft')}</dd>
              </div>
            </dl>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            {t('common.close')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || Boolean(createdTaskId) || taskTitle.length < 2}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100',
              'disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400'
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            {t('dashboardI18n.templateTask.createPendingTask')}
          </button>
        </footer>
      </section>
    </div>
  );
}
