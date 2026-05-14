import 'server-only';

import { generateMarketingText } from '@/lib/ai/text-provider';
import type {
  GitHubPullRequestFile,
  GitHubPullRequestReviewContext,
} from '@/lib/github';
import type { PullRequestRecommendation, PullRequestRiskLevel } from '@/lib/data/pull-request-reviews';
import type { ProjectRecord } from '@/types/database';

export interface PullRequestReviewReport {
  generatedAt: string;
  riskLevel: PullRequestRiskLevel;
  recommendation: PullRequestRecommendation;
  executiveSummary: string[];
  filesChanged: Array<{
    file: string;
    changeType: string;
    risk: PullRequestRiskLevel;
    notes: string;
  }>;
  riskAssessment: {
    ui: PullRequestRiskLevel;
    data: PullRequestRiskLevel;
    provider: PullRequestRiskLevel;
    scheduler: PullRequestRiskLevel;
    security: PullRequestRiskLevel;
    migration: PullRequestRiskLevel;
    deployment: PullRequestRiskLevel;
    notes: string[];
  };
  potentialIssues: string[];
  securityReview: string[];
  regressionChecklist: string[];
  testingChecklist: string[];
  releaseNotesDraft: string;
  followUpTasks: string[];
  finalRecommendation: string;
  aiNotes: string;
  warnings: string[];
}

const riskRank: Record<PullRequestRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxRisk(values: PullRequestRiskLevel[]): PullRequestRiskLevel {
  return values.reduce((current, value) => (riskRank[value] > riskRank[current] ? value : current), 'low' as PullRequestRiskLevel);
}

