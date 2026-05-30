/**
 * Retry strategy options for safeFetch.
 * Incremental + production-safe: defaults preserve existing maxRetries=3 behavior.
 */
export interface RetryOptions {
  /**
   * Total retries after the first attempt (0 means single attempt).
   * NOTE: safeFetch loop uses attemptIndex <= maxRetries to preserve existing semantics.
   */
  maxRetries?: number;

  baseDelayMs?: number;
  maxDelayMs?: number;

  /** Enable randomized jitter on backoff delay */
  jitter?: boolean;

  /**
   * Optional override. If not provided, safeFetch uses transient classification:
   * - network/TypeError
   * - timeout/abort due to our timeout
   * - 429 + 502 + 503 + 504
   */
  retryOn?: (
    error: unknown,
    meta: { statusCode: number | null; isTimeout: boolean }
  ) => boolean;

  /**
   * Total retry budget across all attempts (including delay).
   * If exceeded, we stop retrying and fail fast to avoid retry storms/hangs.
   */
  totalRetryTimeoutMs?: number;
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retryOptions?: RetryOptions;
  traceId?: string;
}

export interface SafeFetchResult<T> {
  data: T | null;
  error: Error | null;
  statusCode: number | null;
  traceId: string;
  durationMs: number;
  fromCache: boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<
  Pick<RetryOptions, 'maxRetries' | 'baseDelayMs' | 'maxDelayMs' | 'jitter' | 'totalRetryTimeoutMs'>
> & {
  retryOn: NonNullable<RetryOptions['retryOn']>;
} = {
  maxRetries: 3,
  baseDelayMs: 1000, // align with spec example scale (Retry1->2s etc when attemptIndex starts at 0)
  maxDelayMs: 15_000,
  jitter: true,
  totalRetryTimeoutMs:
    typeof process !== 'undefined' && process.env?.SAFE_FETCH_TOTAL_RETRY_TIMEOUT_MS
      ? Number(process.env.SAFE_FETCH_TOTAL_RETRY_TIMEOUT_MS)
      : 30_000,

  retryOn: (error, meta) => {
    // Transient classification only.
    if (meta.statusCode !== null) {
      return [429, 502, 503, 504].includes(meta.statusCode);
    }

    if (meta.isTimeout) return true;

    if (error instanceof Error) {
      // Network errors in fetch are commonly TypeError
      if (error.name === 'TypeError') return true;
      // Our own timeout abort error message includes "Request timed out"
      if (error.message.toLowerCase().includes('request timed out')) return true;
      // Some environments use "fetch failed"
      if (error.message.toLowerCase().includes('fetch failed')) return true;
    }

    return false;
  },
};

function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function calculateDelay(opts: {
  attemptIndex: number; // 0 for first retry scheduling
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}): number {
  const { attemptIndex, baseDelayMs, maxDelayMs, jitter } = opts;

  // Exponential backoff: baseDelay * 2^attemptIndex
  let delay = baseDelayMs * Math.pow(2, attemptIndex);

  delay = Math.min(delay, maxDelayMs);

  if (jitter) {
    const jitterAmount = delay * 0.25; // ±25%
    delay += (Math.random() * 2 - 1) * jitterAmount;
  }

  return Math.max(0, delay);
}

function getEnvNumber(name: string, fallback: number): number {
  const raw = process?.env?.[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isLikelyJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const startTime = Date.now();
  const traceId = options.traceId ?? generateTraceId();

  const {
    timeoutMs = getEnvNumber('SAFE_FETCH_TIMEOUT_MS_DEFAULT', 8000),
    retryOptions = {},
    ...fetchOptions
  } = options;

  const maxRetries =
    retryOptions.maxRetries ??
    getEnvNumber('SAFE_FETCH_MAX_RETRIES', DEFAULT_RETRY_OPTIONS.maxRetries);

  const baseDelayMs =
    retryOptions.baseDelayMs ?? getEnvNumber('SAFE_FETCH_BASE_DELAY_MS', DEFAULT_RETRY_OPTIONS.baseDelayMs);

  const maxDelayMs =
    retryOptions.maxDelayMs ?? getEnvNumber('SAFE_FETCH_MAX_DELAY_MS', DEFAULT_RETRY_OPTIONS.maxDelayMs);

  const jitter = retryOptions.jitter ?? DEFAULT_RETRY_OPTIONS.jitter;

  const totalRetryTimeoutMs =
    retryOptions.totalRetryTimeoutMs ??
    getEnvNumber('SAFE_FETCH_TOTAL_RETRY_TIMEOUT_MS', DEFAULT_RETRY_OPTIONS.totalRetryTimeoutMs);

  const retryOn = retryOptions.retryOn ?? DEFAULT_RETRY_OPTIONS.retryOn;

  const { reportAppEvent, reportAppError } = await import('@/lib/logger');

  let lastError: Error | null = null;
  let lastStatusCode: number | null = null;

  const urlString = input instanceof URL ? input.toString() : String(input);
  const method = (fetchOptions.method ?? 'GET').toUpperCase();

  // attemptIndex in loop is the attempt number starting from 0 (first attempt)
  for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex++) {
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > totalRetryTimeoutMs) {
      reportAppError('safe_fetch_retry_budget_exceeded', new Error('Retry budget exceeded'), {
        traceId,
        method,
        url: urlString,
        durationMs: elapsedMs,
        attempts: maxRetries + 1,
      });

      return {
        data: null,
        error: lastError ?? new Error('Retry budget exceeded'),
        statusCode: lastStatusCode,
        traceId,
        durationMs: elapsedMs,
        fromCache: false,
      };
    }

    // Create abort controller for per-attempt timeout
    const controller = new AbortController();
    let isTimeoutAbort = false;

    const timeoutId = setTimeout(() => {
      isTimeoutAbort = true;
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const upstreamSignal = fetchOptions.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

    try {
      if (upstreamSignal?.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
      }

      const response = await fetch(input, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);

      const durationMs = Date.now() - startTime;
      lastStatusCode = response.status;

      // Retryable HTTP codes: 429/502/503/504
      if ([429, 502, 503, 504].includes(response.status) && attemptIndex < maxRetries) {
        const retryReason = `retryable_http_status:${response.status}`;
        const delayMs = calculateDelay({
          attemptIndex,
          baseDelayMs,
          maxDelayMs,
          jitter,
        });

        const projectedElapsed = Date.now() - startTime + delayMs;
        if (projectedElapsed > totalRetryTimeoutMs) {
          reportAppError('safe_fetch_retry_budget_exceeded_http', new Error('Retry budget exceeded after http'), {
            traceId,
            method,
            url: urlString,
            statusCode: response.status,
            durationMs,
            attempt: attemptIndex,
            delayMs,
            attempts: maxRetries + 1,
          });

          break;
        }

        reportAppEvent('safe_fetch_retry_scheduled', {
          traceId,
          method,
          url: urlString,
          statusCode: response.status,
          durationMs,
          attempt: attemptIndex + 1,
          retryAttempt: attemptIndex + 1,
          retryReason,
          delayMs,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Parse JSON response if applicable
      let data: T | null = null;
      const statusCode = response.status;

      if (isLikelyJsonResponse(response)) {
        try {
          data = (await response.json()) as T;
        } catch (parseError) {
          console.warn(`[safeFetch:${traceId}] JSON parsing failed`, parseError);
        }
      }

      reportAppEvent('safe_fetch_success', {
        traceId,
        method,
        url: urlString,
        statusCode,
        durationMs,
        attempt: attemptIndex + 1,
        fromCache: false,
      });

      return {
        data,
        error: null,
        statusCode,
        traceId,
        durationMs,
        fromCache: false,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);

      const durationMs = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));

      const retryable =
        attemptIndex < maxRetries &&
        retryOn(lastError, { statusCode: lastStatusCode, isTimeout: isTimeoutAbort });

      if (!retryable) break;

      const delayMs = calculateDelay({
        attemptIndex,
        baseDelayMs,
        maxDelayMs,
        jitter,
      });

      const projectedElapsed = Date.now() - startTime + delayMs;
      if (projectedElapsed > totalRetryTimeoutMs) {
        reportAppError('safe_fetch_retry_budget_exceeded_timeout_or_network', new Error('Retry budget exceeded'), {
          traceId,
          method,
          url: urlString,
          durationMs,
          attempt: attemptIndex + 1,
          delayMs,
          attempts: maxRetries + 1,
          isTimeout: isTimeoutAbort,
        });

        break;
      }

      const retryReason = isTimeoutAbort
        ? `timeout_abort:${timeoutMs}ms`
        : `transient_error:${lastError.name || 'Error'}`;

      reportAppEvent('safe_fetch_retry_scheduled', {
        traceId,
        method,
        url: urlString,
        statusCode: lastStatusCode,
        durationMs,
        attempt: attemptIndex + 1,
        retryAttempt: attemptIndex + 1,
        retryReason,
        delayMs,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
  }

  const durationMs = Date.now() - startTime;

  reportAppError('safe_fetch_retry_final_failure', lastError ?? new Error('Unknown fetch error'), {
    traceId,
    method,
    url: urlString,
    durationMs,
    attempts: maxRetries + 1,
    lastStatusCode,
    timeoutMs,
  });

  return {
    data: null,
    error: lastError ?? new Error('Unknown fetch error'),
    statusCode: lastStatusCode,
    traceId,
    durationMs,
    fromCache: false,
  };
}

export async function providerFetch<T = unknown>(
  provider: string,
  input: RequestInfo | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const providerTraceId = `${provider}-${options.traceId ?? generateTraceId()}`;

  return safeFetch<T>(input, {
    ...options,
    traceId: providerTraceId,
  });
}

export async function batchFetch<T = unknown>(
  requests: Array<{ input: RequestInfo | URL; options?: SafeFetchOptions }>
): Promise<SafeFetchResult<T>[]> {
  const traceId = generateTraceId();

  const results = await Promise.allSettled(
    requests.map(({ input, options = {} }) =>
      safeFetch<T>(input, {
        ...options,
        traceId: `${traceId}-${Math.random().toString(36).substring(2, 5)}`,
      })
    )
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;

    const reason = result.reason;
    const error =
      reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Request failed');

    const errorResult: SafeFetchResult<T> = {
      data: null,
      error,
      statusCode: null,
      traceId: `${traceId}-failed-${index}`,
      durationMs: 0,
      fromCache: false,
    };

    return errorResult;
  });
}
