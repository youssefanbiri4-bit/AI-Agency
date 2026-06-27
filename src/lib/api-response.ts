/**
 * Standardized API response helpers.
 *
 * Provides consistent response format across all endpoints:
 *   { success, data?, error?, message?, requestId, timestamp, meta? }
 *
 * Backward-compatible: never removes existing response fields.
 * All helpers return a Response object with X-Request-ID header.
 */

import { NextResponse } from 'next/server';

let requestCounter = 0;

/**
 * Generate a unique, stable request ID from a request or seed.
 * Propagates an existing X-Request-ID header when present.
 */
export function getRequestId(req?: Request | { headers: { get(name: string): string | null } }): string {
  const existing = req?.headers?.get('X-Request-ID');
  if (existing) return existing;
  requestCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `req-${ts}-${rand}-${requestCounter}`;
}

/** ISO-8601 timestamp string for the current moment. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Shared response headers every endpoint should include. */
export function commonHeaders(requestId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'X-Content-Type-Options': 'nosniff',
  };
}

export interface ApiSuccessPayload<T = unknown> {
  success: true;
  data: T;
  error: null;
  message: string;
  requestId: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  // Allow additional fields for backward compatibility
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  success: false;
  data: null;
  error: string;
  message: string;
  requestId: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  // Allow additional fields for backward compatibility
  [key: string]: unknown;
}

export type ApiResponsePayload<T = unknown> = ApiSuccessPayload<T> | ApiErrorPayload;

/**
 * Create a success JSON response.
 * @param data - The response payload (or `null` for no data)
 * @param options - Request ID, message, extra fields, status, additional headers
 */
export function createApiSuccess<T = unknown>(
  data: T,
  options?: {
    requestId?: string;
    message?: string;
    status?: number;
    meta?: Record<string, unknown>;
    extra?: Record<string, unknown>; // backward-compat fields like `ok`
    headers?: Record<string, string>;
  }
): NextResponse {
  const requestId = options?.requestId ?? `req-${crypto.randomUUID().slice(0, 8)}`;
  const timestamp = nowISO();

  const payload: ApiSuccessPayload<T> = {
    success: true,
    data,
    error: null,
    message: options?.message ?? '',
    requestId,
    timestamp,
    ...(options?.meta ? { meta: options.meta } : {}),
    // Backward compatibility: include extra fields (e.g. `ok: true`)
    ...(options?.extra ?? {}),
  };

  return NextResponse.json(payload, {
    status: options?.status ?? 200,
    headers: {
      ...commonHeaders(requestId),
      ...(options?.headers ?? {}),
    },
  });
}

/**
 * Create a JSON error response.
 * @param error - Error message string
 * @param options - Status code, request ID, message, meta, extra fields, additional headers
 */
export function createApiError(
  error: string,
  options?: {
    status?: number;
    requestId?: string;
    message?: string;
    meta?: Record<string, unknown>;
    extra?: Record<string, unknown>; // backward-compat fields like `ok`
    headers?: Record<string, string>;
  }
): NextResponse {
  const requestId = options?.requestId ?? `req-${crypto.randomUUID().slice(0, 8)}`;
  const timestamp = nowISO();

  const payload: ApiErrorPayload = {
    success: false,
    data: null,
    error,
    message: options?.message ?? error,
    requestId,
    timestamp,
    ...(options?.meta ? { meta: options.meta } : {}),
    // Backward compatibility: include extra fields (e.g. `ok: false`)
    ...(options?.extra ?? {}),
  };

  return NextResponse.json(payload, {
    status: options?.status ?? 500,
    headers: {
      ...commonHeaders(requestId),
      ...(options?.headers ?? {}),
    },
  });
}

/**
 * Convenience wrapper: createApiSuccess with `ok: true` for operational endpoints
 * that already use `{ ok, data }` on the frontend.
 */
export function createOperationalSuccess<T = unknown>(
  data: T,
  options?: {
    requestId?: string;
    message?: string;
    status?: number;
    meta?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): NextResponse {
  return createApiSuccess(data, {
    ...options,
    extra: { ok: true },
  });
}

/**
 * Convenience wrapper: createApiError with `ok: false` for operational endpoints.
 */
export function createOperationalError(
  error: string,
  options?: {
    status?: number;
    requestId?: string;
    message?: string;
    meta?: Record<string, unknown>;
    headers?: Record<string, string>;
  }
): NextResponse {
  return createApiError(error, {
    ...options,
    status: options?.status ?? 500,
    extra: { ok: false },
  });
}
