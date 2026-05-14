import Link from 'next/link';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listPromptLibraryForWorkspace } from '@/lib/data/prompt-library';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { PromptLibraryClient } from './PromptLibraryClient';

export default async function PromptLibraryPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const promptsResult = workspaceResult.data
    ? await listPromptLibraryForWorkspace(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace knowledge"
        title="Prompt Library"
        description="Save, organize, search, and reuse your best prompts for development, deployment, automation, ads, reports, and project workflows."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <a href="#new-prompt" className={buttonStyles()}>
              <Plus className="h-4 w-4" />
              New Prompt
            </a>
            <a href="#new-prompt" className={buttonStyles({ variant: 'outline' })}>
              <Upload className="h-4 w-4" />
              Import Starter Prompts
            </a>
          </>
        }
      />

      {promptsResult.error && (
        <Notice tone="warning" title="Prompt Library unavailable">
          {promptsResult.error}
        </Notice>
      )}

      <div id="new-prompt">
        <PromptLibraryClient prompts={promptsResult.data} />
      </div>

      <Notice tone="warning" title="Prompt safety">
        Do not store API keys, tokens, passwords, authorization headers, or private credentials in prompts.
      </Notice>
    </div>
  );
}
