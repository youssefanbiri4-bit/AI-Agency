/**
 * Shared cron authorization (W20-T2)
 *
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header using a
 * constant-time compare. Reused by /api/cron/* routes so the auth logic
 * lives in one place.
 */

import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

export interface CronAuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

function safeCompare(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (valueBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(valueBuffer, expectedBuffer);
}

export function isCronAuthorized(request: NextRequest): CronAuthResult {
  const expectedSecret = process.env.CRON_SECRET?.trim() ?? '';

  if (!expectedSecret) {
    return { ok: false, status: 401, error: 'CRON_SECRET is not configured on the server.' };
  }

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const prefix = 'Bearer ';

  if (!authorization.startsWith(prefix)) {
    return { ok: false, status: 401, error: 'Missing or invalid Authorization header.' };
  }

  const providedSecret = authorization.slice(prefix.length).trim();
  if (!providedSecret || !safeCompare(providedSecret, expectedSecret)) {
    return { ok: false, status: 401, error: 'Invalid cron secret.' };
  }

  return { ok: true, status: 200 };
}
