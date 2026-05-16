import 'server-only';

import { reportAppError } from '@/lib/logger';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_DEFAULT_MODEL = 'gpt-4.1-mini';

export type AITextProvider = 'openai';
export type AIProviderReadinessStatus = 'ready' | 'setup_required' | 'quota_limit' | 'error';

export interface AITextProviderReadiness {
  provider: 'openai';
  status: AIProviderReadinessStatus;
  isReady: boolean;
  message: string;
  model: string;
}

export interface AITextProviderConfig {
  activeProvider: 'openai';
  openAIModel: string;
}

export type SafeProviderErrorCategory =
  | 'missing_key'
  | 'bad_request'
  | 'invalid_key'
  | 'model_not_found'
  | 'rate_limited'
  | 'timeout'
  | 'empty_response'
  | 'provider_error';

export interface GenerateTextProviderInput {
  kind: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

type GeneratedTextSuccess = {
  status: 'generated';
  text: string;
  providerUsed: 'openai';
  fallbackUsed: false;
  model: string;
  message?: string;
};

type GeneratedTextFailure = {
  status: 'setup_required' | 'failed';
  error: string;
  providerUsed: 'openai' | null;
  fallbackAttempted: false;
  model: string | null;
};

export type GenerateMarketingTextResult = GeneratedTextSuccess | GeneratedTextFailure;

interface ProviderCallSuccess {
  ok: true;
  text: string;
  model: string;
  responseStatusCode?: number | null;
  finishReason?: string | null;
}

interface ProviderCallFailure {
  ok: false;
  error: string;
  model: string;
  fallbackEligible: false;
  setupRequired?: boolean;
  responseStatusCode?: number | null;
  errorCategory: SafeProviderErrorCategory;
}

type ProviderCallResult = ProviderCallSuccess | ProviderCallFailure;

interface ChatCompletionPayload {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
  error?: unknown;
}

interface ProviderErrorDetails {
  code: string | null;
  type: string | null;
  message: string | null;
}

function readOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function normalizeOpenAIModel() {
  return process.env.OPENAI_TEXT_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
}

export function getAITextProviderConfig(): AITextProviderConfig {
  return {
    activeProvider: 'openai',
    openAIModel: normalizeOpenAIModel(),
  };
}

export function checkOpenAITextProviderReadiness(): AITextProviderReadiness {
  const model = normalizeOpenAIModel();

  if (!readOpenAIKey()) {
    return {
      provider: 'openai',
      status: 'setup_required',
      isReady: false,
      message:
        'OpenAI setup is required. Add OPENAI_API_KEY in Vercel to enable AI text generation. الإعداد ناقص: خاص OPENAI_API_KEY.',
      model,
    };
  }

  return {
    provider: 'openai',
    status: 'ready',
    isReady: true,
    message: 'OpenAI text generation is configured server-side.',
    model,
  };
}

function readProviderErrorDetails(value: unknown): ProviderErrorDetails {
  if (!value || typeof value !== 'object' || !('error' in value) || !value.error) {
    return { code: null, type: null, message: null };
  }

  const error = value.error;
  if (!error || typeof error !== 'object') {
    return { code: null, type: null, message: null };
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : null,
    type: typeof record.type === 'string' ? record.type : null,
    message: typeof record.message === 'string' ? record.message.slice(0, 500) : null,
  };
}

function isQuotaOrRateIssue(details: ProviderErrorDetails) {
  const combined = `${details.code ?? ''} ${details.type ?? ''} ${details.message ?? ''}`.toLowerCase();
  return (
    combined.includes('insufficient_quota') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('rate_limit') ||
    combined.includes('too many requests')
  );
}

function isContextLengthIssue(details: ProviderErrorDetails) {
  const combined = `${details.code ?? ''} ${details.type ?? ''} ${details.message ?? ''}`.toLowerCase();
  return (
    combined.includes('context length') ||
    combined.includes('maximum context') ||
    combined.includes('token limit') ||
    combined.includes('too many tokens') ||
    combined.includes('request too large') ||
    combined.includes('payload too large') ||
    combined.includes('input is too long') ||
    combined.includes('context window')
  );
}

function safeGenericAIError() {
  return 'AI generation is temporarily unavailable. Please try again later. التوليد غير متاح مؤقتاً، جرّب مرة أخرى بعد قليل.';
}

function friendlyOpenAITextError(details: ProviderErrorDetails) {
  if (isContextLengthIssue(details)) {
    return 'The prompt is too long for OpenAI. Shorten the draft and try again. البرومبت طويل بزاف، نقص النص وجرب مرة أخرى.';
  }

  if (isQuotaOrRateIssue(details)) {
    return 'OpenAI is rate-limited or out of quota. Please check billing/quota in OpenAI, then try again. حصة OpenAI أو الفوترة تحتاج مراجعة.';
  }

  const combined = `${details.code ?? ''} ${details.type ?? ''} ${details.message ?? ''}`.toLowerCase();
  if (combined.includes('invalid api key') || combined.includes('unauthorized') || combined.includes('forbidden')) {
    return 'OpenAI API key is invalid or does not have access. Check OPENAI_API_KEY in Vercel. مفتاح OpenAI غير صالح أو لا يملك صلاحية.';
  }

  if (combined.includes('model') && (combined.includes('not found') || combined.includes('does not exist'))) {
    return 'The configured OpenAI model is not available. Check OPENAI_TEXT_MODEL or use the default model.';
  }

  return safeGenericAIError();
}

function categorizeProviderError(input: {
  status?: number | null;
  details?: ProviderErrorDetails;
  timeout?: boolean;
}): SafeProviderErrorCategory {
  if (input.timeout) return 'timeout';
  if (input.status === 400) return 'bad_request';
  if (input.status === 401 || input.status === 403) return 'invalid_key';
  if (input.status === 404) return 'model_not_found';
  if (input.status === 429) return 'rate_limited';
  if (input.status && input.status >= 500) return 'provider_error';

  const combined = `${input.details?.code ?? ''} ${input.details?.type ?? ''} ${input.details?.message ?? ''}`.toLowerCase();
  if (combined.includes('unauthorized') || combined.includes('forbidden') || combined.includes('invalid api key')) return 'invalid_key';
  if (combined.includes('model') && (combined.includes('not found') || combined.includes('does not exist'))) return 'model_not_found';
  if (combined.includes('rate limit') || combined.includes('rate_limit') || combined.includes('too many requests') || combined.includes('quota')) return 'rate_limited';

  return 'provider_error';
}

function normalizeProviderText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function readChatCompletionOutput(payload: ChatCompletionPayload | null) {
  const choice = payload?.choices?.[0];
  return {
    text: normalizeProviderText(choice?.message?.content),
    finishReason: choice?.finish_reason ?? null,
  };
}

export async function generateTextWithOpenAI(input: GenerateTextProviderInput): Promise<ProviderCallResult> {
  const readiness = checkOpenAITextProviderReadiness();
  const apiKey = readOpenAIKey();

  if (!readiness.isReady || !apiKey) {
    return {
      ok: false,
      error: readiness.message,
      model: readiness.model,
      fallbackEligible: false,
      setupRequired: true,
      responseStatusCode: null,
      errorCategory: 'missing_key',
    };
  }

  try {
    const messages = [
      ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
      { role: 'user', content: input.userPrompt },
    ];

    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: readiness.model,
        messages,
        max_tokens: input.maxTokens ?? 900,
        ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
    const output = readChatCompletionOutput(payload);

    if (!response.ok) {
      const details = readProviderErrorDetails(payload);
      const errorCategory = isQuotaOrRateIssue(details)
        ? 'rate_limited'
        : categorizeProviderError({ status: response.status, details });

      reportAppError('openai text generation provider error', new Error('OpenAI provider request failed.'), {
        model: readiness.model,
        kind: input.kind,
        code: details.code ?? 'unknown',
        type: details.type ?? 'unknown',
        status: response.status,
        category: errorCategory,
      });

      return {
        ok: false,
        error: friendlyOpenAITextError(details),
        model: readiness.model,
        fallbackEligible: false,
        responseStatusCode: response.status,
        errorCategory,
      };
    }

    if (!output.text) {
      reportAppError('openai text generation returned empty content', new Error('OpenAI returned an empty response.'), {
        model: readiness.model,
        kind: input.kind,
        category: 'empty_response',
        finishReason: output.finishReason ?? 'none',
      });

      return {
        ok: false,
        error: safeGenericAIError(),
        model: readiness.model,
        fallbackEligible: false,
        responseStatusCode: response.status,
        errorCategory: 'empty_response',
      };
    }

    return {
      ok: true,
      text: output.text,
      model: readiness.model,
      responseStatusCode: response.status,
      finishReason: output.finishReason,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name.toLowerCase() : '';
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const isTimeout = errorName.includes('timeout') || errorName.includes('abort') || errorMessage.includes('timeout');

    reportAppError('openai text generation request failed', error, {
      model: readiness.model,
      kind: input.kind,
      category: isTimeout ? 'timeout' : 'provider_error',
    });

    return {
      ok: false,
      error: isTimeout
        ? 'OpenAI request timed out. Please try again. انتهت مهلة طلب OpenAI، جرّب مرة أخرى.'
        : safeGenericAIError(),
      model: readiness.model,
      fallbackEligible: false,
      responseStatusCode: null,
      errorCategory: isTimeout ? 'timeout' : 'provider_error',
    };
  }
}

export async function generateMarketingText(input: GenerateTextProviderInput): Promise<GenerateMarketingTextResult> {
  const result = await generateTextWithOpenAI(input);

  if (!result.ok) {
    return {
      status: result.setupRequired ? 'setup_required' : 'failed',
      error: result.error,
      providerUsed: 'openai',
      fallbackAttempted: false,
      model: result.model,
    };
  }

  return {
    status: 'generated',
    text: result.text,
    providerUsed: 'openai',
    fallbackUsed: false,
    model: result.model,
    message: 'Generated successfully with OpenAI.',
  };
}
