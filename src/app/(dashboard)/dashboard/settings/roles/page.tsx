import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Card, CardHeader } from '@/components/ui/Card';
import { getWorkspaceAccessContext, canManageRoles, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { RolesPermissionsSection } from '../RolesPermissionsSection';
import { MemberRoleForm } from './MemberRoleForm';

export default async function RolesSettingsPage() {
  const access = await getWorkspaceAccessContext();

  if (access.error || !access.data) {
    return <AccessDenied />;
  }

  if (!canManageRoles(access.data.role)) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'roles',
      message: 'Blocked Roles & Permissions page access.',
      metadata: { role: access.data.role },
    });

    return <AccessDenied />;
  }

  const { data: members } = await access.data.supabase
    .from('workspace_members')
    .select('user_id, role, created_at, updated_at')
    .eq('workspace_id', access.data.workspace.id)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner-only access"
        title="Roles & Permissions"
        description="Review workspace-scoped role boundaries before adding future assistants or operators."
        actions={
          <Link href="/dashboard/settings" className={buttonStyles({ variant: 'outline' })}>
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        }
      />

      <Notice tone="info" title="Owner mode">
        You are currently using the workspace as Owner.
      </Notice>

      <RolesPermissionsSection
        currentRole={access.data.role}
        isOwner={access.data.isOwner}
        isAdmin={access.data.isAdmin}
        memberCount={access.data.memberCount}
      />

      <Card>
        <CardHeader
          title="Workspace Members"
          description="Owner-only role assignment for existing workspace members. This does not create a client portal or expose secrets."
        />
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                <th className="px-3 py-3">Member</th>
                <th className="px-3 py-3">Current Role</th>
                <th className="px-3 py-3">Role Management</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => {
                const role = normalizeWorkspaceRole(member.role, access.data.workspace, member.user_id);
                const isWorkspaceOwner = member.user_id === access.data.workspace.owner_id;

                return (
                  <tr key={member.user_id} className="border-b border-black/6 align-top">
                    <td className="px-3 py-3">
                      <p className="font-mono text-xs font-bold text-[#5D6B6B]">{member.user_id}</p>
                      {isWorkspaceOwner ? <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#F7CBCA]">Workspace owner</p> : null}
                    </td>
                    <td className="px-3 py-3 font-black capitalize text-[#5D6B6B]">{role}</td>
                    <td className="px-3 py-3">
                      <MemberRoleForm
                        userId={member.user_id}
                        currentRole={role}
                        disabled={isWorkspaceOwner}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
