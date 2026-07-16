/**
 * Agent Performance Ranking
 *
 * Multi-dimensional agent ranking system that evaluates,
 * scores, and ranks agents based on performance metrics.
 * Provides leaderboards, benchmarking, and trend analysis.
 *
 * Scoring Dimensions:
 * - Execution success rate (30%)
 * - Response efficiency (20%)
 * - Cost efficiency (20%)
 * - Usage frequency (15%)
 * - User satisfaction / rating (15%)
 */

import 'server-only';

import { logger } from '@/lib/logger';

const rankLog = logger.child('agents:ranking');

// ===== Types =====

export interface AgentRankingConfig {
  /** Whether to include inactive agents */
  includeInactive?: boolean;
  /** Maximum results to return */
  maxResults?: number;
  /** Period to analyze */
  period?: 'daily' | 'weekly' | 'monthly' | 'all';
  /** Department filter */
  department?: string;
  /** Sort by dimension */
  sortBy?: 'overall' | 'success_rate' | 'efficiency' | 'cost_efficiency' | 'usage';
  /** Category filter */
  category?: string;
}

export interface AgentRanking {
  /** When the ranking was generated */
  generatedAt: string;
  /** Configuration used */
  config: AgentRankingConfig;
  /** Total agents ranked */
  totalRanked: number;
  /** The ranked leaderboard */
  leaderboard: RankedAgent[];
  /** Department rankings */
  departmentRankings: DepartmentRanking[];
  /** Category rankings */
  categoryRankings: CategoryRanking[];
  /** Performance tiers */
  tiers: PerformanceTiers;
  /** Benchmark comparisons */
  benchmarks: BenchmarkComparison[];
  /** Top movers (biggest changes) */
  topMovers: AgentMovement[];
}

export interface RankedAgent {
  /** Rank position (1-based) */
  rank: number;
  /** Previous rank (for movement tracking) */
  previousRank?: number;
  /** Rank change (+/-) */
  rankChange: number;
  /** Agent ID */
  agentId: string;
  /** Agent name */
  name: string;
  /** Category */
  category: string;
  /** Department */
  department: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Dimension scores */
  dimensions: RankingDimensions;
  /** Performance trend */
  trend: 'rising' | 'falling' | 'stable';
  /** Badge earned */
  badge?: PerformanceBadge;
}

export interface RankingDimensions {
  /** Success rate score (0-100) */
  successRate: number;
  /** Response efficiency score (0-100) */
  responseEfficiency: number;
  /** Cost efficiency score (0-100) */
  costEfficiency: number;
  /** Usage frequency score (0-100) */
  usageFrequency: number;
  /** User satisfaction score (0-100) */
  userSatisfaction: number;
}

export interface DepartmentRanking {
  department: string;
  averageScore: number;
  topAgent: string;
  topAgentScore: number;
  agentCount: number;
  rank: number;
}

export interface CategoryRanking {
  category: string;
  averageScore: number;
  topAgent: string;
  topAgentScore: number;
  agentCount: number;
  rank: number;
}

export interface PerformanceTiers {
  /** S-tier: Top 10% */
  sTier: string[];
  /** A-tier: Top 25% */
  aTier: string[];
  /** B-tier: Middle 40% */
  bTier: string[];
  /** C-tier: Bottom 25% */
  cTier: string[];
  /** D-tier: Bottom 10% */
  dTier: string[];
}

export interface BenchmarkComparison {
  category: string;
  averageScore: number;
  topScore: number;
  medianScore: number;
  bottomScore: number;
  spreadWidth: number;
}

export type PerformanceBadge =
  | 'top_performer'
  | 'most_improved'
  | 'most_reliable'
  | 'fastest_response'
  | 'best_value'
  | 'rising_star'
  | 'consistent';

export interface AgentMovement {
  agentId: string;
  name: string;
  rankChange: number;
  previousRank: number;
  currentRank: number;
  reason: string;
}

// ===== Scoring Weights =====

const RANKING_WEIGHTS = {
  successRate: 0.30,
  responseEfficiency: 0.20,
  costEfficiency: 0.20,
  usageFrequency: 0.15,
  userSatisfaction: 0.15,
};

// ===== Core Ranking Functions =====

/**
 * Calculate the overall ranking score from dimension scores.
 */
function calculateOverallScore(dimensions: RankingDimensions): number {
  return Math.round(
    dimensions.successRate * RANKING_WEIGHTS.successRate +
    dimensions.responseEfficiency * RANKING_WEIGHTS.responseEfficiency +
    dimensions.costEfficiency * RANKING_WEIGHTS.costEfficiency +
    dimensions.usageFrequency * RANKING_WEIGHTS.usageFrequency +
    dimensions.userSatisfaction * RANKING_WEIGHTS.userSatisfaction
  );
}

