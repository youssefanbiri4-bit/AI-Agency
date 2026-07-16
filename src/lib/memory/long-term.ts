import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';
import {
  isValidMemoryType,
  type MemoryEntry,
  type MemoryType,
  type RecallQuery,
} from './types';

const memoryLog = logger.child('memory:long-term');

const DEFAULT_TTL_DAYS = 365;

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function toEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    agentType: String(row.agent_type),
    memoryType: (row.memory_type as MemoryType) ?? 'semantic',
    category: String(row.category ?? 'general'),
    content: String(row.content ?? ''),
    importance: Number(row.importance ?? 5),
    confidence: Number(row.confidence ?? 1),
    source: (row.source as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastAccessedAt: (row.last_accessed_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
  };
}

export interface StoreMemoryInput {
  workspaceId: string;
  agentType: string;
  memoryType: MemoryType;
  content: string;
  category?: string;
  importance?: number;
  confidence?: number;
  source?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ttlDays?: number;
}

export async function storeMemory(
  input: StoreMemoryInput
): Promise<DataResult<MemoryEntry>> {
  const start = Date.now();
  if (!isSupabaseConfigured()) {
    return emptyDataResult(null as unknown as MemoryEntry, false);
  }

  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult(null as unknown as MemoryEntry, clientError ?? 'supabase unavailable');
  }

  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt =
    ttlDays > 0 ? new Date(Date.now() + ttlDays * 86_400_000).toISOString() : null;

  const insertRow = {
    workspace_id: input.workspaceId,
    agent_type: input.agentType,
    memory_type: input.memoryType,
    category: input.category ?? 'general',
    content: input.content,
    importance: input.importance ?? 5,
    confidence: input.confidence ?? 1,
    source: input.source ?? null,
    tags: input.tags ?? [],
    metadata: (input.metadata ?? {}) as never,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('agent_memory')
    .insert(insertRow)
    .select('*')
    .single();

  timing('memory_longterm_store_ms', Date.now() - start);
  if (error || !data) {
    increment('memory_longterm_store_errors_total');
    return errorDataResult(null as unknown as MemoryEntry, error?.message ?? 'insert failed');
  }

  increment('memory_longterm_store_total');
  memoryLog.info('Stored long-term memory', {
    id: (data as Record<string, unknown>).id,
    memoryType: input.memoryType,
    agentType: input.agentType,
  });
  return emptyDataResult(toEntry(data as Record<string, unknown>));
}

/**
 * Recall relevant long-term memories. Results are ranked by importance then
 * recency, with an optional tag filter. Expired rows are excluded by the query.
 */
export async function recallMemories(
  query: RecallQuery
): Promise<DataResult<MemoryEntry[]>> {
  const start = Date.now();
  if (!isSupabaseConfigured()) {
    return emptyDataResult<MemoryEntry[]>([]);
  }

  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult<MemoryEntry[]>([], clientError ?? 'supabase unavailable');
  }

  let builder = client
    .from('agent_memory')
    .select('*')
    .eq('workspace_id', query.workspaceId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (query.agentType) builder = builder.eq('agent_type', query.agentType);
  if (query.memoryType && isValidMemoryType(query.memoryType)) {
    builder = builder.eq('memory_type', query.memoryType);
  }
  if (query.category) builder = builder.eq('category', query.category);
  if (query.minImportance) builder = builder.gte('importance', query.minImportance);
  if (query.tags && query.tags.length > 0) {
    builder = builder.contains('tags', query.tags);
  }

  const { data, error } = await builder
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(query.limit ?? 25);

  timing('memory_longterm_recall_ms', Date.now() - start);
  if (error) {
    increment('memory_longterm_recall_errors_total');
    return errorDataResult<MemoryEntry[]>([], error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  // Touch last_accessed_at best-effort (fire and forget, ignore failures).
  if (rows.length > 0) {
    const ids = rows.map((r) => String(r.id));
    void client
      .from('agent_memory')
      .update({ last_accessed_at: new Date().toISOString() })
      .in('id', ids);
  }

  increment('memory_longterm_recall_total', { results: rows.length });
  return emptyDataResult(rows.map(toEntry));
}

export async function forgetMemory(id: string): Promise<DataResult<boolean>> {
  if (!isSupabaseConfigured()) {
    return emptyDataResult(false, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult(false, clientError ?? 'supabase unavailable');
  }
  const { error } = await client.from('agent_memory').delete().eq('id', id);
  if (error) {
    return errorDataResult(false, error.message);
  }
  increment('memory_longterm_forget_total');
  return emptyDataResult(true);
}

/** Prune expired memories. Returns the number removed. */
export async function pruneExpiredMemories(): Promise<DataResult<number>> {
  if (!isSupabaseConfigured()) {
    return emptyDataResult(0, false);
  }
  const { client, error: clientError } = getSupabaseAdmin();
  if (clientError || !client) {
    return errorDataResult(0, clientError ?? 'supabase unavailable');
  }
  const { data, error } = await client
    .from('agent_memory')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('*');
  if (error) {
    return errorDataResult(0, error.message);
  }
  const removed = (data ?? []).length;
  increment('memory_longterm_pruned_total', { removed });
  return emptyDataResult(removed);
}
