import type { NextResponse } from 'next/server';
import { getRequestId, createApiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

/**
 * Standard API route wrapper.
 *
 * Unifies cross-cutting concerns for every `/api/*` handler:
 *  - consistent request-ID correlation
 *  - structured request logging (method, path, status, duration)
 *  - a single standardized 500 envelope on unexpected errors
 *
 * Compose with `withApiAuth` for authenticated routes, e.g.
 *   `export const GET = withApiHandler(withApiAuth(['scope'], handler));`
 *
 * `TParams` matches Next.js route-segment params (`Record<string, string>`
 * for the public v1 routes, or `Promise<{ id: string }>` for dynamic segments).
 */
export type ApiRouteHandler<TParams = Record<string, string>> = (
  request: Request,
  routeContext: { params: Promise<TParams> }
) => Promise<NextResponse> | NextResponse;

export function withApiHandler<TParams = Record<string, string>>(
  handler: ApiRouteHandler<TParams>
): ApiRouteHandler<TParams> {
  return async (request, routeContext) => {
    const requestId = getRequestId(request);
    const start = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;

    try {
      const response = await handler(request, routeContext);
      logger.info('api.request', {
        requestId,
        method,
        path,
        status: response.status,
        durationMs: Date.now() - start,
      });
      return response as NextResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      logger.error('api.request_error', {
        requestId,
        method,
        path,
        durationMs: Date.now() - start,
        error: message,
      });
      return createApiError('INTERNAL_ERROR', {
        status: 500,
        requestId,
        message: 'Internal server error',
      });
    }
  };
}
