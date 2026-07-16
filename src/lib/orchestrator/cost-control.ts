/**
 * Cost Control for Orchestrator
 *
 * Provides budget management, cost tracking, and enforcement
 * for workflow executions at the workspace level.
 *
 * Features:
 * - Daily/monthly budget limits per workspace
 * - Real-time cost tracking during execution
 * - Automatic budget enforcement (hard stop)
 * - Cost alerts and notifications
 * - Plan-based limits (free/pro/enterprise)
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const costLog = logger.child('orchestrator:cost-control');

// ─── Types ──────────────────────────────────────────────────────────

export interface CostBudget {
  workspaceId: string;
  /** Daily limit in USD */
  dailyLimitUsd: number;
  /** Monthly limit in USD */
  monthlyLimitUsd: number;
  /** Current day cost */
  currentDayCostUsd: number;
  /** Current month cost */
  currentMonthCostUsd: number;
  /** Alert threshold (percentage, e.g. 80 = alert at 80%) */
  alertThresholdPercent: number;
  /** Whether hard limit is enabled */
  hardLimitEnabled: boolean;
}

export interface CostRecord {
  id: string;
  workspaceId: string;
  executionId: string;
  operationType: string;
  costUsd: number;
  model?: string;
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CostAlert {
  type: 'warning' | 'critical' | 'exceeded';
  message: string;
  currentCost: number;
  limit: number;
  percentage: number;
}

// ─── Plan-Based Limits ──────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { dailyUsd: number; monthlyUsd: number }> = {
  free: { dailyUsd: 1.0, monthlyUsd: 10.0 },
  pro: { dailyUsd: 10.0, monthlyUsd: 100.0 },
  enterprise: { dailyUsd: 50.0, monthlyUsd: 500.0 },
};

/**
 * Get the default budget for a workspace based on its plan.
 */
function getDefaultBudget(workspaceId: string, plan: string): CostBudget {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return {
    workspaceId,
    dailyLimitUsd: limits.dailyUsd,
    monthlyLimitUsd: limits.monthlyUsd,
    currentDayCostUsd: 0,
    currentMonthCostUsd: 0,
    alertThresholdPercent: 80,
    hardLimitEnabled: true,
  };
}

// ─── Budget Management ──────────────────────────────────────────────

/**
 * Get the cost budget for a workspace.
 */
export async function getWorkspaceCostBudget(
  workspaceId: string
): Promise<CostBudget> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return getDefaultBudget(workspaceId, 'free');
  }

  try {
    // Get workspace plan
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('plan')
      .eq('id', workspaceId)
      .single();

    const plan = (workspace as unknown as { plan?: string })?.plan ?? 'free';
    const defaults = getDefaultBudget(workspaceId, plan);

    // Get today's cost
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayCosts } = await supabase
      .from('usage_events')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .gte('created_at', today.toISOString());

    const currentDayCostUsd = (todayCosts ?? []).reduce((sum, event) => {
      const cost = (event.metadata as Record<string, unknown>)?.cost_usd;
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);

    // Get this month's cost
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: monthCosts } = await supabase
      .from('usage_events')
      .select('metadata')
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStart.toISOString());

    const currentMonthCostUsd = (monthCosts ?? []).reduce((sum, event) => {
      const cost = (event.metadata as Record<string, unknown>)?.cost_usd;
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);

    return {
      ...defaults,
      currentDayCostUsd,
      currentMonthCostUsd,
    };
  } catch (err) {
    costLog.error('Failed to get workspace budget', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return getDefaultBudget(workspaceId, 'free');
  }
}

/**
 * Check if a workspace can afford a given cost.
 */
