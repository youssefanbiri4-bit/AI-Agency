'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface UseRouteFocusOptions {
  /** Selector for the element to focus after route change */
  targetSelector?: string;
  /** Whether to announce the route change to screen readers */
  announce?: boolean;
  /** Delay before focusing (ms) */
  delay?: number;
}

export function useRouteFocus(options: UseRouteFocusOptions = {}) {
  const { targetSelector = 'h1, [data-route-focus], main', announce = true, delay = 100 } = options;
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;

    const timer = setTimeout(() => {
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.addEventListener('blur', () => {
          target.removeAttribute('tabindex');
        }, { once: true });
      }

      if (announce) {
        const pageTitle = document.title || pathname.split('/').pop() || 'page';
        const announcer = document.querySelector('[aria-live="polite"]');
        if (announcer) {
          announcer.textContent = `Navigated to ${pageTitle}`;
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [pathname, targetSelector, announce, delay]);
}

export function useFocusOnNavigation() {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== lastPathname.current) {
      lastPathname.current = pathname;

      requestAnimationFrame(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.focus();
        }
      });
    }
  }, [pathname]);
}
