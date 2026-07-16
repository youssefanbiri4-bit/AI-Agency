import type { JsonObject, Task } from '@/types';

type TaskExecutionSource = Pick<
  Task,
  'id' | 'agent_type' | 'title' | 'description' | 'input_data' | 'priority'
>;

/**
 * Builds the n8n task execution payload from a persisted task record.
 * Used by RunTaskButton (via server props) and the execute API.
 */
export function buildTaskExecutionPayload(task: TaskExecutionSource): JsonObject {
  return {
    agent_type: task.agent_type,
    title: task.title,
    description: task.description,
    input_data: task.input_data,
    priority: task.priority,
    task_id: task.id,
  };
}