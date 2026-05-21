// Define retry strategy options
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryOn?: (error: unknown) => boolean;
}

// Define fetch options with timeout and retry
export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retryOptions?: RetryOptions;
  traceId?: string;
}

// Define the result of a safe fetch operation
export interface SafeFetchResult<T> {
  data: T | null;
  error: Error | null;
  statusCode: number | null;
  traceId: string;
  durationMs: number;
  fromCache: boolean;
}

// Default retry options
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  jitter: true,
  retryOn: (error) => {
    // Retry on network errors, timeouts, and 5xx errors
    if (error instanceof Error) {
      return (
        error.name === 'TypeError' || // Network errors
        error.message.includes('fetch failed') ||
        error.message.includes('timeout')
      );
    }
    return false;
  },
};

// Generate a simple trace ID
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Calculate delay with exponential backoff and jitter
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean
): number {
  // Exponential backoff: baseDelay * 2^attempt
  let delay = baseDelayMs * Math.pow(2, attempt);
  
  // Apply max delay cap
  delay = Math.min(delay, maxDelayMs);
  
  // Add jitter if enabled (±25%)
  if (jitter) {
    const jitterAmount = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterAmount; // [-jitterAmount, +jitterAmount]
  }
  
  return Math.max(0, delay);
}

// Safe fetch implementation with timeout, retry, and tracing
export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const startTime = Date.now();
  const traceId = options.traceId ?? generateTraceId();
  
  // Extract our custom options
  const { timeoutMs = 8000, retryOptions = {}, ...fetchOptions } = options;
  const { 
    maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_RETRY_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs,
    jitter = DEFAULT_RETRY_OPTIONS.jitter,
    retryOn = DEFAULT_RETRY_OPTIONS.retryOn
  } = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  
  let lastError: Error | null = null;
  
  // Try the request with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const upstreamSignal = fetchOptions.signal;
      const abortFromUpstream = () => {
        controller.abort(upstreamSignal?.reason);
      };

      if (upstreamSignal?.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
      }
      
      // Make the fetch request
      const response = await fetch(input, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
      
      // Calculate duration
      const durationMs = Date.now() - startTime;
      
      // Parse JSON response if applicable
      let data: T | null = null;
      const statusCode = response.status;
      
      if (response.headers.get('content-type')?.includes('application/json')) {
        try {
          const jsonData = await response.json();
          data = jsonData as T;
        } catch (parseError) {
          // If JSON parsing fails, return null data but still success
          console.warn(`[safeFetch:${traceId}] JSON parsing failed`, parseError);
        }
      }
      
      // Log successful request
      const { reportAppEvent } = await import('@/lib/logger');
      reportAppEvent('safe_fetch_success', {
        traceId,
        method: fetchOptions.method ?? 'GET',
        url: input instanceof URL ? input.toString() : String(input),
        statusCode,
        durationMs,
        attempt,
        fromCache: false,
      });
      
      // Return successful result
      return {
        data,
        error: null,
        statusCode,
        traceId,
        durationMs,
        fromCache: false,
      };
    } catch (error) {
      // Clear any pending timeouts
      if (timeoutId) clearTimeout(timeoutId);
      
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt < maxRetries && retryOn(lastError)) {
        // Calculate delay before retry
        const delay = calculateDelay(
          attempt,
          baseDelayMs,
          maxDelayMs,
          jitter
        );
        
        // Wait for delay before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we shouldn't retry or we've exhausted retries, break
      break;
    }
  }
  
  // If we got here, all retries failed
  const durationMs = Date.now() - startTime;
  
  // Log failed request
  const { reportAppError } = await import('@/lib/logger');
  reportAppError('safe_fetch_failed', lastError, {
    traceId,
    method: (options as SafeFetchOptions).method ?? 'GET',
    url: input instanceof URL ? input.toString() : String(input),
    durationMs,
    attempts: maxRetries + 1,
  });
  
  return {
    data: null,
    error: lastError ?? new Error('Unknown fetch error'),
    statusCode: null,
    traceId,
    durationMs,
    fromCache: false,
  };
}

// Provider-specific fetch with additional context
export async function providerFetch<T = unknown>(
  provider: string,
  input: RequestInfo | URL,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  // Add provider context to trace ID
  const providerTraceId = `${provider}-${options.traceId ?? generateTraceId()}`;
  
  return safeFetch<T>(input, {
    ...options,
    traceId: providerTraceId,
  });
}

// Batch fetch for multiple related requests
export async function batchFetch<T = unknown>(
  requests: Array<{ input: RequestInfo | URL; options?: SafeFetchOptions }>
): Promise<SafeFetchResult<T>[]> {
  const traceId = generateTraceId();
  
  // Execute all requests in parallel
  const results = await Promise.allSettled(
    requests.map(({ input, options = {} }) => 
      safeFetch<T>(input, {
        ...options,
        traceId: `${traceId}-${Math.random().toString(36).substring(2, 5)}`,
      })
    )
  );
  
  // Convert settled results to SafeFetchResult format
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    // Return error result for rejected promises (مطابق تماماً لـ SafeFetchResult<T>)
    const reason = result.reason;
    const error =
      reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : 'Request failed');

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
