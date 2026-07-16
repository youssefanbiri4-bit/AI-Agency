import { describe, it, expect, vi, beforeEach } from 'vitest';

const getRedisClientMock = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/monitoring/metrics', () => ({
  increment: vi.fn(),
  timing: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: (...args: unknown[]) => getRedisClientMock(...args),
}));

function fakeRedis() {
  const map = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => map.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      map.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (k: string) => {
      map.delete(k);
      return 1;
    }),
  };
}

describe('short-term memory', () => {
  beforeEach(() => {
    getRedisClientMock.mockReset();
  });

  it('creates a blank memory and appends messages (redis-backed)', async () => {
    const redis = fakeRedis();
    getRedisClientMock.mockResolvedValue(redis);

    const { getShortTermMemory, addMessage, clearShortTermMemory } = await import('./short-term');

    const mem = await getShortTermMemory('run1', 'ws1', 'seo');
    expect(mem.runId).toBe('run1');
    expect(mem.messages).toHaveLength(0);

    const msg = await addMessage('run1', 'ws1', 'seo', {
      role: 'user',
      content: 'hello',
    });
    expect(msg.content).toBe('hello');
    expect(msg.createdAt).toBeTruthy();

    const reloaded = await getShortTermMemory('run1', 'ws1', 'seo');
    expect(reloaded.messages).toHaveLength(1);
    expect(reloaded.messages[0].content).toBe('hello');

    await clearShortTermMemory('run1');
    const afterClear = await getShortTermMemory('run1', 'ws1', 'seo');
    expect(afterClear.messages).toHaveLength(0);
  });

  it('falls back to in-memory store when Redis is unavailable', async () => {
    getRedisClientMock.mockResolvedValue(null);

    const { getShortTermMemory, addMessage } = await import('./short-term');
    await getShortTermMemory('run2', 'ws2', 'ads');
    const msg = await addMessage('run2', 'ws2', 'ads', { role: 'assistant', content: 'hi' });
    expect(msg.content).toBe('hi');

    const reloaded = await getShortTermMemory('run2', 'ws2', 'ads');
    expect(reloaded.messages).toHaveLength(1);
  });

  it('updates the scratchpad', async () => {
    getRedisClientMock.mockResolvedValue(null);
    const { getShortTermMemory, updateScratchpad, getScratchpad } = await import('./short-term');
    await getShortTermMemory('run3', 'ws3', 'content');
    await updateScratchpad('run3', 'ws3', 'content', { plan: 'draft' });
    const sp = await getScratchpad('run3', 'ws3', 'content');
    expect(sp.plan).toBe('draft');
  });
});
