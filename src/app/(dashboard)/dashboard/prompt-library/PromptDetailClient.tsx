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
import { useLanguage } from '@/i18n/context';

export function PromptDetailActions({ prompt }: { prompt: PromptLibraryRecord }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      toast.success(t('dashboardI18n.promptLibrary.promptCopied', 'Prompt copied.'));
    } catch {
      toast.error(t('dashboardI18n.promptLibrary.copyFailed', 'Could not copy prompt.'));
      return;
    }

    startTransition(async () => {
      const result = await markPromptCopiedAction(prompt.id);
      if (result.error) {
        toast.warning(t('dashboardI18n.promptLibrary.promptCopied', 'Prompt copied.'), { description: t('dashboardI18n.promptLibrary.usageUpdateFailed', 'Usage count could not be updated.') });
      }
      router.refresh();
    });
  };

  const toggleFavorite = () => {
    startTransition(async () => {
      const result = await togglePromptFavoriteAction(prompt.id, !prompt.is_favorite);
      if (result.error) {
        toast.error(t('dashboardI18n.promptLibrary.updateFailed', 'Could not update prompt.'), { description: result.error });
      }
      router.refresh();
    });
  };

  const deletePrompt = () => {
    if (!window.confirm(t('dashboardI18n.promptLibrary.deleteConfirm', 'Delete "{title}"?').replace('{title}', prompt.title))) return;

    startTransition(async () => {
      const result = await deletePromptAction(prompt.id);
      if (result.error) {
        toast.error(t('dashboardI18n.promptLibrary.deleteFailed', 'Could not delete prompt.'), { description: result.error });
        return;
      }
      toast.success(t('dashboardI18n.promptLibrary.deleted', 'Prompt deleted.'));
      router.push('/dashboard/prompt-library');
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={copyPrompt} disabled={isPending}>
        <Clipboard className="h-4 w-4" />
        {t('common.copy')}
      </Button>
      <Button onClick={toggleFavorite} variant="outline" disabled={isPending}>
        <Star className="h-4 w-4" />
        {prompt.is_favorite ? t('dashboardI18n.promptLibrary.unfavorite', 'Unfavorite') : t('dashboardI18n.promptLibrary.favorite', 'Favorite')}
      </Button>
      <Button onClick={deletePrompt} variant="danger" disabled={isPending}>
        <Trash2 className="h-4 w-4" />
        {t('common.delete')}
      </Button>
    </div>
  );
}
