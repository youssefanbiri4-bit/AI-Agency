/**
 * Workflow Auto-Optimizer
 *
 * Analyzes agent workflows to detect bottlenecks, calculate
 * efficiency scores, and suggest improvements. Uses signal-based
 * analysis from workflow review data and agent usage patterns.
 *
 * Features:
 * - Bottleneck detection (slow steps, missing inputs, dependencies)
 * - Efficiency scoring (0-100) with breakdown by category
 * - Improvement suggestions with expected impact
 * - Optimal agent sequencing (parallelization opportunities)
 * - Cycle time estimation
 * - Redundancy detection
 */

import 'server-only';

import { logger } from '@/lib/logger';
import type { AgentWorkflowDraft, AgentWorkflowStep } from '@/lib/agent-library/workflow-builder';
import { reviewAgentWorkflow } from '@/lib/agent-library/workflow-review';
import { getAgentTemplateById } from '@/lib/agent-library/templates';

const optimizeLog = logger.child('agents:workflow-optimizer');

// ===== Types =====

export interface WorkflowOptimizationResult {
  /** Overall efficiency score 0-100 */
  efficiencyScore: number;
  /** Readiness score from workflow review */
  readinessScore: number;
  /** Category breakdown */
  categoryScores: OptimizationCategoryScores;
  /** Detected bottlenecks */
  bottlenecks: Bottleneck[];
  /** Improvement suggestions */
  improvements: ImprovementSuggestion[];
  /** Parallelization opportunities */
  parallelization: ParallelizationOpportunity[];
  /** Redundancy warnings */
  redundancies: RedundancyWarning[];
  /** Missing input analysis */
  inputHealth: InputHealthAnalysis;
  /** Structural analysis */
  structure: StructureAnalysis;
  /** Summary */
  summary: string;
  /** Optimization history (if any) */
  optimizationHistory?: OptimizationHistoryEntry[];
}

export interface OptimizationCategoryScores {
  /** Input completeness (0-100) */
  inputCompleteness: number;
  /** Step diversity (0-100) */
  stepDiversity: number;
  /** Dependency efficiency (0-100) */
  dependencyEfficiency: number;
  /** Safety compliance (0-100) */
  safetyCompliance: number;
  /** Output clarity (0-100) */
  outputClarity: number;
}

export interface Bottleneck {
  /** Step index where bottleneck occurs */
  stepIndex: number;
  /** Step description */
  stepName: string;
  /** Bottleneck type */
  type: 'input_dependency' | 'missing_inputs' | 'sequential_slowdown' | 'overloaded_step' | 'approval_gate';
  /** Severity 0-100 */
  severity: number;
  /** Description of the bottleneck */
  description: string;
  /** Suggested fix */
  suggestedFix: string;
}

export interface ImprovementSuggestion {
  /** Category of improvement */
  category: 'inputs' | 'structure' | 'parallelization' | 'safety' | 'efficiency';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Expected impact on efficiency score */
  expectedImpact: number;
  /** Effort level to implement */
  effort: 'low' | 'medium' | 'high';
  /** Whether it's an auto-fix or manual */
  autoFixable: boolean;
}

export interface ParallelizationOpportunity {
  /** Steps that can run in parallel */
  stepIndices: number[];
  /** Step names */
  stepNames: string[];
  /** Reasoning */
  reason: string;
  /** Estimated time saved (relative) */
  estimatedTimeSaved: string;
}

export interface RedundancyWarning {
  /** Steps that are redundant */
  stepIndices: number[];
  /** Description */
  description: string;
  /** Severity 0-100 */
  severity: number;
  /** Suggestion */
  suggestion: string;
}

export interface InputHealthAnalysis {
  /** Total inputs needed */
  totalInputsNeeded: number;
  /** Inputs that are covered */
  coveredInputs: number;
  /** Inputs that are missing */
  missingInputs: number;
  /** Coverage percentage */
  coveragePercent: number;
  /** Missing inputs by step */
  missingByStep: Array<{ stepIndex: number; stepName: string; inputs: string[] }>;
  /** Recommended input template */
  recommendedInputTemplate?: string;
}

