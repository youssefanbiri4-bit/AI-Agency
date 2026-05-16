'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { collectKnowledgeEntries } from '@/lib/knowledge-base/sources';
import { searchKnowledgeBase } from '@/lib/knowledge-base/search';
import type { KnowledgeSearchResult, KnowledgeSourceType } from '@/lib/knowledge-base/types';

export interface KnowledgeSearchActionState {
  error: string | null;
  results: KnowledgeSearchResult[];
  totalEntries: number;
  liveMode: boolean;
}

export interface RefreshKnowledgeBaseState {
  error: string | null;
  message: string;
  totalEntries: number;
  liveMode: boolean;
}

async function getKnowledgeContext() {
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

  return { supabase, user, workspace: workspaceResult.data };
}

export async function searchKnowledgeAction(input: {
  query: string;
  sourceTypes: KnowledgeSourceType[];
  maxResults?: number;
}): Promise<KnowledgeSearchActionState> {
  const { user, workspace } = await getKnowledgeContext();
  const result = await searchKnowledgeBase(
    input.query,
    { sourceTypes: input.sourceTypes, maxResults: input.maxResults ?? 8 },
    workspace.id,
    user.id
  );

  return {
    error: result.error,
    results: result.data,
    totalEntries: result.totalEntries,
    liveMode: true,
  };
}

export async function refreshKnowledgeBaseAction(): Promise<RefreshKnowledgeBaseState> {
  const { supabase, user, workspace } = await getKnowledgeContext();
  const entries = await collectKnowledgeEntries({
    supabase,
    workspaceId: workspace.id,
    userId: user.id,
  });

  return {
    error: null,
    message: 'Knowledge Base uses live safe search over existing AgentFlow data. No persistent index table was created or updated.',
    totalEntries: entries.length,
    liveMode: true,
  };
}
