/**
 * Orchestrator Monitoring
 *
 * Real-time monitoring for workflow executions.
 * Provides metrics, health checks, and alerting.
 *
 * Features:
 * - Execution metrics (success rate, duration, cost)
 * - Health checks for n8n, Redis, BullMQ
 * - Alert thresholds and notifications
 * - Performance dashboards
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getN8nReadiness } from '@/lib/n8n';
import { redis } from '@/lib/queue/redis';

const monitorLog = logger.child('orchestrator:monitor');

// ─── Types ──────────────────────────────────────────────────────────

export interface OrchestratorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    n8n: ComponentHealth;
    redis: ComponentHealth;
    database: ComponentHealth;
    queue: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successRate: number;
  averageDurationMs: number;
  averageCostUsd: number;
  totalCostUsd: number;
  byMode: Record<string, { count: number; successRate: number }>;
  byAgentType: Record<string, { count: number; successRate: number }>;
  period: { from: string; to: string };
}

export interface AlertConfig {
  type: 'success_rate' | 'cost' | 'duration' | 'error_rate';
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  enabled: boolean;
}

// ─── Health Checks ──────────────────────────────────────────────────

/**
 * Check the health of all orchestrator components.
 */
export async function checkOrchestratorHealth(): Promise<OrchestratorHealth> {
  const timestamp = new Date().toISOString();

  // Check n8n
  const n8nStart = Date.now();
  let n8nHealth: ComponentHealth;
  try {
    const readiness = await getN8nReadiness();
    n8nHealth = {
      status: readiness.canExecute ? 'healthy' : 'degraded',
      latencyMs: Date.now() - n8nStart,
      message: readiness.message,
    };
  } catch (err) {
    n8nHealth = {
      status: 'unhealthy',
      latencyMs: Date.now() - n8nStart,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // Check Redis
  const redisStart = Date.now();
  let redisHealth: ComponentHealth;
  try {
    await redis.ping();
    redisHealth = {
      status: 'healthy',
      latencyMs: Date.now() - redisStart,
    };
  } catch (err) {
    redisHealth = {
      status: 'unhealthy',
      latencyMs: Date.now() - redisStart,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // Check Database
  const dbStart = Date.now();
  let dbHealth: ComponentHealth;
  try {
    const { client: supabase } = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('tasks').select('id').limit(1);
      dbHealth = {
        status: 'healthy',
        latencyMs: Date.now() - dbStart,
      };
    } else {
      dbHealth = {
        status: 'degraded',
        message: 'Supabase not configured',
      };
    }
  } catch (err) {
    dbHealth = {
      status: 'unhealthy',
      latencyMs: Date.now() - dbStart,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // Check Queue (Redis-based)
  const queueHealth: ComponentHealth = {
    status: redisHealth.status,
    latencyMs: redisHealth.latencyMs,
    message: redisHealth.status === 'healthy' ? 'Queue operational' : 'Queue unavailable',
  };

  // Overall status
  const components = { n8n: n8nHealth, redis: redisHealth, database: dbHealth, queue: queueHealth };
  const statuses = Object.values(components).map((c) => c.status);

  let status: OrchestratorHealth['status'] = 'healthy';
  if (statuses.includes('unhealthy')) {
    status = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    status = 'degraded';
  }

  return { status, timestamp, components };
}

// ─── Execution Metrics ──────────────────────────────────────────────

/**
 * Get execution metrics for a workspace over a time period.
 */
export async function getExecutionMetrics(
  workspaceId: string,
  days: number = 7
): Promise<ExecutionMetrics> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return getDefaultMetrics(days);
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('agent_type, status, created_at, completed_at, result')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since.toISOString());

    const totalExecutions = tasks?.length ?? 0;
    const completedTasks = tasks?.filter((t) => t.status === 'completed') ?? [];
    const successRate = totalExecutions > 0
      ? (completedTasks.length / totalExecutions) * 100
      : 0;

    // Calculate average duration
    const durations = completedTasks
      .filter((t) => t.completed_at)
      .map((t) => new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime());
    const averageDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Calculate costs from results
    const costs = tasks?.map((t) => {
      const result = (t.result ?? {}) as Record<string, unknown>;
      return typeof result.cost_usd === 'number' ? result.cost_usd : 0;
    }) ?? [];
    const totalCostUsd = costs.reduce((a, b) => a + b, 0);
    const averageCostUsd = totalExecutions > 0 ? totalCostUsd / totalExecutions : 0;

    // Group by agent type
    const byAgentType: Record<string, { count: number; successRate: number }> = {};
    const agentTypeCounts = new Map<string, { total: number; completed: number }>();

    for (const task of tasks ?? []) {
      const current = agentTypeCounts.get(task.agent_type) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (task.status === 'completed') current.completed += 1;
      agentTypeCounts.set(task.agent_type, current);
    }

    for (const [agentType, counts] of agentTypeCounts) {
      byAgentType[agentType] = {
        count: counts.total,
        successRate: counts.total > 0 ? (counts.completed / counts.total) * 100 : 0,
      };
    }

    return {
      totalExecutions,
      successRate,
      averageDurationMs,
      averageCostUsd,
      totalCostUsd,
      byMode: { n8n: { count: totalExecutions, successRate } },
      byAgentType,
      period: {
        from: since.toISOString(),
        to: new Date().toISOString(),
      },
    };
  } catch (err) {
    monitorLog.error('Failed to get execution metrics', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return getDefaultMetrics(days);
  }
}

function getDefaultMetrics(days: number): ExecutionMetrics {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return {
    totalExecutions: 0,
    successRate: 0,
    averageDurationMs: 0,
    averageCostUsd: 0,
    totalCostUsd: 0,
    byMode: {},
    byAgentType: {},
    period: { from: since.toISOString(), to: new Date().toISOString() },
  };
}

// ─── Alert Evaluation ───────────────────────────────────────────────

/**
 * Evaluate alert conditions against current metrics.
 */
export function evaluateAlerts(
  metrics: ExecutionMetrics,
  alerts: AlertConfig[]
): Array<{ alert: AlertConfig; triggered: boolean; currentValue: number }> {
  return alerts.map((alert) => {
    let currentValue: number;

    switch (alert.type) {
      case 'success_rate':
        currentValue = metrics.successRate;
        break;
      case 'cost':
        currentValue = metrics.totalCostUsd;
        break;
      case 'duration':
        currentValue = metrics.averageDurationMs;
        break;
      case 'error_rate':
        currentValue = 100 - metrics.successRate;
        break;
      default:
        currentValue = 0;
    }

    let triggered = false;
    switch (alert.operator) {
      case 'gt':
        triggered = currentValue > alert.threshold;
        break;
      case 'lt':
        triggered = currentValue < alert.threshold;
        break;
      case 'gte':
        triggered = currentValue >= alert.threshold;
        break;
      case 'lte':
        triggered = currentValue <= alert.threshold;
        break;
    }

    return { alert, triggered, currentValue };
  });
}

// ─── Performance Report ─────────────────────────────────────────────

export interface PerformanceReport {
  generatedAt: string;
  health: OrchestratorHealth;
  metrics: ExecutionMetrics;
  alerts: Array<{ alert: AlertConfig; triggered: boolean; currentValue: number }>;
  recommendations: string[];
}

/**
 * Generate a comprehensive performance report.
 */
export async function generatePerformanceReport(
  workspaceId: string,
  days: number = 7
): Promise<PerformanceReport> {
  const [health, metrics] = await Promise.all([
    checkOrchestratorHealth(),
    getExecutionMetrics(workspaceId, days),
  ]);

  // Default alerts
  const defaultAlerts: AlertConfig[] = [
    { type: 'success_rate', threshold: 90, operator: 'lt', enabled: true },
    { type: 'cost', threshold: 10, operator: 'gt', enabled: true },
    { type: 'duration', threshold: 300000, operator: 'gt', enabled: true }, // 5 min
    { type: 'error_rate', threshold: 10, operator: 'gt', enabled: true },
  ];

  const alertResults = evaluateAlerts(metrics, defaultAlerts);

  // Generate recommendations
  const recommendations: string[] = [];

  if (metrics.successRate < 90) {
    recommendations.push('Success rate is below 90%. Review failed executions for patterns.');
  }

  if (metrics.averageDurationMs > 300000) {
    recommendations.push('Average execution time exceeds 5 minutes. Consider optimizing prompts or splitting workflows.');
  }

  if (metrics.totalCostUsd > 50) {
    recommendations.push('Total cost exceeds $50. Review workflow efficiency and consider using smaller models.');
  }

  if (health.status !== 'healthy') {
    recommendations.push(`System health is ${health.status}. Check component status.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    health,
    metrics,
    alerts: alertResults,
    recommendations,
  };
}
