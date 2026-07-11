import type { NextRequest, NextResponse } from 'next/server';
import {
  evaluateSessionActivity,
  evaluateSessionIpMismatch,
  SESSION_ACTIVITY_COOKIE,
  SESSION_CLIENT_IP_COOKIE,
} from '@/lib/auth/session-shared';
import {
  getSecureCookieDefaults,
  getSessionActivityCookieOptions,
  getSessionActivityCookieValue,
} from '@/lib/auth/session-cookies';
import { getClientIpFromHeaders } from '@/lib/rate-limit';

export function readSessionTrackingCookies(request: NextRequest) {
  return {
    lastActivity: request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value,
    sessionIp: request.cookies.get(SESSION_CLIENT_IP_COOKIE)?.value,
  };
}

export function evaluateEdgeSessionSecurity(
  request: NextRequest
): {
  idleExpired: boolean;
  ipMismatch: boolean;
  shouldTouch: boolean;
  clientIp: string;
} {
  const clientIp = getClientIpFromHeaders(request.headers);
  const { lastActivity, sessionIp } = readSessionTrackingCookies(request);
  const activity = evaluateSessionActivity(lastActivity);

  return {
    clientIp,
    idleExpired: activity.expired,
    ipMismatch: evaluateSessionIpMismatch(sessionIp, clientIp),
    shouldTouch: activity.shouldTouch,
  };
}

export function touchSessionTrackingCookies(
  response: NextResponse,
  clientIp: string,
  now = Date.now()
) {
  response.cookies.set(
    SESSION_ACTIVITY_COOKIE,
    getSessionActivityCookieValue(now),
    getSessionActivityCookieOptions()
  );

  response.cookies.set(
    SESSION_CLIENT_IP_COOKIE,
    clientIp,
    getSecureCookieDefaults(60 * 60 * 24 * 7)
  );
}

export function clearSessionTrackingCookiesOnResponse(response: NextResponse) {
  const expired = { ...getSecureCookieDefaults(0), maxAge: 0 };

  response.cookies.set(SESSION_ACTIVITY_COOKIE, '', expired);
  response.cookies.set(SESSION_CLIENT_IP_COOKIE, '', expired);
}