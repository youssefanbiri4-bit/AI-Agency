'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import {
  formatPromptCategory,
  formatPromptTargetTool,
  promptCategories,
  promptTargetTools,
} from '@/lib/data/prompt-library';
import type { PromptLibraryRecord } from '@/types/database';
import { createPromptAction, updatePromptAction, type PromptActionState } from './actions';

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
  const action = mode === 'create' ? createPromptAction : updatePromptAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useActionToast({
    isPending,
    state,
    loadingMessage: mode === 'create' ? 'Saving prompt...' : 'Updating prompt...',
    successMessage: (currentState) =>
      currentState.message ?? (mode === 'create' ? 'Prompt saved.' : 'Prompt updated.'),
    errorMessage: (currentState) =>
      currentState.error ?? (mode === 'create' ? 'Could not save prompt.' : 'Could not update prompt.'),
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
        <Notice tone="danger" title={mode === 'create' ? 'Could not save prompt' : 'Could not update prompt'}>
          {state.error}
        </Notice>
      )}

      <Card>
        <CardHeader
          title={mode === 'create' ? 'New Prompt' : 'Edit Prompt'}
          description="Do not store API keys, tokens, passwords, or private credentials in prompts."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={prompt?.title ?? ''} required disabled={isPending} />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={prompt?.description ?? ''} rows={3} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue={prompt?.category ?? 'general'} disabled={isPending}>
              {promptCategories.map((category) => (
                <option key={category} value={category}>
                  {formatPromptCategory(category)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="targetTool">Target tool</Label>
            <Select id="targetTool" name="targetTool" defaultValue={prompt?.target_tool ?? 'general_ai_tool'} disabled={isPending}>
              {promptTargetTools.map((tool) => (
                <option key={tool} value={tool}>
                  {formatPromptTargetTool(tool)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input id="subcategory" name="subcategory" defaultValue={prompt?.subcategory ?? ''} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" defaultValue={prompt?.tags.join(', ') ?? ''} disabled={isPending} placeholder="deploy, supabase, audit" />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="promptText">Prompt Text</Label>
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
            Favorite
          </label>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Clock className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isPending ? 'Saving...' : mode === 'create' ? 'Save Prompt' : 'Update Prompt'}
        </Button>
      </div>
    </form>
  );
}
