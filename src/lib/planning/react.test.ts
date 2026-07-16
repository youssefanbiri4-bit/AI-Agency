import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextWithOpenAIMock = vi.fn();
const requestHumanReviewMock = vi.fn();
const storeMemoryMock = vi.fn();
const addMessageMock = vi.fn();
const getShortTermMemoryMock = vi.fn();

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
  addMessage: (...args: unknown[]) => addMessageMock(...args),
  getShortTermMemory: (...args: unknown[]) => getShortTermMemoryMock(...args),
}));

vi.mock('@/lib/memory/long-term', () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
}));

vi.mock('@/lib/human-review', () => ({
  requestHumanReview: (...args: unknown[]) => requestHumanReviewMock(...args),
}));

const blankMemory = () => ({
  runId: 'r',
  workspaceId: 'w',
  agentType: 'a',
  messages: [] as unknown[],
  scratchpad: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ttlSeconds: 10,
});

describe('ReAct engine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getShortTermMemoryMock.mockResolvedValue(blankMemory());
    storeMemoryMock.mockResolvedValue({ error: null, data: { id: 'm1' } });
  });

  it('reasons, calls a tool, observes, and finishes', async () => {
    generateTextWithOpenAIMock
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({
          thought: 'I should search',
          action: 'lookup',
          actionInput: { q: 'pricing' },
          finish: false,
          answer: '',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: JSON.stringify({
          thought: 'I have the answer',
          action: null,
          actionInput: {},
          finish: true,
          answer: 'Pricing is $20/mo',
        }),
      });

    const { runReact } = await import('./react');
    const outcome = await runReact({
      runId: 'run1',
      workspaceId: 'ws1',
      agentType: 'support',
      goal: 'What is pricing?',
      tools: [
        {
          name: 'lookup',
          description: 'look up info',
          run: async () => ({ ok: true, observation: 'found pricing' }),
        },
      ],
    });

    expect(outcome.answer).toBe('Pricing is $20/mo');
    expect(outcome.plan.status).toBe('completed');
    expect(outcome.iterations).toBe(2);
    expect(outcome.plan.steps).toHaveLength(1);
    expect(outcome.plan.steps[0].status).toBe('completed');
    expect(storeMemoryMock).toHaveBeenCalled();
  });

  it('blocks a step for human approval when a tool requests it', async () => {
    generateTextWithOpenAIMock.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({
        thought: 'publish now',
        action: 'publish',
        actionInput: {},
        finish: false,
        answer: '',
      }),
    });
    requestHumanReviewMock.mockResolvedValue({
      ok: true,
      error: null,
      data: { id: 'review-1' },
    });

    const { runReact } = await import('./react');
    const outcome = await runReact({
      runId: 'run2',
      workspaceId: 'ws2',
      agentType: 'content',
      goal: 'Publish the post',
      enableHumanReview: true,
      maxIterations: 3,
      tools: [
        {
          name: 'publish',
          description: 'publish content',
          run: async () => ({
            ok: true,
            observation: 'published',
            requiresApproval: true,
            approvalReason: 'publishing affects real users',
          }),
        },
      ],
    });

    expect(outcome.blockedOnApproval).toBe(true);
    expect(outcome.plan.status).toBe('blocked');
    expect(requestHumanReviewMock).toHaveBeenCalledTimes(1);
    expect(outcome.plan.steps[0].status).toBe('blocked');
  });

  it('marks the plan failed when the LLM is unavailable', async () => {
    generateTextWithOpenAIMock.mockResolvedValue({ ok: false, error: 'down' });

    const { runReact } = await import('./react');
    const outcome = await runReact({
      runId: 'run3',
      workspaceId: 'ws3',
      agentType: 'support',
      goal: 'do thing',
      tools: [],
    });

    expect(outcome.plan.status).toBe('failed');
  });
});
