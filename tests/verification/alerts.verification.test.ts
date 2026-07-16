/**
 * W9-VER-T2 — Alerts module live verification
 *
 * Verifies:
 *  - dispatchAlert routing to email + Slack channels (payloads well-formed)
 *  - channel self-gating when EMAIL_ALERTS_ENABLED / SLACK_WEBHOOK_ENABLED are off
 *  - global ALERTS_ENABLED skip
 *  - alertHealthDegradation + alertHighErrorRate (threshold gating)
 *  - quota alerts (checkAndSendQuotaAlert) dispatch an external alert and debounce
 *
 * safeFetch is mocked so no real network calls are made; the Slack/Resend URLs
 * and request bodies are asserted instead. Supabase is mocked so quota-alert
 * notification creation is a clean no-op (verifying the external-dispatch path).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const safeFetchMock = vi.fn(async (..._args: unknown[]) => ({
  data: null,
  error: null,
  statusCode: 200,
  traceId: 'test',
  durationMs: 1,
  fromCache: false,
}));

vi.mock('@/lib/network/safeFetch', () => ({
  safeFetch: (...args: unknown[]) => safeFetchMock(...(args as [string, unknown])),
}));

vi.mock('@/lib/supabase-server', () => {
  const fakeSupabase = {
    from: (table: string) => {
      if (table === 'workspace_members') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          limit: () => Promise.resolve({ data: [{ user_id: 'u1' }], error: null }),
        };
        return builder;
      }
      return { insert: () => Promise.resolve({ error: null }) };
    },
  };
  return { getSupabaseAdmin: () => ({ client: fakeSupabase }) };
});

import { dispatchAlert, alertHealthDegradation, alertHighErrorRate } from '@/lib/alerts';
import { checkAndSendQuotaAlert, clearAlertCache } from '@/lib/usage/quota-alerts';

beforeEach(() => {
  safeFetchMock.mockClear();
  clearAlertCache();
  vi.stubEnv('ALERTS_ENABLED', 'true');
  vi.stubEnv('EMAIL_ALERTS_ENABLED', 'true');
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_ALERTS_TO', 'ops@example.com');
  vi.stubEnv('EMAIL_ALERTS_FROM', 'AgentFlow <alerts@agentflow-ai.com>');
  vi.stubEnv('SLACK_WEBHOOK_ENABLED', 'true');
  vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test');
  vi.stubEnv('ALERT_ERROR_RATE_THRESHOLD', '0.05');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Alerts — dispatchAlert routing', () => {
  it('dispatches to both email (Resend) and Slack channels with correct payloads', async () => {
    await dispatchAlert({
      source: 'test',
      severity: 'critical',
      title: 'Disk full',
      message: 'No space left on device',
      workspaceId: 'ws-123',
    });

    expect(safeFetchMock).toHaveBeenCalledTimes(2);

    const resendCall = safeFetchMock.mock.calls.find((c) => String(c[0]).includes('resend.com'));
    const slackCall = safeFetchMock.mock.calls.find((c) =>
      String(c[0]).includes('hooks.slack.com'),
    );
    expect(resendCall).toBeTruthy();
    expect(slackCall).toBeTruthy();

    const slackBody = JSON.parse(String((slackCall![1] as any).body));
    expect(slackBody.text).toBe('Disk full');
    expect(JSON.stringify(slackBody)).toContain('ws-123');

    const emailBody = JSON.parse(String((resendCall![1] as any).body));
    expect(emailBody.subject).toContain('[CRITICAL]');
    expect(emailBody.to).toContain('ops@example.com');
  });

  it('sends nothing when both channels are disabled (self-gating)', async () => {
    vi.stubEnv('EMAIL_ALERTS_ENABLED', 'false');
    vi.stubEnv('SLACK_WEBHOOK_ENABLED', 'false');

    await dispatchAlert({ source: 'test', severity: 'warning', title: 'T', message: 'M' });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('skips entirely when ALERTS_ENABLED is false', async () => {
    vi.stubEnv('ALERTS_ENABLED', 'false');

    await dispatchAlert({ source: 'test', severity: 'warning', title: 'T', message: 'M' });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});

describe('Alerts — health degradation + error rate', () => {
  it('alertHealthDegradation dispatches a warning alert from the health source', async () => {
    await alertHealthDegradation({ status: 'degraded', reason: 'DB latency high', workspaceId: 'ws-9' });

    const call = safeFetchMock.mock.calls.find((c) =>
      String(c[0]).includes('hooks.slack.com'),
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call![1] as any).body));
    expect(JSON.stringify(body)).toContain('health');
    expect(JSON.stringify(body)).toContain('ws-9');
  });

  it('alertHighErrorRate does NOT dispatch below threshold', async () => {
    await alertHighErrorRate({ rate: 0.01, count: 1, windowMs: 60_000 });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('alertHighErrorRate dispatches a critical alert above threshold', async () => {
    await alertHighErrorRate({ rate: 0.5, count: 100, windowMs: 60_000, context: 'api' });
    expect(safeFetchMock).toHaveBeenCalled();

    const call = safeFetchMock.mock.calls.find((c) => String(c[0]).includes('hooks.slack.com'));
    const body = JSON.parse(String((call![1] as any).body));
    expect(JSON.stringify(body)).toContain('error-rate');
  });
});

describe('Alerts — quota alerts', () => {
  it('dispatches an external alert at the critical (95%) threshold without throwing', async () => {
    await checkAndSendQuotaAlert('ws-q', 'tasks', 95, 100);
    await vi.waitFor(() => expect(safeFetchMock).toHaveBeenCalled());

    const call = safeFetchMock.mock.calls.find((c) => String(c[0]).includes('hooks.slack.com'));
    const body = JSON.parse(String((call![1] as any).body));
    expect(JSON.stringify(body)).toContain('quota');
  });

  it('debounces duplicate quota alerts within the debounce window (one dispatch only)', async () => {
    clearAlertCache();
    safeFetchMock.mockClear();

    await checkAndSendQuotaAlert('ws-deb', 'tasks', 95, 100);
    await checkAndSendQuotaAlert('ws-deb', 'tasks', 95, 100);

    await vi.waitFor(() => expect(safeFetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    // email + slack for the FIRST call only = 2 network calls (not 4)
    expect(safeFetchMock).toHaveBeenCalledTimes(2);
  });
});
