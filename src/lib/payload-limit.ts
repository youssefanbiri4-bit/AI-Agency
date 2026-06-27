/**
 * Centralized payload size protection.
 * Call at the top of POST/PUT/PATCH route handlers to reject oversized bodies.
 */

import { createApiError } from './api-response';

/**
 * Default maximum payload size: 100 KB.
 * Adjust via PAYLOAD_MAX_BYTES env variable.
 */
export const DEFAULT_PAYLOAD_MAX_BYTES = 100 * 1024; // 100 KB

/**
 * Maximum allowed payload sizes by endpoint category (in bytes).
 * Individual routes can override these.
 */
export const PAYLOAD_LIMITS = {
  /** n8n callbacks: result payloads can be moderately large */
  callback: 512 * 1024, // 512 KB
  /** Task execution requests */
  taskExecute: 256 * 1024, // 256 KB
  /** Alex chat messages */
  alexChat: 128 * 1024, // 128 KB
  /** Generic POST endpoints */
  default: DEFAULT_PAYLOAD_MAX_BYTES,
} as const;

/**
 * Read the configured payload limit from environment, or fall back to the default.
 * Add PAYLOAD_MAX_BYTES to .env to override globally.
 */
function getConfiguredMaxBytes(): number {
  const env = process.env.PAYLOAD_MAX_BYTES?.trim();
  if (env) {
    const n = Number.parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_PAYLOAD_MAX_BYTES;
}

/**
 * Extract Content-Length from a request, returning null if absent or unparseable.
 */
function getContentLength(req: Request): number | null {
  const raw = req.headers.get('content-length');
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Check payload size against the configured limit.
 *
 * - If Content-Length exceeds the limit, returns a 413 response immediately.
 * - If Content-Length is absent, attempts to read the body and measure; caches it
 *   back on the request so the route handler can still read it.
 * - Returns `{ ok: true, request }` if the payload is within bounds.
 *
 * Usage at the top of a POST handler:
 *   const check = await checkPayloadSize(request, PAYLOAD_LIMITS.callback);
 *   if (!check.ok) return check.response;
 *   request = check.request; // use the cloned request
 */
export async function checkPayloadSize(
  req: Request,
  maxBytes: number = getConfiguredMaxBytes()
): Promise<
  | { ok: false; response: Response }
  | { ok: true; request: Request }
> {
  const contentLength = getContentLength(req);

  if (contentLength !== null && contentLength > maxBytes) {
    return {
      ok: false,
      response: createApiError(`Payload too large. Maximum size is ${maxBytes} bytes.`, {
        status: 413,
        extra: { maxBytes },
      }),
    };
  }

  if (contentLength !== null) {
    // Content-Length is within bounds; no need to read the body.
    return { ok: true, request: req };
  }

  // No Content-Length header: clone the request and read the body to measure it.
  try {
    const cloned = req.clone();
    const text = await cloned.text();
    const bodyByteSize = new TextEncoder().encode(text).byteLength;

    if (bodyByteSize > maxBytes) {
      return {
        ok: false,
        response: createApiError(`Payload too large. Maximum size is ${maxBytes} bytes.`, {
          status: 413,
          extra: { maxBytes },
        }),
      };
    }

    // Reconstruct a new Request with the consumed body so the handler can read it.
    // The original body is already consumed, so we rebuild.
    const reconstructed = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: text,
    });

    return { ok: true, request: reconstructed };
  } catch {
    // If we can't measure, allow through (the route handler will fail on parse).
    return { ok: true, request: req };
  }
}
