/**
 * Agent Performance Analytics
 *
 * Comprehensive analytics for AI agent performance:
 * - Success rates per agent type and department
 * - Response time trends and percentiles
 * - Cost analysis per agent and workflow
 * - Quality metrics (output length, cache efficiency)
 * - Anomaly detection for degradation
 * - Historical trend analysis
 *
 * Integrates with metrics.ts, cost-tracking.ts, and the smart cache.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { increment } from '@/lib/monitoring/metrics';

const analyticsLog = logger.child('agents:analytics');

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentPerformancePeriod = '1h' | '6h' | '24h' | '7d' | '30d';

export interface AgentMetricPoint {
  timestamp: string;
  value: number;
}

export interface AgentPerformanceSummary {
  /** Agent type identifier */
  agentType: string;
  /** Human-readable name */
  agentName: string;
  /** Department */
  department: string;

  // Volume
  totalExecutions: number;
  executionsByPeriod: Record<AgentPerformancePeriod, number>;

  // Success metrics
  successRate: number;
  successRateTrend: AgentMetricPoint[];
  failureRate: number;
  topFailureReasons: Array<{ reason: string; count: number }>;

  // Performance metrics
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  durationTrend: AgentMetricPoint[];

  // Cost metrics
  totalCostUsd: number;
  avgCostPerExecution: number;
  costByModel: Array<{ model: string; cost: number }>;
  costTrend: AgentMetricPoint[];

  // Cache metrics
  cacheHitRate: number;
  cacheSavedUsd: number;

  // Quality metrics
  avgOutputLength: number;
  avgOutputLengthByModel: Array<{ model: string; avgLength: number }>;

  // Health
  healthScore: number;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  lastExecutedAt: string | null;
  consecutiveFailures: number;
}

export interface DepartmentAnalytics {
  department: string;
  totalExecutions: number;
  activeAgents: number;
  successRate: number;
  totalCostUsd: number;
  topAgents: Array<{ agentType: string; executions: number; successRate: number }>;
}

export interface AgentAnomaly {
  agentType: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  detectedAt: string;
  message: string;
}

export interface AnalyticsReport {
  summary: {
    totalExecutions: number;
    overallSuccessRate: number;
    totalCostUsd: number;
    cacheHitRate: number;
    costSavedUsd: number;
    activeAgentTypes: number;
    period: AgentPerformancePeriod;
  };
  agents: AgentPerformanceSummary[];
  departments: DepartmentAnalytics[];
  anomalies: AgentAnomaly[];
  trends: {
    executions: AgentMetricPoint[];
    successRate: AgentMetricPoint[];
    cost: AgentMetricPoint[];
    avgDuration: AgentMetricPoint[];
  };
}

// ─── Analytics Engine ────────────────────────────────────────────────────────

class AgentAnalyticsEngine {
  private executionLog: Array<{
    agentType: string;
    agentName: string;
    department: string;
    success: boolean;
    durationMs: number;
    costUsd: number;
    cached: boolean;
    model: string;
    outputLength: number;
    error?: string;
    timestamp: string;
  }> = [];

  private maxLogSize = 50000;

  /**
   * Record an agent execution for analytics.
   */
  recordExecution(input: {
    agentType: string;
    agentName: string;
    department: string;
    success: boolean;
    durationMs: number;
    costUsd: number;
    cached: boolean;
    model: string;
    outputLength: number;
    error?: string;
  }): void {
    this.executionLog.push({
      ...input,
      timestamp: new Date().toISOString(),
    });

    // Trim log if too large
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog = this.executionLog.slice(-this.maxLogSize);
    }

