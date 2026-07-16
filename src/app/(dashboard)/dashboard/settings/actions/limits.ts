'use server';

/**
 * Server actions for managing workspace quota limits.
 *
 * Only owner/admin can read and modify limits.
 * Limits are stored as overrides in usage_limits.metadata.overrides.
 * Fallback chain: override > DB column > PLAN_LIMITS default.
 */

import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { getSettingsWorkspaceContext, denySettingsAction } from './_shared';
import type { JsonObject } from '@/types';

const limitsLog = logger.child('settings:limits');

// ─── Types ────────────────────────────────────────────────────

export interface EditableLimits {
  max_ai_generations_per_month: number | null;
  max_creative_assets: number | null;
  max_content_items: number | null;
  max_tasks: number | null;
  max_reels_publishes_per_month: number | null;
}

export interface LimitsState {
  error: string | null;
  limits: EditableLimits | null;
  plan: string | null;
  isOverridden: boolean;
}

export interface UpdateLimitsState {
  error: string | null;
  message: string | null;
  limits: EditableLimits | null;
}

// ─── Validation Constants ─────────────────────────────────────

/** Maximum allowed values to prevent accidents */
const MAX_CAPS: Record<keyof EditableLimits, number> = {
  max_ai_generations_per_month: 10000,
  max_creative_assets: 10000,
  max_content_items: 10000,
  max_tasks: 10000,
  max_reels_publishes_per_month: 1000,
};

/** Minimum allowed values (0 = disabled, null = unlimited) */
const MIN_VALUE = 0;

// ─── Helper: Read overrides from metadata ─────────────────────

function readOverrides(metadata: JsonObject): EditableLimits {
  const overrides = (metadata.overrides as JsonObject) ?? {};
  return {
    max_ai_generations_per_month: readNum(overrides, 'max_ai_generations_per_month'),
    max_creative_assets: readNum(overrides, 'max_creative_assets'),
    max_content_items: readNum(overrides, 'max_content_items'),
    max_tasks: readNum(overrides, 'max_tasks'),
    max_reels_publishes_per_month: readNum(overrides, 'max_reels_publishes_per_month'),
  };
}

