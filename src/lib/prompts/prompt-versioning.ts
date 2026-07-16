/**
 * Prompt Versioning + A/B Testing System
 *
 * Manages versioned prompts with:
 * - Semantic versioning for prompts
 * - A/B test configuration and execution
 * - Version history tracking
 * - Gradual rollout (canary → 100%)
 * - Performance comparison between versions
 *
 * Integrates with the existing prompt library and metrics system.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { increment, timing } from '@/lib/monitoring/metrics';
import { generateTextWithOpenAI, type GenerateTextProviderInput } from '@/lib/ai/text-provider';

const promptLog = logger.child('prompts:versioning');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PromptVersion {
  /** Unique version ID */
  id: string;
  /** Semantic version string (e.g., "1.0.0", "1.1.0") */
  version: string;
  /** The prompt template text */
  promptText: string;
  /** System prompt (if any) */
  systemPrompt?: string;
  /** Changelog for this version */
  changelog: string;
  /** Who created this version */
  createdBy: string;
  /** When this version was created */
  createdAt: string;
  /** Tags for categorization */
  tags: string[];
  /** Status */
  status: 'draft' | 'active' | 'archived' | 'ab_test';
}

export interface AITestConfig {
  /** Unique test ID */
  id: string;
  /** Human-readable test name */
  name: string;
  /** The prompt key being tested */
  promptKey: string;
  /** Control version (A) */
  controlVersion: string;
  /** Variant version (B) */
  variantVersion: string;
  /** Traffic split: percentage to variant (0-100) */
  variantTrafficPercent: number;
  /** Status */
  status: 'running' | 'paused' | 'completed';
  /** When the test started */
  startedAt: string;
  /** When the test ended (if completed) */
  completedAt?: string;
  /** Minimum sample size before analysis */
  minSampleSize: number;
  /** Current sample count */
  sampleCount: number;
  /** Results */
  results: {
    control: ABTestVariantResult;
    variant: ABTestVariantResult;
  };
}

export interface ABTestVariantResult {
  variantName: string;
  promptVersion: string;
  impressions: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
  avgOutputLength: number;
  cacheHitRate: number;
}

export interface PromptExecutionRecord {
  promptKey: string;
  versionId: string;
  version: string;
  success: boolean;
  durationMs: number;
  outputLength: number;
  cached: boolean;
  error?: string;
  timestamp: string;
}

// ─── Prompt Version Registry ─────────────────────────────────────────────────

/**
 * In-memory prompt version registry.
 * In production, this would be persisted to the database.
 */
class PromptVersionRegistry {
  private versions = new Map<string, PromptVersion[]>();
  private activeVersions = new Map<string, string>(); // promptKey → versionId
  private abTests = new Map<string, AITestConfig>();
  private executionLog: PromptExecutionRecord[] = [];

  /**
   * Register a new version of a prompt.
   */
  registerVersion(promptKey: string, version: PromptVersion): void {
    const existing = this.versions.get(promptKey) ?? [];
    existing.push(version);
    this.versions.set(promptKey, existing);

    // Auto-activate first version
    if (!this.activeVersions.has(promptKey)) {
      this.activeVersions.set(promptKey, version.id);
    }

    promptLog.info('Prompt version registered', {
      promptKey,
      version: version.version,
      id: version.id,
    });
  }

  /**
   * Get all versions for a prompt key.
   */
  getVersions(promptKey: string): PromptVersion[] {
    return this.versions.get(promptKey) ?? [];
  }

  /**
   * Get a specific version by ID.
   */
  getVersion(promptKey: string, versionId: string): PromptVersion | undefined {
    return this.versions.get(promptKey)?.find((v) => v.id === versionId);
  }

  /**
   * Get the active version for a prompt key.
   */
  getActiveVersion(promptKey: string): PromptVersion | undefined {
    const activeId = this.activeVersions.get(promptKey);
    if (!activeId) return undefined;
    return this.getVersion(promptKey, activeId);
  }

