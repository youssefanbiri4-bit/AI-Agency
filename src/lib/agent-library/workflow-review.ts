import type { AgentWorkflowDraft, AgentWorkflowStep } from './workflow-builder';
import { buildWorkflowDiagramFromDraft } from './workflow-diagram';

export type WorkflowReviewStatus = 'ready' | 'needs_inputs' | 'risky' | 'blocked';

export interface WorkflowReviewResult {
  overall_status: WorkflowReviewStatus;
  readiness_score: number;
  missing_inputs: string[];
  weak_steps: string[];
  duplicate_steps: string[];
  unsafe_actions_detected: string[];
  provider_blockers: string[];
  required_approvals: string[];
  recommended_fixes: string[];
  safe_next_actions: string[];
  review_summary: string;
}

const requiredContextHints = [
  { label: 'workflow goal', pattern: /goal|objective|هدف|but|objectif/i },
  { label: 'target audience or ICP', pattern: /audience|persona|icp|customer|client|جمهور|عميل|cible/i },
  { label: 'brand/product name', pattern: /brand|product|service|offer|منتج|خدمة|marque|offre/i },
  { label: 'platform/channel', pattern: /instagram|facebook|linkedin|google|tiktok|email|platform|channel|منصة|قناة/i },
  { label: 'language/tone', pattern: /tone|voice|language|arabic|darija|french|english|لغة|نبرة|ton/i },
];

const unsafePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Publishing or live posting', pattern: /publish|posting|post live|go live|نشر|publier/i },
  { label: 'Scheduling content automatically', pattern: /schedule|scheduled posting|cron publish|جدولة|planifier/i },
  { label: 'Live ads or campaign launch', pattern: /launch campaign|live ads|create ads|google ads|meta campaign|إعلانات|publicit/i },
  { label: 'Spending or budget execution', pattern: /spend|budget|billing|bid|daily budget|صرف|ميزانية/i },
  { label: 'Deleting data', pattern: /delete|remove records|drop table|حذف|supprimer/i },
  { label: 'GitHub writes', pattern: /push|merge|commit|create pr|github write/i },
  { label: 'n8n execution or webhook changes', pattern: /run n8n|execute workflow|activate workflow|change webhook|webhook secret/i },
  { label: 'Provider setting changes', pattern: /provider setting|change provider|token refresh|connection setting/i },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesAnyContext(text: string, values: string[]) {
  const haystack = normalize(text);
  return values.some((value) => {
    const words = normalize(value).split(/[^a-z0-9\u0590-\u08FF]+/i).filter((word) => word.length > 3);
    return words.some((word) => haystack.includes(word));
  });
}

function detectMissingInputs(workflow: AgentWorkflowDraft) {
  const context = [workflow.name, workflow.goal, workflow.notes].join(' ');
  const missing = new Set<string>();

  for (const hint of requiredContextHints) {
    if (!hint.pattern.test(context)) {
      missing.add(hint.label);
    }
  }

  for (const step of workflow.steps) {
    for (const input of step.requiredInputs.slice(0, 4)) {
      if (!includesAnyContext(context, [input])) {
        missing.add(`${step.template.name}: ${input}`);
      }
    }
  }

  return [...missing].slice(0, 14);
}

function detectDuplicateSteps(steps: AgentWorkflowStep[]) {
  const duplicates: string[] = [];
  const seen = new Map<string, number>();
  const categories = new Map<string, string[]>();

  for (const step of steps) {
    const previous = seen.get(step.template.id);
    if (previous) {
      duplicates.push(`${step.template.name} appears in steps ${previous} and ${step.index}.`);
    }
    seen.set(step.template.id, step.index);
    categories.set(step.template.category, [...(categories.get(step.template.category) ?? []), step.template.name]);
  }

  for (const [category, names] of categories.entries()) {
    if (names.length >= 4) {
      duplicates.push(`${category} has ${names.length} similar-category steps. Consider keeping only the strongest sequence.`);
    }
  }

  return duplicates;
}

function detectWeakSteps(workflow: AgentWorkflowDraft) {
  const weak: string[] = [];

  if (workflow.steps.length === 0) {
    weak.push('No workflow steps selected.');
  }

  if (workflow.steps.length === 1) {
    weak.push('Only one step selected. A workflow usually benefits from at least two connected templates.');
  }

  for (const step of workflow.steps) {
    if (step.requiredInputs.length > 0 && step.expectedOutputs.length === 0) {
      weak.push(`${step.template.name} has inputs but no clear expected outputs.`);
    }
    if (step.template.safety_level === 'requires_review') {
      weak.push(`${step.template.name} requires human review before handoff.`);
    }
  }

  return weak;
}

function detectUnsafeActions(workflow: AgentWorkflowDraft) {
  const text = [workflow.name, workflow.goal, workflow.notes, workflow.steps.map((step) => step.template.suggested_prompt).join(' ')].join(' ');
  return unsafePatterns
    .filter((item) => item.pattern.test(text))
    .map((item) => item.label);
}

