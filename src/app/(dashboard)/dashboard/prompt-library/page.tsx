import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { listPromptLibraryForWorkspace } from '@/lib/data/prompt-library';
import { PromptLibraryClient } from './PromptLibraryClient';

export default async function PromptLibraryPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
  const promptsResult = workspaceResult.data
    ? await listPromptLibraryForWorkspace(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };

  return (
    <PromptLibraryClient prompts={promptsResult.data} error={promptsResult.error} />
  );
}
