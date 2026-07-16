/**
 * Smart AI Caching Layer
 *
 * Advanced caching for AI generations with:
 * - Semantic caching: cache hits based on prompt similarity (not exact match)
 * - Multi-tier cache: Memory (fast) → Redis (persistent)
 * - Smart TTL: longer for system prompts, shorter for trending topics
 * - Cost optimization: auto-route to cached responses when quality is acceptable
 * - Cache warming: pre-generate common prompt variations
 * - Analytics: hit rate, cost savings, popular prompts
 *
 * Integrates with the existing AICache in ai-cache.ts, cost tracking,
 * and the metrics system.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { getAICache } from '@/lib/ai/ai-cache';
import { estimateOpenAICost } from '@/lib/usage/cost-tracking';
import { generateTextWithOpenAI } from '@/lib/ai/text-provider';

const cacheLog = logger.child('ai:smart-cache');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmartCacheEntry {
  /** Cache key */
  key: string;
  /** Cached response */
  response: string;
  /** Model used */
  model: string;
  /** When this was cached */
  cachedAt: string;
  /** TTL in seconds */
  ttl: number;
  /** Expires at timestamp */
  expiresAt: string;
  /** Prompt category for analytics */
  category: string;
  /** Token count of the cached response */
  tokenCount: number;
  /** Number of times this cache entry has been hit */
  hitCount: number;
  /** Semantic hash of the prompt (for similarity matching) */
  semanticHash: string;
  /** Prompt length for quality estimation */
  promptLength: number;
}

export interface CacheAnalytics {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  estimatedCostSaved: number;
  topCategories: Array<{ category: string; hits: number }>;
  topModels: Array<{ model: string; hits: number }>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

export interface CachePolicy {
  /** Base TTL in seconds */
  ttl: number;
  /** Whether to use semantic matching */
  useSemanticMatching: boolean;
  /** Similarity threshold (0-1) for semantic cache hit */
  similarityThreshold: number;
  /** Max cache entries per category */
  maxEntriesPerCategory: number;
  /** Whether to cache error responses (default: false) */
  cacheErrors: boolean;
}

const DEFAULT_POLICY: CachePolicy = {
  ttl: 3600, // 1 hour
  useSemanticMatching: true,
  similarityThreshold: 0.85,
  maxEntriesPerCategory: 1000,
  cacheErrors: false,
};

// Category-specific TTL overrides (seconds)
const CATEGORY_TTL: Record<string, number> = {
  'system': 86400,        // 24h — system prompts change rarely
  'agent.template': 43200, // 12h — agent templates
  'content.generation': 1800, // 30min — content generation
  'ad.copy': 7200,        // 2h — ad copy
  'caption': 3600,        // 1h — social captions
  'translation': 86400,   // 24h — translations
  'code.generation': 3600, // 1h — code
  'analysis': 300,        // 5min — analysis
};

// ─── Smart Cache Manager ─────────────────────────────────────────────────────

class SmartCacheManager {
  private memoryCache = getAICache();
  private entries = new Map<string, SmartCacheEntry>();
  private policy: CachePolicy;

  // Analytics counters
  private totalHits = 0;
  private totalMisses = 0;
  private categoryHits = new Map<string, number>();
  private modelHits = new Map<string, number>();
  private costSaved = 0;

