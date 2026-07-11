import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Supabase server client before importing the gate
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

vi.mock('@/lib/production-readiness', () => ({
  getProductionReadiness: vi.fn().mockResolvedValue({
    overallStatus: 'ready',
    blockers: [],
    warnings: [],
    checks: [],
  }),
}));

vi.mock('@/lib/data/workspaces', () => ({
  getIntegrationSettings: vi.fn().mockResolvedValue({
    data: {
      workspace_id: 'ws-1',
      supabase_status: 'configured',
      n8n_status: 'connected',
      settings: {
        production_operations: {
          launch_mode: 'internal',
          paid_ads_enabled: false,
          max_daily_ad_spend: null,
        },
      },
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    isConfigured: true,
    error: null,
  }),
}));

describe('Production Gate - smoke tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Set all critical env vars so gate passes env check
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
    process.env.N8N_WEBHOOK_URL = 'https://n8n.example/webhook';
    process.env.APP_BASE_URL = 'https://app.example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('checkProductionGate returns green when all checks pass', async () => {
    const { checkProductionGate } = await import('@/lib/production/gate');
    const result = await checkProductionGate('ws-1');

    expect(result.passed).toBe(true);
    expect(result.status).toBe('green');
    expect(result.lightweight.envOk).toBe(true);
    expect(result.lightweight.n8nOk).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('checkProductionGate returns red when critical env vars are missing', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.SUPABASE_URL;

    const { checkProductionGate } = await import('@/lib/production/gate');
    const result = await checkProductionGate('ws-1');

    expect(result.passed).toBe(false);
    expect(result.status).toBe('red');
    expect(result.lightweight.envOk).toBe(false);
    expect(result.issues.some((i) => i.includes('env'))).toBe(true);
  });

  it('assertProductionGate throws when gate is red', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { assertProductionGate } = await import('@/lib/production/gate');
    await expect(assertProductionGate('ws-1')).rejects.toThrow('Production Gate blocked');
  });

  it('assertProductionGate does not throw when gate is green', async () => {
    const { assertProductionGate } = await import('@/lib/production/gate');
    await expect(assertProductionGate('ws-1')).resolves.toBeUndefined();
  });

  it('getGateStatusForUI returns correct status and color', async () => {
    const { getGateStatusForUI } = await import('@/lib/production/gate');
    const result = await getGateStatusForUI('ws-1');

    expect(result.status).toBe('green');
    expect(result.color).toBe('green');
    expect(result.summary).toBe('Production ready');
  });

  it('detects blocked launch mode', async () => {
    const { getIntegrationSettings } = await import('@/lib/data/workspaces');
    vi.mocked(getIntegrationSettings).mockResolvedValueOnce({
      data: {
        workspace_id: 'ws-1',
        supabase_status: 'configured',
        n8n_status: 'connected',
        settings: {
          production_operations: {
            launch_mode: 'blocked',
          },
        },
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isConfigured: true,
      error: null,
    });

    const { checkProductionGate } = await import('@/lib/production/gate');
    const result = await checkProductionGate('ws-1');

    expect(result.passed).toBe(false);
    expect(result.checks.some((c) => c.key === 'launch-mode' && c.status === 'blocked')).toBe(true);
  });
});
