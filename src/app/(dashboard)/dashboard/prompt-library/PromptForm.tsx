'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/hooks/useActionToast';
import {
  promptCategories,
  promptTargetTools,
} from '@/lib/data/prompt-library';
import type { PromptLibraryRecord } from '@/types/database';
import { createPromptAction, updatePromptAction, type PromptActionState } from './actions';
import { useLanguage } from '@/i18n/context';
import { translatePromptCategory, translatePromptTool } from './prompt-i18n';

interface PromptFormProps {
  mode: 'create' | 'edit';
  prompt?: PromptLibraryRecord;
  onCancel?: () => void;
}

const initialState: PromptActionState = {
  error: null,
  message: null,
  promptId: null,
};

export function PromptForm({ mode, prompt, onCancel }: PromptFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const action = mode === 'create' ? createPromptAction : updatePromptAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useActionToast({
    isPending,
    state,
    loadingMessage: mode === 'create' ? t('dashboardI18n.promptLibrary.savingPrompt', 'Saving prompt...') : t('dashboardI18n.promptLibrary.updatingPrompt', 'Updating prompt...'),
    successMessage: () =>
      mode === 'create' ? t('dashboardI18n.promptLibrary.promptSaved', 'Prompt saved.') : t('dashboardI18n.promptLibrary.promptUpdated', 'Prompt updated.'),
    errorMessage: (currentState) =>
      currentState.error ?? (mode === 'create' ? t('dashboardI18n.promptLibrary.saveFailed', 'Could not save prompt.') : t('dashboardI18n.promptLibrary.updateFailed', 'Could not update prompt.')),
  });

  useEffect(() => {
    if (mode === 'create' && state.promptId && !state.error) {
      onCancel?.();
      router.refresh();
    }

    if (mode === 'edit' && state.promptId && !state.error) {
      router.refresh();
    }
  }, [mode, onCancel, router, state.error, state.promptId]);

  return (
    <form action={formAction} className="space-y-6">
      {prompt ? <input type="hidden" name="promptId" value={prompt.id} /> : null}

      {state.error && (
        <Notice tone="danger" title={mode === 'create' ? t('dashboardI18n.promptLibrary.saveFailedTitle', 'Could not save prompt') : t('dashboardI18n.promptLibrary.updateFailedTitle', 'Could not update prompt')}>
          {state.error}
        </Notice>
      )}

      <Card>
        <CardHeader
          title={mode === 'create' ? t('dashboardI18n.promptLibrary.newPrompt', 'New Prompt') : t('dashboardI18n.promptLibrary.editPrompt', 'Edit Prompt')}
          description={t('dashboardI18n.promptLibrary.safetyText', 'Do not store API keys, tokens, passwords, or private credentials in prompts.')}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label htmlFor="title">{t('dashboardI18n.promptLibrary.formTitle', 'Title')}</Label>
            <Input id="title" name="title" defaultValue={prompt?.title ?? ''} required disabled={isPending} />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea id="description" name="description" defaultValue={prompt?.description ?? ''} rows={3} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="category">{t('dashboardI18n.promptLibrary.category', 'Category')}</Label>
            <Select id="category" name="category" defaultValue={prompt?.category ?? 'general'} disabled={isPending}>
              {promptCategories.map((category) => (
                <option key={category} value={category}>
                  {translatePromptCategory(t, category)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="targetTool">{t('dashboardI18n.promptLibrary.targetTool', 'Target tool')}</Label>
            <Select id="targetTool" name="targetTool" defaultValue={prompt?.target_tool ?? 'general_ai_tool'} disabled={isPending}>
              {promptTargetTools.map((tool) => (
                <option key={tool} value={tool}>
                  {translatePromptTool(t, tool)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="subcategory">{t('dashboardI18n.promptLibrary.subcategory', 'Subcategory')}</Label>
            <Input id="subcategory" name="subcategory" defaultValue={prompt?.subcategory ?? ''} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="tags">{t('dashboardI18n.promptLibrary.tags', 'Tags')}</Label>
            <Input id="tags" name="tags" defaultValue={prompt?.tags.join(', ') ?? ''} disabled={isPending} placeholder={t('dashboardI18n.promptLibrary.tagsPlaceholder', 'deploy, supabase, audit')} />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="promptText">{t('dashboardI18n.promptLibrary.promptText', 'Prompt Text')}</Label>
            <Textarea id="promptText" name="promptText" defaultValue={prompt?.prompt_text ?? ''} rows={10} required disabled={isPending} />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-black/8 bg-[#F1F7F7]/70 p-4 text-sm font-bold text-black/70">
            <input
              type="checkbox"
              name="isFavorite"
              defaultChecked={prompt?.is_favorite ?? false}
              disabled={isPending}
              className="h-4 w-4 rounded border-black/20 text-[#F7CBCA] focus:ring-[#F7CBCA]"
            />
            {t('dashboardI18n.promptLibrary.favorite', 'Favorite')}
          </label>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Clock className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isPending ? t('dashboardI18n.promptLibrary.saving', 'Saving...') : mode === 'create' ? t('dashboardI18n.promptLibrary.savePrompt', 'Save Prompt') : t('dashboardI18n.promptLibrary.updatePrompt', 'Update Prompt')}
        </Button>
      </div>
    </form>
  );
}
