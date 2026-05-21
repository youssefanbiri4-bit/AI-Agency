import 'server-only';

import type { ApiResponse, JsonObject } from '@/types';
import { PRIMARY_AGENT_IDS } from '@/lib/agents';
import { reportAppError } from '@/lib/logger';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { safeFetch } from '@/lib/network/safeFetch';

const PLACEHOLDER_VALUES = new Set([
  'your_n8n_production_webhook_url',
  'make_a_long_random_secret_here',
]);

export interface N8nReadiness {
  canExecute: boolean;
  webhookUrl: string | null;
  status: 'connected' | 'not_connected';
  statusLabel: 'Ready' | 'Not Connected';
  message: string;
}

function readServerEnv(name: string) {
  const value = process.env[name]?.trim() ?? '';

  return value && !PLACEHOLDER_VALUES.has(value) ? value : '';
}

export function getN8nCallbackSecret() {
  return readServerEnv('N8N_CALLBACK_SECRET');
}

function getValidWebhookUrl() {
  const value = readServerEnv('N8N_WEBHOOK_URL');

  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getN8nReadiness(): N8nReadiness {
  const executionEnabled = process.env.TASK_EXECUTION_ENABLED === 'true';
  const webhookUrl = getValidWebhookUrl();
  const hasCallbackSecret = Boolean(getN8nCallbackSecret());
  const canExecute = executionEnabled && Boolean(webhookUrl) && hasCallbackSecret;

  if (canExecute) {
    return {
      canExecute: true,
      webhookUrl,
      status: 'connected',
      statusLabel: 'Ready',
      message: 'n8n execution is configured on the server.',
    };
  }

  return {
    canExecute: false,
    webhookUrl: null,
    status: 'not_connected',
    statusLabel: 'Not Connected',
      message:
      setupBlockerMessage({
        missing: 'TASK_EXECUTION_ENABLED, N8N_WEBHOOK_URL, or N8N_CALLBACK_SECRET',
        reason: 'Run Task must not send work to n8n until the server execution flag, webhook URL, and callback secret are verified',
        next: 'configure the n8n server env in Vercel, redeploy, and run a callback smoke test',
      }),
  };
}

/**
 * Execute a task through n8n webhook
 * This should be called from the backend API route to keep the webhook URL safe
 */
export async function executeN8nWorkflow(
  workflowId: string,
  data: JsonObject,
  webhookUrl: string
): Promise<ApiResponse> {
  try {
    if (!webhookUrl) {
      return {
        success: false,
        error: setupBlockerMessage({
          missing: 'N8N_WEBHOOK_URL',
          reason: 'task execution cannot start without a server-side n8n webhook URL',
          next: 'add N8N_WEBHOOK_URL in Vercel and redeploy',
        }),
      };
    }

    const response = await safeFetch<JsonObject>(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId,
        data,
      }),
      timeoutMs: 8_000,
      retryOptions: {
        maxRetries: 1,
      },
    });

    if (response.error || !response.statusCode || response.statusCode >= 400) {
      return {
        success: false,
        error: 'n8n workflow request was rejected. Blocked because the automation endpoint did not accept the task. Next: check n8n execution logs and webhook configuration, then retry. / n8n رفض الطلب، راجع سجلات n8n والإعدادات.',
      };
    }

    return {
      success: true,
      data: response.data ?? {},
    };
  } catch (error) {
    reportAppError('Error executing N8N workflow', error);
    return {
      success: false,
      error: 'n8n workflow could not be reached safely. Blocked because task execution did not complete. Next: check N8N_WEBHOOK_URL, network access, and n8n workflow status. / تعذر الوصول إلى n8n بأمان.',
    };
  }
}

/**
 * Map agent type to n8n workflow ID
 * You'll need to configure these IDs in your n8n workflows
 */
export function getWorkflowIdForAgent(agentType: string): string {
  const workflowMap = Object.fromEntries(
    PRIMARY_AGENT_IDS.map((id) => [
      id,
      process.env[`N8N_WORKFLOW_${id.toUpperCase()}`] || id,
    ])
  );

  return workflowMap[agentType] || agentType;
}

/**
 * Execute a task through n8n
 * This is the main task execution interface called from API routes
 * @param taskPayload - Task data to execute
 * @param taskExecutionId - Unique execution ID for tracking
 * @param workspaceId - Workspace context for the task
 * @returns Result with success status and optional error message
 */
export async function executeTask(
  taskPayload: JsonObject,
  taskExecutionId: string,
  workspaceId: string
): Promise<ApiResponse> {
  try {
    const readiness = getN8nReadiness();

    if (!readiness.canExecute || !readiness.webhookUrl) {
      return {
        success: false,
        error: readiness.message,
      };
    }

    // Prepare task execution payload with context
    const executionPayload: JsonObject = {
      ...taskPayload,
      taskExecutionId,
      workspaceId,
      executeAt: new Date().toISOString(),
    };

    // Execute through n8n workflow
    const result = await executeN8nWorkflow(
      `task-execute-${workspaceId}`,
      executionPayload,
      readiness.webhookUrl
    );

    return result;
  } catch (error) {
    reportAppError('Task execution failed', error, {
      taskExecutionId,
      workspaceId,
    });
    return {
      success: false,
      error: 'Task execution encountered an unexpected error. Please retry or contact support.',
    };
  }
}