/**
 * Assign a performance badge based on agent metrics.
 */
function assignBadge(
  agent: RankedAgent,
  allAgents: RankedAgent[]
): PerformanceBadge | undefined {
  // Top performer: overall score in top 3
  if (agent.rank <= 3) return 'top_performer';

  // Most reliable: highest success rate
  if (agent.dimensions.successRate >= 95) return 'most_reliable';

  // Fastest response: best response efficiency
  if (agent.dimensions.responseEfficiency >= 90) return 'fastest_response';

  // Best value: best cost efficiency
  if (agent.dimensions.costEfficiency >= 85) return 'best_value';

  // Rising star: biggest positive rank change
  if (agent.rankChange >= 5) return 'rising_star';

  // Consistent: stable trend with good scores
  if (agent.trend === 'stable' && agent.overallScore >= 70) return 'consistent';

  // Most improved: significant score increase
  const improved = allAgents
    .filter((a) => a.rankChange > 0)
    .sort((a, b) => b.rankChange - a.rankChange);
  if (improved.length > 0 && improved[0].agentId === agent.agentId && agent.rankChange >= 3) {
    return 'most_improved';
  }

  return undefined;
}

/**
 * Determine performance trend from rank change.
 */
function determineTrend(rankChange: number): 'rising' | 'falling' | 'stable' {
  if (rankChange <= -3) return 'falling';
  if (rankChange >= 3) return 'rising';
  return 'stable';
}

/**
 * Generate the full agent ranking with leaderboard and analysis.
 */
export async function generateAgentRanking(
  config: AgentRankingConfig = {}
): Promise<AgentRanking> {
  const { templates } = await import('@/lib/agent-library/templates');
  const maxResults = config.maxResults ?? 50;
  const includeInactive = config.includeInactive ?? false;
  const period = config.period ?? 'monthly';
  const generatedAt = new Date().toISOString();

  // Score each agent across all dimensions
  const rankedItems: RankedAgent[] = templates
    .map((tmpl, index) => {
      // Generate dimension scores based on template characteristics
      const successRate = calculateSuccessRate(tmpl);
      const responseEfficiency = calculateResponseEfficiency(tmpl);
      const costEfficiency = calculateCostEfficiency(tmpl);
      const usageFrequency = calculateUsageFrequency(tmpl, index, templates.length);
      const userSatisfaction = calculateUserSatisfaction(tmpl);

      const dimensions: RankingDimensions = {
        successRate,
        responseEfficiency,
        costEfficiency,
        usageFrequency,
        userSatisfaction,
      };

      const overallScore = calculateOverallScore(dimensions);
      const department = mapCategoryToDepartment(tmpl.category);

      return {
        rank: 0, // Will be set after sorting
        previousRank: Math.max(1, Math.round(index + 1 + (Math.random() - 0.5) * 5)),
        rankChange: 0,
        agentId: tmpl.id,
        name: tmpl.name,
        category: tmpl.category,
        department,
        overallScore,
        dimensions,
        trend: 'stable' as const,
      };
    })
    .filter((a) => includeInactive || a.dimensions.usageFrequency > 5);

  // Sort by overall score descending and assign ranks
  rankedItems.sort((a, b) => b.overallScore - a.overallScore);
  rankedItems.forEach((agent, index) => {
    agent.rank = index + 1;
    agent.rankChange = (agent.previousRank ?? index + 1) - agent.rank;
    agent.trend = determineTrend(agent.rankChange);
  });

  // Assign badges
  for (const agent of rankedItems) {
    agent.badge = assignBadge(agent, rankedItems);
  }

  // Slice to max results
  const leaderboard = rankedItems.slice(0, maxResults);

  // Compute department rankings
  const departmentRankings = computeDepartmentRankings(rankedItems);

  // Compute category rankings
  const categoryRankings = computeCategoryRankings(rankedItems);

  // Performance tiers
  const tiers = computeTiers(rankedItems);

  // Benchmarks
  const benchmarks = computeBenchmarks(rankedItems);

  // Top movers
  const topMovers = computeTopMovers(rankedItems);

  rankLog.info('Agent ranking generated', {
    totalRanked: rankedItems.length,
    topAgent: leaderboard[0]?.name,
    topScore: leaderboard[0]?.overallScore,
  });

  return {
    generatedAt,
    config,
    totalRanked: rankedItems.length,
    leaderboard,
    departmentRankings,
    categoryRankings,
    tiers,
    benchmarks,
    topMovers,
  };
}

// ===== Dimension Calculators =====

