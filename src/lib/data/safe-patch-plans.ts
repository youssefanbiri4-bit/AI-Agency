import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsonObject } from '@/types';
import type { Database } from '@/types/database';
import type {
  SafePatchChangeType,
  SafePatchPriority,
  SafePatchRiskLevel,
  SafePatchStatus,
} from '@/lib/safe-patch-planner';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface SafePatchPlanRecord {
  id: string;
  workspace_id: string;
  project_id: string | null;
  created_by: string | null;
  title: string;
  change_request: string;
  change_type: SafePatchChangeType;
  priority: SafePatchPriority;
  risk_level: SafePatchRiskLevel;
  status: SafePatchStatus;
  affected_files: string | null;
  implementation_plan: string | null;
  safety_constraints: string | null;
  test_checklist: string | null;
  rollback_plan: string | null;
  suggested_prompt: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
}

export interface SafePatchPlanInput {
  workspaceId: string;
  projectId: string | null;
  userId: string;
  title: string;
  changeRequest: string;
  changeType: SafePatchChangeType;
  priority: SafePatchPriority;
  riskLevel: SafePatchRiskLevel;
  status?: SafePatchStatus;
  affectedFiles: string;
  implementationPlan: string;
  safetyConstraints: string;
  testChecklist: string;
  rollbackPlan: string;
  suggestedPrompt: string;
  metadata: JsonObject;
}

function safePatchClient(client: SupabaseClient<Database>) {
  return client as unknown as {
    from(name: string): SafePatchQuery;
  };
}

interface SafePatchQuery {
  select(columns: string): SafePatchQuery;
  eq(column: string, value: string): SafePatchQuery;
  order(column: string, options: { ascending: boolean }): SafePatchQuery;
  limit(count: number): Promise<{ data: SafePatchPlanRecord[] | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: SafePatchPlanRecord | null; error: { message: string } | null }>;
  insert(value: Record<string, unknown>): SafePatchQuery;
  update(value: Record<string, unknown>): SafePatchQuery;
  single(): Promise<{ data: SafePatchPlanRecord | null; error: { message: string } | null }>;
}

export async function listSafePatchPlansForWorkspace(
  workspaceId: string,
  client: SupabaseClient<Database>,
  projectId?: string | null,
  limit = 40
): Promise<DataResult<SafePatchPlanRecord[]>> {
  let query = safePatchClient(client)
    .from('safe_patch_plans')
    .select('*, projects(name)')
    .eq('workspace_id', workspaceId);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult(
    (data ?? []).map((record) => {
      const maybeProject = (record as unknown as { projects?: { name?: string | null } | null }).projects;
      return {
        ...record,
        project_name: maybeProject?.name ?? null,
      };
    }),
    true
  );
}

export async function getSafePatchPlanById(
  id: string,
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<SafePatchPlanRecord | null>> {
  const { data, error } = await safePatchClient(client)
    .from('safe_patch_plans')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ?? null, true);
}

export async function createSafePatchPlan(
  input: SafePatchPlanInput,
  client: SupabaseClient<Database>
): Promise<DataResult<SafePatchPlanRecord | null>> {
  const { data, error } = await safePatchClient(client)
    .from('safe_patch_plans')
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      created_by: input.userId,
      title: input.title,
      change_request: input.changeRequest,
      change_type: input.changeType,
      priority: input.priority,
      risk_level: input.riskLevel,
      status: input.status ?? 'draft',
      affected_files: input.affectedFiles,
      implementation_plan: input.implementationPlan,
      safety_constraints: input.safetyConstraints,
      test_checklist: input.testChecklist,
      rollback_plan: input.rollbackPlan,
      suggested_prompt: input.suggestedPrompt,
      metadata: input.metadata,
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateSafePatchPlanStatus(
  id: string,
  workspaceId: string,
  status: SafePatchStatus,
  client: SupabaseClient<Database>
): Promise<DataResult<SafePatchPlanRecord | null>> {
  const { data, error } = await safePatchClient(client)
    .from('safe_patch_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}
