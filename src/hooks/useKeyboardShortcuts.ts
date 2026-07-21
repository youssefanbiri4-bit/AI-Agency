'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShortcutModifier = 'meta' | 'ctrl' | 'alt' | 'shift';

export interface ShortcutDef {
  /** Key to listen for (e.g., 'k', 'Enter', '/', 'Escape') */
  key: string;
  /** Modifier keys required */
  modifiers?: ShortcutModifier[];
  /** Description shown in help modal */
  description: string;
  /** Category for grouping in help. Default: 'General' */
  category?: string;
  /** Handler */
  handler: (event: KeyboardEvent) => void;
  /** Only trigger when no input/textarea/select is focused */
  ignoreWhenEditing?: boolean;
  /** Prevent default behavior */
  preventDefault?: boolean;
}

interface KeyboardShortcutsOptions {
  /** Additional shortcuts to register */
  shortcuts?: ShortcutDef[];
  /** Element to listen on. Default: document */
  element?: HTMLElement | null;
  /** Enable debug logging */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Registry — global shortcut registry (singleton pattern via context)
// ---------------------------------------------------------------------------

let globalShortcuts: ShortcutDef[] = [];

export function registerShortcuts(shortcuts: ShortcutDef[]) {
  for (const shortcut of shortcuts) {
    const existingIndex = globalShortcuts.findIndex(
      (s) =>
        s.key === shortcut.key &&
        JSON.stringify(s.modifiers?.sort()) ===
          JSON.stringify(shortcut.modifiers?.sort())
    );
    if (existingIndex >= 0) {
      globalShortcuts[existingIndex] = shortcut;
    } else {
      globalShortcuts.push(shortcut);
    }
  }
}

export function unregisterShortcuts(shortcuts: { key: string; modifiers?: ShortcutModifier[] }[]) {
  globalShortcuts = globalShortcuts.filter((s) => {
    return !shortcuts.some((target) => {
      const targetMods = (target.modifiers ?? []).sort().join(',');
      const sMods = (s.modifiers ?? []).sort().join(',');
      return s.key === target.key && sMods === targetMods;
    });
  });
}

export function getAllShortcuts(): ShortcutDef[] {
  return [...globalShortcuts];
}

// ---------------------------------------------------------------------------
// Hook: useKeyboardShortcuts
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(
  shortcuts: ShortcutDef[],
  options: KeyboardShortcutsOptions = {}
) {
  const { element, debug } = options;

  // Register shortcuts on mount, clean up on unmount
  useEffect(() => {
    registerShortcuts(shortcuts);

    return () => {
      unregisterShortcuts(shortcuts);
    };
  }, [shortcuts]);

  // Global keydown listener
  useEffect(() => {
    const target = element ?? document;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.getAttribute('contenteditable') === 'true';

      for (const shortcut of globalShortcuts) {
        const modifiers = shortcut.modifiers ?? [];

        const modsMatch =
          modifiers.every((mod) => {
            if (mod === 'meta') return event.metaKey;
            if (mod === 'ctrl') return event.ctrlKey;
            if (mod === 'alt') return event.altKey;
            if (mod === 'shift') return event.shiftKey;
            return false;
          }) &&
          modifiers.length ===
            [event.metaKey, event.ctrlKey, event.altKey, event.shiftKey].filter(
              Boolean
            ).length;

        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.code.toLowerCase() === `key${shortcut.key.toLowerCase()}`;

        if (modsMatch && keyMatch) {
          // Skip if editing and shortcut says to ignore when editing
          if (shortcut.ignoreWhenEditing && isEditing) continue;

          if (debug) {
            console.log(
              `[KeyboardShortcut] ${formatShortcutForDisplay(shortcut)} → ${shortcut.description}`
            );
          }

          if (shortcut.preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }

          shortcut.handler(event);
          return;
        }
      }
    };

    target.addEventListener('keydown', handleKeyDown as EventListener);
    return () => target.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [element, debug]);
}

// ---------------------------------------------------------------------------
// Format shortcut for display (e.g., "⌘K")
// ---------------------------------------------------------------------------

export function formatShortcutForDisplay(shortcut: ShortcutDef): string {
  const parts: string[] = [];
  const mods = shortcut.modifiers ?? [];

  if (mods.includes('meta')) parts.push('⌘');
  if (mods.includes('ctrl')) parts.push('^');
  if (mods.includes('alt')) parts.push('⌥');
  if (mods.includes('shift')) parts.push('⇧');

  const keyLabel: Record<string, string> = {
    enter: '↵',
    escape: 'esc',
    backspace: '⌫',
    tab: '⇥',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    '/': '/',
    '?': '?',
    '.': '.',
    ',': ',',
  };

  parts.push(keyLabel[shortcut.key.toLowerCase()] ?? shortcut.key.toUpperCase());

  return parts.join('');
}

// ---------------------------------------------------------------------------
// useCmdK — convenience for Cmd+K palette toggle
// ---------------------------------------------------------------------------

export function useCmdK(onToggle: () => void) {
  useKeyboardShortcuts([
    {
      key: 'k',
      modifiers: ['meta'],
      description: 'Open command palette',
      category: 'Navigation',
      handler: () => onToggle(),
      preventDefault: true,
    },
  ]);
}

// ---------------------------------------------------------------------------
// useCmdEnter — convenience for Cmd+Enter form submission
// ---------------------------------------------------------------------------

export function useCmdEnter(onSubmit: () => void, enabled = true) {
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        onSubmitRef.current();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}

// ---------------------------------------------------------------------------
// useEscape — convenience for Escape key
// ---------------------------------------------------------------------------

export function useEscape(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, onEscape]);
}

// ---------------------------------------------------------------------------
// useKeyboardShortcutsHelp — tracks whether help is open
// ---------------------------------------------------------------------------

export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // ? key to open help
  useKeyboardShortcuts([
    {
      key: '/',
      modifiers: ['meta'],
      description: 'Show keyboard shortcuts',
      category: 'General',
      handler: () => setIsOpen((prev) => !prev),
      preventDefault: true,
    },
  ]);

  // Escape to close
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close help / modals',
      category: 'General',
      handler: () => setIsOpen(false),
      preventDefault: false,
      ignoreWhenEditing: true,
    },
  ]);

  return { isOpen, toggle, open, close };
}

// ---------------------------------------------------------------------------
// Helper: check if a shortcut would conflict with editing
// ---------------------------------------------------------------------------

export function isEditing(): boolean {
  const activeEl = document.activeElement;
  return (
    activeEl?.tagName === 'INPUT' ||
    activeEl?.tagName === 'TEXTAREA' ||
    activeEl?.tagName === 'SELECT' ||
    activeEl?.getAttribute('contenteditable') === 'true'
  );
}
