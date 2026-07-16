import { z } from 'zod';
import { logger } from './logger';
import { createErrorResponse, AppError, ErrorLevel } from './error-handler';
import { checkRateLimit, checkRateLimitComposite, type RateLimitInput } from './rate-limit';
import { tokenBucketThrottle } from './rate-limit/throttle';

export interface ApiHandlerOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  schema?: z.ZodSchema;
  /**
   * Rate limiting configuration.
   *  - `windowMs` + `maxRequests` + `keyPrefix`: simple per-key fixed-window limit.
   *  - `composite`: multiple buckets enforced at once (e.g. IP + workspace + key).
   *  - `throttle`: token-bucket throttle for bursty/expensive endpoints.
   *  - `concurrencyKey` + `concurrencyMax`: cap in-flight operations per key.
   */
  rateLimit?: {
    windowMs?: number;
    maxRequests?: number;
    keyPrefix?: string;
    composite?: RateLimitInput[];
    throttle?: { key: string; capacity: number; refillPerSecond: number; cost?: number };
    concurrencyKey?: string;
    concurrencyMax?: number;
  };
  requireAuth?: boolean;
}

export function createApiHandler<T extends Record<string, unknown>>(
  handler: (req: Request, data?: T) => Promise<Response>,
  options?: ApiHandlerOptions
) {
  return async (req: Request): Promise<Response> => {
    const requestId =
      req.headers.get('X-Request-ID') ??
      `req-${Math.random().toString(36).substring(2, 10)}`;

    // Keep using the shared logger instance; attach requestId explicitly per log entry.
    // This avoids breaking the logger's internal requestId scoping semantics.
    const scopedLog = logger;

    try {
      // Method validation
      if (options?.method && req.method !== options.method) {
        throw new AppError(
          `Method ${req.method} not allowed. Expected ${options.method}`,
          405,
          ErrorLevel.LOW
        );
      }

      // Rate limiting
      if (options?.rateLimit) {
        const rl = options.rateLimit;
        const clientIp =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('cf-connecting-ip')?.trim() ||
          'unknown';
        const path = new URL(req.url).pathname;

        // Composite (multi-dimensional) limits take precedence when provided.
        if (rl.composite && rl.composite.length > 0) {
          const composite = await checkRateLimitComposite(rl.composite);
          if (!composite.allowed) {
            scopedLog.warn('Composite rate limit exceeded', { endpoint: path, requestId });
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded', retryAfter: Math.ceil((composite.denied?.resetAt ?? Date.now()) / 1000) }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...composite.headers } }
            );
          }
        } else if (rl.maxRequests && rl.windowMs) {
          const rateLimitResult = await checkRateLimit({
            key: `${rl.keyPrefix ?? 'api'}:${path}:${clientIp}`,
            limit: rl.maxRequests,
            windowMs: rl.windowMs,
          });
          if (!rateLimitResult.allowed) {
            scopedLog.warn('Rate limit exceeded', { endpoint: path, requestId });
            return new Response(
              JSON.stringify({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
              }),
              {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'X-RateLimit-Remaining': '0',
                  'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
                  'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
                },
              }
            );
          }
        }

        // Token-bucket throttle for expensive/bursty endpoints.
        if (rl.throttle) {
          const t = await tokenBucketThrottle(rl.throttle);
          if (!t.allowed) {
            scopedLog.warn('Throttle limit exceeded', { endpoint: path, requestId });
            return new Response(
              JSON.stringify({ error: 'Too many requests, please slow down', retryAfter: Math.ceil(t.retryAfterMs / 1000) }),
              {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'Retry-After': String(Math.ceil(t.retryAfterMs / 1000)),
                  'X-RateLimit-Remaining': '0',
                },
              }
            );
          }
        }

        // Concurrency cap per key (e.g. per workspace) to protect shared workers.
        if (rl.concurrencyKey && rl.concurrencyMax) {
          const { acquireConcurrency } = await import('./rate-limit/throttle');
          const release = await acquireConcurrency(rl.concurrencyKey, rl.concurrencyMax);
          if (!release) {
            scopedLog.warn('Concurrency limit reached', { endpoint: path, requestId });
            return new Response(
              JSON.stringify({ error: 'Service busy, try again shortly' }),
              {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
              }
            );
          }
          // Attach release to the request so the handler can free capacity when done.
          (req as Request & { _releaseConcurrency?: () => Promise<void> })._releaseConcurrency = release;
        }
      }

      let validatedData: T | undefined;

      // Schema validation for POST/PUT/PATCH
      if (options?.schema && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const body = await req.json();
        const validation = options.schema.safeParse(body);

        if (!validation.success) {
          scopedLog.warn('Validation failed', {
            errors: validation.error.flatten(),
            endpoint: new URL(req.url).pathname,
            requestId,
          });
          throw new AppError(
            'Validation failed',
            400,
            ErrorLevel.LOW,
            { errors: validation.error.flatten() }
          );
        }

        validatedData = validation.data as T;
      }

      // Call the actual handler
      const response = await handler(req, validatedData);

      // Release concurrency slot (best-effort) once the handler resolves.
      const release = (req as Request & { _releaseConcurrency?: () => Promise<void> })._releaseConcurrency;
      if (release) await release().catch(() => {});

      // Add security headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');

      scopedLog.info('API request successful', {
        method: req.method,
        endpoint: new URL(req.url).pathname,
        status: response.status,
        requestId,
      });

      return response;
    } catch (error: unknown) {
      // Release concurrency slot on error too.
      const release = (req as Request & { _releaseConcurrency?: () => Promise<void> })._releaseConcurrency;
      if (release) await release().catch(() => {});
      return createErrorResponse(error, {
        endpoint: new URL(req.url).pathname,
        requestId,
      });
    }
  };
}

export function withApiHandler<T extends Record<string, unknown>>(
  handler: (req: Request, data?: T) => Promise<Response>,
  options?: ApiHandlerOptions
) {
  return createApiHandler(handler, options);
}