function readNum(obj: JsonObject, key: string): number | null {
  const val = obj[key];
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

// ─── Validation ───────────────────────────────────────────────

function validateLimits(limits: Partial<EditableLimits>): string | null {
  for (const [key, value] of Object.entries(limits)) {
    if (value === null || value === undefined) continue; // null = unlimited, allowed

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${key} must be a finite number or null.`;
    }

    if (!Number.isInteger(value)) {
      return `${key} must be an integer.`;
    }

    if (value < MIN_VALUE) {
      return `${key} must be at least ${MIN_VALUE}.`;
    }

    const cap = MAX_CAPS[key as keyof EditableLimits];
    if (cap !== undefined && value > cap) {
      return `${key} cannot exceed ${cap}.`;
    }
  }

  return null;
}

// ─── Action: Get Editable Limits ──────────────────────────────

export async function getEditableLimitsAction(): Promise<LimitsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error ?? 'Workspace not found.',
      limits: null,
      plan: null,
      isOverridden: false,
    };
  }

  // Authorization: only owner/admin
  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Attempted to read quota limits without admin role.');
    return {
      error: 'Only workspace owners and admins can view quota limits.',
      limits: null,
      plan: null,
      isOverridden: false,
    };
  }

  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) {
    return { error: 'Database not available.', limits: null, plan: null, isOverridden: false };
  }

  const { data, error } = await supabase
    .from('usage_limits')
    .select('plan, metadata')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle();

  if (error) {
    limitsLog.error('Failed to load usage_limits', {
      workspaceId: context.workspace.id,
      error: error.message,
    });
    return { error: 'Failed to load limits.', limits: null, plan: null, isOverridden: false };
  }

  if (!data) {
    return { error: null, limits: null, plan: 'free', isOverridden: false };
  }

  const metadata = (data.metadata as JsonObject) ?? {};
  const overrides = readOverrides(metadata);
  const isOverridden = Object.values(overrides).some((v) => v !== null);

  return {
    error: null,
    limits: overrides,
    plan: data.plan ?? 'free',
    isOverridden,
  };
}

// ─── Action: Update Workspace Limits ──────────────────────────

export async function updateWorkspaceLimitsAction(
  _state: UpdateLimitsState,
  formData: FormData
): Promise<UpdateLimitsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error ?? 'Workspace not found.',
      message: null,
      limits: null,
    };
  }

  // Authorization: only owner/admin
  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Attempted to update quota limits without admin role.');
    return {
      error: 'Only workspace owners and admins can update quota limits.',
      message: null,
      limits: null,
    };
  }

  // Parse form data
  const rawLimits: Partial<EditableLimits> = {};
  const fields = [
    'max_ai_generations_per_month',
    'max_creative_assets',
    'max_content_items',
    'max_tasks',
    'max_reels_publishes_per_month',
  ] as const;

  for (const field of fields) {
    const raw = formData.get(field);
    if (raw === null || raw === '') {
      rawLimits[field] = null; // null = unlimited (use plan default)
    } else {
      const num = Number(raw);
      rawLimits[field] = num;
    }
  }

  // Validate
  const validationError = validateLimits(rawLimits);
  if (validationError) {
    return { error: validationError, message: null, limits: null };
  }

  // Get current metadata
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) {
    return { error: 'Database not available.', message: null, limits: null };
  }

  const { data: current, error: fetchError } = await supabase
    .from('usage_limits')
    .select('metadata')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle();

  if (fetchError) {
    limitsLog.error('Failed to load current usage_limits', {
      workspaceId: context.workspace.id,
      error: fetchError.message,
    });
    return { error: 'Failed to load current limits.', message: null, limits: null };
  }

  const currentMetadata = (current?.metadata as JsonObject) ?? {};

  // Merge overrides
  const existingOverrides = (currentMetadata.overrides as JsonObject) ?? {};
  const newOverrides: JsonObject = { ...existingOverrides };

  for (const field of fields) {
    if (rawLimits[field] === null || rawLimits[field] === undefined) {
      // Remove override (revert to plan default)
      delete newOverrides[field];
    } else {
      newOverrides[field] = rawLimits[field] as number;
    }
  }

  // Clean up empty overrides
  const hasAnyOverride = Object.keys(newOverrides).length > 0;
  const updatedMetadata: JsonObject = {
    ...currentMetadata,
    ...(hasAnyOverride ? { overrides: newOverrides } : {}),
  };

  if (!hasAnyOverride) {
    delete updatedMetadata.overrides;
  }

  // Update
  const { error: updateError } = await supabase
    .from('usage_limits')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', context.workspace.id);

  if (updateError) {
    limitsLog.error('Failed to update usage_limits', {
      workspaceId: context.workspace.id,
      error: updateError.message,
    });
    return { error: 'Failed to save limits.', message: null, limits: null };
  }

  // Audit log
  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'quota_limits_updated',
    severity: 'info',
    entityType: 'usage_limits',
    message: 'Workspace quota limits updated.',
    metadata: {
      overrides: newOverrides,
      role: context.role,
    },
  });

  limitsLog.info('Workspace quota limits updated', {
    workspaceId: context.workspace.id,
    userId: context.user.id,
    overrides: newOverrides,
  });

  return {
    error: null,
    message: 'Quota limits updated successfully.',
    limits: readOverrides(updatedMetadata),
  };
}

// ─── Action: Reset Limits to Plan Defaults ────────────────────

export async function resetWorkspaceLimitsAction(): Promise<UpdateLimitsState> {
  const context = await getSettingsWorkspaceContext();

  if (context.error || !context.user || !context.workspace) {
    return {
      error: context.error ?? 'Workspace not found.',
      message: null,
      limits: null,
    };
  }

  // Authorization: only owner/admin
  if (!hasPermission(context.role, 'admin')) {
    await denySettingsAction(context, 'Attempted to reset quota limits without admin role.');
    return {
      error: 'Only workspace owners and admins can reset quota limits.',
      message: null,
      limits: null,
    };
  }

  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) {
    return { error: 'Database not available.', message: null, limits: null };
  }

  // Get current metadata
  const { data: current, error: fetchError } = await supabase
    .from('usage_limits')
    .select('metadata')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle();

  if (fetchError) {
    return { error: 'Failed to load current limits.', message: null, limits: null };
  }

  // Remove overrides
  const currentMetadata = (current?.metadata as JsonObject) ?? {};
  const updatedMetadata: JsonObject = { ...currentMetadata };
  delete updatedMetadata.overrides;

  const { error: updateError } = await supabase
    .from('usage_limits')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', context.workspace.id);

  if (updateError) {
    return { error: 'Failed to reset limits.', message: null, limits: null };
  }

  // Audit log
  await logSecurityAuditEvent({
    supabase,
    workspaceId: context.workspace.id,
    userId: context.user.id,
    eventType: 'quota_limits_reset',
    severity: 'info',
    entityType: 'usage_limits',
    message: 'Workspace quota limits reset to plan defaults.',
    metadata: { role: context.role },
  });

  return {
    error: null,
    message: 'Limits reset to plan defaults.',
    limits: {
      max_ai_generations_per_month: null,
      max_creative_assets: null,
      max_content_items: null,
      max_tasks: null,
      max_reels_publishes_per_month: null,
    },
  };
}
