'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Store, Wand2 } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { useActionToast } from '@/hooks/useActionToast';
import { toast } from '@/components/ui/toast';
import type { AgentBuilderAgentRecord, PromptLibraryRecord } from '@/types/database';
import { useLanguage } from '@/i18n/context';
import {
  createAgentAction,
  updateAgentAction,
  type AgentBuilderActionState,
} from './actions';
import {
  AgentBuilderForm,
  type AgentBuilderFormValues,
} from './AgentBuilderForm';
import { AgentPreview } from './AgentPreview';
import { AgentCard } from './AgentCard';

interface AgentBuilderClientProps {
  agents: AgentBuilderAgentRecord[];
  prompts: PromptLibraryRecord[];
  error?: string | null;
}

const emptyForm: AgentBuilderFormValues = {
  name: '',
  role: 'Assistant',
  description: '',
  category: 'general',
  icon: 'Bot',
  accentColor: '#1A7A8C',
  instructions: '',
  inputs: '',
  outputs: '',
  reviewChecklist: '',
  tags: '',
  promptLibraryId: '',
  safetyLevel: 'requires_review',
  executionMode: 'supervised',
};

function agentToForm(agent: AgentBuilderAgentRecord): AgentBuilderFormValues {
  return {
    name: agent.name,
    role: agent.role,
    description: agent.description ?? '',
    category: agent.category,
    icon: agent.icon,
    accentColor: agent.accent_color,
    instructions: agent.instructions,
    inputs: agent.inputs.join('\n'),
    outputs: agent.outputs.join('\n'),
    reviewChecklist: agent.review_checklist.join('\n'),
    tags: agent.tags.join(', '),
    promptLibraryId: agent.prompt_library_id ?? '',
    safetyLevel: agent.safety_level,
    executionMode: agent.execution_mode,
  };
}

export function AgentBuilderClient({ agents, prompts, error }: AgentBuilderClientProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentBuilderFormValues>(emptyForm);
  const [showForm, setShowForm] = useState(agents.length === 0);

  const [createState, createFormAction, createPending] = useTransitionAsState(
    createAgentAction,
    () => {
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      setMode('create');
      router.refresh();
    }
  );
  const [updateState, updateFormAction, updatePending] = useTransitionAsState(
    updateAgentAction,
    () => {
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      setMode('create');
      router.refresh();
    }
  );

  useActionToast({
    isPending: createPending,
    state: createState,
    loadingMessage: t('dashboardI18n.agentBuilder.saveAgent', 'Save Agent'),
    successMessage: () => t('dashboardI18n.agentBuilder.saveAgent', 'Agent saved.'),
    errorMessage: (state) => state.error ?? 'Could not save agent.',
  });

  useActionToast({
    isPending: updatePending,
    state: updateState,
    loadingMessage: t('common.update', 'Update'),
    successMessage: () => t('common.updated', 'Updated.'),
    errorMessage: (state) => state.error ?? 'Could not update agent.',
  });

  const handleChange = (patch: Partial<AgentBuilderFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleLoadPrompt = (promptId: string) => {
    if (!promptId) {
      handleChange({ promptLibraryId: '' });
      return;
    }
    const prompt = prompts.find((item) => item.id === promptId);
    if (!prompt) return;
    handleChange({ promptLibraryId: promptId, instructions: prompt.prompt_text });
    toast.success(t('dashboardI18n.agentBuilder.linkedPromptHint', 'Loaded prompt text into instructions.'));
  };

  const handleNew = () => {
    setMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (agent: AgentBuilderAgentRecord) => {
    setMode('edit');
    setEditingId(agent.id);
    setForm(agentToForm(agent));
    setShowForm(true);
  };

  const formAction = mode === 'create' ? createFormAction : updateFormAction;
  const formPending = mode === 'create' ? createPending : updatePending;

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        eyebrow={t('dashboardI18n.agentBuilder.eyebrow', 'AI Agents')}
        title={t('dashboardI18n.agentBuilder.title', 'AI Agent Builder')}
        description={t('dashboardI18n.agentBuilder.description', 'Build no-code AI agents from prompts, roles, inputs, outputs, and safety guardrails.')}
        actions={
          <>
            <Link href="/dashboard/agent-builder/gallery" className={buttonStyles({ variant: 'outline' })}>
              <Store className="h-4 w-4" />
              {t('dashboardI18n.agentBuilder.gallery', 'Templates Gallery')}
            </Link>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('nav.dashboard', 'Dashboard')}
            </Link>
            <button type="button" onClick={handleNew} className={buttonStyles()}>
              <Plus className="h-4 w-4" />
              {t('dashboardI18n.agentBuilder.newAgent', 'New Agent')}
            </button>
          </>
        }
      />

      {error ? (
        <Notice tone="warning" title={t('dashboardI18n.agentBuilder.title', 'AI Agent Builder')}>
          {t('dashboardI18n.promptLibrary.unavailableDescription', 'Data could not be loaded for this workspace.')}
        </Notice>
      ) : null}

      <Notice tone="info" title={t('dashboardI18n.agentBuilder.safetyNote', 'Agent safety')}>
        {t('dashboardI18n.agentBuilder.safetyNote', 'Do not store API keys, tokens, passwords, or private credentials in agent instructions.')}
      </Notice>

      {showForm ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">
                {mode === 'create'
                  ? t('dashboardI18n.agentBuilder.newAgent', 'New Agent')
                  : t('common.edit', 'Edit')}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={formPending}>
                {t('common.close', 'Close')}
              </Button>
            </div>
            <AgentBuilderForm
              form={form}
              onChange={handleChange}
              prompts={prompts}
              onLoadPrompt={handleLoadPrompt}
              mode={mode}
              editingId={editingId}
              formAction={formAction}
              isPending={formPending}
            />
          </div>
          <AgentPreview form={form} />
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
          <Wand2 className="h-5 w-5 text-slate-400" />
          <p className="text-sm font-bold text-slate-600">{t('dashboardI18n.agentBuilder.emptyDescription', 'Build your first no-code AI agent, then publish it as a template.')}</p>
          <Button onClick={handleNew} size="sm" className="ms-auto">
            <Plus className="h-4 w-4" />
            {t('dashboardI18n.agentBuilder.newAgent', 'New Agent')}
          </Button>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">{t('dashboardI18n.agentBuilder.myAgents', 'My Agents')}</h2>
        {agents.length === 0 ? (
          <EmptyState
            icon={<Wand2 className="h-6 w-6" />}
            title={t('dashboardI18n.agentBuilder.emptyTitle', 'No agents yet')}
            description={t('dashboardI18n.agentBuilder.emptyDescription', 'Build your first no-code AI agent, then publish it as a template.')}
            action={
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4" />
                {t('dashboardI18n.agentBuilder.newAgent', 'New Agent')}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type ActionStatePair = [
  AgentBuilderActionState,
  (formData: FormData) => void,
  boolean,
];

function useTransitionAsState(
  action: (state: AgentBuilderActionState, formData: FormData) => Promise<AgentBuilderActionState>,
  onDone?: (state: AgentBuilderActionState) => void
): ActionStatePair {
  const [state, setState] = useState<AgentBuilderActionState>({
    error: null,
    message: null,
    agentId: null,
    shareSlug: null,
    promptId: null,
  });
  const [pending, setPending] = useState(false);

  const run = (formData: FormData) => {
    setPending(true);
    action(
      { error: null, message: null, agentId: null, shareSlug: null, promptId: null },
      formData
    )
      .then((next) => {
        setState(next);
        if (!next.error && onDone) onDone(next);
      })
      .finally(() => setPending(false));
  };

  return [state, run, pending];
}
