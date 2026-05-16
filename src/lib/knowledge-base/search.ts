import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { collectKnowledgeEntries } from './sources';
import { sanitizeKnowledgeText } from './format';
import type { KnowledgeSearchFilters, KnowledgeSearchResult, KnowledgeSourceType } from './types';

function tokenize(query: string) {
  return sanitizeKnowledgeText(query, 240)
    .toLowerCase()
    .split(/[\s,.;:!?؟،()[\]{}"']+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12);
}

function scoreField(value: string, tokens: string[], weight: number) {
  const lower = value.toLowerCase();
  return tokens.reduce((score, token) => score + (lower.includes(token) ? weight : 0), 0);
}

function buildHighlights(content: string, tokens: string[]) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const highlights: string[] = [];

  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index < 0) continue;
    const start = Math.max(0, index - 70);
    const end = Math.min(normalized.length, index + 170);
    highlights.push(normalized.slice(start, end).trim());
    if (highlights.length >= 3) break;
  }

  return highlights.length ? highlights : [normalized.slice(0, 240).trim()].filter(Boolean);
}

function normalizeFilters(filters?: KnowledgeSearchFilters) {
  const maxResults = Math.max(1, Math.min(filters?.maxResults ?? 8, 20));
  const sourceTypes = filters?.sourceTypes?.filter(Boolean) as KnowledgeSourceType[] | undefined;
  return { maxResults, sourceTypes };
}

export async function searchKnowledgeBase(
  query: string,
  filters: KnowledgeSearchFilters,
  workspaceId: string,
  userId?: string
): Promise<{ data: KnowledgeSearchResult[]; error: string | null; totalEntries: number }> {
  const safeQuery = sanitizeKnowledgeText(query, 240);
  const { maxResults, sourceTypes } = normalizeFilters(filters);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = userId || user?.id;

  if (!currentUserId) {
    return { data: [], error: 'Sign in before searching the knowledge base.', totalEntries: 0 };
  }

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceId, currentUserId);
  if (membership.error || !membership.data) {
    return { data: [], error: membership.error ?? 'Workspace membership is required.', totalEntries: 0 };
  }

  const entries = await collectKnowledgeEntries({
    supabase,
    workspaceId,
    userId: currentUserId,
    sourceTypes,
  });
  const tokens = tokenize(safeQuery);
  const fallbackTokens = tokens.length ? tokens : ['draft', 'review', 'status'];

  const results = entries
    .map((entry) => {
      const tagText = entry.tags.join(' ');
      const score =
        scoreField(entry.title, fallbackTokens, 12) +
        scoreField(entry.summary, fallbackTokens, 8) +
        scoreField(tagText, fallbackTokens, 7) +
        scoreField(entry.source_type, fallbackTokens, 5) +
        scoreField(entry.content, fallbackTokens, 2) +
        (tokens.length === 0 ? 1 : 0);

      return {
        ...entry,
        score,
        highlights: buildHighlights([entry.summary, entry.content].join(' '), fallbackTokens),
      };
    })
    .filter((result) => tokens.length === 0 || result.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, maxResults);

  return { data: results, error: null, totalEntries: entries.length };
}
