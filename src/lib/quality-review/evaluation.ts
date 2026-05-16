import type {
  QualityReviewInput,
  QualityReviewPlatform,
  QualityReviewResult,
  QualityReviewStatus,
  QualityReviewType,
} from './review-types';

const unsafeActionWords = [
  'publish',
  'schedule',
  'spend',
  'delete',
  'run n8n',
  'execute n8n',
  'activate workflow',
  'create live ad',
  'launch campaign',
  'send email',
  'webhook url',
  'api key',
  'secret',
  'token',
];

const exaggeratedClaims = [
  'guaranteed',
  'guarantee',
  'risk-free',
  'instant results',
  '100%',
  'best ever',
  'no effort',
  'get rich',
  'double your revenue',
  'triple your revenue',
];

const ctaWords = [
  'learn more',
  'book',
  'start',
  'try',
  'download',
  'reply',
  'contact',
  'sign up',
  'get',
  'join',
  'shop',
  'call',
  'request',
  'schedule a call',
];

const audienceWords = ['audience', 'customer', 'client', 'buyer', 'persona', 'founder', 'creator', 'team', 'users', 'leads'];
const approvalWords = ['review', 'approval', 'approve', 'manual', 'gate'];
const testingWords = ['test', 'testing checklist', 'qa', 'validate', 'verification'];
const callbackWords = ['callback', '{{agentflow_callback_url}}', 'return payload', 'webhook response'];
const errorWords = ['error', 'fallback', 'retry', 'failed', 'failure', 'exception'];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function includesAny(haystack: string, words: string[]) {
  return words.some((word) => haystack.includes(word));
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceCount(value: string) {
  return value.split(/[.!?؟。]+/).map((item) => item.trim()).filter(Boolean).length;
}

function statusFromScores(overall: number, safety: number, safetyWarnings: string[], missingInputs: string[]): QualityReviewStatus {
  if (safety <= 35 || safetyWarnings.length >= 5) return 'blocked';
  if (safety <= 55 || safetyWarnings.length >= 3) return 'risky';
  if (overall >= 88 && missingInputs.length === 0) return 'excellent';
  if (overall >= 72) return 'good';
  return 'needs_improvement';
}

function reviewTypeLabel(type: QualityReviewType) {
  return type
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function platformLabel(platform: QualityReviewPlatform) {
  if (platform === 'google_ads') return 'Google Ads';
  return platform[0]?.toUpperCase() + platform.slice(1);
}

function isMarketingType(type: QualityReviewType) {
  return type === 'marketing_content' || type === 'ad_copy' || type === 'creative_brief';
}

function isPromptType(type: QualityReviewType) {
  return type === 'prompt_template' || type === 'ai_studio_image_prompt' || type === 'ai_studio_video_prompt';
}

function isWorkflowType(type: QualityReviewType) {
  return type === 'workflow_plan' || type === 'automation_blueprint';
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildImprovedVersion(input: QualityReviewInput, issues: string[], missingInputs: string[], safetyWarnings: string[]) {
  const content = input.content.trim();
  if (!content || issues.length === 0 && missingInputs.length === 0 && safetyWarnings.length === 0) return null;

  if (isWorkflowType(input.reviewType)) {
    return [
      content,
      '',
      'Safety and review additions:',
      '- Keep this plan in planning/review mode only.',
      '- Add a manual approval gate before any task creation, n8n handoff, publishing, scheduling, deletion, or provider action.',
      '- Add missing inputs before execution planning.',
      '- Add callback payload, error handling, and testing checklist sections where relevant.',
    ].join('\n');
  }

  if (input.reviewType === 'prompt_template') {
    return [
      content,
      '',
      'Prompt quality additions:',
      '- Context: [add audience, goal, platform, constraints]',
      '- Output format: [define sections, length, tone, and review checklist]',
      '- Safety: Return draft-only output. Do not publish, schedule, spend money, delete data, or call external tools.',
    ].join('\n');
  }

  if (input.reviewType === 'ai_studio_image_prompt' || input.reviewType === 'ai_studio_video_prompt') {
    return [
      content,
      '',
      'Creative direction additions:',
      '- Audience and campaign goal:',
      '- Brand tone and visual style:',
      '- Composition, subject, lighting, and format:',
      '- Negative constraints: no distorted text, no misleading claims, no unsafe brand usage.',
      '- Review note: save as draft creative asset only.',
    ].join('\n');
  }

  return [
    content,
    '',
    'Revision direction:',
    '- Clarify the audience and core promise.',
    '- Add one specific call to action.',
    '- Remove exaggerated or guaranteed claims.',
    '- Keep the final version as a draft for manual review before use.',
  ].join('\n');
}

export function evaluateQualityDeterministic(input: QualityReviewInput): QualityReviewResult {
  const content = input.content.trim();
  const lower = content.toLowerCase();
  const words = countWords(content);
  const sentences = sentenceCount(content);
  const issues: string[] = [];
  const strengths: string[] = [];
  const missingInputs: string[] = [];
  const safetyWarnings: string[] = [];
  const recommendedFixes: string[] = [];
  const checklist: string[] = [];
  const safeNextActions: string[] = [];

  let clarityScore = 78;
  let conversionScore = isMarketingType(input.reviewType) || input.reviewType === 'alex_draft' ? 68 : 60;
  let safetyScore = 92;

  if (!content) {
    issues.push('No review content was provided.');
    missingInputs.push('Content to review');
    clarityScore -= 60;
    conversionScore -= 40;
  } else if (words < 12) {
    issues.push('Content is too short to evaluate confidently.');
    missingInputs.push('More context or a fuller draft');
    clarityScore -= 28;
  } else {
    strengths.push('Review content is present and long enough for a first-pass check.');
  }

  if (sentences >= 2 || content.includes('\n')) strengths.push('Content has enough structure to scan.');
  if (words > 260 && input.reviewType === 'ad_copy') {
    issues.push('Ad copy is long for most paid placements.');
    recommendedFixes.push('Create shorter primary text and separate headline variations.');
    conversionScore -= 10;
  }

  if (input.platform === 'generic') {
    missingInputs.push('Target platform');
    issues.push('Platform is generic, so platform-fit scoring is limited.');
    conversionScore -= 8;
  }

  if (input.brandTone?.trim()) {
    strengths.push(`Brand tone target is defined: ${input.brandTone.trim()}.`);
  } else {
    missingInputs.push('Brand tone');
    clarityScore -= 4;
  }

  if (isMarketingType(input.reviewType)) {
    if (!includesAny(lower, ctaWords)) {
      issues.push('Marketing/ad content is missing a clear call to action.');
      recommendedFixes.push('Add one specific CTA such as "Book a call", "Learn more", or "Reply for details".');
      conversionScore -= 18;
    } else {
      strengths.push('A call to action appears to be present.');
      conversionScore += 6;
    }

    if (!includesAny(lower, audienceWords)) {
      missingInputs.push('Audience or buyer persona');
      recommendedFixes.push('Add the target audience and the specific pain point being addressed.');
      clarityScore -= 10;
      conversionScore -= 10;
    }

    if (input.reviewType === 'ad_copy') {
      const headlineLines = content.split('\n').filter((line) => /headline/i.test(line) || line.trim().length <= 45);
      if (headlineLines.some((line) => line.trim().length > 90)) {
        issues.push('One or more ad headline candidates may be too long.');
        recommendedFixes.push('Keep Google/Meta headline candidates short, specific, and easy to scan.');
        conversionScore -= 10;
      }
    }
  }

  if (input.reviewType === 'creative_brief') {
    for (const field of ['Audience', 'Objective', 'Visual direction', 'CTA']) {
      if (!lower.includes(field.toLowerCase())) missingInputs.push(field);
    }
    if (!lower.includes('review')) recommendedFixes.push('Add a review checklist for brand, platform, claims, and asset readiness.');
  }

  if (isPromptType(input.reviewType)) {
    if (!lower.includes('output') && !lower.includes('format')) {
      issues.push('Prompt does not clearly define the expected output format.');
      recommendedFixes.push('Add an explicit output format with sections, length, and style constraints.');
      clarityScore -= 14;
    }
    if (!lower.includes('context') && !lower.includes('goal') && !lower.includes('objective')) {
      missingInputs.push('Goal/context');
      clarityScore -= 10;
    }
    if (!lower.includes('review') && !lower.includes('draft')) {
      safetyWarnings.push('Prompt lacks a draft/review safety instruction.');
      recommendedFixes.push('Add a safety note that output is draft-only and must be reviewed manually.');
      safetyScore -= 10;
    }
  }

  if (input.reviewType === 'ai_studio_image_prompt' || input.reviewType === 'ai_studio_video_prompt') {
    if (!lower.includes('style') && !lower.includes('lighting') && !lower.includes('composition')) {
      missingInputs.push('Visual style, lighting, or composition direction');
      clarityScore -= 10;
    }
    if (!lower.includes('aspect') && !lower.includes('size') && !lower.includes('format')) {
      missingInputs.push('Output format or aspect ratio');
      clarityScore -= 6;
    }
  }

  if (isWorkflowType(input.reviewType)) {
    if (!includesAny(lower, approvalWords)) {
      safetyWarnings.push('Workflow is missing a manual review or approval gate.');
      recommendedFixes.push('Add a manual review/approval step before any handoff or task creation.');
      safetyScore -= 18;
    }
    if (!includesAny(lower, testingWords)) {
      issues.push('Workflow is missing a testing checklist.');
      recommendedFixes.push('Add a testing checklist with payload validation, output review, and rollback notes.');
      clarityScore -= 8;
    }
    if ((lower.includes('n8n') || lower.includes('webhook')) && !includesAny(lower, callbackWords)) {
      issues.push('n8n/webhook plan is missing a callback payload or return path.');
      recommendedFixes.push('Add a callback payload using {{AGENTFLOW_CALLBACK_URL}}, {{TASK_ID}}, and {{WORKSPACE_ID}} placeholders only.');
      clarityScore -= 10;
    }
    if ((lower.includes('n8n') || lower.includes('webhook')) && !includesAny(lower, errorWords)) {
      issues.push('n8n/webhook plan is missing error handling.');
      recommendedFixes.push('Add validation failure, provider failure, and malformed output handling.');
      clarityScore -= 8;
    }
    if (!lower.includes('required input') && !lower.includes('inputs')) {
      missingInputs.push('Required inputs section');
      clarityScore -= 8;
    }
  }

  if (input.reviewType === 'alex_draft') {
    if (!lower.includes('next') && !lower.includes('action')) {
      issues.push('Alex draft is missing clear next actions.');
      recommendedFixes.push('Add 2-4 concrete safe next actions.');
      conversionScore -= 8;
    }
    if (words > 500) {
      issues.push('Alex draft may be too long for quick operational use.');
      recommendedFixes.push('Condense into summary, decision, and next actions.');
      clarityScore -= 8;
    }
  }

  for (const claim of exaggeratedClaims) {
    if (lower.includes(claim)) {
      safetyWarnings.push(`Potential exaggerated or risky claim: "${claim}".`);
      recommendedFixes.push('Replace guaranteed or absolute claims with evidence-based, reviewable language.');
      safetyScore -= 9;
      conversionScore -= 4;
    }
  }

  for (const word of unsafeActionWords) {
    if (lower.includes(word)) {
      safetyWarnings.push(`Mentions a sensitive action or secret-adjacent term: "${word}".`);
      safetyScore -= word.includes('secret') || word.includes('api key') || word.includes('token') ? 22 : 10;
    }
  }

  if (safetyWarnings.length > 0 && !lower.includes('manual') && !lower.includes('review') && !lower.includes('draft')) {
    safetyWarnings.push('Sensitive action is mentioned without a manual review or draft-only safety note.');
    recommendedFixes.push('Add an explicit safety note: draft only, manual review required, no external execution.');
    safetyScore -= 12;
  }

  if (issues.length === 0) strengths.push('No major deterministic quality issues were found.');
  if (safetyWarnings.length === 0) strengths.push('No obvious unsafe execution, publishing, spend, deletion, or secret exposure language was found.');

  checklist.push(
    'Review the content for factual accuracy and brand fit.',
    'Confirm missing inputs are filled before use.',
    'Check claims, CTA, platform fit, and final formatting.',
    'Keep output in draft/review mode until manually approved.'
  );

  if (isWorkflowType(input.reviewType)) {
    checklist.push('Confirm required inputs, callback payload, error handling, testing checklist, and approval gate are present.');
  }

  safeNextActions.push(
    'Apply the recommended fixes in a draft copy.',
    'Run another quality review after edits.',
    'Manually approve only after safety warnings and missing inputs are resolved.'
  );

  if (safetyWarnings.length > 0) {
    safeNextActions.unshift('Resolve safety warnings before using this output anywhere else.');
  }

  clarityScore = clampScore(clarityScore);
  conversionScore = clampScore(conversionScore);
  safetyScore = clampScore(safetyScore);
  const overall = clampScore((clarityScore * 0.36) + (conversionScore * 0.24) + (safetyScore * 0.40) - (missingInputs.length * 2));
  const status = statusFromScores(overall, safetyScore, safetyWarnings, missingInputs);
  const platformFit = input.platform === 'generic'
    ? 'Generic fit. Choose a specific platform for sharper length, CTA, and format checks.'
    : `${platformLabel(input.platform)} fit reviewed with local checks. Confirm final specs manually before use.`;
  const brandFit = input.brandTone?.trim()
    ? `Appears reviewable against "${input.brandTone.trim()}"; final brand nuance still needs manual judgment.`
    : 'Brand tone was not provided, so brand fit is limited.';

  return {
    overall_score: overall,
    status,
    summary: `${reviewTypeLabel(input.reviewType)} scored ${overall}/100 with ${unique(issues).length} issue(s), ${unique(missingInputs).length} missing input(s), and ${unique(safetyWarnings).length} safety warning(s).`,
    strengths: unique(strengths),
    issues: unique(issues),
    missing_inputs: unique(missingInputs),
    safety_warnings: unique(safetyWarnings),
    platform_fit: platformFit,
    brand_fit: brandFit,
    clarity_score: clarityScore,
    conversion_score: conversionScore,
    safety_score: safetyScore,
    recommended_fixes: unique(recommendedFixes),
    improved_version: buildImprovedVersion(input, issues, missingInputs, safetyWarnings),
    review_checklist: unique(checklist),
    safe_next_actions: unique(safeNextActions),
    review_type: input.reviewType,
    platform: input.platform,
    brand_tone: input.brandTone?.trim() || null,
    ai_assisted: false,
    ai_assist_note: null,
  };
}

function listMarkdown(title: string, values: string[]) {
  return [`## ${title}`, values.length ? values.map((value) => `- ${value}`).join('\n') : '- None'].join('\n');
}

export function formatQualityReviewMarkdown(review: QualityReviewResult) {
  return [
    '# Quality Review',
    '',
    '## Overall Score',
    `${review.overall_score}/100`,
    '',
    '## Status',
    review.status,
    '',
    '## Summary',
    review.summary,
    '',
    listMarkdown('Strengths', review.strengths),
    '',
    listMarkdown('Issues', review.issues),
    '',
    listMarkdown('Safety Warnings', review.safety_warnings),
    '',
    listMarkdown('Missing Inputs', review.missing_inputs),
    '',
    '## Platform Fit',
    review.platform_fit,
    '',
    '## Brand Fit',
    review.brand_fit,
    '',
    listMarkdown('Recommended Fixes', review.recommended_fixes),
    '',
    '## Improved Version',
    review.improved_version ?? 'Not applicable.',
    '',
    listMarkdown('Review Checklist', review.review_checklist),
    '',
    listMarkdown('Safe Next Actions', review.safe_next_actions),
  ].join('\n').trim() + '\n';
}