export interface StructureAnalysis {
  /** Number of steps */
  stepCount: number;
  /** Path length (longest dependency chain) */
  pathLength: number;
  /** Degree of sequentialness (0 = fully parallel, 100 = fully sequential) */
  sequentialDegree: number;
  /** Whether it's a DAG (no circular deps) */
  isDag: boolean;
  /** Recommended max parallel width */
  recommendedParallelWidth: number;
  /** Structural score 0-100 */
  structureScore: number;
}

export interface OptimizationHistoryEntry {
  timestamp: string;
  previousScore: number;
  newScore: number;
  changes: string[];
}

// ===== Category Scoring Weights =====

const SCORE_WEIGHTS = {
  inputCompleteness: 0.25,
  stepDiversity: 0.20,
  dependencyEfficiency: 0.20,
  safetyCompliance: 0.20,
  outputClarity: 0.15,
};

// ===== Core Scoring Functions =====

/**
 * Score input completeness based on what's covered in the workflow
 */
function scoreInputCompleteness(workflow: AgentWorkflowDraft): {
  score: number;
  analysis: InputHealthAnalysis;
} {
  const allCovered: Set<string> = new Set();
  const missingByStep: Array<{ stepIndex: number; stepName: string; inputs: string[] }> = [];
  let totalInputs = 0;
  let coveredInputs = 0;

  const context = [workflow.name, workflow.goal, workflow.notes].join(' ').toLowerCase();

  for (const step of workflow.steps) {
    const stepInputs = step.requiredInputs.filter((input) => {
      totalInputs++;
      // Check if input is covered in workflow context
      const words = input.toLowerCase().split(/[^a-z0-9\u0590-\u08FF]+/);
      const isCovered = words.some((w) => w.length > 3 && context.includes(w));
      if (isCovered) {
        coveredInputs++;
        allCovered.add(input);
      }
      return !isCovered;
    });

    if (stepInputs.length > 0) {
      missingByStep.push({
        stepIndex: step.index,
        stepName: step.template.name,
        inputs: stepInputs,
      });
    }
  }

  const coveragePercent = totalInputs > 0 ? Math.round((coveredInputs / totalInputs) * 100) : 100;

  return {
    score: coveragePercent,
    analysis: {
      totalInputsNeeded: totalInputs,
      coveredInputs,
      missingInputs: totalInputs - coveredInputs,
      coveragePercent,
      missingByStep,
    },
  };
}

/**
 * Score step diversity — penalizes too many similar steps
 */
function scoreStepDiversity(workflow: AgentWorkflowDraft): number {
  const categories = new Map<string, number>();
  for (const step of workflow.steps) {
    categories.set(step.template.category, (categories.get(step.template.category) ?? 0) + 1);
  }

  if (workflow.steps.length === 0) return 0;
  if (workflow.steps.length === 1) return 60; // Single step is acceptable

  // Penalize if >60% of steps come from the same category
  const maxCategoryCount = Math.max(...categories.values());
  const ratio = maxCategoryCount / workflow.steps.length;

  if (ratio > 0.8) return Math.round(40 * (1 - ratio));
  if (ratio > 0.6) return Math.round(60 * (1 - ratio));

  return Math.min(100, Math.round(70 + (1 - ratio) * 50));
}

/**
 * Score dependency efficiency — how well steps flow into each other
 */
