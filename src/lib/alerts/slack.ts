/**
 * Slack Alert Channel
 *
 * Sends alerts to a Slack webhook URL. Supports per-workspace webhooks
 * via workspace_alert_channels table, with a global fallback from env.
 *
 * Environment variables:
 *   SLACK_WEBHOOK_URL         - Global fallback webhook (all workspaces)
 *   SLACK_WEBHOOK_ENABLED     - Set to "true" to enable (default: disabled)
 */

import type { AlertChannel, AlertPayload } from './channels';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/network/safeFetch';

const slackLog = logger.child('alerts:slack');

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3498db',
  warning: '#f39c12',
  error: '#e74c3c',
  critical: '#c0392b',
};

function buildSlackPayload(payload: AlertPayload): Record<string, unknown> {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: payload.title, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: payload.message },
    },
  ];

  const fields: Record<string, unknown>[] = [
    { type: 'mrkdwn', text: `*Source:*\n${payload.source}` },
    { type: 'mrkdwn', text: `*Severity:*\n${payload.severity}` },
  ];

  if (payload.workspaceId) {
    fields.push({ type: 'mrkdwn', text: `*Workspace:*\n${payload.workspaceId}` });
  }

  blocks.push({
    type: 'section',
    fields,
  });

  if (payload.relatedUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details', emoji: true },
          url: payload.relatedUrl,
        },
      ],
    });
  }

  return {
    text: payload.title,
    attachments: [
      {
        color: SEVERITY_COLORS[payload.severity] ?? '#95a5a6',
        blocks,
      },
    ],
  };
}

async function resolveWebhookUrl(payload?: AlertPayload): Promise<string | null> {
  // Check env-based global webhook first
  const envUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (envUrl) return envUrl;

  // Per-workspace webhook lookup via workspace_alert_channels (W20-T2).
  if (payload?.workspaceId) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase-server');
      const { client, error } = getSupabaseAdmin();
      if (client && !error) {
        const { data } = await client
          .from('workspace_alert_channels')
          .select('target')
          .eq('workspace_id', payload.workspaceId)
          .eq('channel_type', 'slack')
          .eq('enabled', true)
          .maybeSingle();
        if (data?.target) return data.target;
      }
    } catch {
      // fall through to null
    }
  }

  return null;
}

export function createSlackChannel(): AlertChannel {
  return {
    name: 'slack',

    async send(payload: AlertPayload): Promise<boolean> {
      if (process.env.SLACK_WEBHOOK_ENABLED !== 'true') {
        slackLog.debug('Slack alerts disabled (SLACK_WEBHOOK_ENABLED != true)');
        return false;
      }

      const webhookUrl = await resolveWebhookUrl(payload);
      if (!webhookUrl) {
        slackLog.warn('No Slack webhook URL configured', {
          source: payload.source,
          severity: payload.severity,
        });
        return false;
      }

      const slackPayload = buildSlackPayload(payload);

      const result = await safeFetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
        retryOptions: { maxRetries: 1, baseDelayMs: 500 },
      });

      if (result.error) {
        slackLog.error('Failed to send Slack alert', {
          error: result.error.message,
          statusCode: result.statusCode,
          source: payload.source,
        });
        return false;
      }

      slackLog.info('Slack alert sent', {
        source: payload.source,
        severity: payload.severity,
        title: payload.title,
      });
      return true;
    },
  };
}
