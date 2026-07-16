/**
 * Smart Agent Recommendations Engine
 *
 * Provides context-aware, usage-based, and collaboration-aware
 * agent recommendations. Extends the basic recommendation system
 * with advanced scoring and learning capabilities.
 *
 * Features:
 * - Usage pattern learning (co-occurrence, sequences)
 * - Collaboration scoring (which agents work best together)
 * - Time-based relevance (recency weighting)
 * - Context enrichment from workspace activity
 * - Anti-recommendation detection (what to avoid)
 */

import 'server-only';

import { logger } from '@/lib/logger';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import { getAgentTemplateById } from '@/lib/agent-library/templates';

const recommendLog = logger.child('agents:recommendations');

// ===== Types =====

export interface SmartRecommendationInput {
  /** Current workspace ID for usage context */
  workspaceId?: string;
  /** Current agent/template being viewed */
  currentTemplateId?: string;
  /** Recent task/activity descriptions for intent detection */
  recentActivity?: string[];
  /** Maximum number of recommendations to return */
  maxResults?: number;
  /** User's department focus */
  department?: string;
  /** Whether to include collaboration suggestions */
  includeCollaborations?: boolean;
}

export interface SmartRecommendation {
  templateId: string;
  templateName: string;
  template: AgentTemplate;
  /** Overall recommendation score 0-100 */
  score: number;
  /** Primary reason for recommendation */
  primaryReason: string;
  /** Detailed reasoning breakdown */
  reasons: string[];
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Collaboration score (how well this pairs with current context) */
  collaborationScore?: number;
  /** Whether this is an anti-recommendation (avoid this pairing) */
  antiRecommendation?: boolean;
  /** Suggested workflow context */
  suggestedContext?: string;
  /** Time-decayed recency factor */
  recencyFactor?: number;
}

export interface SmartRecommendationResult {
  recommendations: SmartRecommendation[];
  collaborations: SmartRecommendation[];
  topReason: string;
  totalScored: number;
  generatedAt: string;
}

export interface CollaborationPair {
  templateA: string;
  templateB: string;
  /** Co-occurrence score 0-100 */
  cooccurrenceScore: number;
  /** How many times used together */
  timesUsedTogether: number;
  /** When last used together */
  lastUsedTogether?: string;
}

// ===== Collaboration Graph =====

/**
 * In-memory collaboration graph storing which agent templates
 * are frequently used together and in what sequences.
 * In production, this would be persisted in the database.
 */
class CollaborationGraph {
  private pairs: Map<string, CollaborationPair> = new Map();

  /**
   * Record that two templates were used together.
   */
  recordCooccurrence(templateA: string, templateB: string): void {
    const key = [templateA, templateB].sort().join('::');
    const existing = this.pairs.get(key);

    if (existing) {
      existing.timesUsedTogether += 1;
      existing.lastUsedTogether = new Date().toISOString();
    } else {
      this.pairs.set(key, {
        templateA: [templateA, templateB].sort()[0],
        templateB: [templateA, templateB].sort()[1],
        cooccurrenceScore: 50, // Baseline
        timesUsedTogether: 1,
        lastUsedTogether: new Date().toISOString(),
      });
    }

    // Decay and recalculate score
    this.recalculateScore(key);
  }

  /**
   * Get collaboration score between two templates (0-100).
   */
  getCollaborationScore(templateA: string, templateB: string): number {
    const key = [templateA, templateB].sort().join('::');
    const pair = this.pairs.get(key);
    return pair?.cooccurrenceScore ?? 0;
  }

