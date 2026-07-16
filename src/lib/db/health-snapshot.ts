import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as browserClient } from '@/lib/supabase-client';
import { logger } from '@/lib/logger';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface HealthSnapshot {
  id: string;
  workspaceId: string | null;
  status: HealthStatus;
  score: number;
  metrics: Record<string, unknown>;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface WriteHealthSnapshotInput {
  workspaceId?: string | null;
  status: HealthStatus;
  score: number;
  metrics?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

// Supabase client with the default (loose) schema, so we can reference the
// `system_health_snapshots` table that is not yet present in the generated
// Database types. All access is funnelled through this boundary.
type LooseClient = SupabaseClient;

function asLoose(client: unknown): LooseClient {
  return client as LooseClient;
}

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { value: HealthSnapshot | null; at: number }>();

function cacheKey(workspaceId: string | null): string {
  return workspaceId ?? 'system';
}

function getServiceRoleClient(): LooseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapRow(row: Record<string, unknown>): HealthSnapshot {
  return {
    id: String(row.id),
    workspaceId: (row.workspace_id as string | null) ?? null,
    status: (row.status as HealthStatus) ?? 'healthy',
    score: Number(row.score ?? 0),
    metrics: (row.metrics as Record<string, unknown>) ?? {},
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

/** Persist a health snapshot. No-op (with warning) when not configured. */
export async function writeHealthSnapshot(input: WriteHealthSnapshotInput): Promise<void> {
  const client = getServiceRoleClient();
  if (!client) {
    logger.warn('writeHealthSnapshot skipped: Supabase service role not configured');
    return;
  }

  const { error } = await client
    .from('system_health_snapshots')
    .insert({
      workspace_id: input.workspaceId ?? null,
      status: input.status,
      score: input.score,
      metrics: input.metrics ?? {},
      details: input.details ?? {},
    });

  if (error) {
    logger.error('Failed to write health snapshot', { error: error.message });
  } else {
    cache.delete(cacheKey(input.workspaceId ?? null));
  }
}

/** Read the most recent snapshot for a workspace (or system/global when null). */
export async function getLatestHealthSnapshot(
  workspaceId: string | null,
  useCache = true
): Promise<HealthSnapshot | null> {
  const key = cacheKey(workspaceId);
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  }

  const client = asLoose(createSupabaseServerClient());
  let query = client
    .from('system_health_snapshots')
    .select('id, workspace_id, status, score, metrics, details, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  query =
    workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null);

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to read health snapshot', { error: error.message });
    return null;
  }

  const snapshot = data?.[0] ? mapRow(data[0] as Record<string, unknown>) : null;
  cache.set(key, { value: snapshot, at: Date.now() });
  return snapshot;
}

/**
 * Subscribe to new health snapshots over Supabase Realtime.
 * Returns an unsubscribe function.
 */
export function subscribeHealthSnapshots(opts: {
  workspaceId?: string | null;
  onSnapshot: (snapshot: HealthSnapshot) => void;
  onError?: (error: unknown) => void;
}): () => void {
  const { workspaceId = null } = opts;
  const filter = workspaceId ? `workspace_id=eq.${workspaceId}` : undefined;

  const channel = browserClient
    .channel(`health-snapshots:${workspaceId ?? 'system'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'system_health_snapshots',
        ...(filter ? { filter } : {}),
      },
      (payload: { new: Record<string, unknown> }) => {
        const row = payload.new;
        if (workspaceId && row.workspace_id !== workspaceId) return;
        if (!workspaceId && row.workspace_id !== null) return;
        const snapshot = mapRow(row);
        opts.onSnapshot(snapshot);
        cache.set(cacheKey(workspaceId), { value: snapshot, at: Date.now() });
      }
    )
    .subscribe((status: string, err?: unknown) => {
      if (status === 'SUBSCRIBED') cache.delete(cacheKey(workspaceId));
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') opts.onError?.(err);
    });

  return () => {
    browserClient.removeChannel(channel);
  };
}
