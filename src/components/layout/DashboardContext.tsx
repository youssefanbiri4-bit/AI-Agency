'use client';

import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { RBACRole, Department } from '@/types/auth';

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
  rbac?: DashboardRBACProfile;
}

interface DashboardRBACState {
  role: RBACRole | null;
  department: Department | null;
  effectiveDepartment: Department | null;
  assignedDepartment: Department | null;
  isAdminOrHigher: boolean;
  isSavingDepartment: boolean;
  assignedRole: RBACRole | null;
  setEffectiveDepartment: (dept: Department | null) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);
const DashboardRBACContext = createContext<DashboardRBACState | null>(null);

export function DashboardContextProvider({
  children,
  user,
  workspace,
  rbac,
}: DashboardContextValue & {
  children: ReactNode;
}) {
  const value = useMemo(() => ({ user, workspace, rbac }), [user, workspace, rbac]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function DashboardRBACProvider({
  children,
  rbac,
}: {
  children: ReactNode;
  rbac?: DashboardRBACProfile;
}) {
  const [effectiveDepartment, setEffectiveDepartmentState] = useState<Department | null>(
    rbac?.department ?? null
  );
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);

  const setEffectiveDepartment = useCallback((dept: Department | null) => {
    setIsSavingDepartment(true);
    setEffectiveDepartmentState(dept);
    // Simulate save complete (actual persistence is handled elsewhere)
    setTimeout(() => setIsSavingDepartment(false), 300);
  }, []);

  const rbacState: DashboardRBACState = useMemo(
    () => ({
      role: rbac?.role ?? null,
      department: effectiveDepartment,
      effectiveDepartment,
      assignedDepartment: rbac?.department ?? null,
      isAdminOrHigher: rbac?.isAdminOrHigher ?? false,
      isSavingDepartment,
      assignedRole: rbac?.role ?? null,
      setEffectiveDepartment,
    }),
    [rbac, effectiveDepartment, isSavingDepartment, setEffectiveDepartment]
  );

  return (
    <DashboardRBACContext.Provider value={rbacState}>
      {children}
    </DashboardRBACContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error('useDashboardContext must be used inside DashboardContextProvider');
  }

  return context;
}

export function useRBAC() {
  const context = useContext(DashboardRBACContext);

  if (!context) {
    throw new Error('useRBAC must be used inside DashboardRBACProvider');
  }

  return context;
}
