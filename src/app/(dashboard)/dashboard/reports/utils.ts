import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type {
  ContentStudioPlatform,
  ContentStudioPublishAttemptRecord,
  CreativeAssetRecord,
} from '@/types/database';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { JsonObject, TaskReview } from '@/types';
import type { Task } from '@/types';
import type { ProjectRecord, ReleaseRecord } from '@/types/database';
import { buildReportSummary } from '@/features/reports/data/reports';
import type { PublishAttemptTimelineItem } from './OperationalReportClient';
import type { OptionalWorkspaceRow, ProviderStatusRow, MetricCard } from './types';
import type { MonthlyProviderStatus } from './MonthlyAgencyReportClient';
import type { AdvancedAnalyticsData } from './AdvancedAnalyticsClient';
import type { SystemHealthSummary } from '@/lib/data/system-health';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Layers3,
  RadioTower,
} from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Data transformation helpers
// ---------------------------------------------------------------------------

export function buildTopMetrics(input: {
  contentItemsLength: number;
  contentStatusCounts: Record<string, number>;
  projectsLength: number;
  activeProviders: number;
}): MetricCard[] {
  return [
    {
      label: 'Total Content Items',
      value: input.contentItemsLength,
      helper: 'Current workspace records',
      icon: Layers3,
      accent: 'bg-[#D5E5E5] text-[#F7CBCA]',
    },
    {
      label: 'Published',
      value: input.contentStatusCounts.published,
      helper: 'Provider-confirmed only',
      icon: CheckCircle2,
      accent: 'bg-[#5D6B6B] text-[#D5E5E5]',
    },
    {
      label: 'Scheduled',
      value: input.contentStatusCounts.scheduled,
      helper: 'Pending execution windows',
      icon: CalendarClock,
      accent: 'bg-[#E7F5DC]/28 text-[#8A4300]',
    },
    {
      label: 'Failed / Setup Required',
      value: (input.contentStatusCounts.failed ?? 0) + (input.contentStatusCounts.setup_required ?? 0),
      helper: 'Needs operator review',
      icon: AlertTriangle,
      accent: 'bg-[#F7CBCA]/14 text-[#B51F30]',
    },
    {
      label: 'Total Projects',
      value: input.projectsLength,
      helper: 'Internal project records',
      icon: FolderKanban,
      accent: 'bg-[#D5E5E5] text-[#F7CBCA]',
    },
    {
      label: 'Active Providers',
      value: input.activeProviders,
      helper: 'Ready operational services',
      icon: RadioTower,
      accent: 'bg-[#F7CBCA]/10 text-[#F7CBCA]',
    },
  ];
}

export function buildPlatformCounts(contentItems: ContentStudioItemWithAssets[]): Array<[ContentStudioPlatform, string, number]> {
  return [
    ['instagram', 'Instagram', contentItems.filter((item) => item.platform === 'instagram').length],
    ['facebook', 'Facebook', contentItems.filter((item) => item.platform === 'facebook').length],
    ['google_ads', 'Google Ads', contentItems.filter((item) => item.platform === 'google_ads').length],
    ['pinterest', 'Pinterest', contentItems.filter((item) => item.platform === 'pinterest').length],
    ['linkedin', 'LinkedIn', contentItems.filter((item) => item.platform === 'linkedin').length],
  ];
}

