'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { Topbar } from '@/components/ui/Topbar';
import {
  DashboardContextProvider,
  type DashboardUserProfile,
  type DashboardWorkspaceProfile,
} from './DashboardContext';

interface DashboardShellProps {
  children: ReactNode;
  user: DashboardUserProfile;
  workspace: DashboardWorkspaceProfile;
}

export function DashboardShell({ children, user, workspace }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <DashboardContextProvider user={user} workspace={workspace}>
      <div className="premium-page min-h-screen text-black">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        {isMobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-30 bg-black/32 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="min-h-screen min-w-0 lg:pl-72">
          <Topbar
            onMenuClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
          />
          <main className="mx-auto w-full max-w-[1500px] px-3 pb-10 pt-24 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </DashboardContextProvider>
  );
}
