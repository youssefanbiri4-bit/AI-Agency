'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { MobileBottomNav } from '@/components/ui/MobileBottomNav';
import { Topbar } from '@/components/ui/Topbar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { KeyboardShortcutsHelp } from '@/components/ui/KeyboardShortcutsHelp';
import { useKeyboardShortcuts, useKeyboardShortcutsHelp } from '@/hooks/useKeyboardShortcuts';
import {
  DashboardContextProvider,
  DashboardRBACProvider,
  type DashboardUserProfile,
  type DashboardWorkspaceProfile,
  type DashboardRBACProfile,
} from './DashboardContext';
import type { NotificationRecord } from '@/types/database';
import type { WorkspaceTheme } from '@/lib/theme';

interface DashboardShellProps {
  children: ReactNode;
  user: DashboardUserProfile;
  workspace: DashboardWorkspaceProfile;
  rbac?: DashboardRBACProfile;
  initialNotifications?: NotificationRecord[];
  initialUnreadCount?: number;
  theme?: WorkspaceTheme;
}

export function DashboardShell({
  children,
  user,
  workspace,
  rbac,
  initialNotifications,
  initialUnreadCount,
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const shortcutsHelp = useKeyboardShortcutsHelp();

  // Register global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      modifiers: ['meta'],
      description: 'Open command palette',
      category: 'Navigation',
      handler: () => setIsCommandPaletteOpen(true),
      preventDefault: true,
    },
    {
      key: 'Escape',
      description: 'Close menu / modals',
      category: 'General',
      handler: () => {
        setIsCommandPaletteOpen(false);
        setIsMobileMenuOpen(false);
        shortcutsHelp.close();
      },
      ignoreWhenEditing: true,
    },
  ]);

  return (
    <DashboardContextProvider user={user} workspace={workspace} rbac={rbac}>
      <DashboardRBACProvider rbac={rbac}>
        <div className="dashboard-background premium-page min-h-screen text-foreground">
          <a
            href="#main-content"
            className="fixed -top-40 left-4 z-[100] rounded-b-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg transition-all focus:top-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
          >
            Skip to main content
          </a>

          <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

          <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

          <KeyboardShortcutsHelp isOpen={shortcutsHelp.isOpen} onClose={shortcutsHelp.close} />

          {isMobileMenuOpen && (
            <button
              type="button"
              aria-label="Close navigation menu"
              className="fixed inset-0 z-30 bg-black/32 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <div className="min-h-screen min-w-0 lg:ps-60">
            <Topbar
              onMenuClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              isMobileMenuOpen={isMobileMenuOpen}
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
            <main id="main-content" className="mx-auto w-full max-w-[1480px] px-4 pb-20 pt-24 sm:px-6 lg:pb-12 lg:px-8 xl:px-10">
              {children}
            </main>
            <div aria-live="polite" aria-atomic="true" className="sr-only" />
          </div>

          <MobileBottomNav onMoreClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)} />
        </div>
      </DashboardRBACProvider>
    </DashboardContextProvider>
  );
}
