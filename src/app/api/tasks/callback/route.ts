// ────────────────────────────────────────────────────────────────────────────
// DEPRECATED — /api/tasks/callback
//
// This route is preserved for backward compatibility only.
// Existing n8n workflows configured to call /api/tasks/callback will continue
// to work, but all new integrations MUST use POST /api/n8n/callback instead.
//
// Deprecation plan:
//  - Log a structured warning on every invocation.
//  - Forward the request to the canonical /api/n8n/callback handler.
//  - Respond with deprecation headers.
//  - This file will be removed in a future wave after all callers migrate.
// ────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { POST as canonicalPost } from '@/app/api/n8n/callback/route';

export async function POST(request: NextRequest) {
  logger.warn(
    '[DEPRECATED] /api/tasks/callback is deprecated. ' +
      'Use POST /api/n8n/callback with header x-n8n-callback-secret instead.',
    {
      deprecation: true,
      sourceRoute: '/api/tasks/callback',
      canonicalRoute: '/api/n8n/callback',
      deprecationDate: '2026-07-11',
    }
  );

  // Map legacy header (x-callback-secret) to canonical header (x-n8n-callback-secret)
  // so that callers using the old header continue to work without changes.
  const newHeaders = new Headers(request.headers);
  const legacySecret = newHeaders.get('x-callback-secret');
  if (legacySecret && !newHeaders.has('x-n8n-callback-secret')) {
    newHeaders.set('x-n8n-callback-secret', legacySecret);
  }

  // Forward body and headers to the canonical handler.
  const forwardedRequest = new NextRequest(request.url, {
    method: request.method,
    headers: newHeaders,
    body: await request.text(),
  });

  const response = await canonicalPost(forwardedRequest);

  // Attach deprecation headers to the response.
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Deprecated', 'true');
  responseHeaders.set(
    'X-Deprecation-Notice',
    'Use POST /api/n8n/callback with header x-n8n-callback-secret'
  );

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
