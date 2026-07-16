'use client';

import { useState, useMemo } from 'react';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import type { PromptLibraryRecord } from '@/types/database';
import { categories } from '@/lib/agent-library/templates';
import type { AgentBuilderExecutionMode, AgentBuilderSafetyLevel } from '@/lib/data/agent-builder';
import { useLanguage } from '@/i18n/context';
import { AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const safetyDescriptions: Record<AgentBuilderSafetyLevel, string> = {
  safe: 'Agent can execute without human review',
  requires_review: 'Agent output requires human approval before publishing',
  readonly: 'Agent only reads data, never writes or publishes',
};

const executionLabels: Record<AgentBuilderExecutionMode, string> = {
  autonomous: 'Autonomous draft',
  supervised: 'Supervised',
  manual: 'Manual',
  draft_only: 'Draft only',
};

const executionDescriptions: Record<AgentBuilderExecutionMode, string> = {
  autonomous: 'Agent runs independently and produces drafts',
  supervised: 'Agent runs but requires supervision for each step',
  manual: 'Agent only runs when explicitly triggered',
  draft_only: 'Agent only creates drafts, never publishes',
};

const AGENT_TEMPLATES = [
  {
    name: 'Email Marketing Assistant',
    role: 'Email Marketing Specialist',
    description: 'Creates personalized email campaigns with high engagement rates',
    category: 'content',
    instructions: 'You are an email marketing expert. Create compelling email sequences that drive engagement and conversions. Focus on subject line optimization, personalization, and clear CTAs.',
    inputs: ['Product/Service', 'Target Audience', 'Campaign Goal', 'Brand Voice'],
    outputs: ['Subject Lines', 'Email Body', 'CTA Variations', 'A/B Test Suggestions'],
    tags: ['email', 'marketing', 'campaigns', 'automation'],
  },
  {
    name: 'Social Media Content Creator',
    role: 'Social Media Manager',
    description: 'Generates platform-specific social media content with optimal posting schedules',
    category: 'content',
    instructions: 'You are a social media content expert. Create engaging posts for various platforms (Instagram, Twitter, LinkedIn, TikTok) with appropriate hashtags, hooks, and calls-to-action.',
    inputs: ['Brand Voice', 'Content Theme', 'Target Platform', 'Visual Style'],
    outputs: ['Post Captions', 'Hashtag Sets', 'Content Calendar', 'Engagement Hooks'],
    tags: ['social', 'content', 'instagram', 'twitter', 'linkedin'],
  },
  {
    name: 'Code Review Assistant',
    role: 'Senior Code Reviewer',
    description: 'Performs thorough code reviews with security and performance analysis',
    category: 'development',
    instructions: 'You are a senior software engineer specializing in code review. Analyze code for bugs, security vulnerabilities, performance issues, and adherence to best practices. Provide actionable feedback with code examples.',
    inputs: ['Code Snippet', 'Programming Language', 'Context', 'Review Focus'],
    outputs: ['Issues List', 'Suggestions', 'Security Analysis', 'Performance Tips'],
    tags: ['code', 'review', 'security', 'performance', 'quality'],
  },
];

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

interface ValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  score: number;
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
  const [showTemplates, setShowTemplates] = useState(false);

  const validation = useMemo<ValidationState>(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'Agent name is required';
    else if (form.name.length < 3) errors.name = 'Name must be at least 3 characters';

    if (!form.role.trim()) errors.role = 'Role is required';

    if (!form.description.trim()) errors.description = 'Description is required';
    else if (form.description.length < 10) warnings.description = 'Consider adding more detail';

    if (!form.instructions.trim()) errors.instructions = 'Instructions are required';
    else if (form.instructions.length < 20) warnings.instructions = 'More detailed instructions improve output quality';

    const inputCount = form.inputs.split('\n').filter((l) => l.trim()).length;
    const outputCount = form.outputs.split('\n').filter((l) => l.trim()).length;

    if (inputCount === 0) warnings.inputs = 'Adding inputs helps the agent understand context';
    if (outputCount === 0) warnings.outputs = 'Adding outputs clarifies expected results';

    const totalScore = 100;
    const deductions = Object.keys(errors).length * 15 + Object.keys(warnings).length * 5;
    const score = Math.max(0, totalScore - deductions);

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
      score,
    };
  }, [form]);

  const applyTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
    onChange({
      name: template.name,
      role: template.role,
      description: template.description,
      category: template.category,
      instructions: template.instructions,
      inputs: template.inputs.join('\n'),
      outputs: template.outputs.join('\n'),
      tags: template.tags.join(', '),
    });
    setShowTemplates(false);
  };

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

      {/* Validation Score */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border p-3',
        validation.isValid ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'
      )}>
        {validation.isValid ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <AlertCircle className="h-5 w-5 text-warning" />
        )}
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            Agent Quality Score: {validation.score}/100
          </p>
          <p className="text-xs text-foreground-muted">
            {validation.isValid ? 'All required fields completed' : 'Complete required fields to improve score'}
          </p>
        </div>
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center text-sm font-black',
          validation.score >= 80 ? 'bg-success/10 text-success' : validation.score >= 50 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
        )}>
          {validation.score}
        </div>
      </div>

      {/* Template Suggestions */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Quick Start Templates</span>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showTemplates ? 'Hide' : 'Show templates'}
          </button>
        </div>
        {showTemplates && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {AGENT_TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-lg border border-border bg-white p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <p className="text-sm font-bold text-foreground">{template.name}</p>
                <p className="mt-1 text-xs text-foreground-muted line-clamp-2">{template.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="agent-name-input">
            {t('dashboardI18n.agentBuilder.name', 'Agent name')}
            <span className="ml-1 text-danger">*</span>
          </Label>
          <Input
            id="agent-name-input"
            value={form.name}
            placeholder={t('dashboardI18n.agentBuilder.namePlaceholder', 'e.g. Onboarding Email Assistant')}
            onChange={(event) => onChange({ name: event.target.value })}
            disabled={isPending}
            className={cn(validation.errors.name && 'border-danger')}
          />
          {validation.errors.name && (
            <p className="mt-1 text-xs text-danger">{validation.errors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="agent-role-input">
            {t('dashboardI18n.agentBuilder.role', 'Role')}
            <span className="ml-1 text-danger">*</span>
          </Label>
          <Input
            id="agent-role-input"
            value={form.role}
            placeholder={t('dashboardI18n.agentBuilder.rolePlaceholder', 'e.g. Support Assistant')}
            onChange={(event) => onChange({ role: event.target.value })}
            disabled={isPending}
            className={cn(validation.errors.role && 'border-danger')}
          />
          {validation.errors.role && (
            <p className="mt-1 text-xs text-danger">{validation.errors.role}</p>
          )}
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
          <Label htmlFor="agent-description-input">
            {t('dashboardI18n.agentBuilder.description', 'Description')}
            <span className="ml-1 text-danger">*</span>
          </Label>
          <Textarea
            id="agent-description-input"
            value={form.description}
            placeholder={t('dashboardI18n.agentBuilder.descriptionPlaceholder', 'What is this agent for?')}
            rows={2}
            onChange={(event) => onChange({ description: event.target.value })}
            disabled={isPending}
            className={cn(validation.errors.description && 'border-danger')}
          />
          <div className="mt-1 flex justify-between">
            {validation.errors.description ? (
              <p className="text-xs text-danger">{validation.errors.description}</p>
            ) : validation.warnings.description ? (
              <p className="text-xs text-warning">{validation.warnings.description}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-foreground-muted">{form.description.length}/500</p>
          </div>
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
          <Label htmlFor="agent-instructions-input">
            {t('dashboardI18n.agentBuilder.instructions', 'Instructions (system prompt)')}
            <span className="ml-1 text-danger">*</span>
          </Label>
          <Textarea
            id="agent-instructions-input"
            value={form.instructions}
            placeholder={t('dashboardI18n.agentBuilder.instructionsPlaceholder', 'Describe what the agent should do, its tone, constraints, and expected outputs...')}
            rows={8}
            onChange={(event) => onChange({ instructions: event.target.value })}
            disabled={isPending}
            className={cn(validation.errors.instructions && 'border-danger')}
          />
          <div className="mt-1 flex justify-between">
            {validation.errors.instructions ? (
              <p className="text-xs text-danger">{validation.errors.instructions}</p>
            ) : validation.warnings.instructions ? (
              <p className="text-xs text-warning">{validation.warnings.instructions}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-foreground-muted">{form.instructions.length}/5000</p>
          </div>
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
          {validation.warnings.inputs && (
            <p className="mt-1 text-xs text-warning">{validation.warnings.inputs}</p>
          )}
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
          {validation.warnings.outputs && (
            <p className="mt-1 text-xs text-warning">{validation.warnings.outputs}</p>
          )}
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
          <p className="mt-1 text-xs text-foreground-muted">{safetyDescriptions[form.safetyLevel]}</p>
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
          <p className="mt-1 text-xs text-foreground-muted">{executionDescriptions[form.executionMode]}</p>
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
            disabled={isPending || !validation.isValid}
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