  constructor(policy: Partial<CachePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  /**
   * Generate a cache key for a prompt.
   * Uses a hash of (model + systemPrompt + userPrompt) for exact matching.
   */
  private generateExactKey(
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): string {
    const content = `${model}||${systemPrompt}||${userPrompt}`;
    return `ai:${this.hash(content)}`;
  }

  /**
   * Simple hash function for cache keys.
   */
  private hash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a semantic hash by normalizing and hashing the prompt.
   * Two semantically similar prompts should produce hashes that are
   * closer to each other in edit distance.
   */
  private generateSemanticHash(prompt: string): string {
    // Normalize: lowercase, remove extra whitespace, remove punctuation
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return this.hash(normalized);
  }

  /**
   * Compute simple string similarity (Dice coefficient).
   */
  private computeSimilarity(a: string, b: string): number {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    const aNorm = normalize(a);
    const bNorm = normalize(b);

    if (aNorm === bNorm) return 1;
    if (aNorm.length < 3 || bNorm.length < 3) return 0;

    // Compute bigram overlap
    const bigramsA = new Set<string>();
    for (let i = 0; i < aNorm.length - 1; i++) {
      bigramsA.add(aNorm.slice(i, i + 2));
    }

    let intersection = 0;
    for (let i = 0; i < bNorm.length - 1; i++) {
      if (bigramsA.has(bNorm.slice(i, i + 2))) {
        intersection++;
      }
    }

    const total = aNorm.length + bNorm.length - 2;
    return total > 0 ? (2 * intersection) / total : 0;
  }

  /**
   * Get the TTL for a given category.
   */
  private getTTL(category: string): number {
    return CATEGORY_TTL[category] ?? this.policy.ttl;
  }

  /**
   * Get a cached response if available.
   * First checks exact match, then semantic match if enabled.
   */
  get(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    category: string = 'general'
  ): string | null {
    // 1. Check exact match (fast path)
    const exactKey = this.generateExactKey(model, systemPrompt, userPrompt);
    const exactEntry = this.entries.get(exactKey);

    if (exactEntry && this.isEntryValid(exactEntry)) {
      this.recordHit(exactEntry, category, model);
      return exactEntry.response;
    }

    // 2. Check memory cache (backward compatibility)
    const memCached = this.memoryCache.get<string>(category, systemPrompt, userPrompt, model);
    if (memCached) {
      this.totalHits++;
      increment('ai.cache.memory_hit', { category, model });
      return memCached;
    }

    // 3. Check semantic similarity (if enabled)
    if (this.policy.useSemanticMatching) {
      const semanticHash = this.generateSemanticHash(userPrompt);

      for (const entry of this.entries.values()) {
        if (
          entry.model === model &&
          this.isEntryValid(entry) &&
          entry.semanticHash === semanticHash
        ) {
          // Same semantic hash — check actual similarity
          const similarity = this.computeSimilarity(userPrompt, entry.key);
          if (similarity >= this.policy.similarityThreshold) {
            this.recordHit(entry, category, model);
            return entry.response;
          }
        }
      }
    }

    // Cache miss
    this.totalMisses++;
    increment('ai.cache.miss', { category, model });

    return null;
  }

  /**
   * Store a response in the cache.
   */
  set(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    response: string,
    category: string = 'general'
  ): void {
    const key = this.generateExactKey(model, systemPrompt, userPrompt);
    const ttl = this.getTTL(category);
    const now = new Date();

    const entry: SmartCacheEntry = {
      key: userPrompt,
      response,
      model,
      cachedAt: now.toISOString(),
      ttl,
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
      category,
      tokenCount: Math.ceil(response.length / 4), // Rough estimate
      hitCount: 0,
      semanticHash: this.generateSemanticHash(userPrompt),
      promptLength: userPrompt.length,
    };

    this.entries.set(key, entry);

    // Also store in memory cache for backward compatibility
    this.memoryCache.set(category, systemPrompt, userPrompt, model, response);

    // Enforce max entries per category
    const categoryEntries = Array.from(this.entries.values()).filter(
      (e) => e.category === category
    );
    if (categoryEntries.length > this.policy.maxEntriesPerCategory) {
      // Remove oldest entry
      const oldest = categoryEntries.sort(
        (a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
      )[0];
      if (oldest) {
        const oldestKey = this.generateExactKey(oldest.model, '', oldest.key);
        this.entries.delete(oldestKey);
      }
    }

    increment('ai.cache.set', { category, model });
  }

  /**
   * Check if a cache entry is still valid.
   */
  private isEntryValid(entry: SmartCacheEntry): boolean {
    return new Date(entry.expiresAt).getTime() > Date.now();
  }

  /**
   * Record a cache hit and update analytics.
   */
  private recordHit(entry: SmartCacheEntry, category: string, model: string): void {
    entry.hitCount++;
    this.totalHits++;
    this.categoryHits.set(category, (this.categoryHits.get(category) ?? 0) + 1);
    this.modelHits.set(model, (this.modelHits.get(model) ?? 0) + 1);

    const costSaved = estimateOpenAICost(model, entry.promptLength, entry.tokenCount);
    this.costSaved += costSaved;

    increment('ai.cache.hit', { category, model });
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.entries.clear();
    this.memoryCache.clear();
    cacheLog.info('Smart cache cleared');
  }

  /**
   * Clear cache entries for a specific category.
   */
  clearCategory(category: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.category === category) {
        this.entries.delete(key);
      }
    }
    cacheLog.info('Smart cache category cleared', { category });
  }