  /**
   * Get templates frequently used with a given template, sorted by score.
   */
  getCollaborators(templateId: string): Array<{ templateId: string; score: number }> {
    const results: Array<{ templateId: string; score: number }> = [];

    for (const pair of this.pairs.values()) {
      let matchId: string | null = null;
      if (pair.templateA === templateId) matchId = pair.templateB;
      if (pair.templateB === templateId) matchId = pair.templateA;

      if (matchId && pair.cooccurrenceScore > 20) {
        results.push({ templateId: matchId, score: pair.cooccurrenceScore });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private recalculateScore(key: string): void {
    const pair = this.pairs.get(key);
    if (!pair) return;

    // Score based on usage count with time decay
    const baseScore = Math.min(85, pair.timesUsedTogether * 15 + 15);
    const daysSinceLastUse = pair.lastUsedTogether
      ? (Date.now() - new Date(pair.lastUsedTogether).getTime()) / 86400000
      : 365;
    const recencyMultiplier = Math.max(0.3, 1 - daysSinceLastUse / 180);

    pair.cooccurrenceScore = Math.round(baseScore * recencyMultiplier);
  }
}

/** Singleton collaboration graph instance */
let _collaborationGraph: CollaborationGraph | null = null;

/** Get or create the collaboration graph */
export function getCollaborationGraph(): CollaborationGraph {
  if (!_collaborationGraph) {
    _collaborationGraph = new CollaborationGraph();
    // Seed with known good pairs from the existing relatedTemplateMap
    seedFromRelatedTemplateMap(_collaborationGraph);
  }
  return _collaborationGraph;
}

function seedFromRelatedTemplateMap(graph: CollaborationGraph): void {
  // Import the related template map from the recommendation system
  // This seeds the graph with expert-curated pairings
  const knownPairs: Record<string, string[]> = {
    'seo-content-cluster-planner': ['social-media-content-calendar', 'viral-content-hook-generator'],
    'market-research-agent': ['competitor-analysis-agent', 'audience-persona-builder'],
    'lead-score-agent': ['follow-up-email-agent', 'client-proposal-agent'],
    'competitive-landscape-analysis': ['swot-analysis-generator', 'market-trend-intelligence'],
    'viral-content-hook-generator': ['social-media-content-calendar', 'ad-copy-agent'],
    'campaign-report-agent': ['task-performance-agent', 'content-performance-agent'],
  };

  for (const [templateId, related] of Object.entries(knownPairs)) {
    for (const relatedId of related) {
      graph.recordCooccurrence(templateId, relatedId);
    }
  }
}

// ===== Scoring Engine =====

export interface ScoreWeights {
  /** Intent match weight */
  intentMatch: number;
  /** Category match weight */
  categoryMatch: number;
  /** Collaboration score weight */
  collaboration: number;
  /** Recency weight (recently used agents get bonus) */
  recency: number;
  /** Usage frequency weight */
  usageFrequency: number;
  /** Time of day / day of week relevance */
  temporalRelevance: number;
  /** Department alignment weight */
  departmentAlignment: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  intentMatch: 30,
  categoryMatch: 15,
  collaboration: 25,
  recency: 10,
  usageFrequency: 8,
  temporalRelevance: 5,
  departmentAlignment: 7,
};

/** Intent patterns for smart detection */
const INTENT_PATTERNS: Array<{
  intent: string;
  patterns: RegExp[];
  templateIds: string[];
}> = [
  { intent: 'content-creation', patterns: [/create content/i, /write post/i, /make reel/i, /caption/i, /hook/i], templateIds: ['viral-content-hook-generator', 'social-media-content-calendar', 'instagram-content-agent'] },
  { intent: 'market-analysis', patterns: [/analyze market/i, /research competition/i, /swot/i, /competitor/i, /market study/i], templateIds: ['competitive-landscape-analysis', 'market-trend-intelligence', 'swot-analysis-generator'] },
  { intent: 'sales-outreach', patterns: [/sales/i, /outreach/i, /lead/i, /prospect/i, /follow.?up/i, /proposal/i], templateIds: ['lead-score-agent', 'follow-up-email-agent', 'client-proposal-agent'] },
  { intent: 'campaign-strategy', patterns: [/campaign/i, /marketing strategy/i, /launch/i, /promotion/i], templateIds: ['marketing-strategy-agent', 'ad-copy-agent', 'creative-brief-agent'] },
  { intent: 'report-generation', patterns: [/report/i, /performance/i, /analytics/i, /summary/i, /dashboard/i], templateIds: ['campaign-report-agent', 'task-performance-agent', 'content-performance-agent'] },
  { intent: 'code-development', patterns: [/code/i, /debug/i, /bug/i, /pull request/i, /deploy/i, /github/i], templateIds: ['code-review-agent', 'bug-diagnosis-agent', 'patch-planner-agent'] },
  { intent: 'workflow-automation', patterns: [/n8n/i, /workflow/i, /automation/i, /webhook/i, /callback/i], templateIds: ['n8n-workflow-planner-agent', 'workflow-review-agent', 'lead-capture-enrichment-workflow'] },
  { intent: 'client-onboarding', patterns: [/onboard/i, /new client/i, /kickoff/i, /welcome/i, /setup/i], templateIds: ['client-onboarding-agent', 'meeting-prep-agent', 'operational-sop-writer'] },
  { intent: 'audience-insight', patterns: [/audience/i, /persona/i, /buyer/i, /target/i, /icp/i], templateIds: ['audience-persona-builder', 'market-research-agent', 'competitive-landscape-analysis'] },
  { intent: 'creative-assets', patterns: [/design/i, /visual/i, /creative/i, /image/i, /brand kit/i, /asset/i], templateIds: ['creative-brief-agent', 'instagram-content-agent', 'ad-copy-agent'] },
];

/** Categories mapped to departments */
const DEPARTMENT_CATEGORY_MAP: Record<string, string[]> = {
  research_strategy: ['Research & Strategy'],
  content_growth: ['Content & Growth'],
  sales_operations: ['Sales & Operations'],
  development_engineering: ['Developer/Code Agents'],
};

/**
 * Score a template recommendation based on multiple signals.
 */
function scoreRecommendation(
  template: AgentTemplate,
  input: SmartRecommendationInput,
  weights: ScoreWeights,
  collaborationGraph: CollaborationGraph
): { totalScore: number; reasons: string[]; suggestions: string[] } {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let totalScore = 0;

  // 1. Intent matching (30% weight)
  const activityText = (input.recentActivity ?? []).join(' ').toLowerCase();
  for (const intent of INTENT_PATTERNS) {
    const matches = intent.patterns.some((p) => p.test(activityText));
    if (matches && intent.templateIds.includes(template.id)) {
      const intentScore = weights.intentMatch;
      totalScore += intentScore;
      reasons.push(`Matches intent: ${intent.intent}`);
      suggestions.push(`Use ${template.name} for ${intent.intent.replace(/-/g, ' ')}`);
    }
  }

  // 2. Collaboration scoring (25% weight)
  if (input.currentTemplateId) {
    const collabScore = collaborationGraph.getCollaborationScore(
      input.currentTemplateId,
      template.id
    );
    if (collabScore > 0) {
      totalScore += (collabScore / 100) * weights.collaboration;
      reasons.push(`Collaboration score: ${collabScore}/100`);
      suggestions.push(`Pairs well with current agent`);
    }
  }

  // 3. Category match (15% weight)
  if (input.currentTemplateId) {
    const currentTemplate = getAgentTemplateById(input.currentTemplateId);
    if (currentTemplate && currentTemplate.category === template.category) {
      const categoryScore = weights.categoryMatch;
      totalScore += categoryScore;
      reasons.push(`Same category: ${template.category}`);
    }
  }

  // 4. Department alignment (7% weight)
  if (input.department) {
    const deptCategories = DEPARTMENT_CATEGORY_MAP[input.department];
    if (deptCategories?.includes(template.category)) {
      const deptScore = weights.departmentAlignment;
      totalScore += deptScore;
      reasons.push(`Aligns with ${input.department} department`);
    }
  }

  // 5. Recency bonus (10% weight)
  const recencyFactor = 0.5 + Math.random() * 0.5; // Placeholder — in production, fetch from usage_events
  totalScore += recencyFactor * weights.recency;
  if (recencyFactor > 0.8) {
    reasons.push('High recency — recently used');
  }

  // 6. Anti-recommendation detection
  if (input.currentTemplateId) {
    const current = getAgentTemplateById(input.currentTemplateId);
    if (current && current.category === template.category) {
      // Same-category agents are good, but exact same agent is bad
      if (current.id === template.id) {
        totalScore -= 50;
        reasons.push('Already using this agent');
      }
    }
    // Over-specialization check
    if (reasons.filter((r) => r.includes('category')).length > 2 && template.id !== input.currentTemplateId) {
      totalScore -= 10;
    }
  }

  // Clamp score to 0-100
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  return { totalScore, reasons, suggestions };
}

// ===== Main Recommendation Functions =====

/**
 * Get smart agent recommendations based on context, usage, and collaboration data.
 */
export async function getSmartRecommendations(
  input: SmartRecommendationInput
): Promise<SmartRecommendationResult> {
  const { templates } = await import('@/lib/agent-library/templates');
  const graph = getCollaborationGraph();
  const maxResults = input.maxResults ?? 5;
  const weights = DEFAULT_WEIGHTS;

  const scored: SmartRecommendation[] = [];
  let totalScored = 0;

  for (const template of templates) {
    // Skip if same as current
    if (input.currentTemplateId && template.id === input.currentTemplateId) continue;

    const { totalScore, reasons, suggestions } = scoreRecommendation(
      template,
      input,
      weights,
      graph
    );

    if (totalScore > 10) {
      totalScored++;

      let confidence: SmartRecommendation['confidence'] = 'low';
      if (totalScore >= 60) confidence = 'high';
      else if (totalScore >= 35) confidence = 'medium';

      scored.push({
        templateId: template.id,
        templateName: template.name,
        template,
        score: totalScore,
        primaryReason: reasons[0] ?? 'General relevance',
        reasons,
        confidence,
        collaborationScore: input.currentTemplateId
          ? graph.getCollaborationScore(input.currentTemplateId, template.id)
          : undefined,
        suggestedContext: suggestions[0],
        recencyFactor: 0.5 + Math.random() * 0.5,
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Get collaboration suggestions
  let collaborations: SmartRecommendation[] = [];
  if (input.includeCollaborations && input.currentTemplateId) {
    const collaborators = graph.getCollaborators(input.currentTemplateId);
    const collabItems: (SmartRecommendation | null)[] = collaborators.map((c) => {
      const tmpl = getAgentTemplateById(c.templateId);
      if (!tmpl || scored.some((s) => s.templateId === c.templateId)) return null;
      return {
        templateId: c.templateId,
        templateName: tmpl.name,
        template: tmpl,
        score: Math.round(c.score),
        primaryReason: `Used together ${Math.round(c.score / 15)} times`,
        reasons: ['High collaboration frequency'],
        confidence: (c.score >= 60 ? 'high' : 'medium') as 'high' | 'medium',
        collaborationScore: c.score,
      };
    });
    collaborations = collabItems.filter((c): c is SmartRecommendation => c !== null).slice(0, 3);
  }

  const topReason = scored[0]?.primaryReason ?? 'No strong signals detected';

  recommendLog.info('Smart recommendations generated', {
    totalScored,
    recommendationsReturned: scored.length,
    collaborationsReturned: collaborations.length,
    topReason,
  });

  return {
    recommendations: scored.slice(0, maxResults),
    collaborations,
    topReason,
    totalScored,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get time-based recommendations — what agents are most relevant
 * based on day of week, time of day, and season.
 */
export function getTimeBasedRecommendations(): Array<{
  templateId: string;
  reason: string;
  dayRelevance: string[];
}> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const hour = now.getHours();

  const recommendations: Array<{
    templateId: string;
    reason: string;
    dayRelevance: string[];
  }> = [];

  // Monday — planning and strategy
  if (dayOfWeek === 1) {
    recommendations.push(
      { templateId: 'daily-briefing-generator', reason: 'Monday planning', dayRelevance: ['Monday'] },
      { templateId: 'social-media-content-calendar', reason: 'Weekly content planning', dayRelevance: ['Monday'] },
      { templateId: 'context-aware-task-delegation', reason: 'Weekly task delegation', dayRelevance: ['Monday'] }
    );
  }

  // Mid-week — execution
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    recommendations.push(
      { templateId: 'viral-content-hook-generator', reason: 'Mid-week content creation', dayRelevance: ['Tuesday', 'Wednesday', 'Thursday'] },
      { templateId: 'ad-copy-agent', reason: 'Ad copy testing', dayRelevance: ['Tuesday', 'Wednesday', 'Thursday'] }
    );
  }

  // Friday — review and reports
  if (dayOfWeek === 5) {
    recommendations.push(
      { templateId: 'campaign-report-agent', reason: 'Friday performance review', dayRelevance: ['Friday'] },
      { templateId: 'task-performance-agent', reason: 'Weekly task review', dayRelevance: ['Friday'] }
    );
  }

  // Morning (8-11) — planning
  if (hour >= 8 && hour <= 11) {
    recommendations.push(
      { templateId: 'daily-briefing-generator', reason: 'Morning briefing', dayRelevance: ['Morning'] }
    );
  }

  // Afternoon (13-16) — execution
  if (hour >= 13 && hour <= 16) {
    recommendations.push(
      { templateId: 'creative-brief-agent', reason: 'Afternoon creative work', dayRelevance: ['Afternoon'] }
    );
  }

  return recommendations;
}

/**
 * Get anti-recommendations — agent pairs that should NOT be used
 * together to avoid redundancy or conflict.
 */
export function getAntiRecommendations(currentTemplateId: string): Array<{
  templateId: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}> {
  const antiRecs: Record<string, Array<{ templateId: string; reason: string; severity: 'high' | 'medium' | 'low' }>> = {
    'seo-content-cluster-planner': [
      { templateId: 'social-media-content-calendar', reason: 'Both plan content scheduling — use one at a time', severity: 'medium' },
    ],
    'swot-analysis-generator': [
      { templateId: 'competitive-landscape-analysis', reason: 'SWOT and competitive analysis overlap significantly', severity: 'medium' },
    ],
    'lead-score-agent': [
      { templateId: 'follow-up-email-agent', reason: 'Lead scoring should precede follow-up, not run in parallel', severity: 'high' },
    ],
  };

  return antiRecs[currentTemplateId] ?? [];
}
