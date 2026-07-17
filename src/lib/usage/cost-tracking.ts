/**
 * Cost Tracking for OpenAI + n8n executions
 *
 * Estimates costs in USD for AI generations and workflow executions.
 * Used together with quotas for cost awareness and hard/soft limits.
 *
 * Pricing based on current OpenAI rates (approximate as of 2026):
 * - GPT-4o: ~$2.50 / 1M input tokens, $10 / 1M output
 * - DALL-E 3: $0.04 - $0.12 per image depending on size/quality
 * - n8n execution: estimated $0.001 - $0.01 per run (infra cost)
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const costLog = logger.child('usage:cost');

export interface WorkspaceCostBreakdown {
  totalCost: number;
  openaiCost: number;
  n8nCost: number;
  totalTokens: number;
  operations: number;
  since: string;
  until: string;
}

export interface CostEstimate {
  estimatedCostUsd: number;
  breakdown: {
    openai?: number;
    n8n?: number;
    other?: number;
  };
  tokensUsed?: number;
  model?: string;
}

export interface CostRecordInput {
  workspaceId: string;
  operationType: 'image_generation' | 'text_generation' | 'task_execution' | 'reel_generation' | 'video_generation' | 'orchestrator_tool';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  n8nExecutions?: number;
  metadata?: Record<string, unknown>;
}

// Approximate pricing (update as needed)
const PRICING = {
  'gpt-4o': { input: 0.0025 / 1000, output: 0.01 / 1000 }, // per 1k tokens
  'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  'dall-e-3': 0.08, // standard image ~$0.04-$0.12
  'dall-e-2': 0.02,
  n8n: 0.002, // per execution
};

export function estimateOpenAICost(
  model: string = 'gpt-4o',
  inputTokens: number = 0,
  outputTokens: number = 0,
  imageCount: number = 0
): number {
  let cost = 0;

  if (model.includes('gpt')) {
    const rates = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o'];
    if (typeof rates === 'object' && rates !== null && 'input' in rates && 'output' in rates) {
      cost += (inputTokens / 1000) * rates.input;
      cost += (outputTokens / 1000) * rates.output;
    }
  }

  if (model.includes('dall-e') || imageCount > 0) {
    const imagePrice = PRICING[model as keyof typeof PRICING] || PRICING['dall-e-3'];
    cost += imageCount * (typeof imagePrice === 'number' ? imagePrice : 0.04);
  }

  return Math.round(cost * 10000) / 10000; // 4 decimal precision
}

/**
 * Estimate cost for Anthropic Claude API usage.
 * Based on Claude 3.5 Sonnet pricing (approximate as of 2026):
 * - Input: $3 / 1M tokens ($0.003 / 1k tokens)
 * - Output: $15 / 1M tokens ($0.015 / 1k tokens)
 */
export function estimateClaudeCost(
  inputTokens: number = 0,
  outputTokens: number = 0,
): number {
  // Per-token rates: $3/1M input, $15/1M output
  const CLAUDE_INPUT_RATE = 0.000003;  // $3 / 1M tokens
  const CLAUDE_OUTPUT_RATE = 0.000015; // $15 / 1M tokens

  const cost = inputTokens * CLAUDE_INPUT_RATE + outputTokens * CLAUDE_OUTPUT_RATE;

  return Math.round(cost * 10000) / 10000; // 4 decimal precision
}

export function estimateN8nCost(executions: number = 1): number {
  return executions * PRICING.n8n;
}

export function estimateTotalCost(params: {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  n8nExecutions?: number;
}): CostEstimate {
  const {
    model = 'gpt-4o',
    inputTokens = 0,
    outputTokens = 0,
    imageCount = 0,
    n8nExecutions = 0,
  } = params;

  const openai = estimateOpenAICost(model, inputTokens, outputTokens, imageCount);
  const n8n = estimateN8nCost(n8nExecutions);

  const total = openai + n8n;

  return {
    estimatedCostUsd: Math.max(0, total),
    breakdown: {
      openai: openai > 0 ? openai : undefined,
      n8n: n8n > 0 ? n8n : undefined,
    },
    tokensUsed: inputTokens + outputTokens,
    model,
  };
}

