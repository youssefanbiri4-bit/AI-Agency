import { NextRequest, NextResponse } from 'next/server';
import { snapshotSystemHealth } from '@/lib/health/system-health-check';
import { reportAppError } from '@/lib/logger';
import { getRequestId, nowISO } from '@/lib/api-response';
import { isCronAuthorized } from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleSnapshotRequest(request: NextRequest) {
  const requestId = getRequestId(request);
  const authorization = isCronAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json(
      {
        success: false,
        error: authorization.error,
        requestId,
        timestamp: nowISO(),
      },
      {
        status: authorization.status,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }

  try {
    const result = await snapshotSystemHealth();

    return NextResponse.json(
      {
        success: true,
        requestId,
        timestamp: nowISO(),
        data: {
          status: result.status,
          score: result.score,
          responseMs: result.responseMs,
          services: result.detailed.services,
        },
      },
      {
        headers: { 'X-Request-ID': requestId },
      }
    );
  } catch (error) {
    reportAppError('Health snapshot cron route failed', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to capture health snapshot.',
        requestId,
        timestamp: nowISO(),
      },
      {
        status: 500,
        headers: { 'X-Request-ID': requestId },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSnapshotRequest(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshotRequest(request);
}