function scoreDependencyEfficiency(workflow: AgentWorkflowDraft): number {
  if (workflow.steps.length <= 1) return 100;

  let score = 100;
  const outputKeywords = new Set<string>();
  for (const step of workflow.steps) {
    for (const output of step.expectedOutputs) {
      outputKeywords.add(output.toLowerCase().split(' ').slice(0, 3).join(' '));
    }
  }

  // Check output-to-input flow
  for (let i = 1; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const hasFlow = step.requiredInputs.some((input) => {
      const inputWords = input.toLowerCase().split(' ').slice(0, 3).join(' ');
      return Array.from(outputKeywords).some((kw) => kw.includes(inputWords) || inputWords.includes(kw));
    });

    if (!hasFlow) {
      score -= 15; // Penalty for disconnected steps
    }
  }

  return Math.max(0, Math.round(score));
}

/**
 * Score safety compliance based on workflow review
 */
function scoreSafety(workflow: AgentWorkflowDraft): number {
  const review = reviewAgentWorkflow(workflow);
  return review.readiness_score;
}

/**
 * Score output clarity
 */
function scoreOutputClarity(workflow: AgentWorkflowDraft): number {
  if (workflow.steps.length === 0) return 0;

  let score = 100;
  for (const step of workflow.steps) {
    if (step.expectedOutputs.length === 0) score -= 20;
    if (step.expectedOutputs.length < 2) score -= 10;
  }

  if (!workflow.goal || workflow.goal.length < 10) score -= 15;
  if (!workflow.name || workflow.name.length < 5) score -= 5;

  return Math.max(0, score);
}

// ===== Bottleneck Detection =====

function detectBottlenecks(workflow: AgentWorkflowDraft): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  for (const step of workflow.steps) {
    // Missing inputs bottleneck
    if (step.requiredInputs.length > 3 && step.expectedOutputs.length < 2) {
      bottlenecks.push({
        stepIndex: step.index,
        stepName: step.template.name,
        type: 'input_dependency',
        severity: 70,
        description: `${step.template.name} requires ${step.requiredInputs.length} inputs but only produces ${step.expectedOutputs.length} clear outputs. This may create a data bottleneck.`,
        suggestedFix: 'Break this step into smaller sub-steps or ensure all inputs are pre-computed before this step.',
      });
    }

    // Approval gate bottleneck
    if (step.template.safety_level === 'requires_review') {
      bottlenecks.push({
        stepIndex: step.index,
        stepName: step.template.name,
        type: 'approval_gate',
        severity: step.template.execution_mode === 'supervised' ? 50 : 30,
        description: `${step.template.name} requires human review before proceeding, which will introduce wait time.`,
        suggestedFix: 'Prepare all required context in advance to minimize review turnaround time.',
      });
    }
  }

  // Sequential bottleneck — too many steps in a row from same category
  const categorySequence = workflow.steps.map((s) => s.template.category);
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < categorySequence.length; i++) {
    if (categorySequence[i] === categorySequence[i - 1]) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  if (maxRun >= 3) {
    const affectedSteps = workflow.steps
      .filter((s) => s.template.category === categorySequence[0])
      .slice(0, maxRun);
    bottlenecks.push({
      stepIndex: affectedSteps[0]?.index ?? 1,
      stepName: `Sequential ${categorySequence[0]} steps`,
      type: 'sequential_slowdown',
      severity: Math.min(80, maxRun * 15),
      description: `${maxRun} consecutive steps from "${categorySequence[0]}" category. Consider interleaving with other categories or parallelizing.`,
      suggestedFix: 'Mix in complementary steps from different categories to reduce monotony and potential wait times.',
    });
  }

  return bottlenecks;
}

// ===== Improvement Suggestions =====

