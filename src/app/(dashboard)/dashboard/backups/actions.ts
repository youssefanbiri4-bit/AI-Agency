'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import {
  allBackupCategories,
  createWorkspaceBackup,
  normalizeBackupCategories,
  type WorkspaceBackup,
} from '@/lib/backup-center';
import { createBackupRecord, type BackupRecord } from '@/lib/data/backup-records';
import {
  getCurrentUserWorkspace,
  getCurrentWorkspaceMembership,
} from '@/lib/data/workspaces';
import { canManageBackups, normalizeWorkspaceRole } from '@/lib/workspace-permissions';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import type { JsonObject } from '@/types';

export interface BackupCenterState {
  error: string | null;
  message?: string | null;
  backup?: WorkspaceBackup | null;
  record?: BackupRecord | null;
}

const emptyState: BackupCenterState = {
  error: null,
  message: null,
  backup: null,
  record: null,
};

async function getBackupContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard/backups');
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    redirect('/onboarding');
  }

  const membershipResult = await getCurrentWorkspaceMembership(
    supabase,
    workspaceResult.data.id,
    user.id
  );

  if (membershipResult.error) {
    return { error: membershipResult.error, supabase, user, workspace: workspaceResult.data };
  }

  const currentRole = normalizeWorkspaceRole(membershipResult.data?.role, workspaceResult.data, user.id);

  if (!membershipResult.data || !canManageBackups(currentRole)) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'backup',
      message: 'Blocked backup export.',
      metadata: { role: currentRole },
    });

    return { error: 'Backup exports are restricted to workspace owners and admins.', supabase, user, workspace: workspaceResult.data };
  }

  return { error: null, supabase, user, workspace: workspaceResult.data };
}

export async function createBackupAction(
  state: BackupCenterState = emptyState,
  formData: FormData
): Promise<BackupCenterState> {
  void state;

  const context = await getBackupContext();
  if (context.error) {
    return { error: context.error, backup: null, record: null };
  }

  const selectedCategories = normalizeBackupCategories(
    formData
      .getAll('categories')
      .filter((value): value is string => typeof value === 'string')
  );
  const backup = await createWorkspaceBackup({
    workspace: context.workspace,
    userId: context.user.id,
    client: context.supabase,
    categories: selectedCategories.length ? selectedCategories : allBackupCategories,
  });

  const recordResult = await createBackupRecord(
    {
      workspaceId: context.workspace.id,
      userId: context.user.id,
      categories: selectedCategories,
      recordCounts: backup.summary.record_counts as unknown as JsonObject,
      fileName: backup.summary.file_name,
      fileSizeBytes: backup.summary.size_estimate_bytes,
      warnings: backup.summary.warnings,
      metadata: {
        backup_version: backup.backup_version,
        total_records: backup.summary.total_records,
        secrets_excluded: true,
        tokens_excluded: true,
        binary_files_included: false,
        markdown_summary: backup.summary.markdown,
      },
    },
    context.supabase
  );

  await logSecurityAuditEvent({
    supabase: context.supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'backup_exported',
    entityType: 'backup',
    entityId: recordResult.data?.id ?? null,
    message: 'Safe workspace backup exported.',
    metadata: {
      categories: selectedCategories,
      secrets_excluded: true,
      tokens_excluded: true,
    },
  });

  revalidatePath('/dashboard/backups');
  revalidatePath('/dashboard/system-health');
  revalidatePath('/dashboard/security');

  return {
    error: recordResult.error,
    message: recordResult.error
      ? 'Backup generated, but metadata history could not be saved.'
      : 'Backup generated safely.',
    backup,
    record: recordResult.data,
  };
}
