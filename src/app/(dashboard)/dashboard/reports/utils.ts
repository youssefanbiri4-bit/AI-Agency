import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ContentStudioItemWithAssets } from '@/lib/data/content-studio';
import type {
  ContentStudioPublishAttemptRecord,
  ContentStudioStatus,
  CreativeAssetRecord,
} from '@/types/database';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { JsonObject } from '@/types';
import { buildReportSummary } from '@/lib/data/reports';
import { formatDateTime } from '@/lib/utils';
import type { PublishAttemptTimelineItem } from './OperationalReportClient';
import type { OptionalWorkspaceRow, ProviderStatusRow, ReadinessState } from './types';

export const readinessBadgeStatuses: Record<ReadinessState, Parameters<typeof StatusBadge>[0]['status']> = {
  ready: 'ready',
  setup_required: 'setup_required',
  approval_pending: 'approval_pending',
  quota_limit: 'quota_limit',
  token_missing: 'token_missing',
  manual_only: 'manual_only',
  unsupported: 'unsupported',
  error: 'error',
};

export const contentStatuses: ContentStudioStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'failed',
  'setup_required',
  'approval_pending',
];

export const attemptStatuses = [
  'succeeded',
  'failed',
  'setup_required',
  'approval_pending',
  'quota_limit',
  'token_missing',
  'manual_only',
  'unsupported',
  'error',
] as const;

export const reportAgentIds = [
  'campaign-report-agent',
  'task-performance-agent',
  'content-performance-agent',
  'provider-health-report-agent',
  'workflow-usage-report-agent',
] as const;

export function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

export function rowString(row: OptionalWorkspaceRow, key: string, fallback = '') {
  const value = row[key];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

export function rowNullableString(row: OptionalWorkspaceRow, key: string) {
  const value = row[key];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return null;
}

export function rowNumber(row: OptionalWorkspaceRow, key: string, fallback = 0) {
  const value = row[key];
  return typeof value === 'number' ? value : fallback;
}

export function rowBoolean(row: OptionalWorkspaceRow, key: string, fallback = false) {
  const value = row[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function rowStringArray(row: OptionalWorkspaceRow, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function safeText(value: string | null | undefined, fallback = '') {
  const text = value?.trim() || fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key)=([^&\\s]+)/gi, '$1=[redacted]')
    .replace(/(\"(?:access_token|refresh_token|client_secret|api_key|authorization)\"\\s*:\\s*)\"[^\"]+\"/gi, '$1\"[redacted]\"')
    .slice(0, 500);
}

export function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(asset.metadata?.video)
  );
}

export function hasAssetMediaUrl(asset: CreativeAssetRecord) {
  const metadata = readObject(asset.metadata);
  const video = readObject(metadata.video);

  return Boolean(
    asset.image_url ||
      asset.storage_path ||
      safeString(video.public_url) ||
      safeString(video.storage_path)
  );
}

export function isManualOnlyItem(item: ContentStudioItemWithAssets) {
  return item.content_type === 'linkedin_post_planner' || item.provider_status === 'manual_only';
}

export function sanitizeSummary(value: unknown, depth = 0): unknown {
  if (depth > 2) {
    return '[summary truncated]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 4).map((entry) => sanitizeSummary(entry, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('authorization') ||
      normalized.includes('credential')
    ) {
      continue;
    }

    result[key] = sanitizeSummary(entry, depth + 1);
  }

  return result;
}

export function summarizeJson(value: JsonObject | null | undefined) {
  const sanitized = sanitizeSummary(value ?? {});
  const serialized = JSON.stringify(sanitized);
  return serialized === '{}' ? '' : serialized.slice(0, 240);
}

export function getReadinessState(value: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean }) {
  if (value.state) {
    return value.state as ReadinessState;
  }

  if (value.status === 'configured' || value.status === 'ready' || value.isConfigured || value.isReady) {
    return 'ready';
  }

  if (value.status === 'approval_pending') return 'approval_pending';
  if (value.status === 'quota_limit') return 'quota_limit';
  return 'setup_required';
}

export function setupItem(label: string, configured: boolean | null, action: string) {
  return {
    label,
    status: configured === null ? 'needs_review' : configured ? 'present' : 'missing',
    action,
  };
}

export function getPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function safeDashboardHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

export function formatReportAgentPrompt(template: AgentTemplate) {
  return [
    `# ${template.name}`,
    '',
    `Category: ${template.category}`,
    `Execution mode: ${template.execution_mode}`,
    `Safety level: ${template.safety_level}`,
    '',
    '## Purpose',
    template.description,
    '',
    '## Inputs',
    template.inputs.map((input) => `- ${input}`).join('\n'),
    '',
    '## Outputs',
    template.outputs.map((output) => `- ${output}`).join('\n'),
    '',
    '## Suggested Prompt',
    template.suggested_prompt,
    '',
    '## Review Checklist',
    template.review_checklist.map((item) => `- ${item}`).join('\n'),
  ].join('\n');
}

export function mapAttemptTimeline(
  attempts: ContentStudioPublishAttemptRecord[],
  items: ContentStudioItemWithAssets[]
): PublishAttemptTimelineItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));

  return attempts.map((attempt) => {
    const item = attempt.content_item_id ? itemById.get(attempt.content_item_id) : null;
    return {
      id: attempt.id,
      createdAt: attempt.created_at,
      provider: attempt.provider,
      actionType: attempt.action_type,
      contentItemId: attempt.content_item_id,
      contentTitle: item?.title ?? 'Workspace-level attempt',
      contentType: item?.content_type ?? 'unknown',
      status: attempt.status,
      message: safeText(attempt.error_message ?? safeString(attempt.request_summary?.message), ''),
      externalId: attempt.provider_external_id,
      safeSummary: summarizeJson(attempt.provider_response_summary),
    };
  });
}

export function buildReportText(input: {
  contentCounts: Record<string, number>;
  attemptCounts: Record<string, number>;
  providers: ProviderStatusRow[];
  schedulerLine: string;
  creativeAssets: {
    total: number;
    images: number;
    videos: number;
    linked: number;
    unlinked: number;
    missingMedia: number;
  };
  taskStats: ReturnType<typeof buildReportSummary>['taskStats'];
  externalBlockers: string[];
}) {
  return [
    '# AgentFlow AI Operational Report',
    '',
    '## Content Counts',
    ...Object.entries(input.contentCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Publish Attempts',
    ...Object.entries(input.attemptCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Provider Readiness',
    ...input.providers.map((provider) => `- ${provider.name}: ${provider.status} (${provider.nextAction})`),
    '',
    '## Scheduler',
    `- ${input.schedulerLine}`,
    '',
    '## Creative Assets',
    `- total: ${input.creativeAssets.total}`,
    `- images: ${input.creativeAssets.images}`,
    `- videos: ${input.creativeAssets.videos}`,
    `- linked: ${input.creativeAssets.linked}`,
    `- unlinked: ${input.creativeAssets.unlinked}`,
    `- missing media URL: ${input.creativeAssets.missingMedia}`,
    '',
    '## Tasks & Reviews',
    `- total tasks: ${input.taskStats.total}`,
    `- pending: ${input.taskStats.pending}`,
    `- processing: ${input.taskStats.processing}`,
    `- needs_review: ${input.taskStats.needsReview}`,
    `- completed: ${input.taskStats.completed}`,
    `- failed: ${input.taskStats.failed}`,
    '',
    '## External Setup Checklist',
    ...(input.externalBlockers.length > 0
      ? input.externalBlockers.map((blocker) => `- ${blocker}`)
      : ['- None detected in operational reporting.']),
  ].join('\n');
}
