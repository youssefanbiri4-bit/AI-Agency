import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

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
  const savedSupabaseUrl = process.env.SUPABASE_URL;
  const savedServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    // The store decides "unconfigured" by checking these env vars, which is
    // independent of the getSupabaseAdmin mock. Clear them so the test does
    // not depend on the ambient environment.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    storeMemoryMock.mockReset();
    recallMemoriesMock.mockReset();
  });

  afterAll(() => {
    if (savedSupabaseUrl !== undefined) process.env.SUPABASE_URL = savedSupabaseUrl;
    if (savedServiceRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRoleKey;
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
