import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  listAgentBuilderAgents,
  listPromptLibraryForAgentBuilder,
} from '@/lib/data/agent-builder';
import { AgentBuilderClient } from './AgentBuilderClient';

export default async function AgentBuilderPage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  const agentsResult = workspaceResult.data
    ? await listAgentBuilderAgents(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };

  const promptsResult = workspaceResult.data
    ? await listPromptLibraryForAgentBuilder(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };

  return (
    <AgentBuilderClient
      agents={agentsResult.data}
      prompts={promptsResult.data}
      error={agentsResult.error}
    />
  );
}
