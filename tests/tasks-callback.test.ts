import { vi, describe, it, expect, beforeEach } from 'vitest';

// Ensure callback secret is set for tests
process.env.N8N_CALLBACK_SECRET = 'test-secret';

// Mock n8n callback idempotency recorder
const mockRecord = vi.fn();
vi.mock('@/lib/n8n-callback-idempotency', () => ({
  recordN8nCallback: (...args: unknown[]) => mockRecord(...(args as any)),
  buildN8nCallbackKey: () => ({ executionIdentifier: 'exec-1' }),
  markN8nCallbackEvent: async () => {},
}));

// Mock supabase admin client lookup
const mockMaybeSingle = vi.fn();
vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => mockMaybeSingle(),
          }),
        }),
      }),
    },
  }),
}));

describe('POST /api/tasks/callback - ignored when not processing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Record callback returns success, not duplicate
    mockRecord.mockResolvedValue({ duplicate: false, eventId: null, error: null });
    // Simulate task record with status 'pending'
    mockMaybeSingle.mockResolvedValue({ data: { id: 'task-1', workspace_id: 'w1', user_id: 'u1', title: 'T', status: 'pending' } });
  });

  it('returns ignored when task status is not processing', async () => {
    const { POST } = await import('@/app/api/tasks/callback/route');

    const body = {
      task_id: 'task-1',
      status: 'completed',
    };

    const res = await POST(new Request('http://localhost/api/tasks/callback', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-callback-secret': 'test-secret' },
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(true);
    expect(json.data.status).toBe('pending');
  });

  it('processes callback when task status is processing', async () => {
    // Simulate task record with status 'processing'
    mockMaybeSingle.mockResolvedValue({ data: { id: 'task-1', workspace_id: 'w1', user_id: 'u1', title: 'T', status: 'processing' } });

    const { POST } = await import('@/app/api/tasks/callback/route');

    const body = {
      task_id: 'task-1',
      status: 'completed',
      result: { success: true },
    };

    const res = await POST(new Request('http://localhost/api/tasks/callback', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-callback-secret': 'test-secret' },
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(false);
    expect(json.data.status).toBe('processing' || 'completed');
  });
});
