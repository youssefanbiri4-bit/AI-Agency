/**
 * DepartmentSwitcher
 *
 * Admin-only component to view/switch active department context.
 * - Shows current department badge
 * - Dropdown to select another department (for scoping UI or future filtered views)
 * - Only visible to admin/owner
 *
 * Usage:
 *   <DepartmentSwitcher />
 *
 * Note: This component is client-only. It can emit onChange for parent to react.
 * Persists admin "view as department" selection server-side via user_preferences.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { useRBAC } from '@/components/layout/DashboardContext';
import type { Department } from '@/types/auth';
import { DEPARTMENT_LABELS } from '@/types/auth';
import { cn } from '@/lib/utils';

interface DepartmentSwitcherProps {
  className?: string;
  onDepartmentChange?: (dept: Department | null) => void;
  /** When true, allow selecting "All Departments" (for admins) */
  allowAll?: boolean;
}

const ALL_DEPTS: Department[] = ['content', 'creative', 'social', 'strategy', 'paid_ads', 'operations'];

export function DepartmentSwitcher({
  className,
  onDepartmentChange,
  allowAll = true,
}: DepartmentSwitcherProps) {
  const {
    role,
    effectiveDepartment,
    assignedDepartment,
    setEffectiveDepartment,
    isAdminOrHigher,
    isSavingDepartment,
  } = useRBAC();
  const [open, setOpen] = useState(false);

  // Only admins/owners see the switcher
  const isAdmin = isAdminOrHigher || role === 'admin' || role === 'owner';
  if (!isAdmin) return null;

  // Prefer effective (from context/cookie), fall back to assigned
  const current = effectiveDepartment ?? assignedDepartment ?? null;

  const handleSelect = (dept: Department | null) => {
    setEffectiveDepartment(dept);
    setOpen(false);
    onDepartmentChange?.(dept);
  };

  const displayLabel = current ? DEPARTMENT_LABELS[current].en : 'All Depts';

  return (
    <div className={cn('relative inline-block text-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-[#F7CBCA]/20 bg-white/70 px-3 py-1.5 text-black/80 shadow-sm hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/30 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isSavingDepartment}
      >
        <Users className="h-4 w-4 text-[#F7CBCA]" />
        <span className="font-bold">
          {displayLabel}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute end-0 z-50 mt-2 w-52 rounded-xl border border-black/10 bg-white p-1 shadow-xl"
          role="listbox"
        >
          {allowAll && (
            <button
              className={cn(
                'w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-[#F1F7F7]',
                !current && 'bg-[#F7CBCA]/10 font-semibold'
              )}
              onClick={() => handleSelect(null)}
            >
              All Departments
            </button>
          )}
          {ALL_DEPTS.map((dept) => {
            const label = DEPARTMENT_LABELS[dept];
            const active = current === dept;
            return (
              <button
                key={dept}
                role="option"
                aria-selected={active}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-start hover:bg-[#F1F7F7]',
                  active && 'bg-[#F7CBCA]/10 font-semibold'
                )}
                onClick={() => handleSelect(dept)}
              >
                <span>{label.en}</span>
                <span className="text-[10px] text-black/40">{label.ar}</span>
              </button>
            );
          })}
          <div className="mt-1 border-t border-black/10 pt-1 text-[10px] text-black/45 px-2">
            {isSavingDepartment ? 'Saving preference…' : 'Only visible to Admins & Owners'}
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentSwitcher;
