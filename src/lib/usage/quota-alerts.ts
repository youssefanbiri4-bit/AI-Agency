/**
 * Quota Alert System
 *
 * Sends in-app notifications when workspace quotas reach warning (80%) or critical (95%) levels.
 * Also dispatches external alerts (Slack, Email) if configured.
 * Implements debounce logic to avoid spam: once per threshold per workspace per quota type per hour.
 *
 * Integration point: called from incrementUsage() in quotas.ts after a successful increment.
 */

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import { dispatchAlert } from '@/lib/alerts';
import type { QuotaType } from '@/lib/usage/quotas';

const alertLog = logger.child('usage:quota-alerts');

// Threshold constants
export const WARNING_THRESHOLD = 80;
export const CRITICAL_THRESHOLD = 95;

// Debounce: minimum time (ms) between alerts for the same workspace+type+threshold
const DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour

// In-memory debounce cache: key = `${workspaceId}:${type}:${threshold}` -> last alert timestamp
const alertCache = new Map<string, number>();

function getCacheKey(workspaceId: string, type: QuotaType, threshold: number): string {
  return `${workspaceId}:${type}:${threshold}`;
}

function shouldSendAlert(workspaceId: string, type: QuotaType, threshold: number): boolean {
  const key = getCacheKey(workspaceId, type, threshold);
  const lastAlert = alertCache.get(key);
  const now = Date.now();

  if (lastAlert && now - lastAlert < DEBOUNCE_MS) {
    return false;
  }

  alertCache.set(key, now);
  return true;
}

/**
 * Human-readable label for quota types.
 */
function getQuotaLabel(type: QuotaType): string {
  const labels: Record<QuotaType, string> = {
    ai_generations: 'AI Generations',
    tasks: 'Tasks',
    creative_assets: 'Creative Assets',
    content_items: 'Content Items',
    content_publishes: 'Content Publishes',
    reels_publishes: 'Reel Publishes',
    paid_ads_spend: 'Paid Ads Spend',
    cost_usd: 'Estimated Cost',
  };
  return labels[type] ?? type;
}

/**
 * Get the workspace owner or admin user ID for sending notifications.
 * Queries workspace_members for the first owner or admin.
 */
async function getWorkspaceNotifyUserId(
  workspaceId: string,
  supabase: ReturnType<typeof getSupabaseAdmin>['client']
): Promise<string | null> {
  if (!supabase) return null;

  // Try owner first, then admin
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true }) // 'owner' < 'admin' alphabetically
    .limit(1);

  if (error || !members || members.length === 0) {
    return null;
  }

  return members[0].user_id;
}

/**
 * Send a quota alert notification to the workspace owner/admin.
 *
 * Uses the Supabase admin client to insert a notification row.
 * Falls back gracefully if notification creation fails (alerts are best-effort).
 */
async function sendQuotaNotification(input: {
  workspaceId: string;
  type: QuotaType;
  threshold: 'warning' | 'critical';
  current: number;
  limit: number;
  percentUsed: number;
}): Promise<void> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) {
    alertLog.warn('Supabase not configured, skipping quota alert', {
      workspaceId: input.workspaceId,
      type: input.type,
    });
    return;
  }

  // Get the workspace owner/admin to notify
  const userId = await getWorkspaceNotifyUserId(input.workspaceId, supabase);
  if (!userId) {
    alertLog.warn('No workspace owner/admin found for quota alert', {
      workspaceId: input.workspaceId,
      type: input.type,
    });
    return;
  }

  const severity = input.threshold === 'critical' ? 'critical' : 'warning';
  const notificationType = input.threshold === 'critical' ? 'quota_critical' : 'quota_warning';
  const label = getQuotaLabel(input.type);

  const title =
    input.threshold === 'critical'
      ? `${label} quota critical`
      : `${label} quota warning`;

  const message =
    input.threshold === 'critical'
      ? `${label} usage has reached ${input.percentUsed}% (${input.current}/${input.limit}). Operations may be blocked soon.`
      : `${label} usage is at ${input.percentUsed}% (${input.current}/${input.limit}). Consider reducing usage.`;

  try {
    const { error } = await supabase.from('notifications').insert({
      workspace_id: input.workspaceId,
      user_id: userId,
      type: notificationType,
      severity,
      title,
      message,
      status: 'unread',
      related_url: '/dashboard/usage',
      metadata: {
        quota_type: input.type,
        threshold: input.threshold,
        current: input.current,
        limit: input.limit,
        percent_used: input.percentUsed,
      },
    });

    if (error) {
      alertLog.error('Failed to create quota alert notification', {
        workspaceId: input.workspaceId,
        type: input.type,
        threshold: input.threshold,
        error: error.message,
      });
    } else {
      alertLog.info('Quota alert notification created', {
        workspaceId: input.workspaceId,
        type: input.type,
        threshold: input.threshold,
        percentUsed: input.percentUsed,
      });
    }
  } catch (err) {
    alertLog.error('Unexpected error creating quota alert', {
      workspaceId: input.workspaceId,
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Also dispatch external alerts (Slack, Email) — non-blocking
  dispatchAlert({
    title,
    message,
    severity: input.threshold === 'critical' ? 'critical' : 'warning',
    source: 'quota',
    workspaceId: input.workspaceId,
    relatedUrl: '/dashboard/usage',
    metadata: {
      quota_type: input.type,
      current: input.current,
      limit: input.limit,
      percent_used: input.percentUsed,
    },
  }).catch((err) => {
    alertLog.warn('External alert dispatch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Check quota usage and send alerts if thresholds are crossed.
 *
 * Call this after incrementing usage to notify the team when quotas approach limits.
 * Safe to call: errors are caught and logged, never thrown.
 *
 * @param workspaceId - The workspace to check
 * @param type - The quota type that was incremented
 * @param current - Current usage count after increment
 * @param limit - The quota limit (null = unlimited, skip alerts)
 */
export async function checkAndSendQuotaAlert(
  workspaceId: string,
  type: QuotaType,
  current: number,
  limit: number | null
): Promise<void> {
  // No alerts for unlimited quotas
  if (limit === null || limit <= 0) {
    return;
  }

  const percentUsed = Math.min(100, Math.round((current / limit) * 100));

  // Check critical threshold first (95%)
  if (percentUsed >= CRITICAL_THRESHOLD) {
    if (shouldSendAlert(workspaceId, type, CRITICAL_THRESHOLD)) {
      await sendQuotaNotification({
        workspaceId,
        type,
        threshold: 'critical',
        current,
        limit,
        percentUsed,
      });
    }
    return; // If critical, don't also send warning
  }

  // Check warning threshold (80%)
  if (percentUsed >= WARNING_THRESHOLD) {
    if (shouldSendAlert(workspaceId, type, WARNING_THRESHOLD)) {
      await sendQuotaNotification({
        workspaceId,
        type,
        threshold: 'warning',
        current,
        limit,
        percentUsed,
      });
    }
  }
}

/**
 * Clear the debounce cache (for testing or cache invalidation).
 */
export function clearAlertCache(): void {
  alertCache.clear();
}
