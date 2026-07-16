'use server';

import { revalidatePath } from 'next/cache';
import { getRBACContext, hasPermission } from '@/lib/auth/rbac';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';

export async function updateUsageLimits(formData: FormData) {
  const access = await getRBACContext();
  if (access.error || !access.data) {
    return { success: false, error: 'Authentication required.' };
  }

  const ctx = access.data;

  if (!hasPermission(ctx.role, 'admin')) {
    await logSecurityAuditEvent({
      supabase: ctx.supabase,
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'usage_limits',
      message: 'Blocked usage limits update — insufficient role.',
      metadata: { role: ctx.role },
    });
    return { success: false, error: 'Only workspace owners and admins can adjust limits.' };
  }

  const workspaceId = ctx.workspace.id;

  const maxAiGenerations = parsePositiveInt(formData.get('max_ai_generations_per_month'));
  const maxTasks = parsePositiveInt(formData.get('max_tasks'));
  const maxCreativeAssets = parsePositiveInt(formData.get('max_creative_assets'));
  const maxContentItems = parsePositiveInt(formData.get('max_content_items'));
  const maxReelPublishes = parsePositiveInt(formData.get('max_reels_publishes_per_month'));

  const { client, error: clientError } = getSupabaseAdmin();
  if (!client) {
    return { success: false, error: clientError ?? 'Admin client unavailable.' };
  }

  const { error } = await client
    .from('usage_limits')
    .update({
      max_ai_generations_per_month: maxAiGenerations,
      max_creative_assets: maxCreativeAssets,
      max_content_items: maxContentItems,
      metadata: {
        max_tasks: maxTasks,
        max_reels_publishes_per_month: maxReelPublishes,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId);

  if (error) {
    return { success: false, error: `Failed to update limits: ${error.message}` };
  }

  await logSecurityAuditEvent({
    supabase: ctx.supabase,
    workspaceId,
    userId: ctx.user.id,
    eventType: 'usage_limits_updated',
    severity: 'info',
    entityType: 'usage_limits',
    message: 'Admin adjusted workspace usage limits',
    metadata: {
      max_ai_generations_per_month: maxAiGenerations,
      max_tasks: maxTasks,
      max_creative_assets: maxCreativeAssets,
      max_content_items: maxContentItems,
      max_reels_publishes_per_month: maxReelPublishes,
    },
  });

  revalidatePath('/dashboard/usage');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/billing');

  return { success: true, error: null };
}

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
}
