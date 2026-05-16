import 'server-only';

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type CallbackOutcome = 'accepted' | 'processed' | 'duplicate' | 'stale_ignored' | 'failed';

interface CallbackEventInput {
  supabase: SupabaseClient<Database>;
  sourceRoute: '/api/n8n/callback' | '/api/tasks/callback';
  taskId: string;
  workspaceId: string;
  status: string;
  payload: Record<string, unknown>;
}

interface CallbackEventRecord {
  id: string;
  outcome: CallbackOutcome;
}

interface CallbackEventInsert {
  callback_key: string;
  source_route: string;
  task_id: string;
  workspace_id: string;
  callback_status: string | null;
  execution_identifier: string | null;
  payload_hash: string;
  outcome: CallbackOutcome;
  metadata: {
    key_basis: string;
    has_error: boolean;
  };
}

interface CallbackEventUpdate {
  outcome: CallbackOutcome;
  processed_at?: string;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function readString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function getExecutionIdentifier(payload: Record<string, unknown>) {
  return readString(payload, [
    'n8n_execution_id',
    'executionId',
    'execution_id',
    'runId',
    'run_id',
    'callbackId',
    'callback_id',
  ]);
}

function getCallbackTimestamp(payload: Record<string, unknown>) {
  return readString(payload, [
    'timestamp',
    'callback_timestamp',
    'completed_at',
    'finished_at',
    'updated_at',
    'created_at',
  ]);
}

export function buildN8nCallbackKey({
  sourceRoute,
  taskId,
  status,
  payload,
}: Omit<CallbackEventInput, 'supabase' | 'workspaceId'>) {
  const executionIdentifier = getExecutionIdentifier(payload);
  const payloadHash = hashValue(stableStringify({
    taskId,
    status,
    result: payload.result ?? null,
    error_message: payload.error_message ?? null,
    executionIdentifier,
    timestamp: getCallbackTimestamp(payload),
  }));

  if (executionIdentifier) {
    return {
      callbackKey: `${sourceRoute}:${taskId}:execution:${executionIdentifier}`,
      executionIdentifier,
      payloadHash,
      keyBasis: 'execution_identifier',
    };
  }

  const callbackTimestamp = getCallbackTimestamp(payload);

  if (callbackTimestamp) {
    return {
      callbackKey: `${sourceRoute}:${taskId}:${status || 'unknown'}:${callbackTimestamp}`,
      executionIdentifier: null,
      payloadHash,
      keyBasis: 'task_status_timestamp',
    };
  }

  return {
    callbackKey: `${sourceRoute}:${taskId}:${status || 'unknown'}:${payloadHash}`,
    executionIdentifier: null,
    payloadHash,
    keyBasis: 'task_status_payload_hash',
  };
}

export async function recordN8nCallback(input: CallbackEventInput) {
  const { callbackKey, executionIdentifier, payloadHash, keyBasis } = buildN8nCallbackKey(input);
  const table = input.supabase.from('n8n_callback_events');
  const insert: CallbackEventInsert = {
    callback_key: callbackKey,
    source_route: input.sourceRoute,
    task_id: input.taskId,
    workspace_id: input.workspaceId,
    callback_status: input.status || null,
    execution_identifier: executionIdentifier,
    payload_hash: payloadHash,
    outcome: 'accepted',
    metadata: {
      key_basis: keyBasis,
      has_error: typeof input.payload.error_message === 'string' && input.payload.error_message.trim().length > 0,
    },
  };

  const { data, error } = await table
    .insert(insert)
    .select('id, outcome')
    .single<CallbackEventRecord>();

  if (!error) {
    return { duplicate: false, eventId: data.id, error: null as string | null };
  }

  if (error.code === '23505') {
    return { duplicate: true, eventId: null, error: null as string | null };
  }

  return { duplicate: false, eventId: null, error: error.message };
}

export async function markN8nCallbackEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  outcome: Exclude<CallbackOutcome, 'accepted' | 'duplicate'>
) {
  const update: CallbackEventUpdate = {
    outcome,
    processed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('n8n_callback_events')
    .update(update)
    .eq('id', eventId);

  return error?.message ?? null;
}
