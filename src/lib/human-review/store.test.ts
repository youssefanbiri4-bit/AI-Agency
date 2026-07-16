import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMemoryMock = vi.fn();
const recallMemoriesMock = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/monitoring/metrics', () => ({
  increment: vi.fn(),
  timing: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    client: null,
    error: 'not configured',
  }),
}));

vi.mock('@/lib/memory/long-term', () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  recallMemories: (...args: unknown[]) => recallMemoriesMock(...args),
}));

describe('human-review store (unconfigured)', () => {
  beforeEach(() => {
    vi.resetModules();
    storeMemoryMock.mockReset();
    recallMemoriesMock.mockReset();
  });

  it('returns unconfigured result when Supabase is missing', async () => {
    const { requestHumanReview } = await import('./store');
    const res = await requestHumanReview({
      runId: 'r1',
      workspaceId: 'ws1',
      agentType: 'seo',
      stepId: 's1',
      reason: 'needs approval',
    });
    expect(res.isConfigured).toBe(false);
    expect(res.data).toBeNull();
  });
});

describe('human-review status validation', () => {
  it('accepts valid statuses', async () => {
    const { isStatus, isDecision } = await import('./store');
    expect(isStatus('pending')).toBe(true);
    expect(isStatus('approved')).toBe(true);
    expect(isStatus('bogus')).toBe(false);
    expect(isDecision('approved')).toBe(true);
    expect(isDecision('rejected')).toBe(true);
    expect(isDecision('pending')).toBe(false);
  });
});
