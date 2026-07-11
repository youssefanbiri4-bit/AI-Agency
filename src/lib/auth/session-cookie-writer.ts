import type { CookieOptions } from '@supabase/ssr';
import {
  getSecureCookieDefaults,
  getSessionActivityCookieOptions,
  getSessionActivityCookieValue,
} from '@/lib/auth/session-cookies';
import {
  SESSION_ACTIVITY_COOKIE,
  SESSION_CLIENT_IP_COOKIE,
} from '@/lib/auth/session-shared';

type WritableCookieStore = {
  set: (name: string, value: string, options?: CookieOptions) => void;
  delete?: (name: string) => void;
};

export function writeSessionActivityCookie(
  cookieStore: WritableCookieStore,
  clientIp?: string,
  now = Date.now()
) {
  cookieStore.set(
    SESSION_ACTIVITY_COOKIE,
    getSessionActivityCookieValue(now),
    getSessionActivityCookieOptions()
  );

  if (clientIp) {
    cookieStore.set(SESSION_CLIENT_IP_COOKIE, clientIp, getSecureCookieDefaults(60 * 60 * 24 * 7));
  }
}

export function clearSessionTrackingCookies(cookieStore: WritableCookieStore) {
  const clear = (name: string) => {
    if (cookieStore.delete) {
      cookieStore.delete(name);
      return;
    }

    cookieStore.set(name, '', { ...getSecureCookieDefaults(0), maxAge: 0 });
  };

  clear(SESSION_ACTIVITY_COOKIE);
  clear(SESSION_CLIENT_IP_COOKIE);
}