export function buildProviderStatuses(input: {
  openAIReadiness: { isReady: boolean; message: string };
  facebookReadiness: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean; missing?: string[] } | null | undefined;
  instagramReadiness: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean; missing?: string[] } | null | undefined;
  selectedPage: string | null;
  selectedInstagram: string | null;
  selectedMetaAdAccount: string | null;
  googleProviderReadiness: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean } | null | undefined;
  googleAdsReadiness: { isConfigured: boolean; missingEnvironmentVariables: string[]; state?: string; status?: string };
  googleConnection: { status: string } | null;
  pinterestProviderReadiness: { state?: string; status?: string; isConfigured?: boolean; isReady?: boolean; details?: { selectedBoardName?: string } } | null | undefined;
  pinterestReadiness: { isConfigured: boolean; missingEnvironmentVariables: string[]; state?: string; status?: string };
  selectedPinterestBoard: string | null;
  schedulerReadiness: { isConfigured: boolean; cronSecretConfigured: boolean; message: string; routePath: string; recommendedSchedule: string };
}): MonthlyProviderStatus[] {
  return [
    {
      name: 'OpenAI',
      status: getReadinessState(input.openAIReadiness),
      missing: [],
      nextAction: input.openAIReadiness.message,
    },
    {
      name: 'Meta / Instagram / Facebook',
      status: getReadinessState(input.facebookReadiness ?? input.instagramReadiness ?? {}),
      missing: [
        ...(input.facebookReadiness?.missing ?? []),
        ...(input.instagramReadiness?.missing ?? []),
        ...(input.selectedPage ? [] : ['Selected Facebook Page']),
        ...(input.selectedInstagram ? [] : ['Selected Instagram account']),
        ...(input.selectedMetaAdAccount ? [] : ['Selected Meta Ad Account']),
      ],
      nextAction: input.selectedPage || input.selectedInstagram
        ? 'Review scopes, selected page, Instagram account, and Meta Ad Account.'
        : 'Connect Meta and select Facebook/Instagram publishing targets.',
    },
    {
      name: 'Google Ads',
      status: getReadinessState(input.googleProviderReadiness ?? input.googleAdsReadiness),
      missing: [
        ...input.googleAdsReadiness.missingEnvironmentVariables,
        ...(input.googleConnection?.status === 'connected' ? [] : ['Google Ads OAuth connection']),
      ],
      nextAction: input.googleAdsReadiness.isConfigured
        ? 'Confirm OAuth, customer ID, and developer token approval before paused drafts.'
        : 'Add Google Ads env vars and complete OAuth.',
    },
    {
      name: 'Pinterest',
      status: getReadinessState(input.pinterestProviderReadiness ?? input.pinterestReadiness),
      missing: [
        ...input.pinterestReadiness.missingEnvironmentVariables,
        ...(input.selectedPinterestBoard ? [] : ['Pinterest board selection']),
      ],
      nextAction: input.selectedPinterestBoard
        ? 'Pinterest board is selected; verify OAuth remains connected.'
        : 'Complete Pinterest OAuth and select a board.',
    },
    {
      name: 'LinkedIn',
      status: 'manual_only',
      missing: [],
      nextAction: 'Manual-only copy workflow. No LinkedIn publishing API is enabled.',
    },
    {
      name: 'Scheduler',
      status: input.schedulerReadiness.isConfigured ? 'ready' : 'setup_required',
      missing: input.schedulerReadiness.cronSecretConfigured ? [] : ['CRON_SECRET', 'Vercel Cron'],
      nextAction: input.schedulerReadiness.message,
    },
  ];
}

export function buildSetupChecklist(input: {
  selectedPage: string | null;
  selectedInstagram: string | null;
  googleConnection: { status: string } | null;
  pinterestReadiness: { missingEnvironmentVariables: string[] };
  selectedPinterestBoard: string | null;
  schedulerReadiness: { cronSecretConfigured: boolean; message: string; routePath: string; recommendedSchedule: string };
}) {
  return [
    setupItem('META_APP_ID', Boolean(process.env.META_APP_ID?.trim()), 'Required for Meta OAuth.'),
    setupItem('META_APP_SECRET', Boolean(process.env.META_APP_SECRET?.trim()), 'Required server-side for Meta OAuth.'),
    setupItem('META_REDIRECT_URI', Boolean(process.env.META_REDIRECT_URI?.trim()), 'Required for Meta OAuth callbacks.'),
    setupItem('AD_TOKEN_ENCRYPTION_KEY', Boolean(process.env.AD_TOKEN_ENCRYPTION_KEY?.trim()), 'Required for encrypted provider tokens.'),
    setupItem('Selected Facebook Page', Boolean(input.selectedPage), 'Select in Provider Settings.'),
    setupItem('Selected Instagram account', Boolean(input.selectedInstagram), 'Select in Provider Settings.'),
    setupItem('Google Ads developer token approval', null, 'Requires external approval review.'),
    setupItem('Google Ads OAuth/customer ID', input.googleConnection?.status === 'connected', 'Connect OAuth and select a customer ID.'),
    setupItem('Pinterest app secret', !input.pinterestReadiness.missingEnvironmentVariables.includes('PINTEREST_APP_SECRET'), 'Required for Pinterest OAuth.'),
    setupItem('Pinterest OAuth/board', Boolean(input.selectedPinterestBoard), 'Connect Pinterest and select a board.'),
    setupItem('CRON_SECRET', input.schedulerReadiness.cronSecretConfigured, input.schedulerReadiness.message),
    setupItem('Vercel Cron', null, `${input.schedulerReadiness.routePath} / ${input.schedulerReadiness.recommendedSchedule}`),
    setupItem('Supabase Storage bucket creative-assets', null, 'Verify bucket and public media URL policy.'),
  ];
}

