'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface DashboardUserProfile {
  id: string;
  email: string;
  fullName: string;
}

export interface DashboardWorkspaceProfile {
  id: string;
  name: string;
  slug: string | null;
  branding?: {
    logoUrl: string | null;
    logoAltText: string | null;
  };
}

interface DashboardContextValue {
  user: DashboardUserProfile;
  workspace: DashboardWorkspaceProfile;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardContextProvider({
  children,
  user,
  workspace,
}: DashboardContextValue & {
  children: ReactNode;
}) {
  const value = useMemo(() => ({ user, workspace }), [user, workspace]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error('useDashboardContext must be used inside DashboardContextProvider');
  }

  return context;
}
