import 'server-only';

import { generateMarketingText } from '@/lib/ai/text-provider';
import type { ProjectRecord } from '@/types/database';

export type SafePatchChangeType =
  | 'bug_fix'
  | 'ui_update'
  | 'feature'
  | 'refactor'
  | 'security'
  | 'database_migration'
  | 'provider_update'
  | 'docs'
  | 'deployment'
  | 'stabilization';

export type SafePatchPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SafePatchRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SafePatchStatus =
  | 'draft'
  | 'needs_review'
  | 'approved_to_prompt'
  | 'copied_to_codex'
  | 'implemented_externally'
  | 'rejected'
  | 'archived';

export interface SafePatchPlannerInput {
  title: string;
  projectId: string | null;
  changeType: SafePatchChangeType;
  priority: SafePatchPriority;
  changeRequest: string;
  currentProblem: string;
  expectedResult: string;
  filesOrPages: string;
  systemsNotToTouch: string[];
  riskNotes: string;
  testingRequirements: string;
  sourceContext: string;
}

export interface SafePatchAffectedFile {
  fileOrArea: string;
  expectedChange: string;
  risk: SafePatchRiskLevel;
  notes: string;
}

export interface SafePatchRiskAssessment {
  technical: SafePatchRiskLevel;
  data: SafePatchRiskLevel;
  provider: SafePatchRiskLevel;
  ui: SafePatchRiskLevel;
  deployment: SafePatchRiskLevel;
  notes: string[];
}

export interface SafePatchPlan {
  generatedAt: string;
  title: string;
  changeType: SafePatchChangeType;
  priority: SafePatchPriority;
  riskLevel: SafePatchRiskLevel;
  aiProviderUsed: string;
  changeSummary: string[];
  scope: {
    included: string[];
    excluded: string[];
    systemsNotToTouch: string[];
  };
  affectedFiles: SafePatchAffectedFile[];
  implementationSteps: string[];
  riskAssessment: SafePatchRiskAssessment;
  safetyConstraints: string[];
  testChecklist: string[];
  rollbackPlan: string[];
  suggestedCodexPrompt: string;
  approvalChecklist: string[];
  aiNotes: string;
}

export const defaultNoTouchSystems = [
  'n8n/callbacks/webhooks/task execution',
  'provider publishing logic',
  'Real Scheduling Execution core logic',
  'Supabase schema unless required',
  'environment variables/secrets',
  'ads_management',
  'live campaign spending',
  'GitHub writes',
  'production deploy unless explicitly requested',
];

function cleanText(value: string, fallback = '') {
  return (
    value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
      .trim() || fallback
  );
}

function splitLines(value: string, fallback: string[]) {
  const items = value
    .split(/\n|,/)
    .map((item) => cleanText(item))
    .filter(Boolean);

  return items.length ? items : fallback;
}

function riskForInput(input: SafePatchPlannerInput): SafePatchRiskLevel {
  const haystack = [
    input.changeType,
    input.changeRequest,
    input.currentProblem,
    input.filesOrPages,
    input.riskNotes,
    input.testingRequirements,
  ]
    .join(' ')
    .toLowerCase();

  if (/secret|token|auth|rls|security|provider|publishing|scheduler|n8n|migration|database|payment|cron/.test(haystack)) {
    return input.changeType === 'security' || input.changeType === 'database_migration'
      ? 'high'
      : 'medium';
  }

  if (/ui|copy|docs|spacing|translation|style/.test(haystack)) return 'low';
  return input.priority === 'urgent' ? 'high' : 'medium';
}

function riskRank(risk: SafePatchRiskLevel) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[risk];
}

function maxRisk(values: SafePatchRiskLevel[]): SafePatchRiskLevel {
  return values.reduce((current, value) => (riskRank(value) > riskRank(current) ? value : current), 'low' as SafePatchRiskLevel);
}

function buildAffectedFiles(input: SafePatchPlannerInput): SafePatchAffectedFile[] {
  const files = splitLines(input.filesOrPages, ['Needs discovery: inspect route, component, action, and related data helpers first.']);
  const baseRisk = riskForInput(input);

  return files.slice(0, 12).map((fileOrArea) => ({
    fileOrArea,
    expectedChange:
      fileOrArea.startsWith('Needs discovery')
        ? 'Identify exact files before editing; do not patch from assumptions.'
        : 'Make the smallest scoped change required for the approved request.',
    risk: baseRisk,
    notes: 'Confirm ownership/workspace boundaries and preserve unrelated user changes.',
  }));
}

