'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { updateWorkspaceMemberRoleAction, type RoleChangeState } from './actions';
import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';

const initialState: RoleChangeState = { error: null };
const roles: StrictWorkspaceRole[] = ['owner', 'admin', 'operator', 'editor', 'viewer'];

export function MemberRoleForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: StrictWorkspaceRole;
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateWorkspaceMemberRoleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={currentRole} disabled={disabled || isPending} aria-label="Member role">
        {roles.map((role) => (
          <option key={role} value={role}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" disabled={disabled || isPending}>
        <Save className="h-4 w-4" />
        Save
      </Button>
      {state.error ? <p className="text-xs font-bold text-[#B51F30]">{state.error}</p> : null}
      {state.message ? <p className="text-xs font-bold text-[#206A3B]">{state.message}</p> : null}
    </form>
  );
}
