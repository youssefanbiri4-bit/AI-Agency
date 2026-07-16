/**
 * Email Alert Channel
 *
 * Sends alerts via the Resend transactional email API.
 * Requires RESEND_API_KEY and a recipient list (EMAIL_ALERTS_TO).
 * When disabled or unconfigured, the channel is a no-op (returns false) and
 * the alert is logged at debug level — alerting must never break the caller.
 *
 * Environment variables:
 *   EMAIL_ALERTS_ENABLED  - Set to "true" to enable
 *   EMAIL_ALERTS_FROM     - Sender address (default: alerts@agentflow-ai.com)
 *   EMAIL_ALERTS_TO       - Comma-separated recipient list
 *   RESEND_API_KEY        - Resend API key (secret, never hardcoded)
 */

import type { AlertChannel, AlertPayload } from './channels';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/network/safeFetch';

const emailLog = logger.child('alerts:email');

const RESEND_API_URL = 'https://api.resend.com/emails';

function buildEmailHtml(payload: AlertPayload): string {
  const severityColors: Record<string, string> = {
    info: '#3498db',
    warning: '#f39c12',
    error: '#e74c3c',
    critical: '#c0392b',
  };
  const color = severityColors[payload.severity] ?? '#95a5a6';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto;">
  <div style="border-left: 4px solid ${color}; padding: 16px; background: #f8f9fa; border-radius: 4px;">
    <h2 style="margin: 0 0 8px; color: ${color};">${payload.title}</h2>
    <p style="margin: 0 0 16px; color: #333; line-height: 1.5;">${payload.message}</p>
    <table style="font-size: 13px; color: #666; width: 100%;">
      <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Source</td><td>${payload.source}</td></tr>
      <tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Severity</td><td>${payload.severity}</td></tr>
      ${payload.workspaceId ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Workspace</td><td>${payload.workspaceId}</td></tr>` : ''}
    </table>
    ${payload.relatedUrl ? `<p style="margin-top: 16px;"><a href="${payload.relatedUrl}" style="background: ${color}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px;">View Details</a></p>` : ''}
  </div>
  <p style="font-size: 11px; color: #999; margin-top: 16px;">Sent by AgentFlow AI Monitoring</p>
</body>
</html>`;
}

function getRecipients(): string[] {
  const raw = process.env.EMAIL_ALERTS_TO?.trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function sendViaResend(payload: AlertPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = getRecipients();

  if (!apiKey) {
    emailLog.warn('RESEND_API_KEY is not set; cannot send email alerts');
    return false;
  }
  if (recipients.length === 0) {
    emailLog.warn('EMAIL_ALERTS_TO is empty; no email recipients');
    return false;
  }

  const result = await safeFetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_ALERTS_FROM || 'AgentFlow Alerts <alerts@agentflow-ai.com>',
      to: recipients,
      subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
      html: buildEmailHtml(payload),
    }),
    retryOptions: { maxRetries: 1, baseDelayMs: 500 },
  });

  if (result.error) {
    emailLog.error('Failed to send email alert via Resend', {
      error: result.error.message,
      statusCode: result.statusCode,
      source: payload.source,
    });
    return false;
  }

  emailLog.info('Email alert sent via Resend', {
    source: payload.source,
    severity: payload.severity,
    title: payload.title,
    recipients: recipients.length,
  });
  return true;
}

export function createEmailChannel(): AlertChannel {
  return {
    name: 'email',

    async send(payload: AlertPayload): Promise<boolean> {
      if (process.env.EMAIL_ALERTS_ENABLED !== 'true') {
        emailLog.debug('Email alerts disabled (EMAIL_ALERTS_ENABLED != true)');
        return false;
      }
      return sendViaResend(payload);
    },
  };
}