function buildSuggestedPrompt(input: SafePatchPlannerInput, plan: Omit<SafePatchPlan, 'suggestedCodexPrompt'>) {
  return [
    `Implement this approved safe patch for AgentFlow AI: ${plan.title}`,
    '',
    'Change request:',
    cleanText(input.changeRequest),
    '',
    'Expected result:',
    cleanText(input.expectedResult, 'Deliver the requested behavior without changing unrelated systems.'),
    '',
    'Scope:',
    ...plan.scope.included.map((item) => `- Include: ${item}`),
    ...plan.scope.excluded.map((item) => `- Exclude: ${item}`),
    '',
    'Affected files / areas to inspect first:',
    ...plan.affectedFiles.map((file) => `- ${file.fileOrArea}: ${file.expectedChange}`),
    '',
    'Hard constraints:',
    ...plan.safetyConstraints.map((item) => `- ${item}`),
    '',
    'Implementation steps:',
    ...plan.implementationSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    'Verification:',
    ...plan.testChecklist.map((item) => `- [ ] ${item}`),
    '',
    'Do not push commits, create PRs, deploy, run task execution, expose secrets, create live campaigns, or change provider/scheduler/n8n behavior unless I explicitly approve it in a later instruction.',
  ].join('\n');
}

export function safePatchPlanToMarkdown(plan: SafePatchPlan) {
  const affectedTable = [
    '| File/Area | Expected change | Risk | Notes |',
    '| --- | --- | --- | --- |',
    ...plan.affectedFiles.map((file) =>
      `| ${file.fileOrArea.replace(/\|/g, '/')} | ${file.expectedChange.replace(/\|/g, '/')} | ${file.risk} | ${file.notes.replace(/\|/g, '/')} |`
    ),
  ];

  return [
    `# ${plan.title}`,
    '',
    `Generated: ${plan.generatedAt}`,
    `Change type: ${plan.changeType}`,
    `Priority: ${plan.priority}`,
    `Risk level: ${plan.riskLevel}`,
    '',
    '## Change Summary',
    ...plan.changeSummary.map((item) => `- ${item}`),
    '',
    '## Scope',
    ...plan.scope.included.map((item) => `- Include: ${item}`),
    ...plan.scope.excluded.map((item) => `- Exclude: ${item}`),
    ...plan.scope.systemsNotToTouch.map((item) => `- Do not touch: ${item}`),
    '',
    '## Affected Files',
    ...affectedTable,
    '',
    '## Implementation Steps',
    ...plan.implementationSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    '## Risk Assessment',
    `- Technical: ${plan.riskAssessment.technical}`,
    `- Data: ${plan.riskAssessment.data}`,
    `- Provider: ${plan.riskAssessment.provider}`,
    `- UI: ${plan.riskAssessment.ui}`,
    `- Deployment: ${plan.riskAssessment.deployment}`,
    ...plan.riskAssessment.notes.map((item) => `- ${item}`),
    '',
    '## Safety Constraints',
    ...plan.safetyConstraints.map((item) => `- ${item}`),
    '',
    '## Test Checklist',
    ...plan.testChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## Rollback Plan',
    ...plan.rollbackPlan.map((item) => `- ${item}`),
    '',
    '## Suggested Codex Prompt',
    plan.suggestedCodexPrompt,
    '',
    '## Approval Checklist',
    ...plan.approvalChecklist.map((item) => `- [ ] ${item}`),
    '',
    'Safety note: planning only. This plan does not modify code, write to GitHub, deploy, run tasks, publish provider content, or expose secrets.',
  ].join('\n');
}

