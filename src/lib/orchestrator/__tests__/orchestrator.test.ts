/**
 * Orchestrator Integration Tests
 *
 * Comprehensive test suite for multi-step workflow execution.
 * Tests the unified orchestrator, playbook executor, and cost control.
 *
 * Run: npx jest src/lib/orchestrator/__tests__/orchestrator.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validatePlaybook,
  type PlaybookDefinition,
} from '../playbook-executor';

// ─── Playbook Validation Tests ──────────────────────────────────────

describe('Playbook Validation', () => {
  const basePlaybook: PlaybookDefinition = {
    id: 'test-playbook',
    name: 'Test Playbook',
    workspaceId: 'ws-123',
    steps: [
      {
        id: 'step-1',
        agentType: 'market_research',
        name: 'Research',
        prompt: 'Research the market for AI tools',
        dependsOn: [],
      },
      {
        id: 'step-2',
        agentType: 'content_writer',
        name: 'Write Content',
        prompt: 'Write content based on the research',
        dependsOn: ['step-1'],
      },
    ],
  };

  it('should validate a correct playbook', () => {
    const result = validatePlaybook(basePlaybook);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty playbook', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Playbook has no steps');
  });

  it('should detect circular dependencies', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research',
          prompt: 'Research',
          dependsOn: ['step-2'],
        },
        {
          id: 'step-2',
          agentType: 'content_writer',
          name: 'Write',
          prompt: 'Write',
          dependsOn: ['step-1'],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Circular dependency'))).toBe(true);
  });

  it('should detect unknown dependencies', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research',
          prompt: 'Research',
          dependsOn: ['nonexistent-step'],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown step'))).toBe(true);
  });

  it('should detect duplicate step IDs', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research 1',
          prompt: 'Research 1',
          dependsOn: [],
        },
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research 2',
          prompt: 'Research 2',
          dependsOn: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate step ID'))).toBe(true);
  });

  it('should warn about short prompts', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research',
          prompt: 'Hi',
          dependsOn: [],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('short prompt'))).toBe(true);
  });

  it('should warn about many steps', () => {
    const steps = Array.from({ length: 15 }, (_, i) => ({
      id: `step-${i}`,
      agentType: 'market_research',
      name: `Step ${i}`,
      prompt: `This is step ${i} with a sufficiently long prompt for validation`,
      dependsOn: i > 0 ? [`step-${i - 1}`] : [],
    }));

    const result = validatePlaybook({
      ...basePlaybook,
      steps,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('more than 10 steps'))).toBe(true);
  });

  it('should handle diamond dependency graph', () => {
    const result = validatePlaybook({
      ...basePlaybook,
      steps: [
        {
          id: 'step-1',
          agentType: 'market_research',
          name: 'Research',
          prompt: 'Research the market thoroughly',
          dependsOn: [],
        },
        {
          id: 'step-2a',
          agentType: 'competitor_analysis',
          name: 'Analyze Competitors',
          prompt: 'Analyze competitor products and strategies',
          dependsOn: ['step-1'],
        },
        {
          id: 'step-2b',
          agentType: 'content_writer',
          name: 'Write Draft',
          prompt: 'Write initial content draft',
          dependsOn: ['step-1'],
        },
        {
          id: 'step-3',
          agentType: 'content_editor',
          name: 'Review & Edit',
          prompt: 'Review and edit the content',
          dependsOn: ['step-2a', 'step-2b'],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Cost Control Tests ─────────────────────────────────────────────

describe('Cost Control', () => {
  it('should enforce daily budget limits', async () => {
    // Mock Supabase
    vi.mock('@/lib/supabase-server', () => ({
      getSupabaseAdmin: () => ({
        client: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: { plan: 'free' },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }),
    }));

    const { canAfford } = await import('../cost-control');
    const result = await canAfford('ws-123', 2.0);

    // Free plan has $1/day limit
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily budget');
  });

  it('should allow affordable operations', async () => {
    vi.mock('@/lib/supabase-server', () => ({
      getSupabaseAdmin: () => ({
        client: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => ({
                  data: { plan: 'pro' },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }),
    }));

    const { canAfford } = await import('../cost-control');
    const result = await canAfford('ws-123', 0.50);

    // Pro plan has $10/day limit
    expect(result.allowed).toBe(true);
  });
});

// ─── Workflow Type Tests ────────────────────────────────────────────

describe('Workflow Types', () => {
  it('should have correct execution mode types', async () => {
    const { executeUnifiedWorkflow } = await import('../unified-orchestrator');
    expect(typeof executeUnifiedWorkflow).toBe('function');
  });

  it('should have correct playbook executor', async () => {
    const { executePlaybook, loadPlaybook } = await import('../playbook-executor');
    expect(typeof executePlaybook).toBe('function');
    expect(typeof loadPlaybook).toBe('function');
  });

  it('should have correct monitoring functions', async () => {
    const { checkOrchestratorHealth, getExecutionMetrics, evaluateAlerts } = await import('../monitoring');
    expect(typeof checkOrchestratorHealth).toBe('function');
    expect(typeof getExecutionMetrics).toBe('function');
    expect(typeof evaluateAlerts).toBe('function');
  });
});

// ─── Alert Evaluation Tests ─────────────────────────────────────────

describe('Alert Evaluation', () => {
  it('should trigger success rate alert', async () => {
    const { evaluateAlerts } = await import('../monitoring');

    const metrics = {
      totalExecutions: 100,
      successRate: 85,
      averageDurationMs: 120000,
      averageCostUsd: 0.05,
      totalCostUsd: 5,
      byMode: {},
      byAgentType: {},
      period: { from: '2026-01-01', to: '2026-01-07' },
    };

    const alerts = [
      { type: 'success_rate' as const, threshold: 90, operator: 'lt' as const, enabled: true },
    ];

    const results = evaluateAlerts(metrics, alerts);
    expect(results[0].triggered).toBe(true);
    expect(results[0].currentValue).toBe(85);
  });

  it('should not trigger when threshold not met', async () => {
    const { evaluateAlerts } = await import('../monitoring');

    const metrics = {
      totalExecutions: 100,
      successRate: 95,
      averageDurationMs: 120000,
      averageCostUsd: 0.05,
      totalCostUsd: 5,
      byMode: {},
      byAgentType: {},
      period: { from: '2026-01-01', to: '2026-01-07' },
    };

    const alerts = [
      { type: 'success_rate' as const, threshold: 90, operator: 'lt' as const, enabled: true },
    ];

    const results = evaluateAlerts(metrics, alerts);
    expect(results[0].triggered).toBe(false);
  });
});