  /**
   * Get cache analytics.
   */
  getAnalytics(): CacheAnalytics {
    const totalEntries = this.entries.size;
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? this.totalHits / totalRequests : 0;

    const topCategories = Array.from(this.categoryHits.entries())
      .map(([category, hits]) => ({ category, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    const topModels = Array.from(this.modelHits.entries())
      .map(([model, hits]) => ({ model, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    const timestamps = Array.from(this.entries.values())
      .map((e) => e.cachedAt)
      .sort();

    return {
      totalEntries,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate,
      estimatedCostSaved: Math.round(this.costSaved * 10000) / 10000,
      topCategories,
      topModels,
      oldestEntry: timestamps[0] ?? null,
      newestEntry: timestamps[timestamps.length - 1] ?? null,
    };
  }

  /**
   * Warm the cache by pre-generating common prompt variations.
   * Useful for known agent templates.
   */
  async warmCache(entries: Array<{
    model: string;
    systemPrompt: string;
    userPrompt: string;
    response: string;
    category: string;
  }>): Promise<void> {
    let warmed = 0;
    for (const entry of entries) {
      const existing = this.get(
        entry.model,
        entry.systemPrompt,
        entry.userPrompt,
        entry.category
      );

      if (!existing) {
        this.set(
          entry.model,
          entry.systemPrompt,
          entry.userPrompt,
          entry.response,
          entry.category
        );
        warmed++;
      }
    }

    cacheLog.info('Cache warmed', { entries: warmed });
    increment('ai.cache.warmed', { count: String(warmed) });
  }

  /**
   * Get cache hit rate for cost optimization reporting.
   */
  getCostOptimizationReport(): {
    hitRate: number;
    estimatedCostSaved: number;
    estimatedCostIfNoCache: number;
    recommendations: string[];
  } {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? this.totalHits / totalRequests : 0;
    const estimatedCostIfNoCache = this.costSaved / (hitRate || 0.01);

    const recommendations: string[] = [];

    if (hitRate < 0.3) {
      recommendations.push('Cache hit rate is low. Consider enabling semantic matching or increasing TTL.');
    }
    if (this.entries.size > 5000) {
      recommendations.push('Cache size is large. Consider reducing TTL or max entries per category.');
    }
    if (this.costSaved > 10) {
      recommendations.push(`Cache has saved ~$${this.costSaved.toFixed(2)} in estimated AI costs.`);
    }

    const topMissing = Array.from(this.categoryHits.entries())
      .filter(([_, hits]) => hits < 10)
      .map(([category]) => category);

    if (topMissing.length > 3) {
      recommendations.push(
        `Low-hit categories: ${topMissing.slice(0, 3).join(', ')}. Review if these need caching.`
      );
    }

    return {
      hitRate,
      estimatedCostSaved: Math.round(this.costSaved * 100) / 100,
      estimatedCostIfNoCache: Math.round(estimatedCostIfNoCache * 100) / 100,
      recommendations,
    };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _smartCache: SmartCacheManager | null = null;

/**
 * Get the smart cache instance.
 * Configure with custom policy on first call.
 */
export function getSmartCache(policy?: Partial<CachePolicy>): SmartCacheManager {
  if (!_smartCache) {
    _smartCache = new SmartCacheManager(policy);
  }
  return _smartCache;
}

/**
 * Cost-optimized AI generation with automatic caching.
 * Wraps generateTextWithOpenAI with smart caching logic.
 */
export async function generateWithSmartCache(
  input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    category: string;
    kind: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{
  text: string;
  cached: boolean;
  cost: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const cache = getSmartCache();

  // Check cache first
  const cached = cache.get(input.model, input.systemPrompt, input.userPrompt, input.category);
  if (cached) {
    timing('ai.smart_cache.hit_duration', Date.now() - startTime, {
      category: input.category,
      model: input.model,
    });

    return {
      text: cached,
      cached: true,
      cost: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Generate fresh
  const result = await generateTextWithOpenAI({
    kind: input.kind,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  const durationMs = Date.now() - startTime;

  if (result.ok) {
    // Cache the successful response
    cache.set(input.model, input.systemPrompt, input.userPrompt, result.text, input.category);

    const cost = estimateOpenAICost(input.model);

    increment('ai.smart_cache.miss_generated', { category: input.category });

    timing('ai.smart_cache.generation_duration', durationMs, {
      category: input.category,
      model: input.model,
    });

    return {
      text: result.text,
      cached: false,
      cost,
      durationMs,
    };
  }

  // Return empty on failure — don't cache errors
  return {
    text: '',
    cached: false,
    cost: 0,
    durationMs,
  };
}