    // Emit metrics
    increment('agents.analytics.execution', {
      agentType: input.agentType,
      department: input.department,
      success: String(input.success),
      cached: String(input.cached),
      model: input.model,
    });
  }

  /**
   * Get all execution records for analysis.
   */
  getExecutionLog() {
    return this.executionLog;
  }

  /**
   * Filter execution records by time period.
   */
  private filterByPeriod(
    logs: typeof this.executionLog,
    period: AgentPerformancePeriod
  ): typeof this.executionLog {
    const cutoff = new Date();

    switch (period) {
      case '1h': cutoff.setHours(cutoff.getHours() - 1); break;
      case '6h': cutoff.setHours(cutoff.getHours() - 6); break;
      case '24h': cutoff.setDate(cutoff.getDate() - 1); break;
      case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
      case '30d': cutoff.setDate(cutoff.getDate() - 30); break;
    }

    return logs.filter((l) => new Date(l.timestamp) >= cutoff);
  }

  /**
   * Calculate percentile value from sorted array.
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Build trend data points from execution logs.
   */
  private buildTrend(
    logs: typeof this.executionLog,
    _period: AgentPerformancePeriod,
    valueFn: (log: typeof this.executionLog[0]) => number,
    bucketSizeMinutes: number = 60
  ): AgentMetricPoint[] {
    // TODO: Use period to dynamically adjust bucket size
    // Longer periods should use larger buckets for meaningful aggregation
    if (logs.length === 0) return [];

    const now = new Date();
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const log of logs) {
      const logDate = new Date(log.timestamp);
      const bucketKey = this.getBucketKey(logDate, bucketSizeMinutes);

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { sum: 0, count: 0 });
      }

      const bucket = buckets.get(bucketKey)!;
      bucket.sum += valueFn(log);
      bucket.count++;
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { sum, count }]) => ({
        timestamp: key,
        value: count > 0 ? sum / count : 0,
      }));
  }

  /**
   * Get a bucket key for a date (rounded to bucketSizeMinutes).
   */
  private getBucketKey(date: Date, bucketSizeMinutes: number): string {
    const rounded = new Date(
      Math.floor(date.getTime() / (bucketSizeMinutes * 60 * 1000)) *
        (bucketSizeMinutes * 60 * 1000)
    );
    return rounded.toISOString();
  }

  /**
   * Get performance summary for a specific agent type.
   */
  getAgentSummary(
    agentType: string,
    period: AgentPerformancePeriod = '24h'
  ): AgentPerformanceSummary | null {
    const agentLogs = this.executionLog.filter((l) => l.agentType === agentType);
    if (agentLogs.length === 0) return null;

    const recentLogs = this.filterByPeriod(agentLogs, period);
    const recentDurations = recentLogs.map((l) => l.durationMs).sort((a, b) => a - b);
    const recentCosts = recentLogs.map((l) => l.costUsd);
    const recentCached = recentLogs.filter((l) => l.cached);

    // Success rate
    const successes = recentLogs.filter((l) => l.success);
    const successRate = recentLogs.length > 0 ? successes.length / recentLogs.length : 0;

    // Failure reasons
    const failureReasons = new Map<string, number>();
    for (const log of recentLogs) {
      if (!log.success && log.error) {
        const reason = log.error.slice(0, 100);
        failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
      }
    }

    // Costs by model
    const costByModel = new Map<string, number>();
    for (const log of recentLogs) {
      costByModel.set(log.model, (costByModel.get(log.model) ?? 0) + log.costUsd);
    }

    // Count executions by period
    const executionsByPeriod = {} as Record<AgentPerformancePeriod, number>;
    for (const p of ['1h', '6h', '24h', '7d', '30d'] as AgentPerformancePeriod[]) {
      executionsByPeriod[p] = this.filterByPeriod(agentLogs, p).length;
    }

    // Consecutive failures
    const sortedLogs = agentLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    let consecutiveFailures = 0;
    for (const log of sortedLogs) {
      if (!log.success) consecutiveFailures++;
      else break;
    }

    // Health score (0-100)
    const healthComponents = [
      successRate * 40,                           // Success rate: 0-40
      Math.min(30, (1 - consecutiveFailures / 10) * 30), // Consecutive failures: 0-30
      recentCached.length / Math.max(1, recentLogs.length) * 15, // Cache efficiency: 0-15
      Math.min(15, (1 - (consecutiveFailures > 3 ? 1 : 0)) * 15), // Recent failures: 0-15
    ];
    const healthScore = Math.round(healthComponents.reduce((a, b) => a + b, 0));

    let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (healthScore < 50) healthStatus = 'critical';
    else if (healthScore < 75) healthStatus = 'degraded';

    return {
      agentType,
      agentName: agentLogs[0]?.agentName ?? agentType,
      department: agentLogs[0]?.department ?? 'unknown',

      totalExecutions: recentLogs.length,
      executionsByPeriod,

      successRate,
      successRateTrend: this.buildTrend(recentLogs, period, (l) => l.success ? 1 : 0, 60),
      failureRate: 1 - successRate,
      topFailureReasons: Array.from(failureReasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),

      avgDurationMs: recentDurations.length > 0
        ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length
        : 0,
      p50DurationMs: this.percentile(recentDurations, 50),
      p95DurationMs: this.percentile(recentDurations, 95),
      p99DurationMs: this.percentile(recentDurations, 99),
      durationTrend: this.buildTrend(recentLogs, period, (l) => l.durationMs, 60),

      totalCostUsd: recentCosts.reduce((a, b) => a + b, 0),
      avgCostPerExecution: recentLogs.length > 0
        ? recentCosts.reduce((a, b) => a + b, 0) / recentLogs.length
        : 0,
      costByModel: Array.from(costByModel.entries())
        .map(([model, cost]) => ({ model, cost: Math.round(cost * 10000) / 10000 }))
        .sort((a, b) => b.cost - a.cost),
      costTrend: this.buildTrend(recentLogs, period, (l) => l.costUsd, 60),

      cacheHitRate: recentLogs.length > 0
        ? recentCached.length / recentLogs.length
        : 0,
      cacheSavedUsd: recentCached.reduce((sum, l) => sum + l.costUsd, 0),

      avgOutputLength: recentLogs.length > 0
        ? recentLogs.reduce((sum, l) => sum + l.outputLength, 0) / recentLogs.length
        : 0,
      avgOutputLengthByModel: [],

      healthScore,
      healthStatus,
      lastExecutedAt: sortedLogs[0]?.timestamp ?? null,
      consecutiveFailures,
    };
  }

  /**
   * Get department-level analytics.
   */
  getDepartmentAnalytics(
    period: AgentPerformancePeriod = '24h'
  ): DepartmentAnalytics[] {
    const recentLogs = this.filterByPeriod(this.executionLog, period);
    const departments = new Map<string, typeof recentLogs>();

    for (const log of recentLogs) {
      if (!departments.has(log.department)) {
        departments.set(log.department, []);
      }
      departments.get(log.department)!.push(log);
    }

    return Array.from(departments.entries())
      .map(([dept, logs]) => {
        const agentTypes = new Set(logs.map((l) => l.agentType));
        const successes = logs.filter((l) => l.success);
        const totalCost = logs.reduce((sum, l) => sum + l.costUsd, 0);

        // Top agents
        const agentCounts = new Map<string, { executions: number; successes: number }>();
        for (const log of logs) {
          if (!agentCounts.has(log.agentType)) {
            agentCounts.set(log.agentType, { executions: 0, successes: 0 });
          }
          const entry = agentCounts.get(log.agentType)!;
          entry.executions++;
          if (log.success) entry.successes++;
        }

        return {
          department: dept,
          totalExecutions: logs.length,
          activeAgents: agentTypes.size,
          successRate: logs.length > 0 ? successes.length / logs.length : 0,
          totalCostUsd: Math.round(totalCost * 100) / 100,
          topAgents: Array.from(agentCounts.entries())
            .map(([agentType, data]) => ({
              agentType,
              executions: data.executions,
              successRate: data.executions > 0 ? data.successes / data.executions : 0,
            }))
            .sort((a, b) => b.executions - a.executions)
            .slice(0, 5),
        };
      })
      .sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Detect anomalies in agent performance.
   */
  detectAnomalies(period: AgentPerformancePeriod = '24h'): AgentAnomaly[] {
    const anomalies: AgentAnomaly[] = [];
    const agentTypes = new Set(this.executionLog.map((l) => l.agentType));

    for (const agentType of agentTypes) {
      const summary = this.getAgentSummary(agentType, period);
      if (!summary || summary.totalExecutions < 5) continue;

      const historical = this.getAgentSummary(agentType, '7d');
      if (!historical) continue;

      const now = new Date().toISOString();

      // Check success rate drop
      if (historical.successRate > 0 && summary.successRate < historical.successRate * 0.5) {
        const deviation = ((historical.successRate - summary.successRate) / historical.successRate) * 100;
        anomalies.push({
          agentType,
          metric: 'success_rate',
          currentValue: summary.successRate,
          expectedValue: historical.successRate,
          deviation: Math.round(deviation),
          severity: deviation > 75 ? 'critical' : 'warning',
          detectedAt: now,
          message: `Success rate dropped from ${(historical.successRate * 100).toFixed(0)}% to ${(summary.successRate * 100).toFixed(0)}%`,
        });
      }

      // Check duration spike
      if (historical.avgDurationMs > 0 && summary.avgDurationMs > historical.avgDurationMs * 2) {
        const deviation = ((summary.avgDurationMs - historical.avgDurationMs) / historical.avgDurationMs) * 100;
        anomalies.push({
          agentType,
          metric: 'avg_duration',
          currentValue: summary.avgDurationMs,
          expectedValue: historical.avgDurationMs,
          deviation: Math.round(deviation),
          severity: deviation > 200 ? 'critical' : 'warning',
          detectedAt: now,
          message: `Average duration spiked from ${historical.avgDurationMs.toFixed(0)}ms to ${summary.avgDurationMs.toFixed(0)}ms`,
        });
      }

      // Check consecutive failures
      if (summary.consecutiveFailures >= 3) {
        anomalies.push({
          agentType,
          metric: 'consecutive_failures',
          currentValue: summary.consecutiveFailures,
          expectedValue: 0,
          deviation: summary.consecutiveFailures,
          severity: summary.consecutiveFailures >= 5 ? 'critical' : 'warning',
          detectedAt: now,
          message: `${summary.consecutiveFailures} consecutive failures detected`,
        });
      }

      // Check health score
      if (summary.healthScore < 50) {
        anomalies.push({
          agentType,
          metric: 'health_score',
          currentValue: summary.healthScore,
          expectedValue: 75,
          deviation: 75 - summary.healthScore,
          severity: 'critical',
          detectedAt: now,
          message: `Agent health score is critically low: ${summary.healthScore}/100`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate a full analytics report.
   */
  generateReport(period: AgentPerformancePeriod = '24h'): AnalyticsReport {
    const recentLogs = this.filterByPeriod(this.executionLog, period);
    const agentTypes = new Set(recentLogs.map((l) => l.agentType));

    // Overall metrics
    const successes = recentLogs.filter((l) => l.success);
    const cached = recentLogs.filter((l) => l.cached);
    const totalCost = recentLogs.reduce((sum, l) => sum + l.costUsd, 0);
    const cacheCostSaved = cached.reduce((sum, l) => sum + l.costUsd, 0);

    // Agent summaries
    const agents = Array.from(agentTypes)
      .map((type) => this.getAgentSummary(type, period))
      .filter((s): s is AgentPerformanceSummary => s !== null)
      .sort((a, b) => b.totalExecutions - a.totalExecutions);

    // Department analytics
    const departments = this.getDepartmentAnalytics(period);

    // Anomalies
    const anomalies = this.detectAnomalies(period);

    // Trends
    const allDurations = recentLogs.map((l) => l.durationMs);

    analyticsLog.info('Analytics report generated', {
      period,
      totalExecutions: recentLogs.length,
      agentTypes: agentTypes.size,
      departments: departments.length,
      anomalies: anomalies.length,
    });

    return {
      summary: {
        totalExecutions: recentLogs.length,
        overallSuccessRate: recentLogs.length > 0 ? successes.length / recentLogs.length : 0,
        totalCostUsd: Math.round(totalCost * 100) / 100,
        cacheHitRate: recentLogs.length > 0 ? cached.length / recentLogs.length : 0,
        costSavedUsd: Math.round(cacheCostSaved * 100) / 100,
        activeAgentTypes: agentTypes.size,
        period,
      },
      agents,
      departments,
      anomalies,
      trends: {
        executions: this.buildTrend(recentLogs, period, () => 1, 60),
        successRate: this.buildTrend(recentLogs, period, (l) => l.success ? 1 : 0, 60),
        cost: this.buildTrend(recentLogs, period, (l) => l.costUsd, 60),
        avgDuration: this.buildTrend(recentLogs, period, (l) => l.durationMs, 60),
      },
    };
  }

  /**
   * Format analytics report as markdown.
   */
  formatReportAsMarkdown(report: AnalyticsReport): string {
    const periodLabel = report.summary.period;
    const lines: string[] = [
      `# Agent Performance Analytics (${periodLabel})`,
      '',
      '## Summary',
      '',
      `- **Total Executions:** ${report.summary.totalExecutions}`,
      `- **Overall Success Rate:** ${(report.summary.overallSuccessRate * 100).toFixed(1)}%`,
      `- **Total Cost:** $${report.summary.totalCostUsd.toFixed(4)}`,
      `- **Cost Saved (Cache):** $${report.summary.costSavedUsd.toFixed(4)}`,
      `- **Cache Hit Rate:** ${(report.summary.cacheHitRate * 100).toFixed(1)}%`,
      `- **Active Agent Types:** ${report.summary.activeAgentTypes}`,
      '',
      '## Agents',
      '',
      '| Agent | Dept | Executions | Success Rate | Avg Duration | Cost | Health |',
      '|-------|------|-----------|-------------|-------------|------|--------|',
      ...report.agents.map((a) =>
        `| ${a.agentName} | ${a.department} | ${a.totalExecutions} | ${(a.successRate * 100).toFixed(0)}% | ${a.avgDurationMs.toFixed(0)}ms | $${a.totalCostUsd.toFixed(4)} | ${a.healthScore}/100 ${a.healthStatus} |`
      ),
      '',
      '## Departments',
      '',
      '| Department | Active Agents | Executions | Success Rate | Cost |',
      '|-----------|--------------|-----------|-------------|------|',
      ...report.departments.map((d) =>
        `| ${d.department} | ${d.activeAgents} | ${d.totalExecutions} | ${(d.successRate * 100).toFixed(0)}% | $${d.totalCostUsd.toFixed(2)} |`
      ),
      '',
      ...(report.anomalies.length > 0
        ? [
            '## Anomalies Detected',
            '',
            '| Agent | Metric | Current | Expected | Deviation | Severity |',
            '|-------|--------|---------|----------|-----------|----------|',
            ...report.anomalies.map((a) =>
              `| ${a.agentType} | ${a.metric} | ${typeof a.currentValue === 'number' ? a.currentValue.toFixed(2) : a.currentValue} | ${typeof a.expectedValue === 'number' ? a.expectedValue.toFixed(2) : a.expectedValue} | ${a.deviation}% | ⚠️ ${a.severity} |`
            ),
            '',
          ]
        : ['', '✅ No anomalies detected.', '']),
      '## Top Agents by Execution',
      '',
      ...report.agents.slice(0, 5).map((a, i) =>
        `${i + 1}. **${a.agentName}** — ${a.totalExecutions} executions, ${(a.successRate * 100).toFixed(0)}% success, $${a.totalCostUsd.toFixed(4)} cost`
      ),
      '',
      '## Recommendations',
      '',
      ...this.generateRecommendations(report),
      '',
    ];

    return lines.join('\n');
  }

  /**
   * Generate actionable recommendations based on analytics.
   */
  private generateRecommendations(report: AnalyticsReport): string[] {
    const recommendations: string[] = [];

    if (report.summary.overallSuccessRate < 0.8) {
      recommendations.push('⚠️ Overall success rate is below 80%. Review failing agents and check for provider issues.');
    }

    if (report.summary.cacheHitRate < 0.3) {
      recommendations.push('💡 Cache hit rate is low. Increase TTL for stable prompts or enable semantic caching.');
    }

    const highCostAgents = report.agents
      .filter((a) => a.totalCostUsd > 0.1)
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 3);

    if (highCostAgents.length > 0) {
      recommendations.push(
        `💰 Highest cost agents: ${highCostAgents.map((a) => `${a.agentName} ($${a.totalCostUsd.toFixed(4)})`).join(', ')}. Review if caching or model optimization can reduce costs.`
      );
    }

    if (report.anomalies.length > 0) {
      const criticalAnomalies = report.anomalies.filter((a) => a.severity === 'critical');
      if (criticalAnomalies.length > 0) {
        recommendations.push(
          `🚨 ${criticalAnomalies.length} critical anomalies detected. Review agent health and consider rolling back recent changes.`
        );
      }
    }

    const degradedAgents = report.agents.filter((a) => a.healthStatus === 'degraded');
    if (degradedAgents.length > 0) {
      recommendations.push(
        `⚕️ ${degradedAgents.length} agents are in degraded health: ${degradedAgents.map((a) => a.agentName).join(', ')}.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All agents are performing well. No recommendations at this time.');
    }

    return recommendations;
  }

  /**
   * Clear execution log.
   */
  clearLogs(): void {
    this.executionLog = [];
    analyticsLog.info('Analytics execution log cleared');
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _analyticsEngine: AgentAnalyticsEngine | null = null;

export function getAgentAnalytics(): AgentAnalyticsEngine {
  if (!_analyticsEngine) {
    _analyticsEngine = new AgentAnalyticsEngine();
  }
  return _analyticsEngine;
}

/**
 * Convenience function to record an agent execution.
 */
export function recordAgentExecution(input: {
  agentType: string;
  agentName: string;
  department: string;
  success: boolean;
  durationMs: number;
  costUsd: number;
  cached: boolean;
  model: string;
  outputLength: number;
  error?: string;
}): void {
  getAgentAnalytics().recordExecution(input);
}

/**
 * Convenience function to get agent analytics report.
 */
export function getAgentAnalyticsReport(
  period: AgentPerformancePeriod = '24h'
): AnalyticsReport {
  return getAgentAnalytics().generateReport(period);
}
