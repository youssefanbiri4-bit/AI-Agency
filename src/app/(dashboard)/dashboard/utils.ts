import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type {
  ContentStudioPublishAttemptRecord,
  CreativeAssetRecord,
  ProjectRecord,
  ReleaseRecord,
} from '@/types/database';
import type { Task } from '@/types';
import { logger } from '@/lib/logger';
import { formatDateTime } from '@/lib/utils';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';
import { getCurrentUsage, getUsageLimits } from '@/lib/usage/quotas';
import {
  contentStatuses,
  readinessBadgeStatuses,
  countBy,
  readObject,
  safeString,
  isVideoAsset,
  isManualOnlyItem,
  getReadinessState,
  getMetaEnvironmentMissing,
  getMetaProviderState,
  getGoogleAdsProviderState,
  getPinterestProviderState,
  fallbackProviderReadiness,
} from '@/lib/dashboard-shared';

export {
  contentStatuses,
  readinessBadgeStatuses,
  countBy,
  readObject,
  safeString,
  isVideoAsset,
  isManualOnlyItem,
  getReadinessState,
  getMetaEnvironmentMissing,
  getMetaProviderState,
  getGoogleAdsProviderState,
  getPinterestProviderState,
  fallbackProviderReadiness,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

export interface ProviderRow {
  name: string;
  status: ReadinessState;
  nextAction: string;
}

export interface TodayAction {
  id: string;
  title: string;
  reason: string;
  href: string;
  status: Parameters<typeof StatusBadge>[0]['status'];
  cta: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DASHBOARD_SECTION_TIMEOUT_MS = 3500;
export const DASHBOARD_PROVIDER_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const dashboardPageLog = logger.child('dashboard:page');

export function traceWorkspace(message: string, details?: Record<string, unknown>) {
  if (details) {
    dashboardPageLog.info(message, details);
    return;
  }
  dashboardPageLog.info(message);
}

// ---------------------------------------------------------------------------
// Dashboard data helpers
// ---------------------------------------------------------------------------

export function buildEmptyDashboardData() {
  return {
    agents: [],
    departments: [],
    tasks: [],
    events: [],
    agentStats: { total: 0, notConnected: 0 },
    taskStats: { total: 0, draft: 0, pending: 0, processing: 0, needsReview: 0, completed: 0, failed: 0, cancelled: 0 },
  };
}

export function dashboardFallbackResult<T>(data: T, error: string | null = null): DataResult<T> {
  return error ? errorDataResult(data, error) : emptyDataResult(data, true);
}

export function timeoutMessage(sectionName: string) {
  return `${sectionName} did not respond quickly enough. Showing a safe fallback.`;
}

export async function withDashboardTimeout<T>(
  sectionName: string,
  promise: Promise<T>,
  timeoutMs = DASHBOARD_SECTION_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();
  traceWorkspace(`before ${sectionName}`);
  const guardedPromise = promise.catch((error: unknown) => {
    dashboardPageLog.warn(`failed ${sectionName}`, { error: error instanceof Error ? error.message : String(error) });
    throw error;
  });
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      dashboardPageLog.warn(`timeout ${sectionName}`, {
        durationMs: Date.now() - startedAt,
      });
      reject(new Error(timeoutMessage(sectionName)));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([guardedPromise, timeout]);
    traceWorkspace(`after ${sectionName}`, { durationMs: Date.now() - startedAt });
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function settledDataResult<T>(
  result: PromiseSettledResult<DataResult<T>>,
  fallbackData: T,
  sectionName: string
): DataResult<T> {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  return dashboardFallbackResult(fallbackData, timeoutMessage(sectionName));
}

// ---------------------------------------------------------------------------
// General utility helpers
// ---------------------------------------------------------------------------

export function buildProjectSnapshot(projects: ProjectRecord[]) {
  return {
    total: projects.length,
    active: projects.filter((project) => project.status === 'active').length,
    readyToDeploy: projects.filter((project) => project.status === 'ready_to_deploy').length,
    deployed: projects.filter((project) => project.status === 'deployed').length,
    latest: projects[0] ?? null,
  };
}

export function buildReleaseSnapshot(releases: ReleaseRecord[]) {
  return {
    total: releases.length,
    deployed: releases.filter((release) => release.status === 'deployed').length,
    failed: releases.filter((release) => release.status === 'failed').length,
    readyToDeploy: releases.filter((release) => release.status === 'ready_to_deploy').length,
    latest: releases[0] ?? null,
  };
}

export function isDueSoon(value: string | null) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();
  return timestamp <= now + 24 * 60 * 60 * 1000;
}

export function formatActionType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function hasMediaUrl(asset: CreativeAssetRecord) {
  const metadata = readObject(asset.metadata);
  const video = readObject(metadata.video);
  return Boolean(asset.image_url || asset.storage_path || safeString(video.public_url));
}

// ---------------------------------------------------------------------------
// Action builder
// ---------------------------------------------------------------------------

export function buildTodayActions({
  contentItems,
  tasks,
  unlinkedAssets,
}: {
  contentItems: ContentStudioItemWithAssets[];
  tasks: Task[];
  unlinkedAssets: CreativeAssetRecord[];
}) {
  const actions: TodayAction[] = [];

  for (const item of contentItems.filter((candidate) => candidate.status === 'ready').slice(0, 3)) {
    actions.push({
      id: `ready-${item.id}`,
      title: item.title,
      reason: 'Content is ready for the next publish or draft action.',
      href: `/dashboard/content-studio?item=${item.id}`,
      status: 'ready',
      cta: 'Open item',
    });
  }

  for (const item of contentItems.filter((candidate) => candidate.status === 'scheduled' && isDueSoon(candidate.schedule_at)).slice(0, 3)) {
    actions.push({
      id: `scheduled-${item.id}`,
      title: item.title,
      reason: item.schedule_at ? `Scheduled for ${formatDateTime(item.schedule_at)}` : 'Scheduled item needs timing review.',
      href: `/dashboard/content-studio?item=${item.id}`,
      status: 'scheduled',
      cta: 'Review schedule',
    });
  }

  for (const item of contentItems.filter((candidate) => ['failed', 'setup_required', 'approval_pending'].includes(candidate.status)).slice(0, 4)) {
    actions.push({
      id: `blocked-${item.id}`,
      title: item.title,
      reason: item.provider_error || `Item is ${item.status.replace(/_/g, ' ')}.`,
      href: `/dashboard/content-studio?item=${item.id}`,
      status: item.status,
      cta: 'Fix item',
    });
  }

  for (const task of tasks.filter((candidate) => candidate.status === 'needs_review').slice(0, 4)) {
    actions.push({
      id: `review-${task.id}`,
      title: task.title,
      reason: 'Task needs manager review before it can move forward.',
      href: `/dashboard/tasks/${task.id}`,
      status: 'needs_review',
      cta: 'Review task',
    });
  }

  for (const asset of unlinkedAssets.slice(0, 2)) {
    actions.push({
      id: `asset-${asset.id}`,
      title: asset.title,
      reason: hasMediaUrl(asset) ? 'Creative asset is not linked to any content item.' : 'Creative asset is missing a usable media URL.',
      href: `/dashboard/creative-assets/${asset.id}`,
      status: hasMediaUrl(asset) ? 'manual_only' : 'setup_required',
      cta: 'Open asset',
    });
  }

  return actions.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function listRecentPublishAttempts(workspaceId: string) {
  const { getSupabaseAdmin } = await import('@/lib/supabase-server');
  const { client, error } = getSupabaseAdmin(DASHBOARD_PROVIDER_TIMEOUT_MS);

  if (!client) {
    return {
      data: [] as ContentStudioPublishAttemptRecord[],
      error: error ?? 'Supabase admin client is not configured.',
    };
  }

  const { data, error: selectError } = await client
    .from('content_studio_publish_attempts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(6);

  return {
    data: (data ?? []) as ContentStudioPublishAttemptRecord[],
    error: selectError?.message ?? null,
  };
}

// ---------------------------------------------------------------------------
// Usage & Limits widget
// ---------------------------------------------------------------------------

export interface UsageWidgetItem {
  type: string;
  current: number;
  limit: number | null;
  percent: number;
  label: string;
}

export interface UsageWidgetData {
  plan: string;
  quotas: UsageWidgetItem[];
}

export async function getUsageWidgetData(workspaceId: string): Promise<UsageWidgetData> {
  const [usage, limits] = await Promise.all([
    getCurrentUsage(workspaceId),
    getUsageLimits(workspaceId),
  ]);

  const planLabel = limits.plan === 'free'
    ? 'Internal Free Tier'
    : limits.plan === 'agency'
      ? 'Agency'
      : limits.plan.charAt(0).toUpperCase() + limits.plan.slice(1);

  const items: Array<{
    type: string;
    label: string;
    current: number;
    limit: number | null;
  }> = [
    { type: 'ai_generations', label: 'AI Generations', current: usage.ai_generations, limit: limits.max_ai_generations_per_month },
    { type: 'tasks', label: 'Tasks', current: usage.tasks, limit: limits.max_tasks },
    { type: 'creative_assets', label: 'Assets', current: usage.creative_assets, limit: limits.max_creative_assets },
    { type: 'content_publishes', label: 'Publishes', current: usage.content_publishes, limit: limits.max_content_items },
  ];

  const quotas: UsageWidgetItem[] = items.map((item) => ({
    ...item,
    percent: item.limit === null ? 0 : Math.min(100, Math.round((item.current / item.limit) * 100)),
  }));

  return { plan: planLabel, quotas };
}