function detectProviderBlockers(workflow: AgentWorkflowDraft) {
  const text = [workflow.name, workflow.goal, workflow.notes, workflow.steps.map((step) => `${step.template.name} ${step.template.description}`).join(' ')].join(' ');
  const blockers = new Set<string>();

  if (/google ads|google_ads/i.test(text)) {
    blockers.add('Google Ads actions require provider readiness and developer-token approval before any real campaign work.');
  }
  if (/pinterest/i.test(text)) {
    blockers.add('Pinterest may require setup_required/manual provider checks before publishing or pin actions.');
  }
  if (/linkedin/i.test(text)) {
    blockers.add('LinkedIn workflows are manual-only unless provider readiness explicitly supports the action.');
  }
  if (/ai provider|openai|generate|generation/i.test(text)) {
    blockers.add('AI generation requires OpenAI readiness, but this review does not expose or verify API keys.');
  }
  if (/n8n|webhook|callback/i.test(text)) {
    blockers.add('n8n workflow execution and webhook changes are blocked in this phase. Export plans only.');
  }

  if (blockers.size === 0) {
    blockers.add('Provider readiness should be checked manually before any external handoff, publishing, scheduling, or paid action.');
  }

  return [...blockers];
}

function statusFrom(readinessScore: number, unsafeActions: string[], missingInputs: string[]) {
  if (unsafeActions.some((action) => /spending|deleting|github|n8n execution|provider setting|live ads/i.test(action))) {
    return 'blocked';
  }
  if (unsafeActions.length > 0 || readinessScore < 45) return 'risky';
  if (missingInputs.length > 0 || readinessScore < 75) return 'needs_inputs';
  return 'ready';
}

export function reviewAgentWorkflow(workflow: AgentWorkflowDraft): WorkflowReviewResult {
  const missingInputs = detectMissingInputs(workflow);
  const weakSteps = detectWeakSteps(workflow);
  const duplicateSteps = detectDuplicateSteps(workflow.steps);
  const unsafeActions = detectUnsafeActions(workflow);
  const providerBlockers = detectProviderBlockers(workflow);
  const requiredApprovals = [
    'Create pending tasks: explicit user confirmation required.',
    'Send steps to Content Studio: user confirmation required; prefill/draft only.',
    'Export n8n plan: allowed as reference-only export.',
    'Run n8n: blocked in this phase.',
    'Publish, schedule, spend, delete, GitHub writes, or provider setting changes: blocked in this phase.',
  ];

  const penalties =
    missingInputs.length * 4 +
    weakSteps.length * 8 +
    duplicateSteps.length * 8 +
    unsafeActions.length * 14 +
    Math.max(0, workflow.steps.length === 0 ? 25 : 0);
  const readinessScore = Math.max(0, Math.min(100, 100 - penalties));
  const overallStatus = statusFrom(readinessScore, unsafeActions, missingInputs);
  const recommendedFixes = [
    missingInputs.length ? 'Add the missing inputs to workflow notes before creating pending tasks.' : null,
    duplicateSteps.length ? 'Remove duplicate or overlapping steps to keep the workflow focused.' : null,
    unsafeActions.length ? 'Rewrite workflow notes to keep all live execution, publishing, scheduling, spending, and deletion out of scope.' : null,
    weakSteps.length ? 'Clarify weak steps or add a stronger connecting template.' : null,
    'Keep outputs in draft/review mode until every step has been manually checked.',
  ].filter((item): item is string => Boolean(item));

  const safeNextActions = [
    'Copy or download the workflow review summary.',
    'Fill missing inputs in the workflow notes.',
    'Create pending draft tasks only after confirming the review gate.',
    'Export n8n plans as reference-only documents, not live workflows.',
  ];

  return {
    overall_status: overallStatus,
    readiness_score: readinessScore,
    missing_inputs: missingInputs,
    weak_steps: weakSteps,
    duplicate_steps: duplicateSteps,
    unsafe_actions_detected: unsafeActions,
    provider_blockers: providerBlockers,
    required_approvals: requiredApprovals,
    recommended_fixes: recommendedFixes,
    safe_next_actions: safeNextActions,
    review_summary: `${workflow.name} is ${overallStatus.replace('_', ' ')} with a readiness score of ${readinessScore}/100. ${missingInputs.length} missing inputs, ${unsafeActions.length} unsafe action warnings, and ${duplicateSteps.length} duplicate/similar-step warnings were found.`,
  };
}

function list(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None';
}

export function formatWorkflowReviewMarkdown(review: WorkflowReviewResult, workflow?: AgentWorkflowDraft) {
  const diagram = workflow ? buildWorkflowDiagramFromDraft(workflow).markdownDiagram : null;

  return [
    '# Workflow Review',
    '',
    ...(diagram ? ['## Visual Diagram', diagram, ''] : []),
    '## Overall Status',
    review.overall_status,
    '',
    '## Readiness Score',
    `${review.readiness_score}/100`,
    '',
    '## Missing Inputs',
    list(review.missing_inputs),
    '',
    '## Risks & Warnings',
    list([...review.weak_steps, ...review.duplicate_steps, ...review.unsafe_actions_detected]),
    '',
    '## Provider Blockers',
    list(review.provider_blockers),
    '',
    '## Required Approvals',
    list(review.required_approvals),
    '',
    '## Recommended Fixes',
    list(review.recommended_fixes),
    '',
    '## Safe Next Actions',
    list(review.safe_next_actions),
    '',
    '## Review Summary',
    review.review_summary,
    '',
  ].join('\n');
}
