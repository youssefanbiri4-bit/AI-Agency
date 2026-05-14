import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckSquare, Clipboard } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getPromptLibraryItem } from '@/lib/data/prompt-library';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils';
import { PromptForm } from '../PromptForm';
import { PromptCategoryBadge, PromptToolBadge, TagList } from '../PromptBadge';
import { PromptDetailActions } from '../PromptDetailClient';

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) notFound();

  const promptResult = await getPromptLibraryItem(id, workspaceResult.data.id, supabase);
  if (!promptResult.data) notFound();

  const prompt = promptResult.data;
  const taskHref = `/dashboard/create-task?title=${encodeURIComponent(`Use prompt: ${prompt.title}`)}&description=${encodeURIComponent(prompt.prompt_text)}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Prompt Library"
        title={prompt.title}
        description={prompt.description ?? 'Saved prompt detail, copy action, and edit form.'}
        actions={
          <>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Back to Library
            </Link>
            <Link href={taskHref} className={buttonStyles({ variant: 'outline' })}>
              <CheckSquare className="h-4 w-4" />
              Create Task from Prompt
            </Link>
          </>
        }
      />

      {promptResult.error && (
        <Notice tone="warning" title="Prompt data notice">
          {promptResult.error}
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Full Prompt"
            description="Copy the full text when you are ready to reuse it."
            action={<PromptDetailActions prompt={prompt} />}
          />
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-black/8 bg-[#5D6B6B] p-5 font-mono text-sm leading-6 text-[#F1F7F7]">
            {prompt.prompt_text}
          </pre>
        </Card>

        <Card>
          <CardHeader title="Prompt Details" description="Usage and organization metadata." />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <PromptCategoryBadge category={prompt.category} />
              <PromptToolBadge tool={prompt.target_tool} />
            </div>
            {prompt.tags.length > 0 && <TagList tags={prompt.tags} />}
            <DetailLine label="Usage count" value={String(prompt.usage_count)} />
            <DetailLine label="Last used" value={prompt.last_used_at ? formatDateTime(prompt.last_used_at) : 'Not used yet'} />
            <DetailLine label="Updated" value={formatDateTime(prompt.updated_at)} />
            <DetailLine label="Subcategory" value={prompt.subcategory ?? 'Not added'} />
            <Notice tone="warning" title="Prompt safety">
              Do not store API keys, tokens, passwords, or private credentials in prompts.
            </Notice>
            <Link href="/dashboard/prompt-library" className={buttonStyles({ variant: 'outline', className: 'w-full' })}>
              <Clipboard className="h-4 w-4" />
              Open Prompt Library
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
