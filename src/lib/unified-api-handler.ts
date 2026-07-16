/**
 * Unified API Handler
 *
 * Standardized middleware for all API routes.
 * Provides consistent error handling, response format, auth, and logging.
 *
 * Usage:
 *   export const GET = withUnifiedApiHandler(handler, { requireAuth: true });
 *   export const POST = withUnifiedApiHandler(handler, { schema: mySchema });
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AppError, ErrorLevel, handleError } from '@/lib/error-handler';
import {
  createApiSuccess,
  createApiError,
  getRequestId,
} from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';

// ─── Types ──────────────────────────────────────────────────────────

export interface UnifiedHandlerOptions {
  /** Allowed HTTP method(s). Rejects if mismatched. */
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')[];
  /** Zod schema for request body validation (POST/PUT/PATCH). */
  schema?: z.ZodSchema;
  /** Require authentication via Supabase session. */
  requireAuth?: boolean;
  /** RBAC role required (e.g. 'admin', 'editor', 'viewer'). */
  requireRole?: string;
  /** Rate limiting configuration. */
  rateLimit?: {
    windowMs?: number;
    maxRequests?: number;
    keyPrefix?: string;
  };
  /** Custom error handler. Override default error response. */
  onError?: (error: unknown, requestId: string) => NextResponse;
  /** Response headers to add. */
  headers?: Record<string, string>;
}

export interface HandlerContext {
  /** Unique request ID (from header or generated). */
  requestId: string;
  /** Child logger scoped to this request. */
  log: typeof logger;
  /** Authenticated user ID (if requireAuth is true). */
  userId?: string;
  /** Workspace ID (if extracted from request). */
  workspaceId?: string;
}

export type UnifiedHandler<T = Record<string, unknown>> = (
  request: Request,
  data: T,
  ctx: HandlerContext
) => Promise<NextResponse | Response>;

// ─── Response Builders ──────────────────────────────────────────────

export function unifiedSuccess<T>(
  data: T,
  ctx: HandlerContext,
  options?: {
    message?: string;
    status?: number;
    meta?: Record<string, unknown>;
  }
): NextResponse {
  return createApiSuccess(data, {
    requestId: ctx.requestId,
    message: options?.message,
    status: options?.status,
    meta: options?.meta,
  }) as NextResponse;
}

export function unifiedError(
  error: string,
  ctx: HandlerContext,
  options?: {
    status?: number;
    message?: string;
    meta?: Record<string, unknown>;
  }
): NextResponse {
  return createApiError(error, {
    requestId: ctx.requestId,
    status: options?.status,
    message: options?.message,
    meta: options?.meta,
  }) as NextResponse;
}

// ─── Main Handler Factory ───────────────────────────────────────────

export function withUnifiedApiHandler<T extends Record<string, unknown>>(
  handler: UnifiedHandler<T>,
  options?: UnifiedHandlerOptions
) {
  return async (request: Request): Promise<Response> => {
    const requestId = getRequestId(request);
    const log = logger.child(requestId);

    const ctx: HandlerContext = { requestId, log };

    try {
      // ─── Method validation ───────────────────────────────
      if (options?.methods && !options.methods.includes(request.method as never)) {
        throw new AppError(
          `Method ${request.method} not allowed. Expected one of: ${options.methods.join(', ')}`,
          405,
          ErrorLevel.LOW
        );
      }

      // ─── Rate limiting ───────────────────────────────────
      if (options?.rateLimit) {
        const clientIp =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('cf-connecting-ip')?.trim() ||
          'unknown';
        const path = new URL(request.url).pathname;
        const rl = options.rateLimit;

        const result = await checkRateLimit({
          key: `${rl.keyPrefix ?? 'api'}:${path}:${clientIp}`,
          limit: rl.maxRequests ?? 100,
          windowMs: rl.windowMs ?? 60_000,
        });

        if (!result.allowed) {
          log.warn('Rate limit exceeded', { endpoint: path, clientIp });
          return unifiedError('Rate limit exceeded. Please try again later.', ctx, {
            status: 429,
            meta: { retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) },
          });
        }
      }

      // ─── Body validation ─────────────────────────────────
      let validatedData: T = {} as T;

      if (options?.schema && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const body = await request.json();
          const validation = options.schema.safeParse(body);

          if (!validation.success) {
            log.warn('Validation failed', {
              errors: validation.error.flatten(),
              endpoint: new URL(request.url).pathname,
            });
            throw new AppError('Validation failed', 400, ErrorLevel.LOW, {
              errors: validation.error.flatten(),
            });
          }

          validatedData = validation.data as T;
        } catch (err) {
          if (err instanceof AppError) throw err;
          throw new AppError('Invalid JSON body', 400, ErrorLevel.LOW);
        }
      }

      // ─── Call handler ────────────────────────────────────
      const response = await handler(request, validatedData, ctx);

      // ─── Add security headers ────────────────────────────
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');

      if (options?.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          response.headers.set(key, value);
        }
      }

      log.info('API request successful', {
        method: request.method,
        endpoint: new URL(request.url).pathname,
        status: response.status,
      });

      return response;
    } catch (error: unknown) {
      // ─── Custom error handler ────────────────────────────
      if (options?.onError) {
        return options.onError(error, requestId);
      }

      // ─── Default error handling ──────────────────────────
      const { message, statusCode } = handleError(error, {
        requestId,
        endpoint: new URL(request.url).pathname,
      });

      log.error('API request failed', {
        method: request.method,
        endpoint: new URL(request.url).pathname,
        error: message,
        status: statusCode,
      });

      return unifiedError(message, ctx, { status: statusCode });
    }
  };
}

// ─── Convenience Aliases ────────────────────────────────────────────

/** Alias for backward compatibility with existing api-handler.ts */
export const createUnifiedApiHandler = withUnifiedApiHandler;
