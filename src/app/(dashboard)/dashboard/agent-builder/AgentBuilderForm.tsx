'use client';

import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import type { PromptLibraryRecord } from '@/types/database';
import { categories } from '@/lib/agent-library/templates';
import type { AgentBuilderExecutionMode, AgentBuilderSafetyLevel } from '@/lib/data/agent-builder';
import { useLanguage } from '@/i18n/context';

export interface AgentBuilderFormValues {
  name: string;
  role: string;
  description: string;
  category: string;
  icon: string;
  accentColor: string;
  instructions: string;
  inputs: string;
  outputs: string;
  reviewChecklist: string;
  tags: string;
  promptLibraryId: string;
  safetyLevel: AgentBuilderSafetyLevel;
  executionMode: AgentBuilderExecutionMode;
}

const iconOptions = ['Bot', 'Sparkles', 'Workflow', 'FileText', 'Search', 'MessageSquare', 'PenSquare', 'BarChart3', 'Rocket', 'ShieldAlert', 'Wand2', 'Database'];
const safetyOptions: AgentBuilderSafetyLevel[] = ['safe', 'requires_review', 'readonly'];
const executionOptions: AgentBuilderExecutionMode[] = ['autonomous', 'supervised', 'manual', 'draft_only'];

const safetyLabels: Record<AgentBuilderSafetyLevel, string> = {
  safe: 'Safe',
  requires_review: 'Review first',
  readonly: 'Read only',
};

const executionLabels: Record<AgentBuilderExecutionMode, string> = {
  autonomous: 'Autonomous draft',
  supervised: 'Supervised',
  manual: 'Manual',
  draft_only: 'Draft only',
};

interface AgentBuilderFormProps {
  form: AgentBuilderFormValues;
  onChange: (patch: Partial<AgentBuilderFormValues>) => void;
  prompts: PromptLibraryRecord[];
  onLoadPrompt: (promptId: string) => void;
  mode: 'create' | 'edit';
  editingId: string | null;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}

