import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextWithOpenAIMock = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/monitoring/metrics', () => ({
  increment: vi.fn(),
  timing: vi.fn(),
}));

vi.mock('@/lib/ai/text-provider', () => ({
  generateTextWithOpenAI: (...args: unknown[]) => generateTextWithOpenAIMock(...args),
}));

vi.mock('@/lib/memory/short-term', () => ({
  getShortTermMemory: vi.fn(async () => ({
    runId: 'r',
    workspaceId: 'w',
    agentType: 'a',
    messages: [],
    scratchpad: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ttlSeconds: 10,
  })),
}));

describe('CoT planner', () => {
  beforeEach(() => {
    generateTextWithOpenAIMock.mockReset();
  });

  it('parses LLM JSON into ordered steps with dependencies', async () => {
    generateTextWithOpenAIMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        steps: [
          { title: 'Research', description: 'd', rationale: 'r', kind: 'reasoning' },
          { title: 'Draft', description: 'd', rationale: 'r', kind: 'action', requiresApproval: true },
        ],
      }),
    });

    const { createPlan } = await import('./planner');
    const plan = await createPlan({
      runId: 'run1',
      workspaceId: 'ws1',
      agentType: 'seo',
      goal: 'Write a blog post',
    });

    expect(plan.strategy).toBe('cot');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].kind).toBe('reasoning');
    expect(plan.steps[1].kind).toBe('action');
    expect(plan.steps[1].requiresApproval).toBe(true);
    expect(plan.steps[1].dependsOn).toEqual([plan.steps[0].id]);
  });

  it('falls back to a deterministic plan when the LLM fails', async () => {
    generateTextWithOpenAIMock.mockResolvedValue({ ok: false, error: 'boom' });

    const { createPlan } = await import('./planner');
    const plan = await createPlan({
      runId: 'run2',
      workspaceId: 'ws2',
      agentType: 'ads',
      goal: 'Launch campaign',
    });

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.every((s) => s.status === 'pending')).toBe(true);
  });
});
