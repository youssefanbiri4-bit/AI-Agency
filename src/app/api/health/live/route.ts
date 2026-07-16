/**
 * Liveness Probe — GET /api/health/live
 *
 * W19-T2 Horizontal Scaling Readiness.
 *
 * Cheap, no I/O. Returns 200 as long as the process is alive and not
 * deadlocked. Wire this to your orchestrator's liveness check (K8s
 * livenessProbe, Fly healthchecks, etc.). Mirrors SCALING.md §2.
 */

import { NextResponse } from 'next/server';
import { livenessProbe } from '@/lib/scaling/instance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const probe = livenessProbe();
  return NextResponse.json(probe, {
    status: probe.alive ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