export function AgentBuilderForm({
  form,
  onChange,
  prompts,
  onLoadPrompt,
  mode,
  editingId,
  formAction,
  isPending,
}: AgentBuilderFormProps) {
  const { t } = useLanguage();

  return (
    <form action={formAction} className="space-y-5">
      {editingId ? <input type="hidden" name="agentId" value={editingId} /> : null}
      <input type="hidden" name="name" value={form.name} />
      <input type="hidden" name="role" value={form.role} />
      <input type="hidden" name="description" value={form.description} />
      <input type="hidden" name="category" value={form.category} />
      <input type="hidden" name="icon" value={form.icon} />
      <input type="hidden" name="accentColor" value={form.accentColor} />
      <input type="hidden" name="instructions" value={form.instructions} />
      <input type="hidden" name="inputs" value={form.inputs} />
      <input type="hidden" name="outputs" value={form.outputs} />
      <input type="hidden" name="reviewChecklist" value={form.reviewChecklist} />
      <input type="hidden" name="tags" value={form.tags} />
      <input type="hidden" name="promptLibraryId" value={form.promptLibraryId} />
      <input type="hidden" name="safetyLevel" value={form.safetyLevel} />
      <input type="hidden" name="executionMode" value={form.executionMode} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="agent-name-input">{t('dashboardI18n.agentBuilder.name', 'Agent name')}</Label>
          <Input
            id="agent-name-input"
            value={form.name}
            placeholder={t('dashboardI18n.agentBuilder.namePlaceholder', 'e.g. Onboarding Email Assistant')}
            onChange={(event) => onChange({ name: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-role-input">{t('dashboardI18n.agentBuilder.role', 'Role')}</Label>
          <Input
            id="agent-role-input"
            value={form.role}
            placeholder={t('dashboardI18n.agentBuilder.rolePlaceholder', 'e.g. Support Assistant')}
            onChange={(event) => onChange({ role: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-category-input">{t('dashboardI18n.agentBuilder.category', 'Category')}</Label>
          <Select
            id="agent-category-input"
            value={form.category}
            onChange={(event) => onChange({ category: event.target.value })}
            disabled={isPending}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            <option value="general">general</option>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="agent-description-input">{t('dashboardI18n.agentBuilder.description', 'Description')}</Label>
          <Textarea
            id="agent-description-input"
            value={form.description}
            placeholder={t('dashboardI18n.agentBuilder.descriptionPlaceholder', 'What is this agent for?')}
            rows={2}
            onChange={(event) => onChange({ description: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-icon-input">{t('dashboardI18n.agentBuilder.icon', 'Icon')}</Label>
          <Select
            id="agent-icon-input"
            value={form.icon}
            onChange={(event) => onChange({ icon: event.target.value })}
            disabled={isPending}
          >
            {iconOptions.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="agent-color-input">{t('dashboardI18n.agentBuilder.accentColor', 'Accent color')}</Label>
          <div className="flex items-center gap-3">
            <input
              id="agent-color-input"
              type="color"
              value={form.accentColor}
              onChange={(event) => onChange({ accentColor: event.target.value })}
              disabled={isPending}
              className="h-11 w-14 rounded-xl border border-slate-200 bg-slate-50"
            />
            <span className="text-sm font-bold text-slate-500">{form.accentColor}</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="agent-instructions-input">{t('dashboardI18n.agentBuilder.instructions', 'Instructions (system prompt)')}</Label>
          <Textarea
            id="agent-instructions-input"
            value={form.instructions}
            placeholder={t('dashboardI18n.agentBuilder.instructionsPlaceholder', 'Describe what the agent should do, its tone, constraints, and expected outputs...')}
            rows={8}
            onChange={(event) => onChange({ instructions: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-inputs-input">{t('dashboardI18n.agentBuilder.inputs', 'Inputs')}</Label>
          <Textarea
            id="agent-inputs-input"
            value={form.inputs}
            placeholder={t('dashboardI18n.agentBuilder.listItemsPlaceholder', 'One per line')}
            rows={4}
            onChange={(event) => onChange({ inputs: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-outputs-input">{t('dashboardI18n.agentBuilder.outputs', 'Outputs')}</Label>
          <Textarea
            id="agent-outputs-input"
            value={form.outputs}
            placeholder={t('dashboardI18n.agentBuilder.listItemsPlaceholder', 'One per line')}
            rows={4}
            onChange={(event) => onChange({ outputs: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="agent-safety-input">{t('dashboardI18n.agentBuilder.safetyLevel', 'Safety level')}</Label>
          <Select
            id="agent-safety-input"
            value={form.safetyLevel}
            onChange={(event) => onChange({ safetyLevel: event.target.value as AgentBuilderSafetyLevel })}
            disabled={isPending}
          >
            {safetyOptions.map((option) => (
              <option key={option} value={option}>
                {safetyLabels[option]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="agent-execution-input">{t('dashboardI18n.agentBuilder.executionMode', 'Execution mode')}</Label>
          <Select
            id="agent-execution-input"
            value={form.executionMode}
            onChange={(event) => onChange({ executionMode: event.target.value as AgentBuilderExecutionMode })}
            disabled={isPending}
          >
            {executionOptions.map((option) => (
              <option key={option} value={option}>
                {executionLabels[option]}
              </option>
            ))}
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="agent-review-input">{t('dashboardI18n.agentBuilder.reviewChecklist', 'Review checklist')}</Label>
          <Textarea
            id="agent-review-input"
            value={form.reviewChecklist}
            placeholder={t('dashboardI18n.agentBuilder.listItemsPlaceholder', 'One per line')}
            rows={3}
            onChange={(event) => onChange({ reviewChecklist: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="agent-tags-input">{t('dashboardI18n.agentBuilder.tags', 'Tags')}</Label>
          <Input
            id="agent-tags-input"
            value={form.tags}
            placeholder={t('dashboardI18n.agentBuilder.tagsPlaceholder', 'support, email, onboarding')}
            onChange={(event) => onChange({ tags: event.target.value })}
            disabled={isPending}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="agent-prompt-input">{t('dashboardI18n.agentBuilder.linkedPrompt', 'Linked prompt')}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              id="agent-prompt-input"
              value={form.promptLibraryId}
              onChange={(event) => onLoadPrompt(event.target.value)}
              disabled={isPending}
              className="min-w-[200px] flex-1"
            >
              <option value="">{t('dashboardI18n.agentBuilder.noLinkedPrompt', 'Not linked')}</option>
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-60"
          >
            {isPending ? t('common.loading', 'Loading...') : mode === 'create'
              ? t('dashboardI18n.agentBuilder.saveAgent', 'Save Agent')
              : t('common.update', 'Update')}
          </button>
        </div>
      </div>
    </form>
  );
}
