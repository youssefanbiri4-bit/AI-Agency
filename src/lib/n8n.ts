import type { ApiResponse, JsonObject } from '@/types';
import { PRIMARY_AGENT_IDS } from '@/lib/agents';
import { reportAppError } from '@/lib/logger';

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
      'n8n execution is guarded. Run Task is disabled until the server execution flag, webhook URL, and callback secret are configured.',
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
        error: 'N8N webhook URL not provided',
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId,
        data,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `N8N workflow failed with status ${response.status}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    reportAppError('Error executing N8N workflow', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to execute workflow',
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
