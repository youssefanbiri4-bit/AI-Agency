import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  listAgentBuilderAgents,
  listMarketplaceAgents,
} from '@/lib/data/agent-builder';
import { templates } from '@/lib/agent-library/templates';
import { GalleryClient } from './GalleryClient';

export default async function AgentMarketplacePage() {
  const supabase = await createSupabaseServerClient();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  const marketplaceResult = await listMarketplaceAgents(supabase);
  const workspaceAgentsResult = workspaceResult.data
    ? await listAgentBuilderAgents(workspaceResult.data.id, supabase)
    : { data: [], error: null, isConfigured: true };

  return (
    <GalleryClient
      builtInTemplates={templates}
      marketplaceAgents={marketplaceResult.data}
      workspaceAgents={workspaceAgentsResult.data}
      error={marketplaceResult.error}
    />
  );
}
