'use client';

import { useTransition } from 'react';
import { Clipboard, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import type { PromptLibraryRecord } from '@/types/database';
import {
  deletePromptAction,
  markPromptCopiedAction,
  togglePromptFavoriteAction,
} from './actions';

export function PromptDetailActions({ prompt }: { prompt: PromptLibraryRecord }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      toast.success('Prompt copied.');
    } catch {
      toast.error('Could not copy prompt.');
      return;
    }

    startTransition(async () => {
      const result = await markPromptCopiedAction(prompt.id);
      if (result.error) {
        toast.warning('Prompt copied.', { description: 'Usage count could not be updated.' });
      }
      router.refresh();
    });
  };

  const toggleFavorite = () => {
    startTransition(async () => {
      const result = await togglePromptFavoriteAction(prompt.id, !prompt.is_favorite);
      if (result.error) {
        toast.error('Could not update prompt.', { description: result.error });
      }
      router.refresh();
    });
  };

  const deletePrompt = () => {
    if (!window.confirm(`Delete "${prompt.title}"?`)) return;

    startTransition(async () => {
      const result = await deletePromptAction(prompt.id);
      if (result.error) {
        toast.error('Could not delete prompt.', { description: result.error });
        return;
      }
      toast.success('Prompt deleted.');
      router.push('/dashboard/prompt-library');
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={copyPrompt} disabled={isPending}>
        <Clipboard className="h-4 w-4" />
        Copy
      </Button>
      <Button onClick={toggleFavorite} variant="outline" disabled={isPending}>
        <Star className="h-4 w-4" />
        {prompt.is_favorite ? 'Unfavorite' : 'Favorite'}
      </Button>
      <Button onClick={deletePrompt} variant="danger" disabled={isPending}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}
