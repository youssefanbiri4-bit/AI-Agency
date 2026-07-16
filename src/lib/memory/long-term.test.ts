import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const fromMock = vi.fn();
const getSupabaseAdminMock = vi.fn(() => ({ client: { from: fromMock }, error: null }));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/monitoring/metrics', () => ({
  increment: vi.fn(),
  timing: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

function chainReturn(result: unknown, error: unknown = null) {
  const asArray = Array.isArray(result) ? result : [result];
  const terminal = { data: result, error };
  const singleTerminal = { data: asArray[0] ?? null, error };
  const build: () => Record<string, unknown> & { then: unknown } = () => {
    const b = {
      select: vi.fn(() => build()),
      insert: vi.fn(() => build()),
      update: vi.fn(() => build()),
      delete: vi.fn(() => build()),
      eq: vi.fn(() => build()),
      or: vi.fn(() => build()),
      gte: vi.fn(() => build()),
      contains: vi.fn(() => build()),
      in: vi.fn(() => build()),
      order: vi.fn(() => build()),
      limit: vi.fn(() => build()),
      single: vi.fn(() => Promise.resolve(singleTerminal)),
      maybeSingle: vi.fn(() => Promise.resolve(singleTerminal)),
      // Make the builder itself awaitable so `await builder.limit()` resolves to terminal.
      then: (resolve?: (v: unknown) => void) => Promise.resolve(terminal).then(resolve),
    } as Record<string, unknown> & { then: unknown };
    return b;
  };
  return build();
}

describe('long-term memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a memory entry and normalizes the row', async () => {
    const row = {
      id: 'm1',
      workspace_id: 'ws1',
      agent_type: 'seo',
      memory_type: 'semantic',
      category: 'facts',
      content: 'OpenAI used for text',
      importance: 8,
      confidence: 0.9,
      source: null,
      tags: ['llm'],
      metadata: { k: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_accessed_at: null,
      expires_at: null,
    };
    fromMock.mockReturnValue(chainReturn([row]));

    const { storeMemory, recallMemories } = await import('./long-term');
    const res = await storeMemory({
      workspaceId: 'ws1',
      agentType: 'seo',
      memoryType: 'semantic',
      content: 'OpenAI used for text',
    });
    expect(res.error).toBeNull();
    expect(res.data.id).toBe('m1');
    expect(res.data.tags).toEqual(['llm']);

    const recall = await recallMemories({ workspaceId: 'ws1', memoryType: 'semantic' });
    expect(recall.data).toHaveLength(1);
    expect(recall.data[0].agentType).toBe('seo');
  });

  it('propagates supabase errors', async () => {
    fromMock.mockReturnValue(chainReturn([], { message: "insert failed" }));
    const { recallMemories } = await import('./long-term');
    const res = await recallMemories({ workspaceId: 'ws1' });
    expect(res.error).toBe('insert failed');
    expect(res.data).toEqual([]);
  });
});
