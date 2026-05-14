import 'server-only';

import { reportAppError, reportAppEvent } from '@/lib/logger';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4.1-mini';
const NVIDIA_DEFAULT_MODEL = 'minimaxai/minimax-m2.7';
const NVIDIA_GENERATION_TIMEOUT_MS = 60_000;
const NVIDIA_SETUP_TEST_TIMEOUT_MS = 45_000;

export type AITextProvider = 'openai' | 'nvidia' | 'auto';
export type AIProviderReadinessStatus =
  | 'ready'
  | 'setup_required'
  | 'quota_limit'
  | 'credits_required'
  | 'error';

export interface AITextProviderReadiness {
  provider: 'openai' | 'nvidia';
  status: AIProviderReadinessStatus;
  isReady: boolean;
  message: string;
  model: string;
}

export interface AITextProviderConfig {
  activeProvider: AITextProvider;
  openAIModel: string;
  nvidiaBaseUrl: string;
  nvidiaModel: string;
  nvidiaBaseUrlPresent: boolean;
  nvidiaModelPresent: boolean;
  nvidiaKeyPresent: boolean;
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

export interface NvidiaSafeDiagnosticSummary {
  provider: 'nvidia';
  providerSelected: AITextProvider;
  baseUrlStatus: 'present' | 'missing';
  modelStatus: 'present' | 'missing';
  keyStatus: 'present' | 'missing';
  model: string;
  requestPath: string;
  requestUrl: string;
  lastTestStatus: 'not_run' | 'ok' | 'failed';
  responseStatusCode: number | null;
  errorCategory: SafeProviderErrorCategory | null;
  safeProviderMessage: string | null;
}

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
  providerUsed: 'openai' | 'nvidia';
  fallbackUsed: boolean;
  model: string;
  message?: string;
};

type GeneratedTextFailure = {
  status: 'setup_required' | 'failed';
  error: string;
  providerUsed: 'openai' | 'nvidia' | null;
  fallbackAttempted: boolean;
  model: string | null;
};

export type GenerateMarketingTextResult = GeneratedTextSuccess | GeneratedTextFailure;

interface ProviderCallSuccess {
  ok: true;
  text: string;
  model: string;
  responseStatusCode?: number | null;
  finishReason?: string | null;
  hasContent?: boolean;
  hasReasoningContent?: boolean;
}

interface ProviderCallFailure {
  ok: false;
  error: string;
  model: string;
  fallbackEligible: boolean;
  setupRequired?: boolean;
  responseStatusCode?: number | null;
  errorCategory: SafeProviderErrorCategory;
  safeProviderMessage?: string | null;
  finishReason?: string | null;
  hasContent?: boolean;
  hasReasoningContent?: boolean;
}

type ProviderCallResult = ProviderCallSuccess | ProviderCallFailure;

interface ChatCompletionPayload {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
  error?: unknown;
}

interface ProviderErrorDetails {
  code: string | null;
  type: string | null;
  message: string | null;
}

function readAITextProvider() {
  const configured = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase();

  if (configured === 'openai' || configured === 'nvidia' || configured === 'auto') {
    return configured;
  }

  return 'openai';
}

function readOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function readNvidiaKey() {
  return process.env.NVIDIA_API_KEY?.trim() || null;
}

function normalizeOpenAIModel() {
  return process.env.OPENAI_TEXT_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
}

function normalizeNvidiaBaseUrl() {
  return process.env.NVIDIA_BASE_URL?.trim().replace(/\/+$/, '') || NVIDIA_DEFAULT_BASE_URL;
}

function normalizeNvidiaModel() {
  return process.env.NVIDIA_MODEL?.trim() || NVIDIA_DEFAULT_MODEL;
}

function isNvidiaBaseUrlConfigured() {
  return Boolean(process.env.NVIDIA_BASE_URL?.trim());
}

function isNvidiaModelConfigured() {
  return Boolean(process.env.NVIDIA_MODEL?.trim());
}

function buildNvidiaRequestUrl() {
  return `${normalizeNvidiaBaseUrl()}/chat/completions`;
}

function safeRequestPath(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.pathname || '/chat/completions';
  } catch {
    return '/chat/completions';
  }
}

