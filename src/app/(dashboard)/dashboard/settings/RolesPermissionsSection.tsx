import { ShieldCheck, UsersRound } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { actionLabels, permissionsMatrix, workspaceRoles, getPermissionLevelSummary, type StrictWorkspaceRole } from '@/lib/permissions-matrix';

const roleLabels: Record<StrictWorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  operator: 'Operator',
  editor: 'Editor',
  viewer: 'Viewer',
};

const compactActions = ['view', 'create', 'edit', 'delete', 'publish', 'manage_settings'] as const;

function roleActions(role: StrictWorkspaceRole, action: string) {
  return permissionsMatrix
    .filter((row) => row[role].includes(action))
    .map((row) => row.area);
}

function RoleCapabilityCell({ role, action }: { role: StrictWorkspaceRole; action: string }) {
  const areas = roleActions(role, action);

  if (areas.length === 0) {
    return <span className="text-black/35">No</span>;
  }

  if (action === 'view') {
    return <span className="font-black text-[#5D6B6B]">{areas.length} areas</span>;
  }

  return <span className="font-bold text-[#5D6B6B]">{areas.length}</span>;
}

export function RolesPermissionsSection({
  currentRole,
  isOwner,
  isAdmin,
  memberCount,
}: {
  currentRole: StrictWorkspaceRole;
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number | null;
}) {
  return (
    <section id="roles-permissions" className="space-y-5">
      <Card>
        <CardHeader
          title="Roles & Permissions"
          description="Workspace-scoped access control for sensitive settings, publishing, scheduler, backups, security, and future operators."
          action={<ShieldCheck className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
          <div className="rounded-lg border border-black/7 bg-[#F1F7F7]/70 p-4">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-[#F7CBCA]">Current user role</p>
            <h3 className="mt-2 text-2xl font-black text-[#5D6B6B]">{roleLabels[currentRole]}</h3>
            <p className="mt-2 text-sm leading-6 text-black/58">{getPermissionLevelSummary(currentRole)}</p>
            {isOwner ? (
              <Notice tone="info" title="Owner mode">
                You are currently using the workspace as Owner.
              </Notice>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-black/7 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Workspace status</p>
              <p className="mt-2 font-black text-[#5D6B6B]">{isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Limited'}</p>
            </div>
            <div className="rounded-lg border border-black/7 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Members</p>
              <p className="mt-2 flex items-center gap-2 font-black text-[#5D6B6B]">
                <UsersRound className="h-4 w-4 text-[#F7CBCA]" />
                {memberCount ?? 'Unavailable'}
              </p>
            </div>
            <div className="rounded-lg border border-black/7 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Strict roles</p>
              <p className="mt-2 font-black text-[#5D6B6B]">{workspaceRoles.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Permissions Matrix"
          description="Readable summary by role. Detailed page and action checks are enforced server-side for sensitive operations."
        />
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                <th className="px-3 py-3">Role</th>
                {compactActions.map((action) => (
                  <th key={action} className="px-3 py-3">{actionLabels[action]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspaceRoles.map((role) => (
                <tr key={role} className="border-b border-black/6 align-top">
                  <td className="px-3 py-3">
                    <p className="font-black text-[#5D6B6B]">{roleLabels[role]}</p>
                    <p className="mt-1 max-w-[260px] text-xs leading-5 text-black/50">{getPermissionLevelSummary(role)}</p>
                  </td>
                  {compactActions.map((action) => (
                    <td key={`${role}-${action}`} className="px-3 py-3">
                      <RoleCapabilityCell role={role} action={action} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
