import { formatDateTime } from '@/lib/utils';
import type {
  AdvancedAnalyticsContentItem,
  AdvancedAnalyticsPublishAttempt,
  AdvancedAnalyticsTask,
  AdvancedAnalyticsProject,
  AdvancedAnalyticsRelease,
  AdvancedAnalyticsPrompt,
  AdvancedAnalyticsAsset,
  AdvancedAnalyticsProvider,
  AdvancedAnalyticsBackup,
  AdvancedAnalyticsSecurityLog,
  AdvancedAnalyticsSafePatchPlan,
  AdvancedAnalyticsCodeFixProposal,
  AdvancedAnalyticsGitHubIssueLink,
  AdvancedAnalyticsPullRequestReview,
  AdvancedAnalyticsNotification,
  AdvancedAnalyticsSystemHealth,
  DateRangeFilter,
  StatusFilter,
  NextAction,
  FilteredData,
} from './analytics-types';

export function rangeStart(range: DateRangeFilter) {
  const now = new Date();
  if (range === 'all_time') return null;
  if (range === 'this_month') return new Date(now.getFullYear(), now.getMonth(), 1);

  const days = range === 'last_7_days' ? 7 : range === 'last_30_days' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function inRange(dateValue: string | null | undefined, range: DateRangeFilter) {
  const start = rangeStart(range);
  if (!start) return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  return !Number.isNaN(date.getTime()) && date >= start;
}

export function itemMatchesStatus(item: AdvancedAnalyticsContentItem, status: StatusFilter) {
  if (status === 'all') return true;
  if (status === 'manual_only') {
    return item.provider_status === 'manual_only' || item.content_type === 'linkedin_post_planner';
  }
  return item.status === status || item.provider_status === status || item.scheduled_execution_status === status;
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function topEntries(counts: Record<string, number>, limit = 6) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function label(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function safeDashboardHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

export function providerKey(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized.includes('google')) return 'Google Ads';
  if (normalized.includes('instagram')) return 'Meta / Instagram / Facebook';
  if (normalized.includes('facebook') || normalized.includes('meta')) return 'Meta / Instagram / Facebook';
  if (normalized.includes('pinterest')) return 'Pinterest';
  if (normalized.includes('linkedin')) return 'LinkedIn';
  if (normalized.includes('scheduler')) return 'Scheduler';
  if (normalized.includes('github')) return 'GitHub';
  if (normalized.includes('openai')) return 'OpenAI';
  return label(provider);
}

export function safeMarkdownLine(value: string | null | undefined) {
  return (value || 'None').replace(/\s+/g, ' ').slice(0, 220);
}

export function filterData(
  data: {
    contentItems: AdvancedAnalyticsContentItem[];
    publishAttempts: AdvancedAnalyticsPublishAttempt[];
    tasks: AdvancedAnalyticsTask[];
    projects: AdvancedAnalyticsProject[];
    releases: AdvancedAnalyticsRelease[];
    prompts: AdvancedAnalyticsPrompt[];
    creativeAssets: AdvancedAnalyticsAsset[];
    backups: AdvancedAnalyticsBackup[];
    securityLogs: AdvancedAnalyticsSecurityLog[];
    safePatchPlans: AdvancedAnalyticsSafePatchPlan[];
    codeFixProposals: AdvancedAnalyticsCodeFixProposal[];
    githubIssueLinks: AdvancedAnalyticsGitHubIssueLink[];
    pullRequestReviews: AdvancedAnalyticsPullRequestReview[];
    notifications: AdvancedAnalyticsNotification[];
  },
  range: DateRangeFilter,
  platform: string,
  status: StatusFilter,
): FilteredData {
  const content = data.contentItems.filter(
    (item) =>
      inRange(item.updated_at || item.created_at, range) &&
      (platform === 'all' || item.platform === platform) &&
      itemMatchesStatus(item, status),
  );
  const contentIds = new Set(content.map((item) => item.id));
  const attempts = data.publishAttempts.filter((attempt) => {
    const platformMatch =
      platform === 'all' ||
      (attempt.content_item_id
        ? contentIds.has(attempt.content_item_id)
        : providerKey(attempt.provider).toLowerCase().includes(platform.replace('_', ' ')));
    const statusMatch = status === 'all' || attempt.status === status;
    return inRange(attempt.created_at, range) && platformMatch && statusMatch;
  });

  return {
    content,
    attempts,
    tasks: data.tasks.filter((task) => inRange(task.updated_at || task.created_at, range)),
    projects: data.projects.filter((project) => inRange(project.updated_at || project.created_at, range)),
    releases: data.releases.filter((release) => inRange(release.updated_at || release.created_at, range)),
    prompts: data.prompts.filter((prompt) => inRange(prompt.updated_at || prompt.created_at, range)),
    assets: data.creativeAssets.filter((asset) => inRange(asset.updated_at || asset.created_at, range)),
    backups: data.backups.filter((backup) => inRange(backup.created_at, range)),
    securityLogs: data.securityLogs.filter((log) => inRange(log.created_at, range)),
    safePatchPlans: data.safePatchPlans.filter((plan) => inRange(plan.updated_at || plan.created_at, range)),
    codeFixProposals: data.codeFixProposals.filter((proposal) => inRange(proposal.updated_at || proposal.created_at, range)),
    githubIssueLinks: data.githubIssueLinks.filter((link) => inRange(link.created_at, range)),
    pullRequestReviews: data.pullRequestReviews.filter((review) => inRange(review.created_at, range)),
    notifications: data.notifications.filter((notification) => inRange(notification.created_at, range)),
  };
}

export function buildNextActions(input: {
  content: AdvancedAnalyticsContentItem[];
  attempts: AdvancedAnalyticsPublishAttempt[];
  tasks: AdvancedAnalyticsTask[];
  projects: AdvancedAnalyticsProject[];
  releases: AdvancedAnalyticsRelease[];
  providers: AdvancedAnalyticsProvider[];
  backups: AdvancedAnalyticsBackup[];
  securityLogs: AdvancedAnalyticsSecurityLog[];
  safePatchPlans: AdvancedAnalyticsSafePatchPlan[];
  codeFixProposals: AdvancedAnalyticsCodeFixProposal[];
  pullRequestReviews: AdvancedAnalyticsPullRequestReview[];
  systemHealth: AdvancedAnalyticsSystemHealth | null;
}) {
  const actions: NextAction[] = [];
  const blockedProviders = input.providers.filter(
    (provider) => !['ready', 'manual_only'].includes(provider.status),
  );
  const readyMissingAssets = input.content.filter(
    (item) => ['ready', 'scheduled'].includes(item.status) && item.asset_ids.length === 0,
  );
  const failedContent = input.content.filter((item) =>
    ['failed', 'setup_required', 'approval_pending'].includes(item.status),
  );
  const failedAttempts = input.attempts.filter((attempt) =>
    ['failed', 'setup_required', 'approval_pending', 'token_missing', 'quota_limit'].includes(attempt.status),
  );
  const reviewTasks = input.tasks.filter((task) => task.status === 'needs_review');
  const projectsMissingGithub = input.projects.filter((project) => !project.github_url);
  const projectsMissingProduction = input.projects.filter((project) => !project.production_url);
  const failedReleases = input.releases.filter(
    (release) =>
      release.status === 'failed' ||
      release.build_status === 'failed' ||
      release.lint_status === 'failed' ||
      release.typecheck_status === 'failed' ||
      release.deploy_status === 'failed',
  );
  const latestBackup = input.backups[0];
  const backupIsStale = !latestBackup || !inRange(latestBackup.created_at, 'last_30_days');
  const criticalSecurity = input.securityLogs.filter((log) => ['critical', 'high'].includes(log.severity));
  const riskyPrReviews = input.pullRequestReviews.filter((review) =>
    ['high', 'critical'].includes(review.risk_level),
  );
  const plansNeedingReview = input.safePatchPlans.filter((plan) => plan.status === 'needs_review');
  const proposalsNeedingReview = input.codeFixProposals.filter((proposal) => proposal.status === 'needs_review');

  if (criticalSecurity.length > 0 || (input.systemHealth?.criticalBlockers ?? 0) > 0) {
    actions.push({
      priority: 'critical',
      title: 'Review critical security or system blockers',
      reason: `${criticalSecurity.length} high-priority audit records and ${input.systemHealth?.criticalBlockers ?? 0} system blockers need attention.`,
      href: '/dashboard/security',
      cta: 'Open Security Center',
    });
  }

  if (blockedProviders.length > 0 || failedAttempts.length > 0) {
    actions.push({
      priority: 'high',
      title: 'Resolve provider setup blockers',
      reason: `${blockedProviders.length} providers are not ready and ${failedAttempts.length} publish attempts need operator review.`,
      href: '/dashboard/settings#provider-setup-wizard',
      cta: 'Open Provider Setup',
    });
  }

  if (failedContent.length > 0) {
    actions.push({
      priority: 'high',
      title: 'Review failed or setup-blocked content',
      reason: `${failedContent.length} content items are failed, setup_required, or approval_pending.`,
      href: '/dashboard/recovery',
      cta: 'Open Recovery Center',
    });
  }

  if (reviewTasks.length > 0) {
    actions.push({
      priority: 'medium',
      title: 'Clear tasks waiting for review',
      reason: `${reviewTasks.length} pending review tasks are waiting on manager approval.`,
      href: '/dashboard/tasks',
      cta: 'Open Tasks',
    });
  }

  if (readyMissingAssets.length > 0) {
    actions.push({
      priority: 'medium',
      title: 'Attach creative assets to ready content',
      reason: `${readyMissingAssets.length} ready or scheduled items have no linked creative asset.`,
      href: '/dashboard/content-studio',
      cta: 'Open Content Studio',
    });
  }

  if (failedReleases.length > 0) {
    actions.push({
      priority: 'medium',
      title: 'Stabilize failed releases',
      reason: `${failedReleases.length} release records report failed release/build/lint/typecheck/deploy status.`,
      href: '/dashboard/releases',
      cta: 'Open Releases',
    });
  }

  if (riskyPrReviews.length > 0) {
    actions.push({
      priority: 'medium',
      title: 'Review risky pull request reports',
      reason: `${riskyPrReviews.length} PR reviews are marked high or critical risk.`,
      href: '/dashboard/projects',
      cta: 'Open Projects',
    });
  }

  if (plansNeedingReview.length > 0 || proposalsNeedingReview.length > 0) {
    actions.push({
      priority: 'medium',
      title: 'Review safe patch and fix planning work',
      reason: `${plansNeedingReview.length} safe patch plans and ${proposalsNeedingReview.length} fix proposals need review.`,
      href: '/dashboard/safe-patch-planner',
      cta: 'Open Safe Patch Planner',
    });
  }

  if (projectsMissingGithub.length > 0 || projectsMissingProduction.length > 0) {
    actions.push({
      priority: 'low',
      title: 'Complete project operational links',
      reason: `${projectsMissingGithub.length} projects are missing GitHub URLs and ${projectsMissingProduction.length} are missing production URLs.`,
      href: '/dashboard/projects',
      cta: 'Open Projects',
    });
  }

  if (backupIsStale) {
    actions.push({
      priority: 'low',
      title: 'Create a fresh workspace backup',
      reason: latestBackup
        ? `Latest backup was created on ${formatDateTime(latestBackup.created_at)}.`
        : 'No backup history is available yet.',
      href: '/dashboard/backups',
      cta: 'Open Backup Center',
    });
  }

  return actions.sort((a, b) => {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[b.priority] - weights[a.priority];
  });
}

export function buildMarkdownReport(input: {
  data: { generatedAt: string; workspaceName: string; schedulerConfigured: boolean; schedulerLine: string; systemHealth: AdvancedAnalyticsSystemHealth | null };
  rangeLabel: string;
  content: AdvancedAnalyticsContentItem[];
  attempts: AdvancedAnalyticsPublishAttempt[];
  tasks: AdvancedAnalyticsTask[];
  projects: AdvancedAnalyticsProject[];
  releases: AdvancedAnalyticsRelease[];
  prompts: AdvancedAnalyticsPrompt[];
  assets: AdvancedAnalyticsAsset[];
  backups: AdvancedAnalyticsBackup[];
  securityLogs: AdvancedAnalyticsSecurityLog[];
  safePatchPlans: AdvancedAnalyticsSafePatchPlan[];
  codeFixProposals: AdvancedAnalyticsCodeFixProposal[];
  githubIssueLinks: AdvancedAnalyticsGitHubIssueLink[];
  pullRequestReviews: AdvancedAnalyticsPullRequestReview[];
  providers: AdvancedAnalyticsProvider[];
  nextActions: NextAction[];
}) {
  const contentStatus = countBy(input.content, (item) => item.status);
  const platformCounts = countBy(input.content, (item) => item.platform);
  const attemptStatus = countBy(input.attempts, (attempt) => attempt.status);
  const taskStatus = countBy(input.tasks, (task) => task.status);
  const projectStatus = countBy(input.projects, (project) => project.status);
  const releaseStatus = countBy(input.releases, (release) => release.status);
  const promptCategories = countBy(input.prompts, (prompt) => prompt.category);
  const blockerProviders = input.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status));

  return [
    '# AgentFlow AI Advanced Analytics Report',
    '',
    `- Generated: ${formatDateTime(input.data.generatedAt)}`,
    `- Workspace: ${safeMarkdownLine(input.data.workspaceName)}`,
    `- Date range: ${input.rangeLabel}`,
    '',
    '## Executive Summary',
    `- Total content items: ${input.content.length}`,
    `- Ready content: ${contentStatus.ready ?? 0}`,
    `- Scheduled content: ${contentStatus.scheduled ?? 0}`,
    `- Published content: ${contentStatus.published ?? 0}`,
    `- Failed/setup required content: ${(contentStatus.failed ?? 0) + (contentStatus.setup_required ?? 0)}`,
    `- Total tasks: ${input.tasks.length}`,
    `- Completed tasks: ${taskStatus.completed ?? 0}`,
    `- Tasks needing review: ${taskStatus.needs_review ?? 0}`,
    `- Active projects: ${projectStatus.active ?? 0}`,
    `- Deployed releases: ${releaseStatus.deployed ?? 0}`,
    `- Provider blockers: ${blockerProviders.length}`,
    '',
    '## Content Analytics',
    ...topEntries(platformCounts, 8).map(([key, value]) => `- ${label(key)}: ${value}`),
    ...topEntries(contentStatus, 8).map(([key, value]) => `- Status ${label(key)}: ${value}`),
    '',
    '## Provider Blockers',
    ...(blockerProviders.length > 0
      ? blockerProviders.map((provider) => `- ${provider.name}: ${provider.status}. ${provider.nextAction}`)
      : ['- No provider blockers detected in current data.']),
    '',
    '## Publishing Attempts',
    ...topEntries(attemptStatus, 10).map(([key, value]) => `- ${label(key)}: ${value}`),
    '',
    '## Scheduler Summary',
    `- Configured: ${input.data.schedulerConfigured ? 'yes' : 'no'}`,
    `- ${input.data.schedulerLine}`,
    '',
    '## Task & Agent Analytics',
    ...topEntries(taskStatus, 10).map(([key, value]) => `- ${label(key)}: ${value}`),
    '',
    '## Project & Release Analytics',
    ...topEntries(projectStatus, 10).map(([key, value]) => `- Project ${label(key)}: ${value}`),
    ...topEntries(releaseStatus, 10).map(([key, value]) => `- Release ${label(key)}: ${value}`),
    '',
    '## Prompt Library',
    `- Total prompts: ${input.prompts.length}`,
    ...topEntries(promptCategories, 8).map(([key, value]) => `- ${label(key)}: ${value}`),
    '',
    '## Backup, Security, System Health',
    `- Backup records: ${input.backups.length}`,
    `- Security audit records: ${input.securityLogs.length}`,
    `- System health: ${input.data.systemHealth ? `${input.data.systemHealth.score}% (${input.data.systemHealth.label})` : 'not available'}`,
    '',
    '## Safe Patch, Code Fix, GitHub Workflow',
    `- Safe patch plans: ${input.safePatchPlans.length}`,
    `- Code fix proposals: ${input.codeFixProposals.length}`,
    `- GitHub issues converted to tasks: ${input.githubIssueLinks.length}`,
    `- Pull request reviews: ${input.pullRequestReviews.length}`,
    '',
    '## Next Best Actions',
    ...(input.nextActions.length > 0
      ? input.nextActions.map((action) => `- ${action.priority.toUpperCase()}: ${action.title}. ${action.reason}`)
      : ['- No urgent next action detected from current records.']),
    '',
    '## Guardrails',
    '- Metrics are operational records only.',
    '- No fake impressions, clicks, spend, conversions, revenue, ROI, or engagement rates are included.',
    '- Secrets, tokens, raw environment values, and provider credentials are not included.',
  ].join('\n');
}
