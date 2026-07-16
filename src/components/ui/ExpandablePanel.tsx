'use client';

import { useCallback, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandablePanelProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

function readStorage(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey || typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'open') return true;
    if (stored === 'closed') return false;
  } catch {
    /* ignore unavailable storage */
  }
  return fallback;
}

/**
 * Collapsible section used to demote secondary dashboard content (Projects,
 * Releases, Content Snapshot) below the fold. Open/closed state is persisted to
 * localStorage so the user's preference survives reloads.
 *
 * `useSyncExternalStore` is used so the server snapshot (defaultOpen) matches
 * during hydration, then the persisted client value takes over — avoiding both
 * hydration mismatches and effects that set state synchronously.
 */
export function ExpandablePanel({
  title,
  description,
  defaultOpen = false,
  storageKey,
  action,
  className,
  children,
}: ExpandablePanelProps) {
  const listenersRef = useRef<Set<() => void> | null>(null);
  if (listenersRef.current === null) {
    listenersRef.current = new Set();
  }
  const listeners = listenersRef.current;

  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    [listeners]
  );

  const getSnapshot = useCallback(
    () => readStorage(storageKey, defaultOpen),
    [storageKey, defaultOpen]
  );

  const open = useSyncExternalStore(subscribe, getSnapshot, () => defaultOpen);

  const toggle = useCallback(() => {
    const next = !readStorage(storageKey, defaultOpen);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, next ? 'open' : 'closed');
      } catch {
        /* ignore unavailable storage */
      }
    }
    listeners.forEach((listener) => listener());
  }, [listeners, storageKey, defaultOpen]);

  const headerId = useId();
  const bodyId = useId();

  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-[0_12px_32px_rgba(93,107,107,0.06)] ring-1 ring-foreground/5',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          id={headerId}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronDown
            className={cn(
              'h-5 w-5 shrink-0 text-foreground-muted transition-transform',
              open ? 'rotate-180' : 'rotate-0'
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block text-lg font-black text-foreground">{title}</span>
            {description ? (
              <span className="mt-1 block text-sm leading-6 text-foreground-muted">{description}</span>
            ) : null}
          </span>
        </button>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {open ? (
        <div id={bodyId} role="region" aria-labelledby={headerId} className="mt-5 border-t border-divider pt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
