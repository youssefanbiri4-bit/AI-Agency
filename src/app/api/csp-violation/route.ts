/**
 * CSP Violation Reporting Endpoint
 *
 * Browsers POST CSP violation reports here when `report-uri` or
 * `report-to` is configured in the Content-Security-Policy header.
 *
 * This endpoint:
 * - Accepts application/csp-report and application/reports+json
 * - Logs violations to Sentry (best-effort)
 * - Rate-limited to 60 requests per minute per IP
 * - Returns 204 No Content (no response body needed)
 */

import { NextResponse } from 'next/server';
import { checkRateLimit, buildRateLimitExceededHeaders, getClientIpFromHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const cspLog = logger.child('csp-violation');

export async function POST(request: Request) {
  const clientIp = getClientIpFromHeaders(request.headers);

  // Rate limit: 60 violations per minute per IP
  const rateLimitResult = await checkRateLimit({
    key: `csp-violation:ip:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateLimitResult.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        ...buildRateLimitExceededHeaders(rateLimitResult),
        'Cache-Control': 'no-store',
      },
    });
  }

  // Accept CSP reports as application/csp-report or application/reports+json
  const contentType = request.headers.get('content-type') || '';
  const isCspReport =
    contentType.includes('application/csp-report') ||
    contentType.includes('application/reports+json');

  if (!isCspReport) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await request.json();

    // Extract the actual CSP report (may be nested under csp-report key)
    const report = body?.['csp-report'] ?? body;

    cspLog.warn('CSP violation detected', {
      'blocked-uri': report?.['blocked-uri'] || 'unknown',
      'document-uri': report?.['document-uri'] || 'unknown',
      'violated-directive': report?.['violated-directive'] || 'unknown',
      'effective-directive': report?.['effective-directive'] || 'unknown',
      'original-policy': report?.['original-policy'] || 'unknown',
      'script-sample': report?.['script-sample'] || null,
      'source-file': report?.['source-file'] || null,
      'line-number': report?.['line-number'] || null,
      'column-number': report?.['column-number'] || null,
      'disposition': report?.['disposition'] || 'enforce',
      clientIp,
    });
  } catch (error) {
    // CSP reports are best-effort; log but never block
    cspLog.warn('Failed to parse CSP violation report', {
      error: error instanceof Error ? error.message : String(error),
      clientIp,
    });
  }

  return new NextResponse(null, { status: 204 });
}

/**
 * Also accept GET for health-check purposes.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'csp-violation' });
}
