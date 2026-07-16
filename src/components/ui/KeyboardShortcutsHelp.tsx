'use client';

import { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { getAllShortcuts, formatShortcutForDisplay, type ShortcutDef } from '@/hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Default shortcuts that ship with the app
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: Record<string, string> = {
  General: 'General',
  Navigation: 'Navigation',
  Actions: 'Actions',
  Editing: 'Editing',
};

// ---------------------------------------------------------------------------
// Kbd element for rendering key combo
// ---------------------------------------------------------------------------

function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[24px] items-center justify-center rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-xs font-bold text-foreground shadow-sm',
        className
      )}
    >
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Shortcut row
// ---------------------------------------------------------------------------

function ShortcutRow({ shortcut }: { shortcut: ShortcutDef }) {
  const display = formatShortcutForDisplay(shortcut);
  const parts = display.split(/(?=[⌘^⌥⇧↵↑↓←→])|(?<=[⌘^⌥⇧])/g);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-surface/50">
      <span className="text-sm font-medium text-foreground">{shortcut.description}</span>
      <span className="flex shrink-0 items-center gap-1">
        {parts.map((part, i) => (
          <Kbd key={i}>{part}</Kbd>
        ))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped shortcuts
// ---------------------------------------------------------------------------

function ShortcutGroup({ category, shortcuts }: { category: string; shortcuts: ShortcutDef[] }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-2 px-2 text-xs font-black uppercase tracking-[0.16em] text-foreground-muted">
        {category}
      </h3>
      <div className="divide-y divide-border/50">
        {shortcuts.map((shortcut, index) => (
          <ShortcutRow key={`${shortcut.key}-${index}`} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeyboardShortcutsHelp component
// ---------------------------------------------------------------------------

export function KeyboardShortcutsHelp({ isOpen: open, onClose }: KeyboardShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape via hook
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close shortcuts help',
      category: 'General',
      handler: () => onClose(),
      ignoreWhenEditing: true,
    },
  ]);

  // Focus trap & click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Get all registered shortcuts and group by category
  const allShortcuts = getAllShortcuts();
  const grouped = allShortcuts.reduce<Record<string, ShortcutDef[]>>((acc, shortcut) => {
    const category = shortcut.category ?? 'General';
    if (!acc[category]) acc[category] = [];
    // Avoid duplicates
    const exists = acc[category].some(
      (s) => s.key === shortcut.key && s.description === shortcut.description
    );
    if (!exists) acc[category].push(shortcut);
    return acc;
  }, {});

  // Ensure order: General, Navigation, Actions, Editing, then rest
  const categoryOrder = Object.keys(DEFAULT_CATEGORIES);
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aIdx = categoryOrder.indexOf(a);
    const bIdx = categoryOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        ref={overlayRef}
        className="mx-auto w-full max-w-lg rounded-xl border border-border bg-surface-elevated shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary shadow-sm">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="keyboard-shortcuts-title"
                className="text-base font-bold text-foreground"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-foreground-muted">
                Press <Kbd className="inline-flex">⌘/</Kbd> to toggle this panel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {sortedCategories.length > 0 ? (
            sortedCategories.map((category) => (
              <ShortcutGroup
                key={category}
                category={category}
                shortcuts={grouped[category]}
              />
            ))
          ) : (
            <div className="py-8 text-center text-foreground-muted">
              <p className="text-sm font-medium">No shortcuts registered yet.</p>
              <p className="mt-1 text-xs">Available shortcuts will appear here as you navigate.</p>
            </div>
          )}
        </div>

        {/* Footer tips */}
        <div className="border-t border-divider bg-background px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
            <span className="flex items-center gap-1.5">
              <Kbd className="inline-flex">⌘K</Kbd>
              <span>Command palette</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd className="inline-flex">⌘/</Kbd>
              <span>Toggle this panel</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd className="inline-flex">⌘↵</Kbd>
              <span>Submit form</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd className="inline-flex">esc</Kbd>
              <span>Close / Cancel</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