/**
 * Record cost — persists a row to `usage_costs` (W19-T2 migration) and emits a
 * cost metric. Falls back to logging only when the admin client is unavailable.
 */
export async function recordCost(input: CostRecordInput): Promise<CostEstimate> {
  const estimate = estimateTotalCost({
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    imageCount: input.imageCount,
    n8nExecutions: input.n8nExecutions,
  });

  costLog.info('Cost recorded', {
    workspaceId: input.workspaceId,
    operation: input.operationType,
    estimate,
    metadata: input.metadata,
  });

  try {
    const { client, error } = getSupabaseAdmin();
    if (client && !error) {
      await client.from('usage_costs').insert({
        workspace_id: input.workspaceId,
        user_id: (input.metadata?.userId as string) ?? null,
        operation_type: input.operationType,
        model: input.model ?? null,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        image_count: input.imageCount ?? 0,
        n8n_executions: input.n8nExecutions ?? 0,
        estimated_cost_usd: estimate.estimatedCostUsd,
      });
    }
  } catch (err) {
    costLog.warn('Failed to persist cost row', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return estimate;
}

/**
 * Aggregate a workspace's estimated cost over a date range using the
 * `sum_workspace_cost()` server function (single round-trip, no JS loop).
 */
export async function getWorkspaceCostBreakdown(
  workspaceId: string,
  sinceDays = 30
): Promise<WorkspaceCostBreakdown> {
  const until = new Date();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const { client, error } = getSupabaseAdmin();
    if (client && !error) {
      const { data, error: rpcError } = await client
        .rpc('sum_workspace_cost', {
          p_workspace_id: workspaceId,
          p_since: since.toISOString(),
          p_until: until.toISOString(),
        })
        .single();

      if (!rpcError && data) {
        const row = data as unknown as {
          total_cost: number;
          openai_cost: number;
          n8n_cost: number;
          total_tokens: number;
          operations: number;
        };
        return {
          totalCost: Number(row.total_cost ?? 0),
          openaiCost: Number(row.openai_cost ?? 0),
          n8nCost: Number(row.n8n_cost ?? 0),
          totalTokens: Number(row.total_tokens ?? 0),
          operations: Number(row.operations ?? 0),
          since: since.toISOString(),
          until: until.toISOString(),
        };
      }
    }
  } catch (err) {
    costLog.warn('Cost aggregation failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Fallback: sum creative_assets estimated_cost_usd (legacy path).
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase-server');
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('creative_assets')
      .select('estimated_cost_usd')
      .eq('workspace_id', workspaceId)
      .not('estimated_cost_usd', 'is', null);

    if (data) {
      const sum = data.reduce((acc, row) => acc + (row.estimated_cost_usd || 0), 0);
      return {
        totalCost: Math.round(sum * 100) / 100,
        openaiCost: Math.round(sum * 100) / 100,
        n8nCost: 0,
        totalTokens: 0,
        operations: data.length,
        since: since.toISOString(),
        until: until.toISOString(),
      };
    }
  } catch {
    costLog.warn('Could not sum costs', { workspaceId });
  }

  return {
    totalCost: 0,
    openaiCost: 0,
    n8nCost: 0,
    totalTokens: 0,
    operations: 0,
    since: since.toISOString(),
    until: until.toISOString(),
  };
}

/**
 * @deprecated Use getWorkspaceCostBreakdown for richer data. Kept for backward
 * compatibility; now delegates to the cost aggregation.
 */
export async function getEstimatedTotalCostForWorkspace(workspaceId: string): Promise<number> {
  const breakdown = await getWorkspaceCostBreakdown(workspaceId, 30);
  return Math.round(breakdown.totalCost * 100) / 100;
}