function cleanText(value: string, fallback = '') {
  return (
    value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/(access_token|refresh_token|client_secret|api_key|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
      .trim() || fallback
  );
}

function fileRisk(file: GitHubPullRequestFile): PullRequestRiskLevel {
  const name = file.filename.toLowerCase();

  if (/\.env|secret|credential|private[-_]?key|service[-_]?account/.test(name)) return 'critical';
  if (/middleware|proxy|auth|security|rls|policy|migration|supabase|schema|provider|publishing|scheduler|cron|callback|webhook|n8n/.test(name)) return 'high';
  if (/api\/|actions\.ts|route\.ts|server|data\/|lib\//.test(name)) return 'medium';
  if (/\.tsx|\.css|globals\.css/.test(name)) return 'medium';
  if (/readme|docs|\.md$/.test(name)) return 'low';
  return 'medium';
}

function changeType(file: GitHubPullRequestFile) {
  if (file.status === 'added') return 'added';
  if (file.status === 'removed') return 'removed';
  if (file.status === 'renamed') return 'renamed';
  return file.changes > 250 ? 'large modification' : 'modified';
}

function areaRisk(files: GitHubPullRequestFile[], pattern: RegExp, empty: PullRequestRiskLevel = 'low') {
  return files.some((file) => pattern.test(file.filename.toLowerCase())) ? 'high' : empty;
}

function recommendationForRisk(risk: PullRequestRiskLevel, warnings: string[]): PullRequestRecommendation {
  if (risk === 'critical') return 'do_not_merge_yet';
  if (risk === 'high') return 'needs_manual_review';
  if (warnings.length) return 'needs_manual_review';
  return 'safe_to_merge_after_tests';
}

function formatRecommendation(value: PullRequestRecommendation) {
  const labels: Record<PullRequestRecommendation, string> = {
    safe_to_merge_after_tests: 'Safe to merge after tests pass',
    request_changes: 'Request changes',
    needs_manual_review: 'Needs manual review',
    do_not_merge_yet: 'Do not merge yet',
  };
  return labels[value];
}

export function pullRequestReviewToMarkdown(report: PullRequestReviewReport) {
  const files = [
    '| File | Change type | Risk | Notes |',
    '| --- | --- | --- | --- |',
    ...report.filesChanged.map((file) =>
      `| ${file.file.replace(/\|/g, '/')} | ${file.changeType} | ${file.risk} | ${file.notes.replace(/\|/g, '/')} |`
    ),
  ];

  return [
    '# Pull Request Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Risk level: ${report.riskLevel}`,
    `Recommendation: ${formatRecommendation(report.recommendation)}`,
    '',
    '## A. Executive Summary',
    ...report.executiveSummary.map((item) => `- ${item}`),
    '',
    '## B. Files Changed',
    ...files,
    '',
    '## C. Risk Assessment',
    `- UI risk: ${report.riskAssessment.ui}`,
    `- Data risk: ${report.riskAssessment.data}`,
    `- Provider risk: ${report.riskAssessment.provider}`,
    `- Scheduler risk: ${report.riskAssessment.scheduler}`,
    `- Security risk: ${report.riskAssessment.security}`,
    `- Migration risk: ${report.riskAssessment.migration}`,
    `- Deployment risk: ${report.riskAssessment.deployment}`,
    ...report.riskAssessment.notes.map((item) => `- ${item}`),
    '',
    '## D. Potential Issues',
    ...report.potentialIssues.map((item) => `- ${item}`),
    '',
    '## E. Security Review',
    ...report.securityReview.map((item) => `- ${item}`),
    '',
    '## F. Regression Checklist',
    ...report.regressionChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## G. Testing Checklist',
    ...report.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    '## H. Release Notes Draft',
    report.releaseNotesDraft,
    '',
    '## I. Suggested Follow-up Tasks',
    ...report.followUpTasks.map((item) => `- ${item}`),
    '',
    '## J. Final Recommendation',
    report.finalRecommendation,
    '',
    '## AI Notes',
    report.aiNotes,
    '',
    'Safety note: review only. This report does not approve, merge, comment, push, deploy, run tasks, expose secrets, or modify GitHub.',
  ].join('\n');
}

export async function generatePullRequestReview(
  context: GitHubPullRequestReviewContext,
  project: ProjectRecord
): Promise<PullRequestReviewReport> {
  const pr = context.pullRequest;
  const files = context.files;
  const fileRows = files.slice(0, 40).map((file) => ({
    file: file.filename,
    changeType: changeType(file),
    risk: fileRisk(file),
    notes: `${file.additions} additions, ${file.deletions} deletions. ${file.patch ? 'Limited patch snippet reviewed.' : 'No patch snippet included.'}`,
  }));
  const uiRisk = areaRisk(files, /\.(tsx|jsx|css|scss)$|app\/|components\//, 'low');
  const dataRisk = areaRisk(files, /supabase|migration|schema|data\/|database|sql/, 'low');
  const providerRisk = areaRisk(files, /provider|publishing|ads|meta|google|pinterest|content-studio/, 'low');
  const schedulerRisk = areaRisk(files, /scheduler|cron|scheduled|run-scheduler/, 'low');
  const securityRisk = areaRisk(files, /auth|security|middleware|proxy|rls|token|secret|api\/|route\.ts|actions\.ts/, 'medium');
  const migrationRisk = areaRisk(files, /supabase\/migrations|\.sql$/, 'low');
  const deploymentRisk = areaRisk(files, /next\.config|vercel\.json|package\.json|proxy|middleware|route\.ts/, 'medium');
  const riskLevel = maxRisk([
    ...fileRows.map((file) => file.risk),
    uiRisk,
    dataRisk,
    providerRisk,
    schedulerRisk,
    securityRisk,
    migrationRisk,
    deploymentRisk,
  ]);
  const recommendation = recommendationForRisk(riskLevel, context.warnings);
  const aiResult = await generateMarketingText({
    kind: 'pull_request_review',
    systemPrompt: [
      'You are a senior read-only pull request reviewer for AgentFlow AI.',
      'Generate review guidance only. Do not instruct GitHub writes, approvals, merges, comments, commits, deploys, task execution, n8n triggers, provider publishing, scheduler changes, or secret exposure.',
      'Never include secrets, tokens, API keys, raw env values, or credentials.',
      'Be concise and practical.',
    ].join('\n'),
    userPrompt: [
      `Project: ${project.name}`,
      `Tech stack: ${project.tech_stack ?? 'not added'}`,
      `PR: #${pr?.number ?? 'unknown'} ${pr?.title ?? 'Unknown PR'}`,
      `Author: ${pr?.author ?? 'unknown'}`,
      `Branches: ${pr?.sourceBranch ?? 'unknown'} -> ${pr?.targetBranch ?? 'unknown'}`,
      `Body: ${cleanText(pr?.body ?? 'No body', 'No body')}`,
      `Files changed: ${files.length}`,
      ...files.slice(0, 30).map((file) => `- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})${file.patch ? `\n${file.patch.slice(0, 1200)}` : ''}`),
      `Commits: ${context.commits.map((commit) => `${commit.shortSha}: ${commit.message}`).join('; ') || 'none'}`,
      `Warnings: ${context.warnings.join('; ') || 'none'}`,
      'Return short notes for risks, possible issues, security concerns, testing, release notes, and final recommendation.',
    ].join('\n'),
    maxTokens: 1200,
    temperature: 0.2,
  });
  const aiNotes =
    aiResult.status === 'generated'
      ? cleanText(aiResult.text)
      : aiResult.status === 'setup_required'
        ? 'AI provider setup required. Deterministic PR review generated.'
        : 'AI generation unavailable. Deterministic PR review generated.';

  return {
    generatedAt: new Date().toISOString(),
    riskLevel,
    recommendation,
    executiveSummary: [
      `PR #${pr?.number ?? 'unknown'} appears to update ${files.length} file(s) in ${project.name}.`,
      `Primary branches: ${pr?.sourceBranch ?? 'unknown'} -> ${pr?.targetBranch ?? 'unknown'}.`,
      `Overall risk is ${riskLevel}. Recommendation: ${formatRecommendation(recommendation)}.`,
    ],
    filesChanged: fileRows.length ? fileRows : [{ file: 'No files returned', changeType: 'unknown', risk: 'medium', notes: 'GitHub did not return changed files.' }],
    riskAssessment: {
      ui: uiRisk,
      data: dataRisk,
      provider: providerRisk,
      scheduler: schedulerRisk,
      security: securityRisk,
      migration: migrationRisk,
      deployment: deploymentRisk,
      notes: [
        `${files.length} changed file(s), ${pr?.additions ?? 0} additions, ${pr?.deletions ?? 0} deletions.`,
        context.diffTruncated ? 'Diff was truncated or summarized due to size.' : 'Limited safe diff snippets were available for review.',
        ...context.warnings,
      ],
    },
    potentialIssues: [
      'Verify workspace ownership checks in any server actions, route handlers, or data helpers touched by the PR.',
      'Confirm changed UI routes still render in desktop and mobile layouts.',
      'Check whether any large file changes need narrower review before merge.',
      riskLevel === 'high' || riskLevel === 'critical' ? 'Review high-risk files manually before merge.' : 'No deterministic blocker detected from filenames and metadata alone.',
    ],
    securityReview: [
      'Confirm no secrets, provider tokens, GitHub tokens, service role keys, or raw env values are logged or rendered.',
      'Review API routes/server actions for authentication and workspace validation.',
      'Review Supabase/RLS/migration changes manually if present.',
      'Confirm user-facing errors do not leak raw provider or database internals.',
      'Confirm file upload, provider, scheduler, and webhook surfaces were not changed unexpectedly.',
    ],
    regressionChecklist: [
      'Open affected dashboard route(s) and verify they load without runtime errors.',
      'Smoke test forms, server actions, and API routes touched by the PR.',
      'Confirm Projects, Tasks, Releases, Safe Patch Planner, Backup Center, and GitHub panels still load if related.',
      'Run provider and scheduler regression checks only if those surfaces were touched.',
      'Check browser/network payloads and copied reports for secrets.',
    ],
    testingChecklist: [
      'npm run lint',
      'npx tsc --noEmit',
      'npm run build',
      'Route-level smoke tests for affected pages.',
      'Mobile/responsive checks for UI changes.',
      'Security/no-secret checks for logs, UI, API responses, and generated reports.',
      'Manual PR diff review for high-risk or truncated files.',
    ],
    releaseNotesDraft: [
      `Summary: Reviewed PR #${pr?.number ?? 'unknown'} for ${project.name}.`,
      `Changes: ${files.slice(0, 8).map((file) => file.filename).join(', ') || 'No files listed.'}`,
      `Risks: ${riskLevel} risk; ${formatRecommendation(recommendation)}.`,
      'Verification: lint, typecheck, build, route smoke tests, and no-secret checks before merge.',
    ].join('\n'),
    followUpTasks: [
      'Code Review task: manually inspect high-risk changed files and PR intent.',
      'Testing task: run regression checklist and route smoke tests.',
      securityRisk === 'high' ? 'Security Review task: inspect auth, token, RLS, server action, and error handling changes.' : 'Security Review task: confirm no secret exposure or unsafe server behavior.',
      'Documentation task: update release notes or internal docs if behavior changed.',
      riskLevel === 'high' || riskLevel === 'critical' ? 'Bug Fix task: address any blocker before merge.' : 'Bug Fix task: only create if verification finds a regression.',
    ],
    finalRecommendation: `${formatRecommendation(recommendation)} because the deterministic risk level is ${riskLevel}. ${context.warnings.length ? `Warnings: ${context.warnings.join(' ')}` : 'Run the full checklist before any merge decision.'}`,
    aiNotes,
    warnings: context.warnings,
  };
}