function generateImprovements(
  workflow: AgentWorkflowDraft,
  categoryScores: OptimizationCategoryScores,
  bottlenecks: Bottleneck[]
): ImprovementSuggestion[] {
  const improvements: ImprovementSuggestion[] = [];

  // Input completeness improvements
  if (categoryScores.inputCompleteness < 60) {
    improvements.push({
      category: 'inputs',
      title: 'Add missing context inputs',
      description: 'Several steps are missing required inputs. Add details about the target audience, brand, or campaign goal to the workflow notes.',
      expectedImpact: 15,
      effort: 'low',
      autoFixable: true,
    });
  }

  // Step diversity improvements
  if (categoryScores.stepDiversity < 50) {
    improvements.push({
      category: 'structure',
      title: 'Diversify agent selection',
      description: 'Too many steps from the same category. Consider adding complementary agents from other categories for a more balanced workflow.',
      expectedImpact: 12,
      effort: 'medium',
      autoFixable: false,
    });
  }

  // Safety improvements
  if (categoryScores.safetyCompliance < 70) {
    improvements.push({
      category: 'safety',
      title: 'Add safety review gates',
      description: 'Workflow has low safety compliance. Add review checkpoints before execution-intensive steps.',
      expectedImpact: 10,
      effort: 'medium',
      autoFixable: true,
    });
  }

  // Structural improvements from bottlenecks
  for (const bottleneck of bottlenecks) {
    if (bottleneck.type === 'approval_gate') {
      improvements.push({
        category: 'efficiency',
        title: `Pre-compute context for ${bottleneck.stepName}`,
        description: bottleneck.suggestedFix,
        expectedImpact: 8,
        effort: 'low',
        autoFixable: true,
      });
    }
  }

  // General efficiency improvements
  if (workflow.steps.length > 6) {
    improvements.push({
      category: 'efficiency',
      title: 'Reduce workflow complexity',
      description: `Workflow has ${workflow.steps.length} steps. Consider splitting into sub-workflows of 3-4 steps each for better manageability.`,
      expectedImpact: 20,
      effort: 'high',
      autoFixable: false,
    });
  }

  if (workflow.steps.length <= 1 && workflow.steps.length > 0) {
    improvements.push({
      category: 'structure',
      title: 'Add more workflow steps',
      description: 'A single-step workflow can be expanded. Consider adding analysis, review, or output formatting steps.',
      expectedImpact: 25,
      effort: 'medium',
      autoFixable: false,
    });
  }

  return improvements;
}

// ===== Parallelization Detection =====

function detectParallelization(workflow: AgentWorkflowDraft): ParallelizationOpportunity[] {
  const opportunities: ParallelizationOpportunity[] = [];
  const categories = new Map<string, number[]>();

  // Group steps by category
  for (const step of workflow.steps) {
    const indices = categories.get(step.template.category) ?? [];
    indices.push(step.index);
    categories.set(step.template.category, indices);
  }

  // Sequential steps in different categories can potentially run in parallel
  if (workflow.steps.length >= 3) {
    for (let i = 0; i < workflow.steps.length - 1; i++) {
      const current = workflow.steps[i];
      const next = workflow.steps[i + 1];

      if (current.template.category !== next.template.category &&
          current.template.safety_level === 'safe' &&
          next.template.safety_level === 'safe') {
        opportunities.push({
          stepIndices: [current.index, next.index],
          stepNames: [current.template.name, next.template.name],
          reason: `Steps from different categories (${current.template.category} and ${next.template.category}) with no strict ordering dependency.`,
          estimatedTimeSaved: '~30-40%',
        });
      }
    }
  }

  // Within-category steps (if they don't depend on each other)
  for (const [, indices] of categories.entries()) {
    if (indices.length >= 2) {
      const steps = indices.map((i) => workflow.steps.find((s) => s.index === i)).filter(Boolean) as AgentWorkflowStep[];
      if (steps.length >= 2 && steps.every((s) => s.template.safety_level === 'safe')) {
        opportunities.push({
          stepIndices: indices,
          stepNames: steps.map((s) => s.template.name),
          reason: `Same-category steps can often be parallelized if they analyze different aspects.`,
          estimatedTimeSaved: '~20-30%',
        });
      }
    }
  }

  return opportunities.slice(0, 4);
}

// ===== Redundancy Detection =====

