import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject } from '@/types';
import type { Database } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface BackupRecord {
  id: string;
  workspace_id: string;
  created_by: string | null;
  backup_type: string;
  categories: string[];
  record_counts: JsonObject;
  file_name: string | null;
  file_size_bytes: number | null;
  status: 'created' | 'previewed' | 'failed' | 'archived';
  warnings: string | null;
  metadata: JsonObject;
  created_at: string;
}

export interface CreateBackupRecordInput {
  workspaceId: string;
  userId: string;
  categories: string[];
  recordCounts: JsonObject;
  fileName: string;
  fileSizeBytes: number;
  warnings: string[];
  metadata: JsonObject;
}

interface BackupRecordQuery {
  select(columns: string): BackupRecordQuery;
  eq(column: string, value: string): BackupRecordQuery;
  order(column: string, options: { ascending: boolean }): BackupRecordQuery;
  limit(count: number): Promise<{ data: BackupRecord[] | null; error: { message: string } | null }>;
  insert(value: Record<string, unknown>): BackupRecordQuery;
  single(): Promise<{ data: BackupRecord | null; error: { message: string } | null }>;
}

function backupRecordClient(client: SupabaseClient<Database>) {
  return client as unknown as {
    from(name: string): BackupRecordQuery;
  };
}

export async function listBackupRecordsForWorkspace(
  workspaceId: string,
  client: SupabaseClient<Database>,
  limit = 12
): Promise<DataResult<BackupRecord[]>> {
  const { data, error } = await backupRecordClient(client)
    .from('backup_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(data ?? [], true);
}

export async function createBackupRecord(
  input: CreateBackupRecordInput,
  client: SupabaseClient<Database>
): Promise<DataResult<BackupRecord | null>> {
  const { data, error } = await backupRecordClient(client)
    .from('backup_records')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      backup_type: 'workspace',
      categories: input.categories,
      record_counts: input.recordCounts,
      file_name: input.fileName,
      file_size_bytes: input.fileSizeBytes,
      status: 'created',
      warnings: input.warnings.join('\n'),
      metadata: input.metadata,
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}
