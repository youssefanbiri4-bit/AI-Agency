import type { ApiResponse, JsonObject } from '@/types';
import { PRIMARY_AGENT_IDS } from '@/lib/agents';
import { reportAppError } from '@/lib/logger';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { safeFetch } from '@/lib/network/safeFetch';
import { validateN8nWebhookUrl } from '@/lib/network/ssrf';

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

async function getValidWebhookUrl(): Promise<string | null> {
  const value = readServerEnv('N8N_WEBHOOK_URL');
  if (!value) return null;

  const res = await validateN8nWebhookUrl(value);
  return res.ok ? res.normalizedUrl ?? value : null;
}

export async function getN8nReadiness(): Promise<N8nReadiness> {
  const executionEnabled = process.env.TASK_EXECUTION_ENABLED === 'true';
  const webhookUrl = await getValidWebhookUrl();
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
    message: setupBlockerMessage({
      missing: 'TASK_EXECUTION_ENABLED, N8N_WEBHOOK_URL, or N8N_CALLBACK_SECRET',
      reason:
        'Run Task must not send work to n8n until the server execution flag, webhook URL, and callback secret are verified',
      next: 'configure the n8n server env in Vercel, redeploy, and run a callback smoke test',
    }),
  };
}

// Configurable workflow timeouts
export function getWorkflowTimeoutMs(workflowId: string): number {
  // Default timeout: 5 minutes
  const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

  // Allow override via environment variable
  const envVarName = `N8N_WORKFLOW_TIMEOUT_${workflowId.toUpperCase()}`;
  const timeoutStr = process.env[envVarName];

  if (timeoutStr) {
    const timeout = parseInt(timeoutStr, 10);
    if (!Number.isNaN(timeout) && timeout > 0) {
      return timeout;
    }
  }

  return DEFAULT_TIMEOUT_MS;
}

/**
 * Execute a task through n8n webhook
 * Pure Node implementation (standalone worker).
 */
export async function executeN8nWorkflow(
  workflowId: string,
  data: JsonObject,
  webhookUrl: string,
  timeoutMs: number = 8_000
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
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId,
        data,
      }),
      timeoutMs: timeoutMs,
      retryOptions: {
        maxRetries: 3,
      },
    });

    if (response.error || !response.statusCode || response.statusCode >= 400) {
      return {
        success: false,
        error: 'n8n workflow request was rejected. Blocked because the automation endpoint did not accept the task. Next: check n8n execution logs and webhook configuration, then retry. / n8n rifiutò la richiesta, controllare i log di n8n e l\'impostazione del webhook.',
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
      error: 'n8n workflow could not be reached safely. Blocked because task execution did not complete. Next: check N8N_WEBHOOK_URL, network access, and n8n workflow status. / Impossibile raggiungere n8n in modo sicuro.',
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
 * Execute a task through n8n (standalone worker entrypoint)
 */
export async function executeTask(
  taskPayload: JsonObject,
  taskExecutionId: string | null,
  workspaceId: string,
  taskId: string | null = null,
  correlationId: string | null = null
): Promise<ApiResponse> {
  try {
    const readiness = await getN8nReadiness();

    if (!readiness.canExecute || !readiness.webhookUrl) {
      return {
        success: false,
        error: readiness.message,
      };
    }

    // Prepare task execution payload with context
    const executionPayload: JsonObject = {
      ...taskPayload,
      // preserve existing execution identifier
      taskExecutionId,
      // include canonical DB id for callbacks
      task_id: taskId ?? null,
      workspaceId,
      executeAt: new Date().toISOString(),

      // correlation for request/job tracking
      correlation_id: correlationId ?? null,
    };

    // Get workflow ID for this agent type
    const workflowId = getWorkflowIdForAgent(
      (taskPayload.agent_type as string) || 'unknown'
    );

    // Get configurable timeout for this workflow
    const timeoutMs = getWorkflowTimeoutMs(workflowId);

    // Execute through n8n workflow with configurable timeout
    return await executeN8nWorkflow(
      `task-execute-${workspaceId}`,
      executionPayload,
      readiness.webhookUrl,
      timeoutMs
    );
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
