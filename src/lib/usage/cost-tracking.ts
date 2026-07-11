/**
 * Cost Tracking for OpenAI + n8n executions
 *
 * Estimates costs in USD for AI generations and workflow executions.
 * Used together with quotas for billing awareness and hard/soft limits.
 *
 * Pricing based on current OpenAI rates (approximate as of 2026):
 * - GPT-4o: ~$2.50 / 1M input tokens, $10 / 1M output
 * - DALL-E 3: $0.04 - $0.12 per image depending on size/quality
 * - n8n execution: estimated $0.001 - $0.01 per run (infra cost)
 */

import 'server-only';

import { logger } from '@/lib/logger';

const costLog = logger.child('usage:cost');

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
  operationType: 'image_generation' | 'text_generation' | 'task_execution' | 'reel_generation' | 'video_generation';
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
 * Record cost (for future persistence, currently logs + can update usage metadata)
 * In real impl, would insert into a costs table or update usage_limits metadata.
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

  // TODO: In production, persist:
  // await supabase.from('usage_costs').insert({ ... })
  // Or increment in usage_limits.metadata.total_cost

  return estimate;
}

export async function getEstimatedTotalCostForWorkspace(workspaceId: string): Promise<number> {
  // Placeholder: in real system sum from DB.
  // For now return 0 or fetch from creative_assets estimated_cost_usd
  // We can query sum of estimated costs here if column exists.

  // For demo, we simulate from recent creative assets
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
      return Math.round(sum * 100) / 100;
    }
  } catch (e) {
    costLog.warn('Could not sum costs', { workspaceId });
  }

  return 0;
}