export async function canAfford(
  workspaceId: string,
  estimatedCostUsd: number
): Promise<{ allowed: boolean; reason?: string; alert?: CostAlert }> {
  const budget = await getWorkspaceCostBudget(workspaceId);

  // Check daily limit
  if (budget.hardLimitEnabled) {
    if (budget.currentDayCostUsd + estimatedCostUsd > budget.dailyLimitUsd) {
      return {
        allowed: false,
        reason: `Daily budget exceeded: $${(budget.currentDayCostUsd + estimatedCostUsd).toFixed(2)} > $${budget.dailyLimitUsd.toFixed(2)}`,
      };
    }

    if (budget.currentMonthCostUsd + estimatedCostUsd > budget.monthlyLimitUsd) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded: $${(budget.currentMonthCostUsd + estimatedCostUsd).toFixed(2)} > $${budget.monthlyLimitUsd.toFixed(2)}`,
      };
    }
  }

  // Check alert threshold
  const dayPercentage = (budget.currentDayCostUsd / budget.dailyLimitUsd) * 100;
  const monthPercentage = (budget.currentMonthCostUsd / budget.monthlyLimitUsd) * 100;

  if (dayPercentage >= 100) {
    return {
      allowed: budget.hardLimitEnabled ? false : true,
      reason: budget.hardLimitEnabled ? 'Daily budget exceeded' : undefined,
      alert: {
        type: 'exceeded',
        message: `Daily budget exceeded: $${budget.currentDayCostUsd.toFixed(2)} / $${budget.dailyLimitUsd.toFixed(2)}`,
        currentCost: budget.currentDayCostUsd,
        limit: budget.dailyLimitUsd,
        percentage: dayPercentage,
      },
    };
  }

  if (dayPercentage >= budget.alertThresholdPercent) {
    return {
      allowed: true,
      alert: {
        type: 'critical',
        message: `Daily budget at ${dayPercentage.toFixed(0)}%: $${budget.currentDayCostUsd.toFixed(2)} / $${budget.dailyLimitUsd.toFixed(2)}`,
        currentCost: budget.currentDayCostUsd,
        limit: budget.dailyLimitUsd,
        percentage: dayPercentage,
      },
    };
  }

  if (monthPercentage >= budget.alertThresholdPercent) {
    return {
      allowed: true,
      alert: {
        type: 'warning',
        message: `Monthly budget at ${monthPercentage.toFixed(0)}%: $${budget.currentMonthCostUsd.toFixed(2)} / $${budget.monthlyLimitUsd.toFixed(2)}`,
        currentCost: budget.currentMonthCostUsd,
        limit: budget.monthlyLimitUsd,
        percentage: monthPercentage,
      },
    };
  }

  return { allowed: true };
}

// ─── Cost Recording ─────────────────────────────────────────────────

/**
 * Record a cost event for a workflow execution.
 */
export async function recordWorkflowCost(record: {
  workspaceId: string;
  executionId: string;
  operationType: string;
  costUsd: number;
  model?: string;
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return;

  try {
    await supabase.from('usage_events').insert({
      workspace_id: record.workspaceId,
      event_type: record.operationType,
      quota_type: 'cost',
      metadata: {
        execution_id: record.executionId,
        cost_usd: record.costUsd,
        model: record.model ?? null,
        tokens_used: record.tokensUsed ?? null,
        ...record.metadata,
      },
    });

    costLog.info('Recorded workflow cost', {
      workspaceId: record.workspaceId,
      executionId: record.executionId,
      costUsd: record.costUsd,
    });
  } catch (err) {
    costLog.error('Failed to record workflow cost', {
      workspaceId: record.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Cost Summary ───────────────────────────────────────────────────

export interface CostSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  byAgentType: Record<string, number>;
  byModel: Record<string, number>;
}

/**
 * Get a cost summary for a workspace.
 */
export async function getCostSummary(
  workspaceId: string,
  days: number = 30
): Promise<CostSummary> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return { today: 0, thisWeek: 0, thisMonth: 0, total: 0, byAgentType: {}, byModel: {} };
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: events } = await supabase
      .from('usage_events')
      .select('event_type, metadata, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since.toISOString());

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let total = 0;
    const byAgentType: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const event of events ?? []) {
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      const cost = typeof meta.cost_usd === 'number' ? meta.cost_usd : 0;
      const createdAt = new Date(event.created_at);

      total += cost;

      if (createdAt >= todayStart) today += cost;
      if (createdAt >= weekStart) thisWeek += cost;
      if (createdAt >= monthStart) thisMonth += cost;

      const agentType = typeof meta.agent_type === 'string' ? meta.agent_type : 'unknown';
      byAgentType[agentType] = (byAgentType[agentType] ?? 0) + cost;

      const model = typeof meta.model === 'string' ? meta.model : 'unknown';
      byModel[model] = (byModel[model] ?? 0) + cost;
    }

    return { today, thisWeek, thisMonth, total, byAgentType, byModel };
  } catch (err) {
    costLog.error('Failed to get cost summary', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { today: 0, thisWeek: 0, thisMonth: 0, total: 0, byAgentType: {}, byModel: {} };
  }
}
