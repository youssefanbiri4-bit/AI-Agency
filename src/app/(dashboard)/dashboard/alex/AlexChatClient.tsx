'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  FileText,
  FolderKanban,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { AgentTemplateRecommendationResult } from '@/lib/agent-library/recommendations';
import type { AgentTemplateUsageActionType } from '@/types/database';
import { CreateTemplateTaskDialog } from '@/app/(dashboard)/dashboard/agent-library/CreateTemplateTaskDialog';
import { WorkflowPlanDialog } from '@/app/(dashboard)/dashboard/agent-library/WorkflowPlanDialog';
import { trackTemplateUsageAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import { createPendingTaskFromAlexToolAction } from './tool-actions';
import type { AlexDraftAction } from '@/lib/alex-tools/types';
import { useLanguage } from '@/i18n/context';
import {
  translateTemplateCategory,
  translateTemplateField,
  translateTemplateList,
} from '@/i18n/dashboard-labels';

interface OpenAIStatus {
  keyPresent: boolean;
  model: string;
  status: 'ready' | 'setup_required' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: AlexToolDisplay[];
  draftAction?: AlexDraftAction | null;
  blockedMessages?: string[];
}

interface AlexToolDisplay {
  toolId: string;
  toolName: string;
  sourceLabel: string;
  riskLevel: string;
  summary: string;
  blocked?: boolean;
}

interface HistoryEntry {
  role: string;
  content: string;
}

const quickPrompts = [
  'شنو خاصني ندير اليوم؟',
  'لخص ليا صحة النظام',
  'Review provider blockers',
  'Create a safe patch plan',
  'Prepare a weekly content plan',
  'Summarize my active projects',
];

const contextLinks = [
  { labelKey: 'nav.tasks', href: '/dashboard/tasks', icon: ClipboardList },
  { labelKey: 'nav.projects', href: '/dashboard/projects', icon: FolderKanban },
  { labelKey: 'nav.knowledgeBase', href: '/dashboard/knowledge-base', icon: Database },
  { labelKey: 'action.providerSetup', href: '/dashboard/settings#provider-setup-wizard', icon: Settings },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function containsRtl(value: string) {
  return /[\u0590-\u08FF]/.test(value);
}

function getTextDirection(value: string) {
  return containsRtl(value) ? 'rtl' : 'ltr';
}

function formatCopiedMessage(message: ChatMessage) {
  const isRtl = containsRtl(message.content);
  const title = isRtl
    ? message.role === 'assistant'
      ? 'رد Alex'
      : 'رسالتي'
    : message.role === 'assistant'
      ? 'Alex response'
      : 'My message';

  return `${title}\n\n${message.content.trim()}\n`;
}

function formatDraftForCopy(draft: AlexDraftAction) {
  return [
    '# Alex Draft Action',
    '',
    `## Type\n${draft.type}`,
    '',
    `## Title\n${draft.title}`,
    '',
    `## Description\n${draft.description}`,
    '',
    `## Safety Note\n${draft.safetyNote}`,
  ].join('\n');
}

function formatList(title: string, values: string[]) {
  return `${title}\n${values.map((value) => `- ${value}`).join('\n')}`;
}

function buildTemplateStarter(template: AgentTemplate) {
  return `Help me use the "${template.name}" AgentFlow template safely.\n\nGoal:\n[describe what I want]\n\nAvailable inputs:\n[add the details I have]\n\nPlease recommend a safe plan, required inputs, expected outputs, and a draft prompt.`;
}

function formatTemplateForCopy(template: AgentTemplate) {
  return [
    `AgentFlow Template: ${template.name}`,
    `Category: ${template.category}`,
    `Safety: ${template.safety_level}`,
    `Execution mode: ${template.execution_mode}`,
    '',
    'Description',
    template.description,
    '',
    formatList('Inputs', template.inputs),
    '',
    formatList('Outputs', template.outputs),
    '',
    'Suggested prompt',
    template.suggested_prompt,
    '',
    formatList('Review checklist', template.review_checklist),
  ].join('\n').trim() + '\n';
}

function AlexChatClient({
  openAIStatus,
  selectedTemplate,
  initialRecommendations,
  recommendationNotice,
  initialKnowledgeQuery,
  initialIndustryPackPrompt,
}: {
  openAIStatus: OpenAIStatus;
  selectedTemplate: AgentTemplate | null;
  initialRecommendations: AgentTemplateRecommendationResult;
  recommendationNotice: string | null;
  initialKnowledgeQuery?: string | null;
  initialIndustryPackPrompt?: string | null;
}) {
  const { t } = useLanguage();
  const initialMessage = openAIStatus.status === 'ready'
    ? selectedTemplate
      ? t('dashboardI18n.alex.loadedTemplate')
      : t('dashboardI18n.alex.hello')
    : t('dashboardI18n.alex.missingKeyPlaceholder');

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: initialMessage },
  ]);
  const [input, setInput] = useState(
    initialIndustryPackPrompt
      ? initialIndustryPackPrompt
      : initialKnowledgeQuery
      ? `Search my knowledge base for: ${initialKnowledgeQuery}`
      : selectedTemplate
        ? buildTemplateStarter(selectedTemplate)
        : ''
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isWorkflowPlanOpen, setIsWorkflowPlanOpen] = useState(false);
  const [recommendationTaskTemplate, setRecommendationTaskTemplate] = useState<AgentTemplate | null>(null);
  const [recommendationWorkflowTemplate, setRecommendationWorkflowTemplate] = useState<AgentTemplate | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isReady = openAIStatus.status === 'ready';
  const inputDirection = useMemo(() => getTextDirection(input), [input]);

  useEffect(() => {
    if (!selectedTemplate) return;

    void trackTemplateUsageAction({
      templateId: selectedTemplate.id,
      actionType: 'view_template',
      sourcePage: 'alex',
      metadata: { surface: 'selected_template_panel' },
    });
  }, [selectedTemplate]);

  function trackSelectedTemplateAction(
    actionType: AgentTemplateUsageActionType,
    metadata?: Record<string, string | number | boolean | null>
  ) {
    if (!selectedTemplate) return;

    void trackTemplateUsageAction({
      templateId: selectedTemplate.id,
      actionType,
      sourcePage: 'alex',
      metadata: metadata ?? {},
    });
  }

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, []);

  async function ask(question: string) {
    const clean = question.trim();
    if (!clean || isPending || !isReady) return;

    setError(null);
    setInput('');
    setIsPending(true);

    const history: HistoryEntry[] = messages
      .filter((message) => message.id !== 'welcome')
      .slice(-4)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 2000) }));

    setMessages((current) => [...current, { id: createId(), role: 'user', content: clean }]);
    scrollToBottom();

    try {
      const response = await fetch('/api/alex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history, selectedTemplateId: selectedTemplate?.id ?? null }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.error) {
        const message = data?.error || t('dashboardI18n.alex.unavailable');
        setError(message);
        setMessages((current) => [
          ...current,
          { id: createId(), role: 'assistant', content: message },
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'assistant',
          content: data.answer,
          toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
          draftAction: data.draftAction ?? null,
          blockedMessages: Array.isArray(data.blockedMessages) ? data.blockedMessages : [],
        },
      ]);
    } catch {
      const message = t('dashboardI18n.alex.connectionError');
      setError(message);
      setMessages((current) => [
        ...current,
        { id: createId(), role: 'assistant', content: message },
      ]);
    } finally {
      setIsPending(false);
      scrollToBottom();
    }
  }

  function clearChat() {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: isReady
          ? t('dashboardI18n.alex.chatCleared')
          : t('dashboardI18n.alex.missingKeyPlaceholder'),
      },
    ]);
    setError(null);
  }

  function regenerate() {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return;

    setMessages((current) => current.filter((message) => message.id !== lastAssistant?.id));
    void ask(lastUser.content);
  }

  return (
    <div className="grid min-h-[calc(100vh-8.5rem)] gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex min-h-[calc(100vh-8.5rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black tracking-normal text-slate-950">{t('dashboardI18n.alex.title')}</h1>
                <p className="mt-1 text-sm leading-5 text-slate-500">{t('dashboardI18n.alex.description')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold',
                  isReady
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', isReady ? 'bg-emerald-500' : 'bg-amber-500')} />
                {isReady ? t('dashboardI18n.alex.openAIReady') : t('dashboardI18n.alex.setupRequired')}
              </span>
              <button
                type="button"
                onClick={clearChat}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-sky-100"
                aria-label={t('dashboardI18n.alex.clearChat')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-5 sm:px-6" aria-live="polite">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}

            {isPending ? (
              <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                {t('dashboardI18n.alex.thinking')}
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {!isPending && messages.some((message) => message.role === 'user') ? (
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('dashboardI18n.alex.regenerate')}
              </button>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <footer className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="mx-auto flex w-full max-w-4xl items-end gap-2"
          >
            <label className="sr-only" htmlFor="alex-message">
              {t('dashboardI18n.alex.messageAlex')}
            </label>
            <textarea
              id="alex-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              dir={inputDirection}
              disabled={isPending || !isReady}
              placeholder={isReady ? t('dashboardI18n.alex.placeholder') : t('dashboardI18n.alex.missingKeyPlaceholder')}
              className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-950 shadow-inner placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isPending || input.trim().length < 1 || !isReady}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
              aria-label={t('action.sendMessage')}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-4xl text-xs leading-5 text-slate-500">
            {t('dashboardI18n.alex.safetyNotice')}
          </p>
          <p className="mx-auto mt-1 max-w-4xl text-xs leading-5 text-slate-500">
            {t('dashboardI18n.alex.toolSafetyNotice', 'Alex tools can read safe workspace summaries and prepare drafts. They do not run n8n, publish, spend money, delete data, send emails, or change providers.')}
          </p>
        </footer>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {selectedTemplate ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-600">{t('dashboardI18n.alex.selectedTemplate')}</p>
                <h2 className="mt-1 text-base font-black leading-snug text-slate-950">{selectedTemplate.name}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{translateTemplateCategory(t, selectedTemplate.category)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formatTemplateForCopy(selectedTemplate)).then(
                    () => {
                      toast.success(t('dashboardI18n.common.copied'));
                      trackSelectedTemplateAction('copy_prompt');
                    },
                    () => toast.error(t('dashboardI18n.common.copyFailed'))
                  );
                }}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-white text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
                aria-label={t('dashboardI18n.alex.selectedTemplate')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm leading-6 text-slate-600">{translateTemplateField(t, selectedTemplate, 'description', selectedTemplate.description)}</p>

            <CompactTemplateList title={t('dashboardI18n.agentLibrary.inputs')} items={translateTemplateList(t, selectedTemplate, 'inputs', selectedTemplate.inputs)} />
            <CompactTemplateList title={t('dashboardI18n.agentLibrary.outputs')} items={translateTemplateList(t, selectedTemplate, 'outputs', selectedTemplate.outputs)} />
            <CompactTemplateList title={t('dashboardI18n.agentLibrary.reviewChecklist')} items={translateTemplateList(t, selectedTemplate, 'review_checklist', selectedTemplate.review_checklist)} />

            <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.alex.suggestedPrompt')}</p>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{translateTemplateField(t, selectedTemplate, 'suggested_prompt', selectedTemplate.suggested_prompt)}</p>
            </div>

            <button
              type="button"
              onClick={() => setInput(buildTemplateStarter(selectedTemplate))}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <MessageSquareText className="h-4 w-4" />
              {t('dashboardI18n.alex.useDraft')}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateTaskOpen(true)}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <ClipboardList className="h-4 w-4" />
              {t('dashboardI18n.alex.createTaskFromTemplate')}
            </button>
            <Link
              href={`/dashboard/content-studio?template=${encodeURIComponent(selectedTemplate.id)}`}
              onClick={() => trackSelectedTemplateAction('send_to_content_studio')}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <FileText className="h-4 w-4" />
              {t('dashboardI18n.alex.sendToContentStudio')}
            </Link>
            <button
              type="button"
              onClick={() => {
                trackSelectedTemplateAction('export_n8n_plan');
                setIsWorkflowPlanOpen(true);
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <Workflow className="h-4 w-4" />
              {t('dashboardI18n.alex.exportN8nPlan')}
            </button>
          </section>
        ) : null}

        <SmartRecommendationsPanel
          recommendations={initialRecommendations}
          selectedTemplate={selectedTemplate}
          notice={recommendationNotice}
          onUseDraft={(template) => setInput(buildTemplateStarter(template))}
          onCreateTask={(template) => setRecommendationTaskTemplate(template)}
          onExportWorkflow={(template) => {
            void trackTemplateUsageAction({
              templateId: template.id,
              actionType: 'export_n8n_plan',
              sourcePage: 'alex',
              metadata: { surface: 'smart_recommendations' },
            });
            setRecommendationWorkflowTemplate(template);
          }}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-black text-slate-900">{t('dashboardI18n.alex.goodStartingPoints')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isPending || !isReady}
                onClick={() => void ask(prompt)}
                dir={getTextDirection(prompt)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold leading-5 text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-black text-slate-900">{t('dashboardI18n.alex.workspaceContext')}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('dashboardI18n.alex.workspaceNotice')}
          </p>
          <div className="mt-4 grid gap-2">
            {contextLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
              >
                <item.icon className="h-4 w-4 shrink-0" />
              <span>{t(item.labelKey)}</span>
              </Link>
            ))}
            <Link
              href="/dashboard/agent-library"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span>{t('dashboardI18n.alex.agentLibrary')}</span>
            </Link>
          </div>
        </section>
      </aside>

      {selectedTemplate ? (
        <>
          <CreateTemplateTaskDialog
            template={selectedTemplate}
            createdFrom="alex"
            open={isCreateTaskOpen}
            onOpenChange={setIsCreateTaskOpen}
            initialContext={input}
            onTaskCreated={(taskId) => {
              trackSelectedTemplateAction('create_task', { task_id: taskId });
            }}
          />
          <WorkflowPlanDialog
            template={selectedTemplate}
            open={isWorkflowPlanOpen}
            onOpenChange={setIsWorkflowPlanOpen}
            sourcePage="alex"
          />
        </>
      ) : null}
      {recommendationTaskTemplate ? (
        <CreateTemplateTaskDialog
          template={recommendationTaskTemplate}
          createdFrom="alex"
          open={Boolean(recommendationTaskTemplate)}
          onOpenChange={(open) => {
            if (!open) setRecommendationTaskTemplate(null);
          }}
          initialContext={input}
          onTaskCreated={(taskId) => {
            void trackTemplateUsageAction({
              templateId: recommendationTaskTemplate.id,
              actionType: 'create_task',
              sourcePage: 'alex',
              metadata: { task_id: taskId, surface: 'smart_recommendations' },
            });
          }}
        />
      ) : null}
      {recommendationWorkflowTemplate ? (
        <WorkflowPlanDialog
          template={recommendationWorkflowTemplate}
          open={Boolean(recommendationWorkflowTemplate)}
          onOpenChange={(open) => {
            if (!open) setRecommendationWorkflowTemplate(null);
          }}
          sourcePage="alex"
        />
      ) : null}
    </div>
  );
}

function SmartRecommendationsPanel({
  recommendations,
  selectedTemplate,
  notice,
  onUseDraft,
  onCreateTask,
  onExportWorkflow,
}: {
  recommendations: AgentTemplateRecommendationResult;
  selectedTemplate: AgentTemplate | null;
  notice: string | null;
  onUseDraft: (template: AgentTemplate) => void;
  onCreateTask: (template: AgentTemplate) => void;
  onExportWorkflow: (template: AgentTemplate) => void;
}) {
  const { t } = useLanguage();
  const items = recommendations.recommendedTemplates.slice(0, 5);
  const nextBest = recommendations.nextBestTemplate;
  const workflowTemplateIds = items.map((item) => item.template.id).join(',');

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <h2 className="text-sm font-black text-slate-900">{t('dashboardI18n.alex.smartRecommendations')}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t('dashboardI18n.alex.recommendationNotice')}
          </p>
        </div>
      </div>

      {notice ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
          {notice}
        </div>
      ) : null}

      {selectedTemplate ? (
        <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-sky-600">{t('dashboardI18n.alex.selected')}</p>
          <p className="mt-1 text-sm font-black text-slate-900">{selectedTemplate.name}</p>
        </div>
      ) : null}

      {nextBest ? (
        <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">{t('dashboardI18n.alex.nextBest')}</p>
          <p className="mt-1 text-sm font-black leading-5 text-slate-900">{nextBest.template.name}</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">{nextBest.reason}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.template.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black leading-5 text-slate-900">{item.template.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{translateTemplateCategory(t, item.template.category)} - {item.confidence}</p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{item.reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/dashboard/alex?template=${encodeURIComponent(item.template.id)}`}
                onClick={() => {
                  void trackTemplateUsageAction({
                    templateId: item.template.id,
                    actionType: 'use_with_alex',
                    sourcePage: 'alex',
                    metadata: { surface: 'smart_recommendations' },
                  });
                }}
                className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-black text-sky-700 transition hover:bg-sky-50"
              >
                {t('dashboardI18n.alex.useTemplate')}
              </Link>
              <button
                type="button"
                onClick={() => onCreateTask(item.template)}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
              >
                {t('dashboardI18n.alex.createTask')}
              </button>
              <Link
                href={`/dashboard/content-studio?template=${encodeURIComponent(item.template.id)}`}
                onClick={() => {
                  void trackTemplateUsageAction({
                    templateId: item.template.id,
                    actionType: 'send_to_content_studio',
                    sourcePage: 'alex',
                    metadata: { surface: 'smart_recommendations' },
                  });
                }}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-100"
              >
                {t('dashboardI18n.alex.contentStudio')}
              </Link>
              <button
                type="button"
                onClick={() => onExportWorkflow(item.template)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-100"
              >
                {t('dashboardI18n.alex.exportPlan')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onUseDraft(item.template)}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-100"
            >
              {t('dashboardI18n.alex.useDraft')}
            </button>
          </div>
        ))}
      </div>

      {workflowTemplateIds ? (
        <Link
          href={`/dashboard/agent-library/workflows?from=alex&templates=${encodeURIComponent(workflowTemplateIds)}`}
          onClick={() => {
            const first = items[0]?.template;
            if (!first) return;
            void trackTemplateUsageAction({
              templateId: first.id,
              actionType: 'create_workflow_draft',
              sourcePage: 'alex',
              metadata: {
                surface: 'smart_recommendations',
                template_count: items.length,
              },
            });
          }}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
        >
          {t('dashboardI18n.alex.reviewWorkflow')}
        </Link>
      ) : null}

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{t('dashboardI18n.alex.safeWorkflow')}</p>
        <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
          {recommendations.recommendedWorkflow.slice(0, 3).map((step, index) => (
            <li key={step}>{index + 1}. {step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CompactTemplateList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 3).map((item) => (
          <li key={item} className="text-sm leading-5 text-slate-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const isAssistant = message.role === 'assistant';
  const direction = getTextDirection(message.content);
  const hasTools = isAssistant && Boolean(message.toolsUsed?.length || message.blockedMessages?.length);
  const draft = isAssistant ? message.draftAction : null;

  function copyContent() {
    const text = formatCopiedMessage(message);
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success(t('dashboardI18n.common.copied'));
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => toast.error(t('dashboardI18n.common.copyFailed'))
    );
  }

  function copyDraft(draftAction: AlexDraftAction) {
    navigator.clipboard.writeText(formatDraftForCopy(draftAction)).then(
      () => toast.success(t('dashboardI18n.common.copied')),
      () => toast.error(t('dashboardI18n.common.copyFailed'))
    );
  }

  async function confirmCreatePendingTask(draftAction: AlexDraftAction) {
    if (draftAction.type !== 'task') return;
    setIsCreatingTask(true);
    setTaskResult(null);

    try {
      const result = await createPendingTaskFromAlexToolAction({
        title: draftAction.title,
        description: draftAction.description,
        approvedByUser: true,
      });

      if (result.error) {
        setTaskResult(result.error);
        toast.error('Could not create pending task', { description: result.error });
        return;
      }

      setTaskResult(result.message ?? 'Pending task created.');
      toast.success(result.message ?? 'Pending task created.');
    } finally {
      setIsCreatingTask(false);
    }
  }

  return (
    <article
      dir={direction}
      className={cn(
        'group max-w-[min(100%,48rem)] rounded-2xl border px-4 py-3 shadow-sm',
        isAssistant
          ? 'me-auto border-slate-200 bg-white text-slate-800'
          : 'ms-auto border-sky-100 bg-sky-50 text-slate-900'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3" dir="ltr">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-slate-400">
          {isAssistant ? <Bot className="h-4 w-4 text-emerald-600" /> : <MessageSquareText className="h-4 w-4 text-sky-600" />}
          {isAssistant ? 'Alex' : t('dashboardI18n.alex.you')}
        </div>
        <button
          type="button"
          onClick={copyContent}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 opacity-100 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          aria-label={isAssistant ? t('dashboardI18n.alex.copyAlexAnswer') : t('dashboardI18n.alex.copyMessage')}
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
      {hasTools ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3" dir={direction}>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-700">
            <Database className="h-4 w-4" />
            {t('dashboardI18n.alex.toolsUsedTitle', 'Alex used safe workspace context')}
          </div>
          <div className="mt-2 space-y-2">
            {message.toolsUsed?.slice(0, 6).map((tool) => (
              <div key={`${message.id}-${tool.toolId}`} className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-800">{tool.toolName}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-black',
                    tool.blocked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {tool.riskLevel}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">{tool.sourceLabel}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{tool.summary}</p>
              </div>
            ))}
            {message.blockedMessages?.map((blocked) => (
              <div key={blocked} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                {blocked}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-800">
            {t('dashboardI18n.alex.toolsSafetyShort', 'No secrets, raw logs, n8n execution, publishing, spending, deletion, email sending, GitHub writes, or provider changes were performed.')}
          </p>
        </div>
      ) : null}
      {draft ? (
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/80 p-3" dir={direction}>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-sky-700">
            <ClipboardList className="h-4 w-4" />
            {t('dashboardI18n.alex.draftActionTitle', 'Draft action prepared')}
          </div>
          <h3 className="mt-2 text-sm font-black text-slate-900">{draft.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{draft.description}</p>
          <p className="mt-2 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-xs font-bold leading-5 text-sky-800">{draft.safetyNote}</p>
          <div className="mt-3 flex flex-wrap gap-2" dir="ltr">
            {draft.type === 'task' ? (
              <button
                type="button"
                disabled={isCreatingTask}
                onClick={() => void confirmCreatePendingTask(draft)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isCreatingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t('dashboardI18n.alex.confirmCreatePendingTask', 'Confirm Create Pending Task')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => copyDraft(draft)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              <Copy className="h-3.5 w-3.5" />
              {t('dashboardI18n.alex.copyDraft', 'Copy Draft')}
            </button>
            <button
              type="button"
              onClick={() => setTaskResult(t('dashboardI18n.alex.draftCancelled', 'Draft cancelled. No action was taken.'))}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100"
            >
              {t('action.cancel', 'Cancel')}
            </button>
          </div>
          {taskResult ? <p className="mt-2 text-xs font-bold leading-5 text-slate-600">{taskResult}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export { AlexChatClient };
