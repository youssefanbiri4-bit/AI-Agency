import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/network/safeFetch', () => {
  return {
    safeFetch: vi.fn().mockResolvedValue({ data: { ok: true }, error: null, statusCode: 200 }),
  };
});

import { safeFetch } from '@/lib/network/safeFetch';
import { executeN8nWorkflow } from '@/lib/n8n';

describe('n8n outbound safety', () => {
  it('uses redirect: manual for n8n webhook POST to prevent redirect chains', async () => {
    const webhookUrl = 'https://example.com/webhook';

    await executeN8nWorkflow(
      'workflow-1',
      { hello: 'world' },
      webhookUrl,
      8000
    );

    expect(safeFetch).toHaveBeenCalledTimes(1);

    const calls = (safeFetch as unknown as {
      mock: { calls: Array<[unknown, Record<string, unknown>]> };
    }).mock.calls;

    const [, init] = calls[0];
    expect(init.redirect).toBe('manual');
    expect(init.method).toBe('POST');
  });
});