export async function generateSafePatchPlan(input: SafePatchPlannerInput, project: ProjectRecord | null) {
  const sanitizedInput: SafePatchPlannerInput = {
    ...input,
    title: cleanText(input.title, 'Untitled safe patch'),
    changeRequest: cleanText(input.changeRequest),
    currentProblem: cleanText(input.currentProblem),
    expectedResult: cleanText(input.expectedResult),
    filesOrPages: cleanText(input.filesOrPages),
    riskNotes: cleanText(input.riskNotes),
    testingRequirements: cleanText(input.testingRequirements),
    sourceContext: cleanText(input.sourceContext),
    systemsNotToTouch: input.systemsNotToTouch.length ? input.systemsNotToTouch.map((item) => cleanText(item)).filter(Boolean) : defaultNoTouchSystems,
  };

  const affectedFiles = buildAffectedFiles(sanitizedInput);
  const dataRisk: SafePatchRiskLevel = sanitizedInput.changeType === 'database_migration' ? 'high' : 'low';
  const providerRisk: SafePatchRiskLevel = /provider|publishing|meta|google|pinterest|scheduler|cron/i.test(
    `${sanitizedInput.changeRequest} ${sanitizedInput.filesOrPages}`
  )
    ? 'high'
    : 'low';
  const uiRisk: SafePatchRiskLevel = sanitizedInput.changeType === 'ui_update' ? 'medium' : 'low';
  const deploymentRisk: SafePatchRiskLevel = sanitizedInput.changeType === 'deployment' ? 'high' : 'medium';
  const technicalRisk = riskForInput(sanitizedInput);
  const riskLevel = maxRisk([technicalRisk, dataRisk, providerRisk, uiRisk]);
  const aiResult = await generateMarketingText({
    kind: 'safe_patch_plan',
    systemPrompt: [
      'You are a senior engineering planning assistant for AgentFlow AI.',
      'Generate planning guidance only. Do not instruct that code has been modified.',
      'Never include secrets, tokens, API keys, raw env values, or provider credentials.',
      'Respect no-touch systems: n8n, callbacks, webhooks, task execution, provider publishing, scheduler core, env vars, secrets, ads_management, live campaigns, GitHub writes, deploys.',
      'Be concise and practical.',
    ].join('\n'),
    userPrompt: [
      `Patch title: ${sanitizedInput.title}`,
      `Change type: ${sanitizedInput.changeType}`,
      `Priority: ${sanitizedInput.priority}`,
      `Change request: ${sanitizedInput.changeRequest}`,
      `Current problem: ${sanitizedInput.currentProblem}`,
      `Expected result: ${sanitizedInput.expectedResult}`,
      `Known files/pages: ${sanitizedInput.filesOrPages || 'not provided'}`,
      `Project context: ${project ? `${project.name} | ${project.project_type} | ${project.status} | ${project.tech_stack ?? 'no tech stack'}` : 'No project selected'}`,
      `Additional context: ${sanitizedInput.sourceContext || 'none'}`,
      'Return short extra notes about risks, sequencing, and tests.',
    ].join('\n'),
    maxTokens: 700,
    temperature: 0.25,
  });

  const basePlan: Omit<SafePatchPlan, 'suggestedCodexPrompt'> = {
    generatedAt: new Date().toISOString(),
    title: sanitizedInput.title,
    changeType: sanitizedInput.changeType,
    priority: sanitizedInput.priority,
    riskLevel,
    aiProviderUsed: aiResult.providerUsed ?? 'unavailable',
    changeSummary: [
      sanitizedInput.changeRequest || 'Clarify the requested change before implementation.',
      sanitizedInput.currentProblem ? `Problem: ${sanitizedInput.currentProblem}` : 'Problem statement needs review.',
      sanitizedInput.expectedResult ? `Expected outcome: ${sanitizedInput.expectedResult}` : 'Expected result should be confirmed before implementation.',
    ],
    scope: {
      included: splitLines(sanitizedInput.filesOrPages, ['Targeted files/pages discovered during implementation prep.']),
      excluded: sanitizedInput.systemsNotToTouch,
      systemsNotToTouch: sanitizedInput.systemsNotToTouch,
    },
    affectedFiles,
    implementationSteps: [
      'Read the relevant route/component/action/data helper files before editing.',
      'Confirm the existing pattern and ownership boundaries.',
      'Make the smallest scoped code change that satisfies the approved request.',
      'Preserve unrelated user changes and avoid broad refactors.',
      'Add focused validation or UI states only where the change requires them.',
      'Run lint, typecheck, build, and route-specific smoke checks.',
      'Prepare a short implementation report with files changed and safety confirmations.',
    ],
    riskAssessment: {
      technical: technicalRisk,
      data: dataRisk,
      provider: providerRisk,
      ui: uiRisk,
      deployment: deploymentRisk,
      notes: [
        sanitizedInput.riskNotes || 'No additional risk notes were provided.',
        project ? `Project context included: ${project.name}.` : 'No project was selected.',
      ],
    },
    safetyConstraints: [
      'No secrets, API keys, tokens, refresh tokens, or raw env values in prompts, logs, UI, or reports.',
      'Do not change provider publishing logic unless explicitly requested in a later approved patch.',
      'Do not change n8n, callbacks, webhooks, or task execution flow.',
      'Do not change Real Scheduling Execution core logic.',
      'Do not add ads_management or create live campaigns.',
      'Do not push to GitHub, create pull requests, deploy, or run generated code.',
      'Do not add a database migration unless the approved scope clearly requires it.',
      ...sanitizedInput.systemsNotToTouch.map((item) => `Do not touch: ${item}.`),
    ],
    testChecklist: [
      'npm run lint',
      'npx tsc --noEmit',
      'npm run build',
      'Open affected dashboard route(s) and check for runtime errors.',
      'Check mobile/responsive layout if UI is affected.',
      'Confirm no secrets or provider token values appear in UI, logs, copied reports, or browser payloads.',
      'Confirm existing Projects, Tasks, Prompt Library, Releases, System Health, and Security Center still load if related.',
      sanitizedInput.testingRequirements || 'Add feature-specific regression checks before implementation.',
    ],
    rollbackPlan: [
      'Record the exact files changed during implementation.',
      'Revert only the patch files if the change fails verification.',
      'If a migration is later added, prepare a forward-safe rollback or compensating migration before deploy.',
      'Use Vercel rollback only after confirming the previous deployment is known-good.',
      'Restore original UI behavior and rerun lint/typecheck/build after rollback.',
    ],
    approvalChecklist: [
      'I reviewed affected files.',
      'I reviewed risk level.',
      'I reviewed no-touch systems.',
      'I reviewed tests.',
      'I reviewed rollback plan.',
      'I am ready to send the implementation prompt to Codex.',
    ],
    aiNotes:
      aiResult.status === 'generated'
        ? cleanText(aiResult.text)
        : aiResult.status === 'setup_required'
          ? 'AI provider setup required for deeper planning. Deterministic safety plan generated.'
          : 'AI generation unavailable. Deterministic safety plan generated.',
  };

  return {
    ...basePlan,
    suggestedCodexPrompt: buildSuggestedPrompt(sanitizedInput, basePlan),
  };
}
