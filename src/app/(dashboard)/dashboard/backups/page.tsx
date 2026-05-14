import Link from 'next/link';
import {
  ArrowLeft,
  Clipboard,
  DatabaseBackup,
  Download,
  Gauge,
  LockKeyhole,
  Settings,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { allBackupCategories, backupCategoryLabels } from '@/lib/backup-center';
import { listBackupRecordsForWorkspace } from '@/lib/data/backup-records';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { canManageBackups, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTime } from '@/lib/utils';
import { BackupCenterClient } from './BackupCenterClient';

function sumRecordCounts(recordCounts: Record<string, unknown>) {
  return Object.values(recordCounts).reduce<number>(
    (total, value) => total + (typeof value === 'number' ? value : 0),
    0
  );
}

export default async function BackupCenterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (user && workspaceResult.data) {
    const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
    const currentRole = normalizeWorkspaceRole(membership.data?.role, workspaceResult.data, user.id);

    if (!canManageBackups(currentRole)) {
      await logSecurityAuditEvent({
        supabase,
        workspaceId: workspaceResult.data.id,
        userId: user.id,
        eventType: 'permission_denied',
        severity: 'warning',
        entityType: 'backup',
        message: 'Blocked Backup Center page access.',
        metadata: { role: currentRole },
      });

      return <AccessDenied />;
    }
  }

  const backupHistory = workspaceResult.data
    ? await listBackupRecordsForWorkspace(workspaceResult.data.id, supabase)
    : { data: [], error: workspaceResult.error ?? 'Workspace not found.', isConfigured: true };
  const latestBackup = backupHistory.data[0] ?? null;
  const latestRecordTotal = latestBackup ? sumRecordCounts(latestBackup.record_counts) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Safe export only"
        title="Backup Center"
        description="Create safe workspace backups for projects, prompts, releases, content, settings, and operational data."
        actions={
          <>
            <Link href="/dashboard" className={buttonStyles({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline' })}>
              <Gauge className="h-4 w-4" />
              System Health
            </Link>
            <Link href="/dashboard/security" className={buttonStyles({ variant: 'outline' })}>
              <LockKeyhole className="h-4 w-4" />
              Security Center
            </Link>
            <Link href="/dashboard/settings" className={buttonStyles({ variant: 'outline' })}>
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </>
        }
      />

      <Notice tone="info" title="Backup safety boundary">
        This center exports sanitized workspace data only. It does not restore, overwrite, delete,
        deploy, run tasks, touch provider publishing, change scheduler logic, export env values,
        include binary files, or expose tokens/secrets.
      </Notice>

      {backupHistory.error ? (
        <Notice tone="warning" title="Backup history unavailable">
          {backupHistory.error}
        </Notice>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Last backup"
          value={latestBackup ? formatDateTime(latestBackup.created_at) : 'No backups yet'}
          helper="Metadata history only"
        />
        <SummaryCard
          label="Categories"
          value={allBackupCategories.length}
          helper="Safe export groups available"
        />
        <SummaryCard
          label="Latest records"
          value={latestRecordTotal}
          helper="Records in latest export"
        />
        <SummaryCard
          label="Safety status"
          value="Sanitized"
          helper="Secrets and tokens excluded"
        />
        <SummaryCard
          label="Binary files"
          value="Excluded"
          helper="Metadata only in phase 3"
        />
      </div>

      <BackupCenterClient
        categories={allBackupCategories.map((value) => ({
          value,
          label: backupCategoryLabels[value],
        }))}
        history={backupHistory.data}
      />

      <Card>
        <CardHeader
          title="Backup History"
          description="Only metadata and summaries are stored. Old full backup JSON files are not stored in the database."
          action={<DatabaseBackup className="h-5 w-5 text-[#F7CBCA]" />}
        />
        {backupHistory.data.length === 0 ? (
          <EmptyState
            icon={Download}
            title="No backups created yet"
            description="Create a backup to generate an immediate JSON download and save a metadata-only history row."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                  <th className="px-3 py-3">Backup date</th>
                  <th className="px-3 py-3">Categories</th>
                  <th className="px-3 py-3">Record counts</th>
                  <th className="px-3 py-3">File name</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.data.map((record) => (
                  <tr key={record.id} className="border-b border-black/6 align-top">
                    <td className="px-3 py-3 font-bold text-[#5D6B6B]">{formatDateTime(record.created_at)}</td>
                    <td className="px-3 py-3 text-black/62">{record.categories.map((category) => backupCategoryLabels[category as keyof typeof backupCategoryLabels] ?? category).join(', ')}</td>
                    <td className="px-3 py-3 font-mono text-xs text-black/58">{JSON.stringify(record.record_counts)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-black/58">{record.file_name ?? 'Not stored'}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/55 px-2.5 py-1 text-xs font-black uppercase text-[#F7CBCA]">
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-black/58">
                      <Clipboard className="inline h-4 w-4 text-[#F7CBCA]" /> Summary metadata stored
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Restore Preview" description="Restoring backups is intentionally disabled in this phase." />
        <div className="rounded-lg border border-dashed border-black/12 bg-[#F1F7F7]/70 p-5 text-sm leading-7 text-black/60">
          Restoring backups is not enabled yet to avoid accidental overwrites. This Backup Center
          currently supports safe export and reference backups only. A later restore-preview phase
          can validate uploaded JSON without writing to the database.
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-lg border border-[#F7CBCA]/10 bg-white/90 p-4 shadow-[0_14px_34px_rgba(93,107,107,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-[#5D6B6B]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-black/55">{helper}</p>
    </div>
  );
}
