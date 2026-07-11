import type { CookieOptions } from '@supabase/ssr';
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/auth/session-shared';

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getSecureCookieDefaults(maxAge?: number): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: 'strict',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export function getSessionActivityCookieValue(now = Date.now()): string {
  return String(now);
}

export function getSessionActivityCookieOptions(maxAgeSeconds?: number): CookieOptions {
  const maxAge = maxAgeSeconds ?? Math.ceil(SESSION_IDLE_TIMEOUT_MS / 1000) + 300;
  return getSecureCookieDefaults(maxAge);
}

export function mergeSecureCookieOptions(options?: CookieOptions): CookieOptions {
  const defaults = getSecureCookieDefaults(options?.maxAge);

  return {
    ...options,
    path: options?.path ?? defaults.path,
    httpOnly: true,
    secure: isProductionRuntime(),
    sameSite: 'strict',
    maxAge: options?.maxAge ?? defaults.maxAge,
  };
}