import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextWithOpenAIMock = vi.fn();
const storeMemoryMock = vi.fn();

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

vi.mock('@/lib/memory/long-term', () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
}));

describe('multi-step reasoning', () => {
  beforeEach(() => {
    generateTextWithOpenAIMock.mockReset();
    storeMemoryMock.mockReset();
  });

  it('builds a reasoning chain and verifies when evidence supports it', async () => {
    generateTextWithOpenAIMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        nodes: [
          { type: 'evidence', content: 'Metric X is up 20%', confidence: 0.9 },
          { type: 'hypothesis', content: 'Campaign drove X', confidence: 0.7, supports: [0] },
          { type: 'conclusion', content: 'Campaign was effective', confidence: 0.8, supports: [1] },
        ],
        conclusion: 'Campaign was effective',
        verified: true,
      }),
    });

    const { reason } = await import('./reasoning');
    const chain = await reason({
      runId: 'r1',
      workspaceId: 'ws1',
      agentType: 'growth',
      goal: 'Was the campaign effective?',
      evidence: ['Metric X is up 20%'],
      persist: true,
    });

    expect(chain.verified).toBe(true);
    expect(chain.conclusion).toBe('Campaign was effective');
    expect(chain.nodes).toHaveLength(3);
    // Verified + persist => writes to semantic memory.
    expect(storeMemoryMock).toHaveBeenCalledTimes(1);
    expect(storeMemoryMock.mock.calls[0][0].memoryType).toBe('semantic');
  });

  it('does not persist unverified conclusions', async () => {
    generateTextWithOpenAIMock.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        nodes: [{ type: 'assumption', content: 'guess', confidence: 0.3 }],
        conclusion: null,
        verified: false,
      }),
    });

    const { reason } = await import('./reasoning');
    const chain = await reason({
      runId: 'r2',
      workspaceId: 'ws2',
      agentType: 'growth',
      goal: 'Why?',
      persist: true,
    });

    expect(chain.verified).toBe(false);
    expect(storeMemoryMock).not.toHaveBeenCalled();
  });
});
