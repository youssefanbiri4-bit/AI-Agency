/**
 * Centralized Security Headers Utility
 *
 * Single source of truth for all security-related HTTP headers.
 * Used by:
 *   - next.config.ts (static headers)
 *   - src/proxy.ts (edge middleware)
 *   - src/lib/auth/dashboard-edge-auth.ts (dashboard edge auth)
 *   - API route handlers
 *
 * This ensures consistent header application across all response paths.
 */

import type { NextResponse } from 'next/server';

// ─── Content Security Policy ────────────────────────────────────────────────

/**
 * Build a strict Content-Security-Policy header value.
 * When a nonce is provided, uses nonce-based script/style directives.
 * Without a nonce, falls back to 'unsafe-inline' (required by Next.js for
 * static next.config.ts headers).
 */
export function buildContentSecurityPolicy(nonce?: string): string {
  const scriptSrc = nonce
    ? `'strict-dynamic' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    'https://*.supabase.co',
    'https://*.ingest.sentry.io',
    'https://api.openai.com',
    'https://graph.facebook.com',
    'https://graph.instagram.com',
    'https://oauth2.googleapis.com',
    'https://googleads.googleapis.com',
    'https://api.pinterest.com',
    'https://api.github.com',
  ].join(' ');

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    "report-uri /api/csp-violation",
  ];

  return directives.join('; ');
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

// ─── CSP Reporting Endpoint ─────────────────────────────────────────────────

/**
 * The Reporting-Endpoints header value.
 * Used to send CSP violation reports to the dedicated endpoint.
 *
 * Usage:
 *   response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS_HEADER);
 */
export const REPORTING_ENDPOINTS_HEADER = 'csp-endpoint="/api/csp-violation"';

// ─── Security Headers Map ────────────────────────────────────────────────────

/**
 * Returns all standard security headers as a key-value map.
 * These should be applied to ALL responses.
 */
export function getSecurityHeaders(csp?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'X-Frame-Options': 'DENY',
    'X-DNS-Prefetch-Control': 'on',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Reporting-Endpoints': REPORTING_ENDPOINTS_HEADER,
    'X-Powered-By': '',
  };

  if (csp) {
    headers['Content-Security-Policy'] = csp;
  }

  return headers;
}

// ─── Apply Headers to Response ──────────────────────────────────────────────

/**
 * Apply all security headers to a NextResponse.
 * Optionally includes a Content-Security-Policy.
 */
export function applySecurityHeaders(
  response: NextResponse,
  csp?: string
): NextResponse {
  const headers = getSecurityHeaders(csp);
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      response.headers.set(key, value);
    }
  }
  return response;
}

// ─── Cache Control Helpers ──────────────────────────────────────────────────

export const CACHE_CONTROL = {
  /** Immutable static assets (1 year) */
  immutable: 'public, max-age=31536000, immutable',
  /** Static images with stale-while-revalidate */
  staticImage: 'public, max-age=86400, stale-while-revalidate=604800',
  /** API health endpoint */
  health: 'public, max-age=30, stale-while-revalidate=60',
  /** Private API data with short cache */
  apiPrivate: 'private, max-age=60, stale-while-revalidate=120',
  /** Dashboard HTML — no cache */
  dashboard: 'private, max-age=0, must-revalidate',
  /** No store at all (CSP reports, auth) */
  noStore: 'no-store',
} as const;

// ─── Nonce Generation ──────────────────────────────────────────────────────

/**
 * Generate a cryptographically random nonce for CSP.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