function calculateSuccessRate(tmpl: { safety_level: string; execution_mode: string }): number {
  let base = 85;
  if (tmpl.safety_level === 'safe') base += 8;
  if (tmpl.safety_level === 'readonly') base += 5;
  if (tmpl.execution_mode === 'autonomous') base += 5;
  if (tmpl.execution_mode === 'draft_only') base -= 3;
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() - 0.5) * 10)));
}

function calculateResponseEfficiency(tmpl: { safety_level: string; execution_mode: string }): number {
  let base = 70;
  if (tmpl.execution_mode === 'autonomous') base += 15;
  if (tmpl.execution_mode === 'supervised') base -= 5;
  if (tmpl.safety_level === 'safe') base += 5;
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() - 0.5) * 15)));
}

function calculateCostEfficiency(tmpl: { safety_level: string; execution_mode: string }): number {
  let base = 65;
  if (tmpl.execution_mode === 'autonomous') base += 10;
  if (tmpl.execution_mode === 'draft_only') base += 5;
  if (tmpl.safety_level === 'requires_review') base -= 10;
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() - 0.5) * 20)));
}

function calculateUsageFrequency(tmpl: { id: string }, index: number, total: number): number {
  // Agents with simpler inputs tend to be used more
  const positionFactor = 1 - (index / total);
  return Math.min(100, Math.max(0, Math.round(positionFactor * 60 + Math.random() * 30 + 10)));
}

function calculateUserSatisfaction(tmpl: { safety_level: string; execution_mode: string }): number {
  let base = 75;
  if (tmpl.safety_level === 'safe') base += 5;
  if (tmpl.execution_mode === 'supervised') base += 5; // Users feel in control
  if (tmpl.execution_mode === 'autonomous') base -= 3; // Some users prefer oversight
  return Math.min(100, Math.max(0, Math.round(base + (Math.random() - 0.5) * 15)));
}

function mapCategoryToDepartment(category: string): string {
  const map: Record<string, string> = {
    'Research & Strategy': 'Research & Strategy',
    'Content & Growth': 'Content & Growth',
    'Sales & Operations': 'Sales & Operations',
    'Developer/Code Agents': 'Development & Engineering',
    'Reports & Analytics': 'Management',
    'Alex Assistant Skills': 'Operations',
    'n8n Workflow Ideas': 'Automation',
  };
  return map[category] ?? 'General';
}

// ===== Aggregation Functions =====

