/**
 * n8n Worker Module
 *
 * This module re-exports all n8n execution utilities from the canonical
 * source (src/lib/n8n.ts) to eliminate code duplication while maintaining
 * backward compatibility for existing imports.
 *
 * The only addition here is the correlationId parameter in executeTask,
 * which is specific to the worker context.
 */
export {
  type N8nReadiness,
  getN8nCallbackSecret,
  getN8nReadiness,
  getWorkflowTimeoutMs,
  executeN8nWorkflow,
  getWorkflowIdForAgent,
} from '@/lib/n8n';

import { executeTask as n8nExecuteTask } from '@/lib/n8n';
import type { ApiResponse, JsonObject } from '@/types';
import { reportAppError } from '@/lib/logger';

/**
 * Execute a task through n8n (standalone worker entrypoint).
 * Extends the base executeTask with correlation ID support for job tracking.
 */
export async function executeTask(
  taskPayload: JsonObject,
  taskExecutionId: string | null,
  workspaceId: string,
  taskId: string | null = null,
  correlationId: string | null = null
): Promise<ApiResponse> {
  try {
    const executionPayload: JsonObject = {
      ...taskPayload,
      taskExecutionId,
      task_id: taskId ?? null,
      workspaceId,
      executeAt: new Date().toISOString(),
      correlation_id: correlationId ?? null,
    };

    return await n8nExecuteTask(executionPayload, taskExecutionId, workspaceId, taskId);
  } catch (error) {
    reportAppError('Worker task execution failed', error, {
      taskExecutionId,
      workspaceId,
    });
    return {
      success: false,
      error: 'Task execution encountered an unexpected error. Please retry or contact support.',
    };
  }
}
