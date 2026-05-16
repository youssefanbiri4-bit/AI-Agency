'use client';

import Link from 'next/link';
import { ArrowLeft, CheckSquare, Clipboard } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils';
import type { PromptLibraryRecord } from '@/types/database';
import { useLanguage } from '@/i18n/context';
import { PromptCategoryBadge, PromptToolBadge, TagList } from './PromptBadge';
import { PromptDetailActions } from './PromptDetailClient';
import { PromptForm } from './PromptForm';

interface PromptDetailShellProps {
  prompt: PromptLibraryRecord;
  error?: string | null;
}

export function PromptDetailShell({ prompt, error }: PromptDetailShellProps) {
  const { t, dir } = useLanguage();
  const taskHref = `/dashboard/create-task?title=${encodeURIComponent(`Use prompt: ${prompt.title}`)}&description=${encodeURIComponent(prompt.prompt_text)}`;

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        eyebrow={t('dashboardI18n.promptLibrary.title', 'Prompt Library')}
        title={prompt.title}
        description={prompt.description ?? t('dashboardI18n.promptLibrary.detailDescription', 'Saved prompt detail, copy action, and edit form.')}
        actions={
          <>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.backToLibrary', 'Back to Library')}
            </Link>
            <Link href={taskHref} className={buttonStyles({ variant: 'outline' })}>
              <CheckSquare className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.createTaskFromPrompt', 'Create Task from Prompt')}
            </Link>
          </>
        }
      />

      {error ? (
        <Notice tone="warning" title={t('dashboardI18n.promptLibrary.dataNotice', 'Prompt data notice')}>
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title={t('dashboardI18n.promptLibrary.fullPrompt', 'Full Prompt')}
            description={t('dashboardI18n.promptLibrary.fullPromptDescription', 'Copy the full text when you are ready to reuse it.')}
            action={<PromptDetailActions prompt={prompt} />}
          />
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-black/8 bg-[#5D6B6B] p-5 font-mono text-sm leading-6 text-[#F1F7F7]">
            {prompt.prompt_text}
          </pre>
        </Card>

        <Card>
          <CardHeader title={t('dashboardI18n.promptLibrary.promptDetails', 'Prompt Details')} description={t('dashboardI18n.promptLibrary.promptDetailsDescription', 'Usage and organization metadata.')} />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <PromptCategoryBadge category={prompt.category} />
              <PromptToolBadge tool={prompt.target_tool} />
            </div>
            {prompt.tags.length > 0 && <TagList tags={prompt.tags} />}
            <DetailLine label={t('dashboardI18n.promptLibrary.usageCount', 'Usage count')} value={String(prompt.usage_count)} />
            <DetailLine label={t('dashboardI18n.promptLibrary.lastUsed', 'Last used')} value={prompt.last_used_at ? formatDateTime(prompt.last_used_at) : t('dashboardI18n.promptLibrary.notUsedYet', 'Not used yet')} />
            <DetailLine label={t('dashboardI18n.promptLibrary.updated', 'Updated')} value={formatDateTime(prompt.updated_at)} />
            <DetailLine label={t('dashboardI18n.promptLibrary.subcategory', 'Subcategory')} value={prompt.subcategory ?? t('dashboardI18n.common.notSet', 'Not set')} />
            <Notice tone="warning" title={t('dashboardI18n.promptLibrary.safetyTitle', 'Prompt safety')}>
              {t('dashboardI18n.promptLibrary.safetyText', 'Do not store API keys, tokens, passwords, or private credentials in prompts.')}
            </Notice>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline', className: 'w-full' })}>
              <Clipboard className="h-4 w-4" />
              {t('dashboardI18n.promptLibrary.openPromptLibrary', 'Open Prompt Library')}
            </Link>
          </div>
        </Card>
      </div>

      <div id="edit-prompt">
        <PromptForm mode="edit" prompt={prompt} />
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-black/68">{value}</p>
    </div>
  );
}
