import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Ensure callback secret is set for tests
process.env.N8N_CALLBACK_SECRET = 'test-secret';

const mockRecord = vi.fn();

vi.mock('@/lib/n8n-callback-idempotency', () => ({
  recordN8nCallback: (...args: unknown[]) => mockRecord(...args),
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

// Mock data layer functions used in the processing path
const mockUpdateTaskExecutionState = vi.fn();
const mockCreateTaskEvent = vi.fn();
const mockCreateNotification = vi.fn();
vi.mock('@/lib/data/tasks', async () => {
  const actual = await vi.importActual('@/lib/data/tasks');
  return {
    ...actual,
    updateTaskExecutionState: (...args: unknown[]) => mockUpdateTaskExecutionState(...args),
    createTaskEvent: (...args: unknown[]) => mockCreateTaskEvent(...args),
  };
});
vi.mock('@/lib/data/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 });
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
const mockCheckPayloadSize = vi.fn();
vi.mock('@/lib/payload-limit', () => ({
  checkPayloadSize: (...args: unknown[]) => mockCheckPayloadSize(...args),
  PAYLOAD_LIMITS: { callback: 512 * 1024 },
}));
vi.mock('@/lib/n8n', () => ({
  getN8nCallbackSecret: () => process.env.N8N_CALLBACK_SECRET,
}));

describe('POST /api/tasks/callback - ignored when not processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Record callback returns success, not duplicate
    mockRecord.mockResolvedValue({ duplicate: false, eventId: null, error: null });
    // Data layer mocks for processing path
    mockUpdateTaskExecutionState.mockResolvedValue({ data: { id: 'ok' }, error: null });
    mockCreateTaskEvent.mockResolvedValue({ data: { id: 'evt-1' }, error: null });
    mockCreateNotification.mockResolvedValue({ data: { id: 'n-1' }, error: null });
    // Rate limit and payload size mocks
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 });
    mockCheckPayloadSize.mockImplementation(async (req: Request) => ({ ok: true as const, request: req }));
    // Simulate task record with status 'pending'
    mockMaybeSingle.mockResolvedValue({ data: { id: '550e8400-e29b-41d4-a716-446655440001', workspace_id: '550e8400-e29b-41d4-a716-446655440010', user_id: '550e8400-e29b-41d4-a716-446655440020', title: 'T', status: 'pending' } });
  });

  it('returns ignored when task status is not processing', async () => {
    const { POST } = await import('@/app/api/tasks/callback/route');

    const body = {
      task_id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'completed',
    };

    const res = await POST(new NextRequest('http://localhost/api/tasks/callback', {
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
    mockMaybeSingle.mockResolvedValue({ data: { id: '550e8400-e29b-41d4-a716-446655440001', workspace_id: '550e8400-e29b-41d4-a716-446655440010', user_id: '550e8400-e29b-41d4-a716-446655440020', title: 'T', status: 'processing' } });

    const { POST } = await import('@/app/api/tasks/callback/route');

    const body = {
      task_id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'completed',
      result: { success: true },
    };

    const res = await POST(new NextRequest('http://localhost/api/tasks/callback', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'x-callback-secret': 'test-secret' },
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('needs_review');
  });
});