  /**
   * Set the active version for a prompt key.
   */
  activateVersion(promptKey: string, versionId: string): boolean {
    const version = this.getVersion(promptKey, versionId);
    if (!version) return false;

    this.activeVersions.set(promptKey, versionId);

    promptLog.info('Prompt version activated', { promptKey, version: version.version });
    return true;
  }

  /**
   * Archive a version.
   */
  archiveVersion(promptKey: string, versionId: string): boolean {
    const version = this.getVersion(promptKey, versionId);
    if (!version) return false;

    version.status = 'archived';
    return true;
  }

  // ─── A/B Testing ───────────────────────────────────────────────────────────

  /**
   * Start an A/B test between two versions.
   */
  startABTest(config: Omit<AITestConfig, 'id' | 'startedAt' | 'sampleCount' | 'results'>): AITestConfig {
    const test: AITestConfig = {
      ...config,
      id: `abtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startedAt: new Date().toISOString(),
      sampleCount: 0,
      results: {
        control: {
          variantName: 'Control (A)',
          promptVersion: config.controlVersion,
          impressions: 0,
          successes: 0,
          failures: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          avgOutputLength: 0,
          cacheHitRate: 0,
        },
        variant: {
          variantName: 'Variant (B)',
          promptVersion: config.variantVersion,
          impressions: 0,
          successes: 0,
          failures: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          avgOutputLength: 0,
          cacheHitRate: 0,
        },
      },
    };

    this.abTests.set(test.id, test);

    // Mark both versions as ab_test
    const controlVersion = this.getVersion(config.promptKey, config.controlVersion);
    const variantVersion = this.getVersion(config.promptKey, config.variantVersion);
    if (controlVersion) controlVersion.status = 'ab_test';
    if (variantVersion) variantVersion.status = 'ab_test';

    promptLog.info('A/B test started', {
      testId: test.id,
      promptKey: config.promptKey,
      controlVersion: config.controlVersion,
      variantVersion: config.variantVersion,
      variantTrafficPercent: config.variantTrafficPercent,
    });

    return test;
  }

  /**
   * Get the version to use for a given prompt key, considering A/B tests.
   * Returns { version, testId } if an A/B test is active.
   */
  resolveVersion(promptKey: string): {
    version: PromptVersion | undefined;
    testId?: string;
    isVariant?: boolean;
  } {
    // Check for active A/B test
    for (const test of this.abTests.values()) {
      if (
        test.promptKey === promptKey &&
        test.status === 'running'
      ) {
        const roll = Math.random() * 100;
        const useVariant = roll < test.variantTrafficPercent;

        const versionId = useVariant ? test.variantVersion : test.controlVersion;
        const version = this.getVersion(promptKey, versionId);

        if (version) {
          return { version, testId: test.id, isVariant: useVariant };
        }
      }
    }

    // No A/B test — use active version
    return { version: this.getActiveVersion(promptKey) };
  }

  /**
   * Record an execution result for A/B test analysis.
   */
  recordExecution(record: PromptExecutionRecord): void {
    this.executionLog.push(record);

    // Limit log size
    if (this.executionLog.length > 10000) {
      this.executionLog.shift();
    }

    // Update A/B test results
    for (const test of this.abTests.values()) {
      if (test.promptKey === record.promptKey && test.status === 'running') {
        const isControl = test.controlVersion === record.versionId;
        const isVariant = test.variantVersion === record.versionId;

        if (isControl || isVariant) {
          const resultKey = isControl ? 'control' : 'variant';
          const result = test.results[resultKey];
          result.impressions++;
          test.sampleCount++;

          if (record.success) {
            result.successes++;
          } else {
            result.failures++;
          }

          result.totalDurationMs += record.durationMs;
          result.avgDurationMs = result.totalDurationMs / result.impressions;

          // Rolling average for output length
          result.avgOutputLength =
            (result.avgOutputLength * (result.impressions - 1) + record.outputLength) /
            result.impressions;

          if (record.cached) {
            result.cacheHitRate =
              (result.cacheHitRate * (result.impressions - 1) + 1) /
              result.impressions;
          } else {
            result.cacheHitRate =
              (result.cacheHitRate * (result.impressions - 1)) /
              result.impressions;
          }
        }

        // Auto-complete test if sample size reached
        if (test.sampleCount >= test.minSampleSize) {
          test.status = 'completed';
          test.completedAt = new Date().toISOString();

          promptLog.info('A/B test auto-completed (sample size reached)', {
            testId: test.id,
            sampleCount: test.sampleCount,
          });
        }
      }
    }

    increment('prompts.execution', {
      success: String(record.success),
      cached: String(record.cached),
    });
  }

  /**
   * Get all A/B tests.
   */
  getABTests(): AITestConfig[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Get a specific A/B test.
   */
  getABTest(testId: string): AITestConfig | undefined {
    return this.abTests.get(testId);
  }

  /**
   * Complete an A/B test and auto-activate the winner.
   */
  completeABTest(testId: string): { winner: 'control' | 'variant' | 'inconclusive'; test: AITestConfig } | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    test.status = 'completed';
    test.completedAt = new Date().toISOString();

    const control = test.results.control;
    const variant = test.results.variant;

    // Determine winner based on success rate
    const controlRate = control.impressions > 0 ? control.successes / control.impressions : 0;
    const variantRate = variant.impressions > 0 ? variant.successes / variant.impressions : 0;

    let winner: 'control' | 'variant' | 'inconclusive' = 'inconclusive';

    if (controlRate > variantRate && control.impressions >= test.minSampleSize / 2) {
      winner = 'control';
      this.activateVersion(test.promptKey, test.controlVersion);
    } else if (variantRate > controlRate && variant.impressions >= test.minSampleSize / 2) {
      winner = 'variant';
      this.activateVersion(test.promptKey, test.variantVersion);
    }

    promptLog.info('A/B test completed', {
      testId,
      winner,
      controlRate: controlRate.toFixed(3),
      variantRate: variantRate.toFixed(3),
      controlSamples: control.impressions,
      variantSamples: variant.impressions,
    });

    return { winner, test };
  }

  /**
   * Generate an A/B test analysis report.
   */
  generateABTestReport(testId: string): string | null {
    const test = this.abTests.get(testId);
    if (!test) return null;

    const control = test.results.control;
    const variant = test.results.variant;

    const controlSuccessRate = control.impressions > 0
      ? ((control.successes / control.impressions) * 100).toFixed(1)
      : 'N/A';
    const variantSuccessRate = variant.impressions > 0
      ? ((variant.successes / variant.impressions) * 100).toFixed(1)
      : 'N/A';

    return [
      `# A/B Test Report: ${test.name}`,
      '',
      `**Status:** ${test.status}`,
      `**Started:** ${test.startedAt}`,
      test.completedAt ? `**Completed:** ${test.completedAt}` : '',
      `**Total Samples:** ${test.sampleCount}`,
      '',
      '## Results',
      '',
      '| Metric | Control (A) | Variant (B) |',
      '|--------|------------|------------|',
      `| Version | ${control.promptVersion} | ${variant.promptVersion} |`,
      `| Impressions | ${control.impressions} | ${variant.impressions} |`,
      `| Success Rate | ${controlSuccessRate}% | ${variantSuccessRate}% |`,
      `| Failures | ${control.failures} | ${variant.failures} |`,
      `| Avg Duration | ${control.avgDurationMs.toFixed(0)}ms | ${variant.avgDurationMs.toFixed(0)}ms |`,
      `| Avg Output Length | ${control.avgOutputLength.toFixed(0)} chars | ${variant.avgOutputLength.toFixed(0)} chars |`,
      `| Cache Hit Rate | ${(control.cacheHitRate * 100).toFixed(1)}% | ${(variant.cacheHitRate * 100).toFixed(1)}% |`,
      '',
      '## Recommendation',
      '',
      test.status === 'completed'
        ? 'Test has reached target sample size. Activate the winning version.'
        : `Test is still running (${test.sampleCount}/${test.minSampleSize} samples).`,
      '',
    ].filter(Boolean).join('\n');
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _registry: PromptVersionRegistry | null = null;

export function getPromptVersionRegistry(): PromptVersionRegistry {
  if (!_registry) {
    _registry = new PromptVersionRegistry();
  }
  return _registry;
}

/**
 * Generate a prompt with versioning and A/B test awareness.
 * Returns the generated text along with version metadata.
 */
export async function generateWithVersionedPrompt(input: {
  promptKey: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  workspaceId: string;
  tags?: string[];
}): Promise<{
  text: string;
  versionId: string;
  version: string;
  testId?: string;
  isVariant?: boolean;
  success: boolean;
  durationMs: number;
}> {
  const startTime = Date.now();
  const registry = getPromptVersionRegistry();

  // Resolve which version to use (considering A/B tests)
  const { version: promptVersion, testId, isVariant } = registry.resolveVersion(input.promptKey);

  if (!promptVersion) {
    // No version registered — use the raw prompt directly
    const providerInput: GenerateTextProviderInput = {
      kind: input.promptKey,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    };

    const result = await generateTextWithOpenAI(providerInput);

    const durationMs = Date.now() - startTime;
    const success = result.ok;

    registry.recordExecution({
      promptKey: input.promptKey,
      versionId: 'raw',
      version: '0.0.0',
      success,
      durationMs,
      outputLength: result.ok ? result.text.length : 0,
      cached: result.ok ? result.finishReason === 'cache_hit' : false,
      error: result.ok ? undefined : result.error,
      timestamp: new Date().toISOString(),
    });

    return {
      text: result.ok ? result.text : '',
      versionId: 'raw',
      version: '0.0.0',
      success,
      durationMs,
    };
  }

  // Use the versioned prompt template
  const renderedSystemPrompt = promptVersion.systemPrompt ?? input.systemPrompt ?? '';
  const renderedUserPrompt = promptVersion.promptText
    .replace(/\{userPrompt\}/g, input.userPrompt)
    .replace(/\{systemPrompt\}/g, renderedSystemPrompt);

  const providerInput: GenerateTextProviderInput = {
    kind: `${input.promptKey}:v${promptVersion.version}`,
    systemPrompt: renderedSystemPrompt,
    userPrompt: renderedUserPrompt,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  };

  const result = await generateTextWithOpenAI(providerInput);

  const durationMs = Date.now() - startTime;
  const success = result.ok;

  registry.recordExecution({
    promptKey: input.promptKey,
    versionId: promptVersion.id,
    version: promptVersion.version,
    success,
    durationMs,
    outputLength: result.ok ? result.text.length : 0,
    cached: result.ok ? result.finishReason === 'cache_hit' : false,
    error: result.ok ? undefined : result.error,
    timestamp: new Date().toISOString(),
  });

  increment('prompts.generated', {
    promptKey: input.promptKey,
    version: promptVersion.version,
    success: String(success),
    abTest: testId ? 'active' : 'none',
  });

  timing('prompts.generation_duration', durationMs, {
    promptKey: input.promptKey,
    version: promptVersion.version,
  });

  return {
    text: result.ok ? result.text : '',
    versionId: promptVersion.id,
    version: promptVersion.version,
    testId,
    isVariant,
    success,
    durationMs,
  };
}

/**
 * Create a new prompt version from a base prompt.
 * Auto-increments the patch version.
 */
export function createNewPromptVersion(input: {
  promptKey: string;
  promptText: string;
  systemPrompt?: string;
  changelog: string;
  createdBy: string;
  tags?: string[];
}): PromptVersion {
  const registry = getPromptVersionRegistry();
  const existing = registry.getVersions(input.promptKey);

  // Auto-increment version
  let major = 1;
  let minor = 0;
  let patch = 0;

  if (existing.length > 0) {
    const latest = existing[existing.length - 1];
    const parts = latest.version.split('.').map(Number);
    major = parts[0] ?? 1;
    minor = parts[1] ?? 0;
    patch = (parts[2] ?? 0) + 1;
  }

  const version: PromptVersion = {
    id: `pv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    version: `${major}.${minor}.${patch}`,
    promptText: input.promptText,
    systemPrompt: input.systemPrompt,
    changelog: input.changelog,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    tags: input.tags ?? [],
    status: existing.length === 0 ? 'active' : 'draft',
  };

  registry.registerVersion(input.promptKey, version);

  return version;
}
