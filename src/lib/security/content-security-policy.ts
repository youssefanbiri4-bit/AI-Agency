/**
 * Single source of truth for Content-Security-Policy across
 * next.config.ts headers and edge middleware.
 *
 * Next.js + React rely on inline style attributes (style-src-attr) and
 * framework script bootstrapping (unsafe-inline). Nonce + strict-dynamic
 * without full nonce coverage caused console violations and ignored directives.
 *
 * Strategy:
 *   - script-src: uses nonce-{nonce} when provided (for middleware-generated
 *     CSP), falls back to 'unsafe-inline' 'unsafe-eval' for static headers
 *     in next.config.ts.
 *   - style-src / style-src-attr: 'unsafe-inline' — required by Next.js for
 *     style={{}} attributes and CSS-in-JS.
 *   - report-uri and report-to directives removed until endpoint is implemented.
 */

const CONNECT_SRC = [
  "'self'",
  'https:',
  'wss:',
  'https://*.supabase.co',
  'https://*.ingest.sentry.io',
].join(' ');

/**
 * The Reporting-Endpoints HTTP header value, defining the CSP violation
 * reporting endpoint. The browser resolves relative URLs against the
 * document origin.
 *
 * Usage in next.config.ts:
 *   { key: "Reporting-Endpoints", value: REPORTING_ENDPOINTS_HEADER }
 *
 * Usage in middleware:
 *   response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS_HEADER);
 */
export const REPORTING_ENDPOINTS_HEADER = 'csp-endpoint="/api/csp-violation"';

export function buildContentSecurityPolicy(nonce?: string): string {
  const scriptSrc = nonce
    ? `'strict-dynamic' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
    : "'self' 'unsafe-inline' 'unsafe-eval'";

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
    `connect-src ${CONNECT_SRC}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:"
  ];

  return directives.join('; ');
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();