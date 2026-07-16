'use client';

import { createContext, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Department, RBACRole } from '@/types/auth';

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

export interface DashboardRBACProfile {
  role: RBACRole;
  department: Department | null;
  isAdminOrHigher: boolean;
}

interface DashboardContextValue {
  user: DashboardUserProfile;
  workspace: DashboardWorkspaceProfile;
  rbac: DashboardRBACProfile | null;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardContextProvider({
  children,
  user,
  workspace,
  rbac,
}: DashboardContextValue & {
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ user, workspace, rbac: rbac ?? null }),
    [user, workspace, rbac]
  );

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

// RBAC convenience hook – provides role, department, and admin status from context.
export function useRBAC() {
  const { rbac } = useDashboardContext();

  return useMemo(
    () => ({
      role: rbac?.role ?? ('viewer' as RBACRole),
      assignedRole: rbac?.role ?? ('viewer' as RBACRole),
      department: rbac?.department ?? null,
      assignedDepartment: rbac?.department ?? null,
      effectiveDepartment: rbac?.department ?? null,
      isAdminOrHigher: rbac?.isAdminOrHigher ?? false,
      isSavingDepartment: false,
      setEffectiveDepartment: (_dept: Department | null) => {
        // Will be wired to server-side persistence in Wave 2+
      },
    }),
    [rbac]
  );
}
