import { z } from 'zod';
import { logger } from './logger';
import { createErrorResponse, AppError, ErrorLevel } from './error-handler';
import { checkRateLimit } from './rate-limit';

export interface ApiHandlerOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  schema?: z.ZodSchema;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  requireAuth?: boolean;
}

export function createApiHandler<T extends Record<string, any>>(
  handler: (req: Request, data?: T) => Promise<Response>,
  options?: ApiHandlerOptions
) {
  return async (req: Request): Promise<Response> => {
    const requestId = `req-${Math.random().toString(36).substring(2, 10)}`;
    const log = logger.child(requestId);

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
        const clientIp =
          req.headers.get('x-forwarded-for') ||
          req.headers.get('cf-connecting-ip') ||
          'unknown';

        const rateLimitResult = await checkRateLimit({
          key: `api:${new URL(req.url).pathname}:${clientIp}`,
          limit: options.rateLimit.maxRequests,
          windowMs: options.rateLimit.windowMs,
        });

        if (!rateLimitResult.allowed) {
          log.warn('Rate limit exceeded', { endpoint: new URL(req.url).pathname });
          return new Response(
            JSON.stringify({
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
            }),
            {
              status: 429,
              headers: {
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
                'Retry-After': Math.ceil(
                  (rateLimitResult.resetAt - Date.now()) / 1000
                ).toString(),
              },
            }
          );
        }
      }

      let validatedData: T | undefined;

      // Schema validation for POST/PUT/PATCH
      if (options?.schema && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const body = await req.json();
        const validation = options.schema.safeParse(body);

        if (!validation.success) {
          log.warn('Validation failed', {
            errors: validation.error.flatten(),
            endpoint: new URL(req.url).pathname,
          });
          throw new AppError(
            'Validation failed',
            400,
            ErrorLevel.LOW,
            { errors: validation.error.flatten() }
          );
        }

        validatedData = validation.data;
      }

      // Call the actual handler
      const response = await handler(req, validatedData);

      // Add security headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');

      log.info('API request successful', {
        method: req.method,
        endpoint: new URL(req.url).pathname,
        status: response.status,
      });

      return response;
    } catch (error: unknown) {
      return createErrorResponse(error, {
        endpoint: new URL(req.url).pathname,
        requestId,
      });
    }
  };
}

export function withApiHandler<T extends Record<string, any>>(
  handler: (req: Request, data?: T) => Promise<Response>,
  options?: ApiHandlerOptions
) {
  return createApiHandler(handler, options);
}
