'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { Topbar } from '@/components/ui/Topbar';
import {
  DashboardContextProvider,
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

  return (
    <DashboardContextProvider user={user} workspace={workspace} rbac={rbac ?? null}>
      <div className="dashboard-background premium-page min-h-screen text-black">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        {isMobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-30 bg-black/32 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="min-h-screen min-w-0 lg:ps-72">
          <Topbar
            onMenuClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
          />
          <main className="mx-auto w-full max-w-[1480px] px-4 pb-12 pt-24 sm:px-6 lg:px-8 xl:px-10">
            {children}
          </main>
        </div>
      </div>
    </DashboardContextProvider>
  );
}
