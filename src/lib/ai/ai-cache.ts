import { createHash } from 'crypto';
import { startSpan } from '@sentry/nextjs';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  model: string;
  kind: string;
  tokensEstimate: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSavedTokens: number;
  totalSavedCost: number;
}

interface CacheConfig {
  maxEntries: number;
  ttlMs: number;
  maxTokensPerEntry: number;
  enableSemanticSimilarity: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  ttlMs: 30 * 60 * 1000, // 30 minutes
  maxTokensPerEntry: 4000,
  enableSemanticSimilarity: false,
};

const costPerToken: Record<string, number> = {
  'gpt-4.1-mini': 0.0000004,
  'gpt-4.1': 0.0000025,
  'gpt-4o-mini': 0.00000015,
  'gpt-4o': 0.000005,
  'o3-mini': 0.000001,
};

class AICache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, totalSavedTokens: 0, totalSavedCost: 0 };
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private generateKey(kind: string, systemPrompt: string, userPrompt: string, model: string): string {
    const content = `${kind}:${systemPrompt}:${userPrompt}:${model}`;
    return createHash('sha256').update(content).digest('hex').slice(0, 32);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private calculateCost(model: string, tokens: number): number {
    const rate = costPerToken[model] ?? 0.000001;
    return tokens * rate;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > this.config.ttlMs;
  }

  private evictOldest(): void {
    if (this.cache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  get<T>(kind: string, systemPrompt: string, userPrompt: string, model: string): T | null {
    return startSpan(
      {
        op: 'ai.cache.get',
        name: 'AI Cache Lookup',
      },
      (span) => {
        const key = this.generateKey(kind, systemPrompt, userPrompt, model);
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
          this.stats.misses++;
          span.setAttribute('ai.cache.hit', false);
          return null;
        }

        if (this.isExpired(entry)) {
          this.cache.delete(key);
          this.stats.misses++;
          span.setAttribute('ai.cache.hit', false);
          return null;
        }

        entry.hits++;
        this.stats.hits++;
        this.stats.totalSavedTokens += entry.tokensEstimate;
        this.stats.totalSavedCost += this.calculateCost(model, entry.tokensEstimate);

        span.setAttribute('ai.cache.hit', true);
        span.setAttribute('ai.cache.hits', entry.hits);
        span.setAttribute('ai.cache.saved_tokens', entry.tokensEstimate);

        return entry.data;
      }
    );
  }

  set<T>(kind: string, systemPrompt: string, userPrompt: string, model: string, data: T): void {
    startSpan(
      {
        op: 'ai.cache.set',
        name: 'AI Cache Store',
      },
      (span) => {
        const key = this.generateKey(kind, systemPrompt, userPrompt, model);
        const tokensEstimate = this.estimateTokens(userPrompt) + this.estimateTokens(JSON.stringify(data));

        while (this.cache.size >= this.config.maxEntries) {
          this.evictOldest();
        }

        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          hits: 0,
          model,
          kind,
          tokensEstimate,
        });

        span.setAttribute('ai.cache.size', this.cache.size);
        span.setAttribute('ai.cache.tokens_estimate', tokensEstimate);
      }
    );
  }

  invalidate(kind?: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (!kind || entry.kind === kind) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalSavedTokens: 0, totalSavedCost: 0 };
  }
}

let globalCache: AICache | null = null;

export function getAICache(config?: Partial<CacheConfig>): AICache {
  if (!globalCache) {
    globalCache = new AICache(config);
  }
  return globalCache;
}

export function resetAICache(): void {
  if (globalCache) {
    globalCache.clear();
    globalCache = null;
  }
}

export function getAICacheStats() {
  return getAICache().getStats();
}

export function invalidateAICache(kind?: string) {
  return getAICache().invalidate(kind);
}