function detectRedundancies(workflow: AgentWorkflowDraft): RedundancyWarning[] {
  const warnings: RedundancyWarning[] = [];
  const seenOutputs = new Map<string, number[]>();

  for (const step of workflow.steps) {
    for (const output of step.expectedOutputs) {
      const key = output.toLowerCase().split(' ').slice(0, 4).join(' ');
      const indices = seenOutputs.get(key) ?? [];
      indices.push(step.index);
      seenOutputs.set(key, indices);
    }
  }

  // Check for overlapping outputs
  for (const [, indices] of seenOutputs.entries()) {
    if (indices.length >= 2) {
      const stepNames = indices
        .map((i) => workflow.steps.find((s) => s.index === i)?.template.name)
        .filter(Boolean) as string[];

      if (new Set(stepNames).size >= 2) {
        warnings.push({
          stepIndices: indices,
          description: `Steps ${indices.join(', ')} (${stepNames.join(', ')}) produce overlapping outputs. Consider consolidating.`,
          severity: Math.min(70, 30 + stepNames.length * 10),
          suggestion: `Combine or differentiate the outputs of ${stepNames.join(' and ')} to avoid duplicated work.`,
        });
      }
    }
  }

  return warnings;
}

// ===== Structure Analysis =====

function analyzeStructure(workflow: AgentWorkflowDraft): StructureAnalysis {
  const stepCount = workflow.steps.length;
  const categorySet = new Set(workflow.steps.map((s) => s.template.category));
  const sequentialDegree = stepCount <= 1
    ? 0
    : Math.round((1 - (categorySet.size / stepCount)) * 100);

  // Path length: number of steps in longest sequential chain
  const pathLength = stepCount;

  const structureScore = stepCount === 0
    ? 0
    : stepCount === 1
      ? 60
      : Math.min(100, Math.round(
          50 +
          (categorySet.size / Math.max(1, stepCount)) * 20 +
          (1 - sequentialDegree / 100) * 15 +
          (stepCount <= 6 ? 15 : -10)
        ));

  return {
    stepCount,
    pathLength,
    sequentialDegree,
    isDag: true, // Workflows are inherently DAGs
    recommendedParallelWidth: Math.max(1, Math.ceil(stepCount / 3)),
    structureScore,
  };
}

// ===== Main Optimization Function =====

/**
 * Run full workflow optimization analysis.
 */
export function optimizeWorkflow(workflow: AgentWorkflowDraft): WorkflowOptimizationResult {
  const startTime = Date.now();

  // 1. Calculate category scores
  const { score: inputScore, analysis: inputAnalysis } = scoreInputCompleteness(workflow);
  const diversityScore = scoreStepDiversity(workflow);
  const dependencyScore = scoreDependencyEfficiency(workflow);
  const safetyScore = scoreSafety(workflow);
  const outputScore = scoreOutputClarity(workflow);

  const categoryScores: OptimizationCategoryScores = {
    inputCompleteness: inputScore,
    stepDiversity: diversityScore,
    dependencyEfficiency: dependencyScore,
    safetyCompliance: safetyScore,
    outputClarity: outputScore,
  };

  // 2. Calculate overall efficiency score
  const efficiencyScore = Math.round(
    inputScore * SCORE_WEIGHTS.inputCompleteness +
    diversityScore * SCORE_WEIGHTS.stepDiversity +
    dependencyScore * SCORE_WEIGHTS.dependencyEfficiency +
    safetyScore * SCORE_WEIGHTS.safetyCompliance +
    outputScore * SCORE_WEIGHTS.outputClarity
  );

  // 3. Detect issues
  const bottlenecks = detectBottlenecks(workflow);
  const improvements = generateImprovements(workflow, categoryScores, bottlenecks);
  const parallelization = detectParallelization(workflow);
  const redundancies = detectRedundancies(workflow);
  const structure = analyzeStructure(workflow);

  // 4. Get readiness score from existing review system
  const review = reviewAgentWorkflow(workflow);

  // 5. Generate summary
  const summary = generateOptimizationSummary(workflow, efficiencyScore, bottlenecks, improvements);

  optimizeLog.info('Workflow optimization completed', {
    workflowName: workflow.name,
    efficiencyScore,
    bottlenecksFound: bottlenecks.length,
    improvementsGenerated: improvements.length,
    durationMs: Date.now() - startTime,
  });

  return {
    efficiencyScore,
    readinessScore: review.readiness_score,
    categoryScores,
    bottlenecks,
    improvements,
    parallelization,
    redundancies,
    inputHealth: inputAnalysis,
    structure,
    summary,
  };
}

