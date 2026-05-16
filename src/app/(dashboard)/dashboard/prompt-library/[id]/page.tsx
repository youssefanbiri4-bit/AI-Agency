import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { getPromptLibraryItem } from '@/lib/data/prompt-library';
import { PromptDetailShell } from '../PromptDetailShell';

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

  return <PromptDetailShell prompt={prompt} error={promptResult.error} />;
}
