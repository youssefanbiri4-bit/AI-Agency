import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  CONTENT_STUDIO_SCHEDULER_BATCH_SIZE,
  runContentStudioScheduler,
} from '@/lib/content-studio/scheduler';
import { reportAppError } from '@/lib/logger';
import { setupBlockerMessage } from '@/lib/safe-messages';
import { getRequestId, nowISO } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim() ?? '';

  if (!expectedSecret) {
    return {
      ok: false,
      status: 401,
      error: 'CRON_SECRET is not configured on the server.',
    };
  }

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const prefix = 'Bearer ';

  if (!authorization.startsWith(prefix)) {
    return {
      ok: false,
      status: 401,
      error: 'Missing or invalid Authorization header.',
    };
  }

  const providedSecret = authorization.slice(prefix.length).trim();

  if (!providedSecret || !safeCompare(providedSecret, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid cron secret.',
    };
  }

  return { ok: true as const };
}

async function handleSchedulerRequest(request: NextRequest) {
  const requestId = getRequestId(request);
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json({
      success: false,
      error: authorization.error,
      requestId,
      timestamp: nowISO(),
    }, {
      status: authorization.status,
      headers: { 'X-Request-ID': requestId },
    });
  }

  try {
    const summary = await runContentStudioScheduler({
      batchSize: CONTENT_STUDIO_SCHEDULER_BATCH_SIZE,
    });

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: nowISO(),
      data: summary,
    }, {
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    reportAppError('Content Studio scheduler route failed', error);
    return jsonError(setupBlockerMessage({
      missing: 'completed cron scheduler run',
      reason: 'the server could not safely complete the scheduled operation',
      next: 'check Vercel function logs, CRON_SECRET configuration, and provider readiness',
    }), 500);
  }
}

export async function GET(request: NextRequest) {
  return handleSchedulerRequest(request);
}

export async function POST(request: NextRequest) {
  return handleSchedulerRequest(request);
}
