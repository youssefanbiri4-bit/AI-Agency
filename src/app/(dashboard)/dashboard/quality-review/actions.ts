'use server';

import { checkOpenAITextProviderReadiness, generateTextWithOpenAI } from '@/lib/ai/text-provider';
import { evaluateQualityDeterministic } from '@/lib/quality-review/evaluation';
import type { QualityReviewInput, QualityReviewResult } from '@/lib/quality-review/review-types';

export interface QualityReviewActionState {
  error: string | null;
  review: QualityReviewResult | null;
}

const maxReviewContentLength = 12000;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function coerceNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item)).filter(Boolean).slice(0, 8);
}

function parseAiJson(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeAiReview(base: QualityReviewResult, aiText: string): QualityReviewResult {
  const parsed = parseAiJson(aiText);
  if (!parsed) {
    return {
      ...base,
      ai_assisted: false,
      ai_assist_note: 'AI-assisted review returned non-JSON output, so deterministic review was used.',
    };
  }

  const aiSafetyScore = coerceNumber(parsed.safety_score);
  const aiClarityScore = coerceNumber(parsed.clarity_score);
  const aiConversionScore = coerceNumber(parsed.conversion_score);

  const clarity_score = aiClarityScore === null ? base.clarity_score : Math.round((base.clarity_score + aiClarityScore) / 2);
  const conversion_score = aiConversionScore === null ? base.conversion_score : Math.round((base.conversion_score + aiConversionScore) / 2);
  const safety_score = aiSafetyScore === null ? base.safety_score : Math.min(base.safety_score, Math.round((base.safety_score + aiSafetyScore) / 2));
  const overall_score = Math.round((clarity_score * 0.36) + (conversion_score * 0.24) + (safety_score * 0.40));
  const aiWarnings = coerceStringArray(parsed.safety_warnings);
  const safety_warnings = Array.from(new Set([...base.safety_warnings, ...aiWarnings]));
  const status = safety_score <= 35 || safety_warnings.length >= 5
    ? 'blocked'
    : safety_score <= 55 || safety_warnings.length >= 3
      ? 'risky'
      : overall_score >= 88 && base.missing_inputs.length === 0
        ? 'excellent'
        : overall_score >= 72
          ? 'good'
          : 'needs_improvement';

  return {
    ...base,
    overall_score,
    status,
    summary: readString(parsed.summary) || base.summary,
    strengths: Array.from(new Set([...base.strengths, ...coerceStringArray(parsed.strengths)])),
    issues: Array.from(new Set([...base.issues, ...coerceStringArray(parsed.issues)])),
    missing_inputs: Array.from(new Set([...base.missing_inputs, ...coerceStringArray(parsed.missing_inputs)])),
    safety_warnings,
    platform_fit: readString(parsed.platform_fit) || base.platform_fit,
    brand_fit: readString(parsed.brand_fit) || base.brand_fit,
    clarity_score,
    conversion_score,
    safety_score,
    recommended_fixes: Array.from(new Set([...base.recommended_fixes, ...coerceStringArray(parsed.recommended_fixes)])),
    improved_version: readString(parsed.improved_version) || base.improved_version,
    review_checklist: Array.from(new Set([...base.review_checklist, ...coerceStringArray(parsed.review_checklist)])),
    safe_next_actions: Array.from(new Set([...base.safe_next_actions, ...coerceStringArray(parsed.safe_next_actions)])),
    ai_assisted: true,
    ai_assist_note: 'AI-assisted review was applied server-side and merged with deterministic checks.',
  };
}

function buildAiPrompt(input: QualityReviewInput, deterministic: QualityReviewResult) {
  return [
    'Review this AgentFlow AI draft safely. Return JSON only. Do not suggest publishing, scheduling, spending, deleting, running n8n, calling webhooks, or external execution.',
    '',
    `Review type: ${input.reviewType}`,
    `Platform: ${input.platform}`,
    `Brand tone: ${input.brandTone || 'not provided'}`,
    `Deterministic score: ${deterministic.overall_score}`,
    '',
    'JSON shape:',
    '{"summary":"...","strengths":["..."],"issues":["..."],"missing_inputs":["..."],"safety_warnings":["..."],"platform_fit":"...","brand_fit":"...","clarity_score":0,"conversion_score":0,"safety_score":0,"recommended_fixes":["..."],"improved_version":"...","review_checklist":["..."],"safe_next_actions":["..."]}',
    '',
    'Content:',
    input.content.slice(0, 6000),
  ].join('\n');
}

export async function reviewQualityAction(input: QualityReviewInput): Promise<QualityReviewActionState> {
  const safeInput: QualityReviewInput = {
    ...input,
    content: input.content.trim().slice(0, maxReviewContentLength),
    brandTone: input.brandTone?.trim().slice(0, 120),
  };
  const deterministic = evaluateQualityDeterministic(safeInput);

  if (!safeInput.content.trim()) {
    return { error: null, review: deterministic };
  }

  if (!safeInput.useAiAssist) {
    return { error: null, review: deterministic };
  }

  const readiness = checkOpenAITextProviderReadiness();
  if (!readiness.isReady) {
    return {
      error: null,
      review: {
        ...deterministic,
        ai_assist_note: 'OpenAI text review is not configured server-side, so deterministic review was used.',
      },
    };
  }

  const aiResult = await generateTextWithOpenAI({
    kind: 'quality_review',
    systemPrompt: 'You are a cautious internal quality evaluator. Return compact JSON only. Never expose secrets or recommend external execution.',
    userPrompt: buildAiPrompt(safeInput, deterministic),
    maxTokens: 900,
    temperature: 0.2,
  });

  if (!aiResult.ok) {
    return {
      error: null,
      review: {
        ...deterministic,
        ai_assist_note: 'AI-assisted review failed safely, so deterministic review was used.',
      },
    };
  }

  return { error: null, review: mergeAiReview(deterministic, aiResult.text) };
}