export function buildAdvancedAnalyticsData(ctx: {
  workspaceName: string;
  contentItems: ContentStudioItemWithAssets[];
  publishAttempts: ContentStudioPublishAttemptRecord[];
  tasks: Task[];
  reviews: TaskReview[];
  projects: ProjectRecord[];
  releases: ReleaseRecord[];
  creativeAssets: CreativeAssetRecord[];
  promptLibraryRows: OptionalWorkspaceRow[];
  backupRows: OptionalWorkspaceRow[];
  securityLogRows: OptionalWorkspaceRow[];
  safePatchPlanRows: OptionalWorkspaceRow[];
  codeFixProposalRows: OptionalWorkspaceRow[];
  githubIssueLinkRows: OptionalWorkspaceRow[];
  pullRequestReviewRows: OptionalWorkspaceRow[];
  notificationRows: OptionalWorkspaceRow[];
  providerStatuses: MonthlyProviderStatus[];
  systemHealth: SystemHealthSummary | null;
  schedulerConfigured: boolean;
  schedulerLine: string;
  optionalWarnings: string[];
}): AdvancedAnalyticsData {
  const assetIdsInUse = new Set(ctx.contentItems.flatMap((item) => item.asset_ids));

  return {
    workspaceName: ctx.workspaceName,
    generatedAt: new Date().toISOString(),
    contentItems: ctx.contentItems.map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      content_type: item.content_type,
      status: item.status,
      provider_status: item.provider_status,
      provider_error: safeText(item.provider_error, ''),
      schedule_at: item.schedule_at,
      published_at: item.published_at,
      scheduled_execution_status: item.scheduled_execution_status,
      scheduled_execution_error: safeText(item.scheduled_execution_error, ''),
      scheduled_execution_started_at: item.scheduled_execution_started_at,
      scheduled_execution_finished_at: item.scheduled_execution_finished_at,
      scheduled_execution_attempts: item.scheduled_execution_attempts,
      asset_ids: item.asset_ids,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    publishAttempts: ctx.publishAttempts.map((attempt) => {
      const item = ctx.contentItems.find((candidate) => candidate.id === attempt.content_item_id);
      return {
        id: attempt.id,
        provider: attempt.provider,
        action_type: attempt.action_type,
        status: attempt.status,
        content_item_id: attempt.content_item_id,
        content_title: item?.title ?? 'Workspace-level attempt',
        safe_message: safeText(attempt.error_message ?? safeString(attempt.request_summary?.message), ''),
        external_id: attempt.provider_external_id,
        created_at: attempt.created_at,
        updated_at: attempt.updated_at,
      };
    }),
    tasks: ctx.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      agent_type: task.agent_type,
      status: task.status,
      priority: task.priority,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
    })),
    reviewsCount: ctx.reviews.length,
    projects: ctx.projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      github_url: project.github_url,
      production_url: project.production_url,
      updated_at: project.updated_at,
      created_at: project.created_at,
    })),
    releases: ctx.releases.map((release) => ({
      id: release.id,
      title: release.title,
      status: release.status,
      release_type: release.release_type,
      known_issues: release.known_issues,
      build_status: release.build_status,
      lint_status: release.lint_status,
      typecheck_status: release.typecheck_status,
      deploy_status: release.deploy_status,
      deploy_url: release.deploy_url,
      created_at: release.created_at,
      updated_at: release.updated_at,
    })),
    prompts: ctx.promptLibraryRows.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Untitled prompt'),
      category: rowString(row, 'category', 'uncategorized'),
      target_tool: rowNullableString(row, 'target_tool'),
      is_favorite: rowBoolean(row, 'is_favorite'),
      usage_count: rowNumber(row, 'usage_count'),
      last_used_at: rowNullableString(row, 'last_used_at'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    creativeAssets: ctx.creativeAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      asset_type: asset.asset_type,
      status: asset.status,
      has_media: hasAssetMediaUrl(asset),
      is_video: isVideoAsset(asset),
      is_linked: assetIdsInUse.has(asset.id) || Boolean(asset.linked_reel_id || asset.linked_task_id || asset.linked_campaign_task_id),
      created_at: asset.created_at,
      updated_at: asset.updated_at,
    })),
    providers: ctx.providerStatuses.map((provider) => ({
      name: provider.name,
      status: provider.status,
      missing: provider.missing,
      nextAction: provider.nextAction,
    })),
    backups: ctx.backupRows.map((row) => ({
      id: rowString(row, 'id'),
      categories: rowStringArray(row, 'categories'),
      status: rowString(row, 'status', 'created'),
      warnings: rowNullableString(row, 'warnings'),
      created_at: rowString(row, 'created_at'),
    })),
    securityLogs: ctx.securityLogRows.map((row) => ({
      id: rowString(row, 'id'),
      event_type: rowString(row, 'event_type', 'security_event'),
      severity: rowString(row, 'severity', 'info'),
      title: safeText(rowNullableString(row, 'message'), rowString(row, 'event_type', 'Security event')),
      created_at: rowString(row, 'created_at'),
    })),
    safePatchPlans: ctx.safePatchPlanRows.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Safe patch plan'),
      status: rowString(row, 'status', 'draft'),
      risk_level: rowString(row, 'risk_level', 'medium'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    codeFixProposals: ctx.codeFixProposalRows.map((row) => ({
      id: rowString(row, 'id'),
      title: rowString(row, 'title', 'Code fix proposal'),
      issue_type: rowString(row, 'issue_type', 'unknown'),
      severity: rowString(row, 'severity', 'medium'),
      status: rowString(row, 'status', 'draft'),
      created_at: rowString(row, 'created_at'),
      updated_at: rowString(row, 'updated_at'),
    })),
    githubIssueLinks: ctx.githubIssueLinkRows.map((row) => ({
      id: rowString(row, 'id'),
      github_issue_number: rowNumber(row, 'github_issue_number'),
      github_issue_title: rowNullableString(row, 'github_issue_title'),
      github_issue_state: rowNullableString(row, 'github_issue_state'),
      created_at: rowString(row, 'created_at'),
    })),
    pullRequestReviews: ctx.pullRequestReviewRows.map((row) => ({
      id: rowString(row, 'id'),
      pr_number: rowNumber(row, 'pr_number'),
      pr_title: rowNullableString(row, 'pr_title'),
      risk_level: rowString(row, 'risk_level', 'medium'),
      recommendation: rowString(row, 'recommendation', 'needs_manual_review'),
      created_at: rowString(row, 'created_at'),
    })),
    notifications: ctx.notificationRows.map((row) => ({
      id: rowString(row, 'id'),
      type: rowString(row, 'type', 'notification'),
      severity: rowString(row, 'severity', 'info'),
      title: safeText(rowNullableString(row, 'title'), 'Notification'),
      status: rowString(row, 'status', 'unread'),
      created_at: rowString(row, 'created_at'),
    })),
    systemHealth: ctx.systemHealth
      ? {
          score: ctx.systemHealth.score,
          label: ctx.systemHealth.label,
          criticalBlockers: ctx.systemHealth.metrics.recovery.criticalBlockers,
          needsSetup: ctx.systemHealth.badges.needsSetup,
          topActions: ctx.systemHealth.actions.slice(0, 3).map((action) => ({
            id: action.id,
            title: action.title,
            href: action.href,
          })),
        }
      : null,
    schedulerConfigured: ctx.schedulerConfigured,
    schedulerLine: ctx.schedulerLine,
    optionalWarnings: ctx.optionalWarnings,
  };
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
