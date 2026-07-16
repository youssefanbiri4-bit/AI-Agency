/**
 * Metrics Scrape Endpoint — GET /api/metrics
 *
 * W20-T2: DevOps Engineer deliverable.
 *
 * Exposes the per-instance Prometheus-format metric stream (aggregated by
 * src/lib/monitoring/metrics.ts). For fleet-wide metrics, ship the JSON
 * `{type:"metric"}` logs to a log drain; this endpoint is a single-instance
 * scrape target.
 *
 * Protected by CRON_SECRET (same token used for cron routes) so it is not
 * publicly enumerable. Returns text/plain; Prometheus exposition format.
 */

import { NextResponse } from 'next/server';
import { collectAndResetMetrics } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/logger';

const metricsLog = logger.child('api:metrics');

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If no secret is configured, allow only from Vercel's internal network.
    return req.headers.get('x-vercel-protection-bypass') !== null;
  }
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('token') === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = collectAndResetMetrics();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    metricsLog.error('Metrics scrape failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse('Internal error', { status: 500 });
  }
}
