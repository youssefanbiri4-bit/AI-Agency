'use client';

import { useState } from 'react';
import type { ContentStudioItemView } from '@/app/(dashboard)/dashboard/content-studio/shared';
import { generateContentStudioFieldAction } from '@/app/(dashboard)/dashboard/content-studio/actions';
import { toast } from '@/components/ui/toast';
import { appendGeneratedVersion } from './shared';

interface UseContentStudioGenerationOptions {
  selectedItem: ContentStudioItemView | null;
  formRef: React.RefObject<HTMLFormElement | null>;
  savePending: boolean;
  taskPending: boolean;
}

interface UseContentStudioGenerationReturn {
  activeGenerationKind: string | null;
  isGenerating: boolean;
  handleGenerate: (kind: string) => Promise<void>;
}

export function useContentStudioGeneration({
  selectedItem,
  formRef,
  savePending,
  taskPending,
}: UseContentStudioGenerationOptions): UseContentStudioGenerationReturn {
  const [activeGenerationKind, setActiveGenerationKind] = useState<string | null>(null);
  const isGenerating = activeGenerationKind !== null;

  async function handleGenerate(kind: string) {
    if (!selectedItem) {
      toast.warning('Save this draft first.', {
        description: 'AI generation is available after the content item exists in your workspace.',
      });
      return;
    }

    if (!formRef.current || isGenerating || savePending || taskPending) {
      return;
    }

    setActiveGenerationKind(kind);
    const loadingToastId = toast.loading(
      'Generating with AI...',
      {
        description: `Generating ${kind.replace(/_/g, ' ')} using the current draft fields and linked creative assets.`,
      }
    );

    try {
      const formData = new FormData(formRef.current);
      formData.set('generation_kind', kind);

      const result = await generateContentStudioFieldAction(selectedItem.id, formData);

      if (result.error || !result.generatedText || !result.field) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: result.error ?? 'Generation failed.',
          description: 'Please review OpenAI setup, quota, and the draft fields, then try again.',
        });
        return;
      }

      const element = formRef.current?.elements.namedItem(result.field);
      const isTextControl = (
        element: Element | RadioNodeList | null
      ): element is HTMLInputElement | HTMLTextAreaElement => Boolean(
        element &&
          'value' in element &&
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
      );

      if (!isTextControl(element)) {
        toast.update(loadingToastId, {
          tone: 'error',
          title: 'Could not place generated content.',
          description: 'Refresh the page and try again.',
        });
        return;
      }

      element.value = appendGeneratedVersion(element.value.trim(), result.generatedText);

      toast.update(loadingToastId, {
        tone: 'success',
        title: result.message ?? 'Generated successfully.',
        description: 'Review it in the field, then click Update Content Item to persist it.',
      });
    } catch (error) {
      toast.update(loadingToastId, {
        tone: 'error',
        title: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        description: 'AI provider setup required.',
      });
    } finally {
      setActiveGenerationKind(null);
    }
  }

  return {
    activeGenerationKind,
    isGenerating,
    handleGenerate,
  };
}