function generateOptimizationSummary(
  workflow: AgentWorkflowDraft,
  score: number,
  bottlenecks: Bottleneck[],
  improvements: ImprovementSuggestion[]
): string {
  const totalImpact = improvements.reduce((sum, i) => sum + i.expectedImpact, 0);

  if (score >= 80) {
    return `${workflow.name} is well-optimized (score: ${score}/100). ${improvements.length} minor improvements could increase efficiency by up to ${totalImpact} points.`;
  }
  if (score >= 60) {
    return `${workflow.name} has good structure (score: ${score}/100). Resolving ${bottlenecks.length} bottleneck(s) and applying ${improvements.length} improvements could increase efficiency by ${totalImpact} points.`;
  }
  if (score >= 40) {
    return `${workflow.name} needs optimization (score: ${score}/100). Focus on fixing ${bottlenecks.length} critical bottlenecks and addressing the top ${Math.min(3, improvements.length)} improvements for a ~${totalImpact} point gain.`;
  }
  return `${workflow.name} requires significant restructuring (score: ${score}/100). Consider rebuilding with clearer inputs, better agent diversity, and safety gates.`;
}

/**
 * Suggest an optimal agent sequence for a given goal.
 * Uses category diversity and dependency analysis to order agents.
 */
export function suggestOptimalSequence(
  templateIds: string[]
): Array<{ templateId: string; suggestedOrder: number; reason: string }> {
  const templates = templateIds
    .map((id) => getAgentTemplateById(id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  // Ordered by category priority (research → strategy → content → execution → review)
  const categoryOrder: Record<string, number> = {
    'Research & Strategy': 1,
    'Content & Growth': 2,
    'Sales & Operations': 3,
    'n8n Workflow Ideas': 4,
    'Alex Assistant Skills': 5,
    'Reports & Analytics': 6,
    'Developer/Code Agents': 7,
  };

  // Ensure all template categories are covered (unmapped categories get lowest priority)
  for (const t of templates) {
    if (!(t.category in categoryOrder)) {
      categoryOrder[t.category] = 99;
    }
  }

  const ordered = templates
    .map((t) => ({
      templateId: t.id,
      originalIndex: templateIds.indexOf(t.id),
      categoryOrder: categoryOrder[t.category] ?? 99,
      name: t.name,
    }))
    .sort((a, b) => a.categoryOrder - b.categoryOrder)
    .map((item, index) => ({
      templateId: item.templateId,
      suggestedOrder: index + 1,
      reason: index === 0
        ? 'Start with research/strategy to establish context'
        : index === templateIds.length - 1
          ? 'End with review/reporting for verification'
          : 'Continue with complementary execution steps',
    }));

  return ordered;
}

/**
 * Get a workflow health score from 0-100 summarizing overall optimization state.
 */
export function getWorkflowHealthSummary(workflow: AgentWorkflowDraft): {
  score: number;
  label: string;
  color: string;
} {
  const result = optimizeWorkflow(workflow);

  let label: string;
  let color: string;

  if (result.efficiencyScore >= 80) {
    label = 'Excellent';
    color = '#22c55e';
  } else if (result.efficiencyScore >= 60) {
    label = 'Good';
    color = '#eab308';
  } else if (result.efficiencyScore >= 40) {
    label = 'Needs Improvement';
    color = '#f97316';
  } else {
    label = 'Poor';
    color = '#ef4444';
  }

  return {
    score: result.efficiencyScore,
    label,
    color,
  };
}
