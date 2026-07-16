'use client';

import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts, type ShortcutDef } from '@/hooks/useKeyboardShortcuts';

interface NavigationShortcutsOptions {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
  onGoBack?: () => void;
  onRefresh?: () => void;
}

export function useNavigationShortcuts(options: NavigationShortcutsOptions = {}) {
  const router = useRouter();
  const { onOpenSearch, onOpenSettings, onToggleSidebar, onGoBack, onRefresh } = options;

  const shortcuts: ShortcutDef[] = [
    {
      key: '/',
      modifiers: ['meta'],
      description: 'Open search / command palette',
      category: 'Navigation',
      handler: () => onOpenSearch?.(),
      preventDefault: true,
    },
    {
      key: ',',
      modifiers: ['meta'],
      description: 'Open settings',
      category: 'Navigation',
      handler: () => onOpenSettings?.() ?? router.push('/dashboard/settings'),
      preventDefault: true,
    },
    {
      key: 'b',
      modifiers: ['meta'],
      description: 'Toggle sidebar',
      category: 'Navigation',
      handler: () => onToggleSidebar?.(),
      preventDefault: true,
    },
    {
      key: '[',
      modifiers: ['meta'],
      description: 'Go back',
      category: 'Navigation',
      handler: () => onGoBack?.() ?? router.back(),
      preventDefault: true,
    },
    {
      key: 'r',
      modifiers: ['meta', 'shift'],
      description: 'Refresh page',
      category: 'Navigation',
      handler: () => onRefresh?.() ?? router.refresh(),
      preventDefault: true,
    },
    {
      key: 'h',
      modifiers: ['meta'],
      description: 'Go to dashboard',
      category: 'Navigation',
      handler: () => router.push('/dashboard'),
      preventDefault: true,
    },
    {
      key: 't',
      modifiers: ['meta'],
      description: 'Go to tasks',
      category: 'Navigation',
      handler: () => router.push('/dashboard/tasks'),
      preventDefault: true,
    },
    {
      key: 'a',
      modifiers: ['meta'],
      description: 'Go to agents',
      category: 'Navigation',
      handler: () => router.push('/dashboard/agents'),
      preventDefault: true,
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

interface EditingShortcutsOptions {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onBold?: () => void;
  onItalic?: () => void;
  onInsertLink?: () => void;
}

export function useEditingShortcuts(options: EditingShortcutsOptions = {}) {
  const { onSave, onUndo, onRedo, onBold, onItalic, onInsertLink } = options;

  const shortcuts: ShortcutDef[] = [
    {
      key: 's',
      modifiers: ['meta'],
      description: 'Save',
      category: 'Editing',
      handler: () => onSave?.(),
      preventDefault: true,
    },
    {
      key: 'z',
      modifiers: ['meta'],
      description: 'Undo',
      category: 'Editing',
      handler: () => onUndo?.(),
      ignoreWhenEditing: false,
    },
    {
      key: 'z',
      modifiers: ['meta', 'shift'],
      description: 'Redo',
      category: 'Editing',
      handler: () => onRedo?.(),
      ignoreWhenEditing: false,
    },
    {
      key: 'b',
      modifiers: ['meta'],
      description: 'Bold',
      category: 'Editing',
      handler: () => onBold?.(),
      ignoreWhenEditing: false,
    },
    {
      key: 'i',
      modifiers: ['meta'],
      description: 'Italic',
      category: 'Editing',
      handler: () => onItalic?.(),
      ignoreWhenEditing: false,
    },
    {
      key: 'k',
      modifiers: ['meta'],
      description: 'Insert link',
      category: 'Editing',
      handler: () => onInsertLink?.(),
      ignoreWhenEditing: false,
    },
  ];

  useKeyboardShortcuts(shortcuts);
}

export function useAccessibilityShortcuts() {
  const shortcuts: ShortcutDef[] = [
    {
      key: 'Escape',
      description: 'Close modal / dialog / menu',
      category: 'Accessibility',
      handler: () => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const closeBtn = dialog.querySelector<HTMLButtonElement>('[aria-label="Close"], [data-close]');
          closeBtn?.click();
        }
      },
      ignoreWhenEditing: true,
    },
    {
      key: 'Tab',
      description: 'Move focus forward',
      category: 'Accessibility',
      handler: () => {},
      preventDefault: false,
    },
    {
      key: 'Tab',
      modifiers: ['shift'],
      description: 'Move focus backward',
      category: 'Accessibility',
      handler: () => {},
      preventDefault: false,
    },
  ];

  useKeyboardShortcuts(shortcuts);
}
