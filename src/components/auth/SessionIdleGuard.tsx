'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  logoutSessionAction,
  refreshSessionAction,
  touchSessionActivityAction,
} from '@/actions/auth/session';
import { SESSION_IDLE_TIMEOUT_MS } from '@/lib/auth/session-shared';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const REFRESH_BEFORE_IDLE_MS = 10 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function SessionIdleGuard() {
  const router = useRouter();
  const lastTouchAtRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    if (lastRefreshAtRef.current === 0) {
      lastRefreshAtRef.current = Date.now();
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const scheduleIdleLogout = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        void (async () => {
          await logoutSessionAction('local');
          if (!disposed) {
            router.replace('/auth/login?message=Your session expired due to inactivity.');
            router.refresh();
          }
        })();
      }, SESSION_IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      const now = Date.now();

      if (now - lastTouchAtRef.current >= TOUCH_INTERVAL_MS) {
        lastTouchAtRef.current = now;
        void touchSessionActivityAction();
      }

      if (now - lastRefreshAtRef.current >= SESSION_IDLE_TIMEOUT_MS - REFRESH_BEFORE_IDLE_MS) {
        lastRefreshAtRef.current = now;
        void refreshSessionAction().then((result) => {
          if (!result.success && !disposed) {
            void logoutSessionAction('local').then(() => {
              router.replace('/auth/login?message=Your session could not be refreshed.');
              router.refresh();
            });
          }
        });
      }

      scheduleIdleLogout();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    scheduleIdleLogout();
    void touchSessionActivityAction();

    return () => {
      disposed = true;
      clearIdleTimer();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [router]);

  return null;
}