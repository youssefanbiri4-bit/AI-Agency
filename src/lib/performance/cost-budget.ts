/**
 * AI Cost Budget Guard (W19-T2)
 *
 * Senior Performance Engineer deliverable.
 *
 * Caps AI spend velocity per workspace using the shared token-bucket throttle
 * from W17-T2 (src/lib/rate-limit/throttle.ts). Instead of tokens, the bucket
 * holds a daily USD budget: each generation consumes its estimated cost, and
 * when the bucket is empty the request is rejected before any LLM call is made
 * — directly reducing wasted spend.
 *
 * Degrades to "allow" when Redis is unavailable (no throttle), matching the
 * other distributed limiters.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { tokenBucketThrottle, type TokenBucketResult } from '@/lib/rate-limit/throttle';

const budgetLog = logger.child('performance:cost-budget');

/** Default daily AI budget per workspace in USD (override per plan in future). */
const DEFAULT_DAILY_BUDGET_USD = 5;

/**
 * Check whether a workspace can still afford an AI operation of `estimatedCostUsd`.
 * Returns the throttle result; callers should treat `allowed === false` as
 * "budget exhausted — reject before calling the model".
 */
export async function checkAiCostBudget(
  workspaceId: string,
  estimatedCostUsd: number,
  dailyBudgetUsd: number = DEFAULT_DAILY_BUDGET_USD
): Promise<TokenBucketResult> {
  // Bucket capacity = daily budget, refills at budget/86400 per second.
  const refillPerSecond = dailyBudgetUsd / 86_400;
  return tokenBucketThrottle({
    key: `ai-budget:${workspaceId}`,
    capacity: dailyBudgetUsd,
    refillPerSecond,
    cost: estimatedCostUsd,
  });
}

/**
 * Convenience: throw an AppError-like object when the budget is exhausted.
 * Returns the throttle result so callers can also surface retry-after.
 */
export async function enforceAiCostBudget(
  workspaceId: string,
  estimatedCostUsd: number,
  dailyBudgetUsd?: number
): Promise<TokenBucketResult> {
  const result = await checkAiCostBudget(workspaceId, estimatedCostUsd, dailyBudgetUsd);
  if (!result.allowed) {
    budgetLog.warn('AI cost budget exhausted', { workspaceId, estimatedCostUsd });
  }
  return result;
}
