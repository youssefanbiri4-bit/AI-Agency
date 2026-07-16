'use client';

import { useEffect, useCallback } from 'react';
import { LiveRegionProvider } from '@/components/a11y/LiveRegion';
import { useRouteFocus } from '@/hooks/useRouteFocus';
import { useNavigationShortcuts } from '@/hooks/useNavigationShortcuts';

interface A11yProviderProps {
  children: React.ReactNode;
  onOpenSearch?: () => void;
}

export function A11yProvider({ children, onOpenSearch }: A11yProviderProps) {
  useRouteFocus({ announce: true });
  useNavigationShortcuts({ onOpenSearch });

  return (
    <LiveRegionProvider>
      {children}
    </LiveRegionProvider>
  );
}

export function SkipNavigation() {
  return (
    <a
      href="#main-content"
      className="skip-link"
      aria-label="Skip to main content"
    >
      Skip to main content
    </a>
  );
}

export function ReducedMotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.reducedMotion = String(e.matches);
    };

    document.documentElement.dataset.reducedMotion = String(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return <div>{children}</div>;
}

export function HighContrastToggle() {
  useEffect(() => {
    const saved = localStorage.getItem('af-high-contrast');
    if (saved === 'true') {
      document.documentElement.classList.add('high-contrast');
    }
  }, []);

  const toggle = useCallback(() => {
    const isHighContrast = document.documentElement.classList.contains('high-contrast');
    if (isHighContrast) {
      document.documentElement.classList.remove('high-contrast');
      localStorage.setItem('af-high-contrast', 'false');
    } else {
      document.documentElement.classList.add('high-contrast');
      localStorage.setItem('af-high-contrast', 'true');
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle high contrast mode"
      className="hidden"
    />
  );
}
