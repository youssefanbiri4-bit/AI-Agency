import { redirect } from 'next/navigation';
import { KnowledgeBaseClient } from './KnowledgeBaseClient';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { searchKnowledgeBase } from '@/lib/knowledge-base/search';

export const metadata = {
  title: 'Knowledge Base - AgentFlow AI',
  description: 'Search safe internal AgentFlow AI workspace knowledge.',
};

function readParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = readParam(params, 'query') ?? '';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/knowledge-base');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const initialSearch = await searchKnowledgeBase(query, { maxResults: 8 }, workspaceResult.data.id, user.id);

  return (
    <KnowledgeBaseClient
      initialResults={initialSearch.data}
      initialTotalEntries={initialSearch.totalEntries}
      initialQuery={query}
    />
  );
}