export function getAITextProviderConfig(): AITextProviderConfig {
  return {
    activeProvider: readAITextProvider(),
    openAIModel: normalizeOpenAIModel(),
    nvidiaBaseUrl: normalizeNvidiaBaseUrl(),
    nvidiaModel: normalizeNvidiaModel(),
    nvidiaBaseUrlPresent: isNvidiaBaseUrlConfigured(),
    nvidiaModelPresent: isNvidiaModelConfigured(),
    nvidiaKeyPresent: Boolean(readNvidiaKey()),
  };
}

export function getNvidiaSafeDiagnosticSummary(
  test?: Pick<NvidiaSafeDiagnosticSummary, 'lastTestStatus' | 'responseStatusCode' | 'errorCategory' | 'safeProviderMessage'>
): NvidiaSafeDiagnosticSummary {
  const config = getAITextProviderConfig();
  const requestUrl = `${config.nvidiaBaseUrl}/chat/completions`;

  return {
    provider: 'nvidia',
    providerSelected: config.activeProvider,
    baseUrlStatus: config.nvidiaBaseUrlPresent ? 'present' : 'missing',
    modelStatus: config.nvidiaModelPresent ? 'present' : 'missing',
    keyStatus: config.nvidiaKeyPresent ? 'present' : 'missing',
    model: config.nvidiaModel,
    requestPath: safeRequestPath(requestUrl),
    requestUrl,
    lastTestStatus: test?.lastTestStatus ?? 'not_run',
    responseStatusCode: test?.responseStatusCode ?? null,
    errorCategory: test?.errorCategory ?? null,
    safeProviderMessage: test?.safeProviderMessage ?? null,
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
        'AI text generation setup required. Add OPENAI_API_KEY in Vercel to enable Content Studio generation.',
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

export function checkNvidiaTextProviderReadiness(): AITextProviderReadiness {
  const model = normalizeNvidiaModel();

  if (!readNvidiaKey() || !isNvidiaBaseUrlConfigured() || !isNvidiaModelConfigured()) {
    return {
      provider: 'nvidia',
      status: 'setup_required',
      isReady: false,
      message: 'إعداد NVIDIA ناقص. تحقق من NVIDIA_API_KEY و NVIDIA_BASE_URL و NVIDIA_MODEL.',
      model,
    };
  }

  return {
    provider: 'nvidia',
    status: 'ready',
    isReady: true,
    message: 'NVIDIA text generation is configured server-side.',
    model,
  };
}

function readProviderErrorDetails(value: unknown): ProviderErrorDetails {
  if (!value || typeof value !== 'object' || !('error' in value) || !value.error) {
    return {
      code: null,
      type: null,
      message: null,
    };
  }

  const error = value.error;

  if (!error || typeof error !== 'object') {
    return {
      code: null,
      type: null,
      message: null,
    };
  }

  const errorRecord = error as Record<string, unknown>;

  return {
    code: typeof errorRecord.code === 'string' ? errorRecord.code : null,
    type: typeof errorRecord.type === 'string' ? errorRecord.type : null,
    message:
      typeof errorRecord.message === 'string'
        ? errorRecord.message.slice(0, 500)
        : null,
  };
}

function readSafeProviderMessage(value: unknown) {
  if (!value) return null;

  if (typeof value === 'string') return value;

  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const message = record.message ?? record.detail ?? record.error_description;

  if (typeof message === 'string') return message;

  if ('error' in record) {
    const error = record.error;

    if (typeof error === 'string') return error;

    if (error && typeof error === 'object') {
      const errorRecord = error as Record<string, unknown>;
      const errorMessage = errorRecord.message ?? errorRecord.detail ?? errorRecord.error_description;

      if (typeof errorMessage === 'string') return errorMessage;
    }
  }

  return null;
}

function redactNvidiaSecrets(value: string) {
  const apiKey = readNvidiaKey();
  const withoutKnownKey = apiKey ? value.split(apiKey).join('[redacted]') : value;

  return withoutKnownKey
    .replace(/authorization\s*:\s*bearer\s+[^\s,;'"`]+/gi, 'Authorization: Bearer [redacted]')
    .replace(/bearer\s+[^\s,;'"`]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;'"`]+/gi, '$1[redacted]')
    .replace(/(key\s*[:=]\s*)[^\s,;'"`]+/gi, '$1[redacted]');
}

function sanitizeSafeProviderMessage(value: unknown) {
  const message = readSafeProviderMessage(value);

  if (!message) return null;

  return redactNvidiaSecrets(message).replace(/\s+/g, ' ').trim().slice(0, 200) || null;
}

function isOpenAIQuotaOrquotaIssue(details: ProviderErrorDetails) {
  const combined = `${details.code ?? ''} ${details.type ?? ''} ${details.message ?? ''}`.toLowerCase();

  return (
    combined.includes('insufficient_quota') ||
    combined.includes('quota') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('rate_limit')
  );
}

function isNvidiaCreditsOrRateIssue(details: ProviderErrorDetails) {
  const combined = `${details.code ?? ''} ${details.type ?? ''} ${details.message ?? ''}`.toLowerCase();

  return (
    combined.includes('quota') ||
    combined.includes('credit') ||
    combined.includes('credits') ||
    combined.includes('rate limit') ||
    combined.includes('rate_limit') ||
    combined.includes('too many requests') ||
    combined.includes('429')
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
  return 'AI generation is temporarily unavailable. Please try again later.';
}

function friendlyOpenAITextError(details: ProviderErrorDetails) {
  if (details && isContextLengthIssue(details)) {
    return 'AI provider context length exceeded.';
  }

  if (isOpenAIQuotaOrquotaIssue(details)) {
    return 'AI generation is temporarily unavailable. Please check OpenAI API quota or quota.';
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
  if (combined.includes('model') && (combined.includes('not found') || combined.includes('not_found') || combined.includes('does not exist'))) return 'model_not_found';
  if (combined.includes('rate limit') || combined.includes('rate_limit') || combined.includes('too many requests') || combined.includes('quota')) return 'rate_limited';

  return 'provider_error';
}

function friendlyNvidiaTextError(category: SafeProviderErrorCategory, details?: ProviderErrorDetails) {
  if (category === 'missing_key') {
    return 'إعداد NVIDIA ناقص. تحقق من NVIDIA_API_KEY و NVIDIA_BASE_URL و NVIDIA_MODEL.';
  }

  if (category === 'invalid_key') {
    return 'مفتاح NVIDIA غير صالح أو لا يملك صلاحية الوصول.';
  }

  if (category === 'bad_request') {
    return details?.message
      ? redactNvidiaSecrets(details.message).replace(/\s+/g, ' ').trim().slice(0, 200)
      : 'NVIDIA rejected the request as invalid.';
  }

  if (category === 'model_not_found') {
    return 'اسم نموذج NVIDIA غير صحيح أو غير متاح لحسابك.';
  }

  if (category === 'rate_limited') {
    return 'تم بلوغ حد استعمال NVIDIA مؤقتاً.';
  }

  if (category === 'timeout') {
    return 'انتهت مهلة الاتصال مع NVIDIA.';
  }

  if (category === 'empty_response') {
    return 'NVIDIA returned an empty response. Try again or increase max tokens.';
  }

  if (details && isContextLengthIssue(details)) {
    return 'NVIDIA AI provider context length exceeded.';
  }

  return safeGenericAIError();
}

function nvidiaTruncatedOutputMessage() {
  return 'NVIDIA responded but output was truncated. Increase max tokens.';
}

function normalizeProviderText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function summarizeReasoningContent(value: string) {
  const cleaned = value
    .replace(/<\/?think>/gi, '')
    .replace(/^\s*(reasoning|analysis|answer|final)\s*:\s*/gim, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const sentenceMatch = cleaned.match(/(?:[^.!؟。]+[.!؟。]){1,3}/);
  const summary = sentenceMatch?.[0]?.trim() || cleaned;

  return summary.slice(0, 700).trim();
}

function readChatCompletionOutput(payload: ChatCompletionPayload | null, provider: 'openai' | 'nvidia') {
  const choice = payload?.choices?.[0];
  const content = normalizeProviderText(choice?.message?.content);
  const reasoningContent =
    provider === 'nvidia'
      ? normalizeProviderText(choice?.message?.reasoning_content)
      : '';

  return {
    text: content || summarizeReasoningContent(reasoningContent),
    finishReason: choice?.finish_reason ?? null,
    hasContent: content.length > 0,
    hasReasoningContent: reasoningContent.length > 0,
  };
}

async function performChatCompletion(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  kind: string;
  provider: 'openai' | 'nvidia';
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<ProviderCallResult> {
  try {
    const messages = [
      ...(input.systemPrompt
        ? [
            {
              role: 'system',
              content: input.systemPrompt,
            },
          ]
        : []),
      {
        role: 'user',
        content: input.userPrompt,
      },
    ];

    const requestBody = {
      model: input.model,
      messages,
      max_tokens: input.maxTokens,
      ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
    };

    const response = await fetch(input.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
      body: JSON.stringify(requestBody),
    });

    const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
    const output = readChatCompletionOutput(payload, input.provider);
    const safeNvidiaDebugMetadata = input.provider === 'nvidia'
      ? {
          timeoutMs: input.timeoutMs ?? 30_000,
          statusCode: response.status,
          finish_reason: output.finishReason ?? 'none',
          errorCategory: 'none',
          hasContent: output.hasContent,
          hasReasoningContent: output.hasReasoningContent,
        }
      : null;

    if (!response.ok) {
      const details = readProviderErrorDetails(payload);
      const safeProviderMessage = input.provider === 'nvidia' ? sanitizeSafeProviderMessage(payload) : null;
      const errorCategory =
        input.provider === 'nvidia'
          ? categorizeProviderError({ status: response.status, details })
          : isOpenAIQuotaOrquotaIssue(details)
            ? 'rate_limited'
            : 'provider_error';

      reportAppError(
        `${input.provider} text generation provider error`,
        new Error(`${input.provider} provider request failed.`),
        {
          model: input.model,
          kind: input.kind,
          code: details.code ?? 'unknown',
          type: details.type ?? 'unknown',
          status: response.status,
          category: errorCategory,
          ...(input.provider === 'nvidia' ? {
            provider: 'nvidia',
            requestPath: safeRequestPath(input.endpoint),
            safeProviderMessage: safeProviderMessage ?? 'none',
            ...safeNvidiaDebugMetadata,
            errorCategory,
          } : {}),
        }
      );

      const fallbackEligible =
        input.provider === 'openai'
          ? isOpenAIQuotaOrquotaIssue(details)
          : isNvidiaCreditsOrRateIssue(details);

      return {
        ok: false,
        error:
          input.provider === 'openai'
            ? friendlyOpenAITextError(details)
            : friendlyNvidiaTextError(errorCategory, details),
        model: input.model,
        fallbackEligible,
        responseStatusCode: response.status,
        errorCategory,
        safeProviderMessage,
        finishReason: output.finishReason,
        hasContent: output.hasContent,
        hasReasoningContent: output.hasReasoningContent,
      };
    }

    if (
      input.provider === 'nvidia' &&
      output.finishReason === 'length' &&
      input.kind !== 'nvidia_provider_setup_test'
    ) {
      reportAppError(
        'nvidia text generation truncated output',
        new Error('nvidia returned a truncated response.'),
        {
          model: input.model,
          kind: input.kind,
          provider: 'nvidia',
          requestPath: safeRequestPath(input.endpoint),
          category: 'empty_response',
          ...safeNvidiaDebugMetadata,
        }
      );

      return {
        ok: false,
        error: nvidiaTruncatedOutputMessage(),
        model: input.model,
        fallbackEligible: false,
        responseStatusCode: response.status,
        errorCategory: 'empty_response',
        safeProviderMessage: nvidiaTruncatedOutputMessage(),
        finishReason: output.finishReason,
        hasContent: output.hasContent,
        hasReasoningContent: output.hasReasoningContent,
      };
    }

    if (!output.text) {
      const errorCategory = input.provider === 'nvidia' ? 'empty_response' : 'provider_error';

      reportAppError(
        `${input.provider} text generation returned empty content`,
        new Error(`${input.provider} returned an empty response.`),
        {
          model: input.model,
          kind: input.kind,
          category: errorCategory,
          ...(input.provider === 'nvidia' ? {
            provider: 'nvidia',
            requestPath: safeRequestPath(input.endpoint),
            ...safeNvidiaDebugMetadata,
          } : {}),
        }
      );

      return {
        ok: false,
        error:
          input.provider === 'nvidia'
            ? friendlyNvidiaTextError(errorCategory)
            : safeGenericAIError(),
        model: input.model,
        fallbackEligible: false,
        responseStatusCode: response.status,
        errorCategory,
        safeProviderMessage:
          input.provider === 'nvidia'
            ? friendlyNvidiaTextError(errorCategory)
            : null,
        finishReason: output.finishReason,
        hasContent: output.hasContent,
        hasReasoningContent: output.hasReasoningContent,
      };
    }

    return {
      ok: true,
      text: output.text,
      model: input.model,
      responseStatusCode: response.status,
      finishReason: output.finishReason,
      hasContent: output.hasContent,
      hasReasoningContent: output.hasReasoningContent,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name.toLowerCase() : '';
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const isTimeout = errorName.includes('timeout') || errorName.includes('abort') || errorMessage.includes('timeout');
    const errorCategory = categorizeProviderError({ timeout: isTimeout });
    const safeProviderMessage =
      input.provider === 'nvidia'
        ? isTimeout
          ? 'Request timed out before NVIDIA returned a response.'
          : sanitizeSafeProviderMessage(error instanceof Error ? error.message : null)
        : null;

    reportAppError(`${input.provider} text generation request failed`, error, {
      model: input.model,
      kind: input.kind,
      ...(input.provider === 'nvidia' ? {
        provider: 'nvidia',
        requestPath: safeRequestPath(input.endpoint),
        timeoutMs: input.timeoutMs ?? 30_000,
        statusCode: null,
        finish_reason: 'none',
        errorCategory,
        safeProviderMessage: safeProviderMessage ?? 'none',
      } : {}),
    });

    return {
      ok: false,
      error:
        input.provider === 'nvidia'
          ? friendlyNvidiaTextError(errorCategory)
          : isTimeout
            ? 'AI generation request timed out.'
            : safeGenericAIError(),
      model: input.model,
      fallbackEligible: false,
      responseStatusCode: null,
      errorCategory,
      safeProviderMessage,
    };
  }
}

export async function generateTextWithOpenAI(
  input: GenerateTextProviderInput
): Promise<ProviderCallResult> {
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

  return performChatCompletion({
    endpoint: OPENAI_CHAT_ENDPOINT,
    apiKey,
    model: readiness.model,
    kind: input.kind,
    provider: 'openai',
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxTokens: input.maxTokens ?? 900,
    temperature: input.temperature ?? 0.7,
  });
}

export async function generateTextWithNvidia(
  input: GenerateTextProviderInput
): Promise<ProviderCallResult> {
  const readiness = checkNvidiaTextProviderReadiness();
  const apiKey = readNvidiaKey();

  if (!readiness.isReady || !apiKey) {
    return {
      ok: false,
      error: friendlyNvidiaTextError('missing_key'),
      model: readiness.model,
      fallbackEligible: false,
      setupRequired: true,
      responseStatusCode: null,
      errorCategory: 'missing_key',
    };
  }

  return performChatCompletion({
    endpoint: buildNvidiaRequestUrl(),
    apiKey,
    model: readiness.model,
    kind: input.kind,
    provider: 'nvidia',
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxTokens: Math.max(input.maxTokens ?? 900, 120),
    temperature: input.temperature ?? 0.7,
    timeoutMs: NVIDIA_GENERATION_TIMEOUT_MS,
  });
}

export async function testNvidiaTextProviderConnection(): Promise<NvidiaSafeDiagnosticSummary> {
  const readiness = checkNvidiaTextProviderReadiness();
  const apiKey = readNvidiaKey();

  if (!readiness.isReady || !apiKey) {
    return getNvidiaSafeDiagnosticSummary({
      lastTestStatus: 'failed',
      responseStatusCode: null,
      errorCategory: 'missing_key',
      safeProviderMessage: 'NVIDIA setup is incomplete.',
    });
  }

  const result = await performChatCompletion({
    endpoint: buildNvidiaRequestUrl(),
    apiKey,
    model: readiness.model,
    kind: 'nvidia_provider_setup_test',
    provider: 'nvidia',
    userPrompt: 'Reply with OK only.',
    maxTokens: 120,
    timeoutMs: NVIDIA_SETUP_TEST_TIMEOUT_MS,
  });

  if (result.ok) {
    reportAppEvent('nvidia_text_provider_test_succeeded', {
      provider: 'nvidia',
      model: result.model,
      requestPath: safeRequestPath(buildNvidiaRequestUrl()),
      status: 'ok',
      responseStatusCode: 200,
      category: 'ok',
      safeProviderMessage: 'OK',
      timeoutMs: NVIDIA_SETUP_TEST_TIMEOUT_MS,
      finish_reason: result.finishReason ?? 'none',
      hasContent: result.hasContent ?? false,
      hasReasoningContent: result.hasReasoningContent ?? false,
    });

    return getNvidiaSafeDiagnosticSummary({
      lastTestStatus: 'ok',
      responseStatusCode: 200,
      errorCategory: null,
      safeProviderMessage: 'OK',
    });
  }

  reportAppEvent('nvidia_text_provider_test_failed', {
    provider: 'nvidia',
    model: result.model,
    requestPath: safeRequestPath(buildNvidiaRequestUrl()),
    status: 'failed',
    responseStatusCode: result.responseStatusCode ?? null,
    category: result.errorCategory,
    safeProviderMessage: result.safeProviderMessage ?? 'none',
    timeoutMs: NVIDIA_SETUP_TEST_TIMEOUT_MS,
    finish_reason: result.finishReason ?? 'none',
    hasContent: result.hasContent ?? false,
    hasReasoningContent: result.hasReasoningContent ?? false,
  });

  return getNvidiaSafeDiagnosticSummary({
    lastTestStatus: 'failed',
    responseStatusCode: result.responseStatusCode ?? null,
    errorCategory: result.errorCategory,
    safeProviderMessage: result.safeProviderMessage ?? null,
  });
}

export async function generateMarketingText(
  input: GenerateTextProviderInput
): Promise<GenerateMarketingTextResult> {
  const config = getAITextProviderConfig();

  if (config.activeProvider === 'openai') {
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
      message: 'Generated successfully.',
    };
  }

  if (config.activeProvider === 'nvidia') {
    const result = await generateTextWithNvidia(input);

    if (!result.ok) {
      return {
        status: result.setupRequired ? 'setup_required' : 'failed',
        error: result.error,
        providerUsed: 'nvidia',
        fallbackAttempted: false,
        model: result.model,
      };
    }

    return {
      status: 'generated',
      text: result.text,
      providerUsed: 'nvidia',
      fallbackUsed: false,
      model: result.model,
      message: 'Generated successfully.',
    };
  }

  const nvidiaResult = await generateTextWithNvidia(input);

  if (nvidiaResult.ok) {
    return {
      status: 'generated',
      text: nvidiaResult.text,
      providerUsed: 'nvidia',
      fallbackUsed: false,
      model: nvidiaResult.model,
      message: 'Generated successfully.',
    };
  }

  const openAIReadiness = checkOpenAITextProviderReadiness();

  if (!openAIReadiness.isReady) {
    return {
      status: nvidiaResult.setupRequired ? 'setup_required' : 'failed',
      error: nvidiaResult.error,
      providerUsed: 'nvidia',
      fallbackAttempted: false,
      model: nvidiaResult.model,
    };
  }

  reportAppEvent('ai_text_provider_fallback_attempted', {
    from: 'nvidia',
    to: 'openai',
    kind: input.kind,
  });

  const openAIResult = await generateTextWithOpenAI(input);

  if (!openAIResult.ok) {
    return {
      status: openAIResult.setupRequired ? 'setup_required' : 'failed',
      error: openAIResult.error,
      providerUsed: 'openai',
      fallbackAttempted: true,
      model: openAIResult.model,
    };
  }

  reportAppEvent('ai_text_provider_fallback_succeeded', {
    from: 'nvidia',
    to: 'openai',
    kind: input.kind,
  });

  return {
    status: 'generated',
    text: openAIResult.text,
    providerUsed: 'openai',
    fallbackUsed: true,
    model: openAIResult.model,
    message: 'OpenAI fallback generated successfully.',
  };
}
