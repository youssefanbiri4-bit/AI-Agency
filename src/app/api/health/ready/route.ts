/**
 * Readiness Probe — GET /api/health/ready
 *
 * W19-T2 Horizontal Scaling Readiness.
 *
 * Aggregates dependency health (Postgres + Redis) via readinessProbe() and
 * returns ready=false (503) when any critical dependency is down, so the load
 * balancer stops routing to this instance. Wire to your orchestrator's
 * readiness check. Mirrors SCALING.md §2.
 */

import { NextResponse } from 'next/server';
import { readinessProbe } from '@/lib/scaling/instance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const probe = await readinessProbe();
  return NextResponse.json(probe, {
    status: probe.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
