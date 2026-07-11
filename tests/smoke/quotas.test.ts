import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetUsageCounters = vi.fn().mockResolvedValue({});
const mockIncrementUsageCounter = vi.fn().mockResolvedValue(undefined);
const mockGetMonthlyUsageByType = vi.fn().mockResolvedValue(0);
vi.mock('@/lib/usage/usage-limits', () => ({
  getUsageCounters: (...args: unknown[]) => mockGetUsageCounters(...args),
  incrementUsageCounter: (...args: unknown[]) => mockIncrementUsageCounter(...args),
  getMonthlyUsageByType: (...args: unknown[]) => mockGetMonthlyUsageByType(...args),
  PLAN_LIMITS: {
    free: { max_ai_generations_per_month: 20, max_tasks: 50, max_creative_assets: 50, max_content_items: 30, max_reels_publishes_per_month: 5 },
    starter: { max_ai_generations_per_month: 100, max_tasks: 200, max_creative_assets: 150, max_content_items: 100, max_reels_publishes_per_month: 30 },
    pro: { max_ai_generations_per_month: 500, max_tasks: 1000, max_creative_assets: 500, max_content_items: 500, max_reels_publishes_per_month: 100 },
    agency: { max_ai_generations_per_month: 2000, max_tasks: 5000, max_creative_assets: 2000, max_content_items: 2000, max_reels_publishes_per_month: 500 },
  },
}));

// Build a proper chainable mock for Supabase
function createSupabaseMock() {
  const chain: Record<string, unknown> = {};
  chain.select = (..._args: unknown[]) => chain;
  chain.eq = (..._args: unknown[]) => chain;
  chain.neq = (..._args: unknown[]) => chain;
  chain.gt = (..._args: unknown[]) => chain;
  chain.gte = (..._args: unknown[]) => chain;
  chain.lt = (..._args: unknown[]) => chain;
  chain.lte = (..._args: unknown[]) => chain;
  chain.order = (..._args: unknown[]) => chain;
  chain.limit = (..._args: unknown[]) => chain;
  chain.insert = (..._args: unknown[]) => chain;
  chain.update = (..._args: unknown[]) => chain;
  chain.delete = (..._args: unknown[]) => chain;

  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = maybeSingle;
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

  // When awaited directly (no terminal method), return { data: [], error: null }
  chain.then = (resolve: (val: { data: unknown[]; error: null }) => unknown, reject?: (err: unknown) => unknown) => {
    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
  };
  chain.catch = (handler: (err: unknown) => unknown) => {
    return Promise.resolve({ data: [], error: null }).catch(handler);
  };

  const fromMock = vi.fn().mockReturnValue(chain);
  return { fromMock, chain, maybeSingle };
}

const { fromMock, chain: defaultChain, maybeSingle: defaultMaybeSingle } = createSupabaseMock();

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({ from: fromMock }),
}));

describe('Quota System - smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsageCounters.mockResolvedValue({});
    defaultMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('checkQuota returns allowed when usage is below limit', async () => {
    mockGetUsageCounters.mockResolvedValue({ tasks: 5 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'tasks');

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(50); // free plan max_tasks
    expect(result.percentUsed).toBe(10);
  });

  it('checkQuota returns not allowed when usage exceeds limit', async () => {
    mockGetUsageCounters.mockResolvedValue({ tasks: 50 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'tasks');

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(50);
    expect(result.limit).toBe(50);
    expect(result.percentUsed).toBe(100);
    expect(result.message).toContain('Quota exceeded');
  });

  it('checkQuota warns at 80% usage', async () => {
    mockGetUsageCounters.mockResolvedValue({ tasks: 40 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'tasks');

    expect(result.allowed).toBe(true);
    expect(result.percentUsed).toBe(80);
    expect(result.message).toContain('Approaching limit');
  });

  it('checkQuota handles ai_generations type', async () => {
    mockGetUsageCounters.mockResolvedValue({ ai_generations: 10 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'ai_generations');

    expect(result.limit).toBe(20);
    expect(result.current).toBe(10);
  });

  it('checkQuota handles reels_publishes type', async () => {
    mockGetUsageCounters.mockResolvedValue({ reels_publishes: 3 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30, max_reels_publishes_per_month: 5 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'reels_publishes');

    expect(result.limit).toBe(5);
    expect(result.current).toBe(3);
  });

  it('checkQuota allows unlimited when limit is null', async () => {
    mockGetUsageCounters.mockResolvedValue({ cost_usd: 999.99 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'agency', max_ai_generations_per_month: 2000, max_creative_assets: 2000, max_content_items: 2000, max_reels_publishes_per_month: 500 },
      error: null,
    });

    const { checkQuota } = await import('@/lib/usage/quotas');
    const result = await checkQuota('ws-1', 'cost_usd');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });

  it('incrementUsage calls incrementUsageCounter', async () => {
    mockGetUsageCounters.mockResolvedValue({ tasks: 6 });
    defaultMaybeSingle.mockResolvedValue({
      data: { plan: 'free', max_ai_generations_per_month: 20, max_creative_assets: 50, max_content_items: 30 },
      error: null,
    });

    const { incrementUsage } = await import('@/lib/usage/quotas');
    await incrementUsage('ws-1', 'tasks', 1);

    expect(mockIncrementUsageCounter).toHaveBeenCalledWith('ws-1', 'tasks', 1);
  });

  it('incrementUsage throws when counter update fails', async () => {
    mockIncrementUsageCounter.mockRejectedValueOnce(new Error('DB write failed'));

    const { incrementUsage } = await import('@/lib/usage/quotas');
    await expect(incrementUsage('ws-1', 'tasks', 1)).rejects.toThrow('DB write failed');
  });
});