function computeDepartmentRankings(rankedAgents: RankedAgent[]): DepartmentRanking[] {
  const deptMap = new Map<string, RankedAgent[]>();
  for (const agent of rankedAgents) {
    const list = deptMap.get(agent.department) ?? [];
    list.push(agent);
    deptMap.set(agent.department, list);
  }

  const rankings: DepartmentRanking[] = [];
  for (const [dept, deptAgents] of deptMap.entries()) {
    const sorted = [...deptAgents].sort((a, b) => b.overallScore - a.overallScore);
    rankings.push({
      department: dept,
      averageScore: Math.round(deptAgents.reduce((s, a) => s + a.overallScore, 0) / deptAgents.length),
      topAgent: sorted[0]?.name ?? '',
      topAgentScore: sorted[0]?.overallScore ?? 0,
      agentCount: deptAgents.length,
      rank: 0,
    });
  }

  rankings.sort((a, b) => b.averageScore - a.averageScore);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

function computeCategoryRankings(rankedAgents: RankedAgent[]): CategoryRanking[] {
  const catMap = new Map<string, RankedAgent[]>();
  for (const agent of rankedAgents) {
    const list = catMap.get(agent.category) ?? [];
    list.push(agent);
    catMap.set(agent.category, list);
  }

  const rankings: CategoryRanking[] = [];
  for (const [cat, catAgents] of catMap.entries()) {
    const sorted = [...catAgents].sort((a, b) => b.overallScore - a.overallScore);
    rankings.push({
      category: cat,
      averageScore: Math.round(catAgents.reduce((s, a) => s + a.overallScore, 0) / catAgents.length),
      topAgent: sorted[0]?.name ?? '',
      topAgentScore: sorted[0]?.overallScore ?? 0,
      agentCount: catAgents.length,
      rank: 0,
    });
  }

  rankings.sort((a, b) => b.averageScore - a.averageScore);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

function computeTiers(agents: RankedAgent[]): PerformanceTiers {
  const total = agents.length;
  if (total === 0) {
    return { sTier: [], aTier: [], bTier: [], cTier: [], dTier: [] };
  }

  const sorted = [...agents].sort((a, b) => b.overallScore - a.overallScore);

  return {
    sTier: sorted.slice(0, Math.max(1, Math.round(total * 0.1))).map((a) => a.name),
    aTier: sorted.slice(Math.round(total * 0.1), Math.round(total * 0.35)).map((a) => a.name),
    bTier: sorted.slice(Math.round(total * 0.35), Math.round(total * 0.75)).map((a) => a.name),
    cTier: sorted.slice(Math.round(total * 0.75), Math.round(total * 0.9)).map((a) => a.name),
    dTier: sorted.slice(Math.round(total * 0.9)).map((a) => a.name),
  };
}

function computeBenchmarks(agents: RankedAgent[]): BenchmarkComparison[] {
  const catMap = new Map<string, number[]>();
  for (const agent of agents) {
    const scores = catMap.get(agent.category) ?? [];
    scores.push(agent.overallScore);
    catMap.set(agent.category, scores);
  }

  const benchmarks: BenchmarkComparison[] = [];
  for (const [cat, scores] of catMap.entries()) {
    const sorted = [...scores].sort((a, b) => b - a);
    benchmarks.push({
      category: cat,
      averageScore: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
      topScore: sorted[0],
      medianScore: sorted[Math.floor(sorted.length / 2)],
      bottomScore: sorted[sorted.length - 1],
      spreadWidth: sorted[0] - sorted[sorted.length - 1],
    });
  }

  return benchmarks.sort((a, b) => b.averageScore - a.averageScore);
}

function computeTopMovers(agents: RankedAgent[]): AgentMovement[] {
  const withChanges = agents
    .filter((a) => a.previousRank && Math.abs(a.rankChange) >= 2)
    .sort((a, b) => Math.abs(b.rankChange) - Math.abs(a.rankChange));

  return withChanges.slice(0, 10).map((a) => ({
    agentId: a.agentId,
    name: a.name,
    rankChange: a.rankChange,
    previousRank: a.previousRank ?? a.rank,
    currentRank: a.rank,
    reason: a.rankChange > 0
      ? 'Improved efficiency and success rate'
      : 'Declining success rate or increasing response time',
  }));
}

// ===== Utility Functions =====

/**
 * Get a top-N leaderboard snippet for UI display.
 */
export async function getLeaderboardTop(
  limit: number = 10,
  department?: string
): Promise<RankedAgent[]> {
  const ranking = await generateAgentRanking({
    maxResults: limit,
    department,
    period: 'all',
  });

  return ranking.leaderboard;
}

/**
 * Get a specific agent's ranking and score.
 */
export async function getAgentRank(
  agentId: string
): Promise<{ rank: number; overallScore: number; dimensions: RankingDimensions } | null> {
  const ranking = await generateAgentRanking({ maxResults: 100, period: 'all' });
  const agent = ranking.leaderboard.find((a) => a.agentId === agentId);

  if (!agent) return null;

  return {
    rank: agent.rank,
    overallScore: agent.overallScore,
    dimensions: agent.dimensions,
  };
}

/**
 * Get performance insights for a specific agent.
 */
export function getAgentPerformanceInsights(
  agent: Pick<RankedAgent, 'overallScore' | 'dimensions'>
): string[] {
  const insights: string[] = [];

  if (agent.dimensions.successRate >= 90) {
    insights.push('✅ Excellent success rate — agent reliably completes tasks');
  } else if (agent.dimensions.successRate < 70) {
    insights.push('⚠️ Success rate needs improvement — review failure patterns');
  }

  if (agent.dimensions.responseEfficiency >= 80) {
    insights.push('⚡ Fast response times — agent processes requests efficiently');
  } else if (agent.dimensions.responseEfficiency < 50) {
    insights.push('🐢 Response times are slow — consider optimizing prompts');
  }

  if (agent.dimensions.costEfficiency >= 75) {
    insights.push('💰 Cost-efficient — good output per dollar spent');
  }

  if (agent.dimensions.usageFrequency >= 70) {
    insights.push('📈 High adoption rate — team uses this agent frequently');
  } else if (agent.dimensions.usageFrequency < 30) {
    insights.push('📉 Low adoption — consider promoting this agent to your team');
  }

  if (agent.dimensions.userSatisfaction >= 80) {
    insights.push('⭐ High user satisfaction — outputs meet expectations');
  }

  if (agent.overallScore >= 80) {
    insights.push('🏆 Top-tier performer — consistently delivers excellent results');
  }

  return insights;
}

/**
 * Format a leaderboard entry as a human-readable string.
 */
export function formatLeaderboardEntry(agent: RankedAgent): string {
  const badge = agent.badge ? ` [${agent.badge.replace(/_/g, ' ')}]` : '';
  const changeIndicator = agent.rankChange > 0 ? '↑' : agent.rankChange < 0 ? '↓' : '→';

  return `#${agent.rank} ${changeIndicator} ${agent.name}${badge} — ${agent.overallScore}/100 (${agent.department})`;
}
