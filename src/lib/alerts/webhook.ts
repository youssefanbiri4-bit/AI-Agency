/**
 * Generic Webhook Alert Channel (PagerDuty-compatible)
 *
 * W20-T2: DevOps Engineer deliverable.
 *
 * Sends alerts to a generic incident webhook (e.g. PagerDuty Events API v2,
 * or any endpoint that accepts a JSON event). Gated by
 * `WEBHOOK_ALERTS_ENABLED === 'true'` and `WEBHOOK_ALERTS_URL`.
 *
 * PagerDuty Events API v2 payload shape is used by default; if the target is a
 * different system, it still receives a well-formed JSON event it can parse.
 */

import type { AlertChannel, AlertPayload } from './channels';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/network/safeFetch';

const webhookLog = logger.child('alerts:webhook');

const SEVERITY_TO_PD: Record<string, string> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
};

function buildPagerDutyPayload(payload: AlertPayload): Record<string, unknown> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  const severity = SEVERITY_TO_PD[payload.severity] ?? 'error';
  return {
    routing_key: routingKey,
    event_action: payload.severity === 'info' ? 'resolve' : 'trigger',
    payload: {
      summary: `${payload.title} — ${payload.message}`,
      source: payload.source,
      severity,
      custom_details: {
        workspaceId: payload.workspaceId ?? null,
        relatedUrl: payload.relatedUrl ?? null,
        ...(payload.metadata ?? {}),
      },
    },
  };
}

export function createWebhookChannel(): AlertChannel {
  return {
    name: 'webhook',

    async send(payload: AlertPayload): Promise<boolean> {
      if (process.env.WEBHOOK_ALERTS_ENABLED !== 'true') {
        webhookLog.debug('Webhook alerts disabled (WEBHOOK_ALERTS_ENABLED != true)');
        return false;
      }

      const url = process.env.WEBHOOK_ALERTS_URL?.trim();
      if (!url) {
        webhookLog.warn('No webhook URL configured');
        return false;
      }

      const body = process.env.PAGERDUTY_ROUTING_KEY
        ? buildPagerDutyPayload(payload)
        : { event: 'alert', ...payload };

      const result = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        retryOptions: { maxRetries: 1, baseDelayMs: 500 },
      });

      if (result.error) {
        webhookLog.error('Failed to send webhook alert', {
          error: result.error.message,
          statusCode: result.statusCode,
          source: payload.source,
        });
        return false;
      }

      webhookLog.info('Webhook alert sent', {
        source: payload.source,
        severity: payload.severity,
        title: payload.title,
      });
      return true;
    },
  };
}
