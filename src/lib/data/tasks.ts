import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client';
import type { AgentType, JsonObject, Task, TaskStatus } from '@/types';
import type { Database, TaskEventRecord, TaskPriority, TaskRecord } from '@/types/database';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

export interface ListTasksOptions {
  workspaceId?: string;
  agentType?: AgentType;
  status?: TaskStatus;
}

export interface CreateTaskDraftInput {
  workspaceId: string;
  userId: string;
  agentType: AgentType;
  title: string;
  description: string;
  priority?: TaskPriority;
  inputData?: JsonObject;
}

export interface UpdateTaskReviewStatusInput {
  taskId: string;
  workspaceId: string;
  status: Extract<TaskStatus, 'pending' | 'completed'>;
  completedAt: string | null;
}

export interface CreateTaskEventInput {
  workspaceId: string;
  taskId: string;
  actorId?: string | null;
  eventType:
    | 'task_created'
    | 'task_approved'
    | 'changes_requested'
    | 'task_sent_to_n8n'
    | 'task_completed_by_n8n'
    | 'task_failed_by_n8n';
  message: string;
}

export interface UpdateTaskExecutionStateInput {
  taskId: string;
  workspaceId: string;
  status: Extract<TaskStatus, 'processing' | 'needs_review' | 'failed'>;
  result?: JsonObject | null;
  n8nExecutionId?: string | null;
  expectedCurrentStatus?: TaskStatus;
}

export interface MarkStaleProcessingTaskFailedInput {
  taskId: string;
  workspaceId: string;
  staleBefore: string;
  errorMessage: string;
}

export function mapTaskRecordToTask(record: TaskRecord): Task {
  return {
    id: record.id,
    user_id: record.user_id,
    agent_type: record.agent_type,
    title: record.title,
    description: record.description,
    input_data: record.input_data,
    status: record.status,
    priority: record.priority,
    result: record.result,
    n8n_execution_id: record.n8n_execution_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    completed_at: record.completed_at,
  };
}

export async function listTasks(
  options: ListTasksOptions = {},
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task[]>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult([], false);
  }

  let query = client.from('tasks').select('*').order('created_at', { ascending: false });

  if (options.workspaceId) {
    query = query.eq('workspace_id', options.workspaceId);
  }

  if (options.agentType) {
    query = query.eq('agent_type', options.agentType);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    return errorDataResult([], error.message);
  }

  return emptyDataResult((data ?? []).map(mapTaskRecordToTask), true);
}

export async function getTaskById(
  taskId: string,
  workspaceId?: string,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  let query = client.from('tasks').select('*').eq('id', taskId);

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ? mapTaskRecordToTask(data) : null, true);
}

export async function createTask(
  input: CreateTaskDraftInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('tasks')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      agent_type: input.agentType,
      title: input.title,
      description: input.description,
      input_data: input.inputData ?? {},
      priority: input.priority ?? 'Normal',
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  const task = mapTaskRecordToTask(data);

  await client.from('task_events').insert({
    workspace_id: input.workspaceId,
    task_id: task.id,
    actor_id: input.userId,
    event_type: 'task_created',
    message: 'Task created by user',
    metadata: {},
  });

  return emptyDataResult(task, true);
}

export const createTaskDraft = createTask;

export async function updateTaskReviewStatus(
  input: UpdateTaskReviewStatusInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('tasks')
    .update({
      status: input.status,
      completed_at: input.completedAt,
    })
    .eq('id', input.taskId)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(mapTaskRecordToTask(data), true);
}

export async function createTaskEvent(
  input: CreateTaskEventInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<TaskEventRecord | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('task_events')
    .insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      message: input.message,
      metadata: {},
    })
    .select('*')
    .single();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data, true);
}

export async function updateTaskExecutionState(
  input: UpdateTaskExecutionStateInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const update: Database['public']['Tables']['tasks']['Update'] = {
    status: input.status,
  };

  if ('result' in input) {
    update.result = input.result ?? null;
  }

  if ('n8nExecutionId' in input) {
    update.n8n_execution_id = input.n8nExecutionId ?? null;
  }

  let query = client
    .from('tasks')
    .update(update)
    .eq('id', input.taskId)
    .eq('workspace_id', input.workspaceId);

  if (input.expectedCurrentStatus) {
    query = query.eq('status', input.expectedCurrentStatus);
  }

  const result = input.expectedCurrentStatus
    ? await query.select('*').maybeSingle()
    : await query.select('*').single();
  const { data, error } = result;

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ? mapTaskRecordToTask(data) : null, true);
}

export async function markStaleProcessingTaskFailed(
  input: MarkStaleProcessingTaskFailedInput,
  client: SupabaseClient<Database> = supabase as SupabaseClient<Database>
): Promise<DataResult<Task | null>> {
  if (!isSupabaseConfigured) {
    return emptyDataResult(null, false);
  }

  const { data, error } = await client
    .from('tasks')
    .update({
      status: 'failed',
      result: {
        error_message: input.errorMessage,
      },
    })
    .eq('id', input.taskId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'processing')
    .lt('updated_at', input.staleBefore)
    .select('*')
    .maybeSingle();

  if (error) {
    return errorDataResult(null, error.message);
  }

  return emptyDataResult(data ? mapTaskRecordToTask(data) : null, true);
}
