'use server';

import { revalidatePath } from 'next/cache';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { escapeCsvField } from '@/lib/csv-utils';
import {
  bulkDeleteContentStudioItems as dataBulkDeleteContentStudioItems,
  bulkDuplicateContentStudioItems as dataBulkDuplicateContentStudioItems,
} from '@/features/content-studio/data/content-studio';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { incrementUsage } from '@/lib/usage/quotas';

export interface BulkContentActionResult {
  ok: boolean;
  updated: number;
  failed: number;
  message?: string;
}

/**
 * Bulk-delete content studio items with RBAC (editor+) and audit logging.
 */
export async function bulkDeleteContentItems(
  itemIds: string[],
): Promise<BulkContentActionResult> {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No items selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Editor role required.' };
  }

  const { workspace, user } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const result = await dataBulkDeleteContentStudioItems(
    itemIds,
    workspace.id,
    supabase,
  );

  if (result.error) {
    return { ok: false, updated: 0, failed: itemIds.length, message: result.error };
  }

  await logSecurityAuditEvent({
    supabase,
    workspaceId: workspace.id,
    userId: user.id,
    eventType: 'bulk_delete',
    severity: 'info',
    entityType: 'content',
    message: `Bulk deleted ${result.data.deleted} content studio item(s).`,
    metadata: { itemIds, count: result.data.deleted },
  }).catch(() => {});

  revalidatePath('/dashboard/content-library');
  revalidatePath('/dashboard/content-studio');

  const failed = itemIds.length - result.data.deleted;
  return { ok: failed === 0, updated: result.data.deleted, failed };
}

/**
 * Bulk-duplicate content studio items with RBAC (editor+) and quota enforcement.
 */
export async function bulkDuplicateContentItems(
  itemIds: string[],
): Promise<BulkContentActionResult> {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { ok: false, updated: 0, failed: 0, message: 'No items selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, updated: 0, failed: 0, message: rbacCheck.error || 'Editor role required.' };
  }

  const { workspace, user } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const result = await dataBulkDuplicateContentStudioItems(
    itemIds,
    workspace.id,
    user.id,
    supabase,
  );

  if (result.error) {
    return { ok: false, updated: 0, failed: itemIds.length, message: result.error };
  }

  await incrementUsage(workspace.id, 'content_items', result.data.duplicated, user.id).catch(() => {});

  revalidatePath('/dashboard/content-library');
  revalidatePath('/dashboard/content-studio');

  const failed = itemIds.length - result.data.duplicated;
  return { ok: failed === 0, updated: result.data.duplicated, failed };
}

/**
 * Bulk-export content studio items as CSV or JSON.
 */
export async function bulkExportContentItems(
  itemIds: string[],
  format: 'csv' | 'json',
): Promise<{ ok: boolean; data?: string; filename?: string; message?: string }> {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { ok: false, message: 'No items selected.' };
  }

  const rbacCheck = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
  if (!rbacCheck.ok || !rbacCheck.context) {
    return { ok: false, message: rbacCheck.error || 'Viewer role required.' };
  }

  const { workspace } = rbacCheck.context;
  const supabase = await createSupabaseServerClient();

  const { data: items, error } = await supabase
    .from('content_studio_items')
    .select('id, title, platform, content_type, status, objective, prompt, script, caption, ad_copy, creative_brief, schedule_at, published_at, provider_status, created_at, updated_at')
    .in('id', itemIds)
    .eq('workspace_id', workspace.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!items || items.length === 0) {
    return { ok: false, message: 'No items found.' };
  }

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    return {
      ok: true,
      data: JSON.stringify(items, null, 2),
      filename: `content-items-export-${timestamp}.json`,
    };
  }

  // CSV format
  const headers = ['ID', 'Title', 'Platform', 'Content Type', 'Status', 'Objective', 'Prompt', 'Script', 'Caption', 'Ad Copy', 'Creative Brief', 'Schedule At', 'Published At', 'Provider Status', 'Created At', 'Updated At'];
  const csvRows = [
    headers.join(','),
    ...items.map((item) =>
      [
        item.id,
        escapeCsvField(item.title),
        item.platform,
        item.content_type,
        item.status,
        escapeCsvField(item.objective ?? ''),
        escapeCsvField(item.prompt ?? ''),
        escapeCsvField(item.script ?? ''),
        escapeCsvField(item.caption ?? ''),
        escapeCsvField(item.ad_copy ?? ''),
        escapeCsvField(item.creative_brief ?? ''),
        item.schedule_at ?? '',
        item.published_at ?? '',
        item.provider_status ?? '',
        item.created_at ?? '',
        item.updated_at ?? '',
      ].join(','),
    ),
  ];

  return {
    ok: true,
    data: csvRows.join('\n'),
    filename: `content-items-export-${timestamp}.csv`,
  };
}

