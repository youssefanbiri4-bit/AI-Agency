'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  Filter,
  FolderKanban,
  Gauge,
  GitPullRequest,
  Layers3,
  Library,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { cn, formatDateTime } from '@/lib/utils';

type DateRangeFilter = 'this_month' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all_time';
type PlatformFilter = 'all' | 'instagram' | 'facebook' | 'google_ads' | 'pinterest' | 'linkedin';
type StatusFilter =
  | 'all'
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'setup_required'
  | 'approval_pending'
  | 'manual_only';
type AnalyticsTab =
  | 'advanced'
  | 'provider'
  | 'work'
  | 'project'
  | 'security';

export interface AdvancedAnalyticsContentItem {
  id: string;
  title: string;
  platform: string;
  content_type: string;
  status: string;
  provider_status: string | null;
  provider_error: string | null;
  schedule_at: string | null;
  published_at: string | null;
  scheduled_execution_status: string | null;
  scheduled_execution_error: string | null;
  scheduled_execution_started_at?: string | null;
  scheduled_execution_finished_at: string | null;
  scheduled_execution_attempts: number;
  asset_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsPublishAttempt {
  id: string;
  provider: string;
  action_type: string;
  status: string;
  content_item_id: string | null;
  content_title: string;
  safe_message: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsTask {
  id: string;
  title: string;
  agent_type: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AdvancedAnalyticsProject {
  id: string;
  name: string;
  status: string;
  priority: string;
  github_url: string | null;
  production_url: string | null;
  updated_at: string;
  created_at: string;
}

export interface AdvancedAnalyticsRelease {
  id: string;
  title: string;
  status: string;
  release_type: string;
  known_issues: string | null;
  build_status: string | null;
  lint_status: string | null;
  typecheck_status: string | null;
  deploy_status: string | null;
  deploy_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsPrompt {
  id: string;
  title: string;
  category: string;
  target_tool: string | null;
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsAsset {
  id: string;
  title: string;
  asset_type: string;
  status: string;
  has_media: boolean;
  is_video: boolean;
  is_linked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsProvider {
  name: string;
  status: string;
  missing: string[];
  nextAction: string;
}

export interface AdvancedAnalyticsBackup {
  id: string;
  categories: string[];
  status: string;
  warnings: string | null;
  created_at: string;
}

export interface AdvancedAnalyticsSecurityLog {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  created_at: string;
}

export interface AdvancedAnalyticsSafePatchPlan {
  id: string;
  title: string;
  status: string;
  risk_level: string;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsCodeFixProposal {
  id: string;
  title: string;
  issue_type: string;
  severity: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdvancedAnalyticsGitHubIssueLink {
  id: string;
  github_issue_number: number;
  github_issue_title: string | null;
  github_issue_state: string | null;
  created_at: string;
}

export interface AdvancedAnalyticsPullRequestReview {
  id: string;
  pr_number: number;
  pr_title: string | null;
  risk_level: string;
  recommendation: string;
  created_at: string;
}

export interface AdvancedAnalyticsNotification {
  id: string;
  type: string;
  severity: string;
  title: string;
  status: string;
  created_at: string;
}

export interface AdvancedAnalyticsSystemHealth {
  score: number;
  label: string;
  criticalBlockers: number;
  needsSetup: number;
  topActions: Array<{ id: string; title: string; href: string }>;
}

export interface AdvancedAnalyticsData {
  workspaceName: string;
  generatedAt: string;
  contentItems: AdvancedAnalyticsContentItem[];
  publishAttempts: AdvancedAnalyticsPublishAttempt[];
  tasks: AdvancedAnalyticsTask[];
  reviewsCount: number;
  projects: AdvancedAnalyticsProject[];
  releases: AdvancedAnalyticsRelease[];
  prompts: AdvancedAnalyticsPrompt[];
  creativeAssets: AdvancedAnalyticsAsset[];
  providers: AdvancedAnalyticsProvider[];
  backups: AdvancedAnalyticsBackup[];
  securityLogs: AdvancedAnalyticsSecurityLog[];
  safePatchPlans: AdvancedAnalyticsSafePatchPlan[];
  codeFixProposals: AdvancedAnalyticsCodeFixProposal[];
  githubIssueLinks: AdvancedAnalyticsGitHubIssueLink[];
  pullRequestReviews: AdvancedAnalyticsPullRequestReview[];
  notifications: AdvancedAnalyticsNotification[];
  systemHealth: AdvancedAnalyticsSystemHealth | null;
  schedulerConfigured: boolean;
  schedulerLine: string;
  optionalWarnings: string[];
}

interface NextAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  href: string;
  cta: string;
}

const dateRanges: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all_time', label: 'All time' },
];

const platforms: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const statuses: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'setup_required', label: 'Setup required' },
  { value: 'approval_pending', label: 'Approval pending' },
  { value: 'manual_only', label: 'Manual only' },
];

const tabs: Array<{ value: AnalyticsTab; label: string }> = [
  { value: 'advanced', label: 'Advanced Analytics' },
  { value: 'provider', label: 'Provider Analytics' },
  { value: 'work', label: 'Work Analytics' },
  { value: 'project', label: 'Project Analytics' },
  { value: 'security', label: 'Security & Backup' },
];

function rangeStart(range: DateRangeFilter) {
  const now = new Date();
  if (range === 'all_time') return null;
  if (range === 'this_month') return new Date(now.getFullYear(), now.getMonth(), 1);

  const days = range === 'last_7_days' ? 7 : range === 'last_30_days' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function inRange(dateValue: string | null | undefined, range: DateRangeFilter) {
  const start = rangeStart(range);
  if (!start) return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  return !Number.isNaN(date.getTime()) && date >= start;
}

function itemMatchesStatus(item: AdvancedAnalyticsContentItem, status: StatusFilter) {
  if (status === 'all') return true;
  if (status === 'manual_only') {
    return item.provider_status === 'manual_only' || item.content_type === 'linkedin_post_planner';
  }
  return item.status === status || item.provider_status === status || item.scheduled_execution_status === status;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function topEntries(counts: Record<string, number>, limit = 6) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function label(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeDashboardHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

function providerKey(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized.includes('google')) return 'Google Ads';
  if (normalized.includes('instagram')) return 'Meta / Instagram / Facebook';
  if (normalized.includes('facebook') || normalized.includes('meta')) return 'Meta / Instagram / Facebook';
  if (normalized.includes('pinterest')) return 'Pinterest';
  if (normalized.includes('linkedin')) return 'LinkedIn';
  if (normalized.includes('scheduler')) return 'Scheduler';
  if (normalized.includes('github')) return 'GitHub';
  if (normalized.includes('openai')) return 'OpenAI';
  if (normalized.includes('nvidia')) return 'NVIDIA';
  return label(provider);
}

function safeMarkdownLine(value: string | null | undefined) {
  return (value || 'None').replace(/\s+/g, ' ').slice(0, 220);
}

function buildNextActions(input: {
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
    (provider) => !['ready', 'manual_only'].includes(provider.status)
  );
  const readyMissingAssets = input.content.filter(
    (item) => ['ready', 'scheduled'].includes(item.status) && item.asset_ids.length === 0
  );
  const failedContent = input.content.filter((item) =>
    ['failed', 'setup_required', 'approval_pending'].includes(item.status)
  );
  const failedAttempts = input.attempts.filter((attempt) =>
    ['failed', 'setup_required', 'approval_pending', 'token_missing', 'quota_limit'].includes(attempt.status)
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
      release.deploy_status === 'failed'
  );
  const latestBackup = input.backups[0];
  const backupIsStale = !latestBackup || !inRange(latestBackup.created_at, 'last_30_days');
  const criticalSecurity = input.securityLogs.filter((log) => ['critical', 'high'].includes(log.severity));
  const riskyPrReviews = input.pullRequestReviews.filter((review) =>
    ['high', 'critical'].includes(review.risk_level)
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

function buildMarkdownReport(input: {
  data: AdvancedAnalyticsData;
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

function MetricTile({
  label: metricLabel,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper?: string;
  icon: typeof Layers3;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/7 bg-white p-4 shadow-[0_14px_36px_rgba(93,107,107,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{metricLabel}</p>
          <p className="mt-2 break-words text-2xl font-black tracking-normal text-[#5D6B6B]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D5E5E5]/72 text-[#F7CBCA]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm font-semibold leading-6 text-black/55">{helper}</p> : null}
    </div>
  );
}

function AnalyticsSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_18px_48px_rgba(93,107,107,0.07)]">
      <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-[#5D6B6B]">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-black/58">{description}</p> : null}
        </div>
        {action ? <div className="flex max-w-full shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ProgressRow({ name, value, total }: { name: string; value: number; total: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="min-w-0 whitespace-normal break-words text-sm font-bold text-black/70">{name}</span>
        <span className="font-mono text-sm font-black text-[#5D6B6B]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F7F7] ring-1 ring-black/5">
        <div className="h-full rounded-full bg-[#F7CBCA]" style={{ width: `${percent(value, total)}%` }} />
      </div>
    </div>
  );
}

function CountBars({ counts, total, emptyText }: { counts: Record<string, number>; total: number; emptyText: string }) {
  const entries = topEntries(counts, 8);

  if (entries.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <ProgressRow key={key} name={label(key)} value={value} total={total} />
      ))}
    </div>
  );
}

function EmptyState({ title, helper }: { title: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/12 bg-[#F1F7F7]/62 p-6 text-center">
      <p className="font-black text-[#5D6B6B]">{title}</p>
      {helper ? <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/56">{helper}</p> : null}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <>
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <article key={row.join('|')} className="rounded-2xl border border-black/7 bg-white p-4">
          <dl className="space-y-3">
            {row.map((cell, index) => (
              <div key={`${cell}-${index}`} className="min-w-0">
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-black/42">{headers[index]}</dt>
                <dd className="mt-1 whitespace-normal break-words text-sm font-semibold leading-6 text-black/64">{cell}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-black/7 md:block">
      <table className="w-full min-w-[860px] table-auto divide-y divide-black/7 text-left text-sm">
        <thead className="bg-[#F1F7F7]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-black/45">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/7 bg-white">
          {rows.map((row) => (
            <tr key={row.join('|')} className="align-top">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="min-w-[9rem] max-w-[24rem] whitespace-normal break-words px-4 py-3 font-semibold leading-6 text-black/62">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function AdvancedAnalyticsClient({ data }: { data: AdvancedAnalyticsData }) {
  const [range, setRange] = useState<DateRangeFilter>('last_30_days');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('advanced');
  const [copyState, setCopyState] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const content = data.contentItems.filter(
      (item) =>
        inRange(item.updated_at || item.created_at, range) &&
        (platform === 'all' || item.platform === platform) &&
        itemMatchesStatus(item, status)
    );
    const contentIds = new Set(content.map((item) => item.id));
    const attempts = data.publishAttempts.filter((attempt) => {
      const platformMatch =
        platform === 'all' ||
        (attempt.content_item_id ? contentIds.has(attempt.content_item_id) : providerKey(attempt.provider).toLowerCase().includes(platform.replace('_', ' ')));
      const statusMatch = status === 'all' || attempt.status === status;
      return inRange(attempt.created_at, range) && platformMatch && statusMatch;
    });
    const tasks = data.tasks.filter((task) => inRange(task.updated_at || task.created_at, range));
    const projects = data.projects.filter((project) => inRange(project.updated_at || project.created_at, range));
    const releases = data.releases.filter((release) => inRange(release.updated_at || release.created_at, range));
    const prompts = data.prompts.filter((prompt) => inRange(prompt.updated_at || prompt.created_at, range));
    const assets = data.creativeAssets.filter((asset) => inRange(asset.updated_at || asset.created_at, range));
    const backups = data.backups.filter((backup) => inRange(backup.created_at, range));
    const securityLogs = data.securityLogs.filter((log) => inRange(log.created_at, range));
    const safePatchPlans = data.safePatchPlans.filter((plan) => inRange(plan.updated_at || plan.created_at, range));
    const codeFixProposals = data.codeFixProposals.filter((proposal) => inRange(proposal.updated_at || proposal.created_at, range));
    const githubIssueLinks = data.githubIssueLinks.filter((link) => inRange(link.created_at, range));
    const pullRequestReviews = data.pullRequestReviews.filter((review) => inRange(review.created_at, range));
    const notifications = data.notifications.filter((notification) => inRange(notification.created_at, range));

    return {
      content,
      attempts,
      tasks,
      projects,
      releases,
      prompts,
      assets,
      backups,
      securityLogs,
      safePatchPlans,
      codeFixProposals,
      githubIssueLinks,
      pullRequestReviews,
      notifications,
    };
  }, [data, platform, range, status]);

  const analytics = useMemo(() => {
    const contentStatusCounts = countBy(filtered.content, (item) => item.status);
    const contentPlatformCounts = countBy(filtered.content, (item) => item.platform);
    const contentTypeCounts = countBy(filtered.content, (item) => item.content_type);
    const attemptStatusCounts = countBy(filtered.attempts, (attempt) => attempt.status);
    const attemptProviderCounts = countBy(filtered.attempts, (attempt) => providerKey(attempt.provider));
    const taskStatusCounts = countBy(filtered.tasks, (task) => task.status);
    const taskPriorityCounts = countBy(filtered.tasks, (task) => task.priority);
    const taskAgentCounts = countBy(filtered.tasks, (task) => task.agent_type);
    const projectStatusCounts = countBy(filtered.projects, (project) => project.status);
    const releaseStatusCounts = countBy(filtered.releases, (release) => release.status);
    const releaseTypeCounts = countBy(filtered.releases, (release) => release.release_type);
    const promptCategoryCounts = countBy(filtered.prompts, (prompt) => prompt.category);
    const promptToolCounts = countBy(filtered.prompts, (prompt) => prompt.target_tool);
    const assetTypeCounts = countBy(filtered.assets, (asset) => asset.asset_type);
    const assetStatusCounts = countBy(filtered.assets, (asset) => asset.status);
    const safePatchStatusCounts = countBy(filtered.safePatchPlans, (plan) => plan.status);
    const safePatchRiskCounts = countBy(filtered.safePatchPlans, (plan) => plan.risk_level);
    const codeFixIssueCounts = countBy(filtered.codeFixProposals, (proposal) => proposal.issue_type);
    const codeFixSeverityCounts = countBy(filtered.codeFixProposals, (proposal) => proposal.severity);
    const prRiskCounts = countBy(filtered.pullRequestReviews, (review) => review.risk_level);
    const prRecommendationCounts = countBy(filtered.pullRequestReviews, (review) => review.recommendation);
    const securitySeverityCounts = countBy(filtered.securityLogs, (log) => log.severity);
    const notificationSeverityCounts = countBy(filtered.notifications, (notification) => notification.severity);
    const providerBlockedItems = data.providers.map((provider) => {
      const name = provider.name;
      const providerContent = filtered.content.filter((item) => providerKey(item.platform) === providerKey(name) || name.toLowerCase().includes(item.platform.replace('_', ' ')));
      const blockers = providerContent.filter((item) =>
        ['failed', 'setup_required', 'approval_pending', 'manual_only'].includes(item.status) ||
        ['failed', 'setup_required', 'approval_pending', 'manual_only'].includes(item.provider_status ?? '')
      );

      return {
        provider: name,
        status: provider.status,
        blockedItems: blockers.length,
        commonBlocker: provider.missing[0] || blockers[0]?.provider_error || provider.nextAction,
        nextAction: provider.nextAction,
      };
    });
    const nextActions = buildNextActions({
      content: filtered.content,
      attempts: filtered.attempts,
      tasks: filtered.tasks,
      projects: filtered.projects,
      releases: filtered.releases,
      providers: data.providers,
      backups: data.backups,
      securityLogs: filtered.securityLogs,
      safePatchPlans: filtered.safePatchPlans,
      codeFixProposals: filtered.codeFixProposals,
      pullRequestReviews: filtered.pullRequestReviews,
      systemHealth: data.systemHealth,
    });
    const markdownReport = buildMarkdownReport({
      data,
      rangeLabel: dateRanges.find((entry) => entry.value === range)?.label ?? 'Custom',
      providers: data.providers,
      nextActions,
      ...filtered,
    });

    return {
      contentStatusCounts,
      contentPlatformCounts,
      contentTypeCounts,
      attemptStatusCounts,
      attemptProviderCounts,
      taskStatusCounts,
      taskPriorityCounts,
      taskAgentCounts,
      projectStatusCounts,
      releaseStatusCounts,
      releaseTypeCounts,
      promptCategoryCounts,
      promptToolCounts,
      assetTypeCounts,
      assetStatusCounts,
      safePatchStatusCounts,
      safePatchRiskCounts,
      codeFixIssueCounts,
      codeFixSeverityCounts,
      prRiskCounts,
      prRecommendationCounts,
      securitySeverityCounts,
      notificationSeverityCounts,
      providerBlockedItems,
      nextActions,
      markdownReport,
    };
  }, [data, filtered, range]);

  const copyText = async (labelText: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopyState(labelText);
    window.setTimeout(() => setCopyState(null), 1800);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([analytics.markdownReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `agentflow-advanced-analytics-${date}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const providerSummary = data.providers
    .map((provider) => `${provider.name}: ${provider.status}. ${provider.nextAction}`)
    .join('\n');
  const nextActionSummary = analytics.nextActions
    .map((action) => `${action.priority.toUpperCase()}: ${action.title} - ${action.reason}`)
    .join('\n');
  const readyContent = filtered.content.filter((item) => item.status === 'ready').length;
  const scheduledContent = filtered.content.filter((item) => item.status === 'scheduled').length;
  const publishedContent = filtered.content.filter((item) => item.status === 'published').length;
  const failedOrSetup = filtered.content.filter((item) =>
    ['failed', 'setup_required'].includes(item.status)
  ).length;
  const tasksNeedingReview = filtered.tasks.filter((task) => task.status === 'needs_review').length;
  const completedTasks = filtered.tasks.filter((task) => task.status === 'completed').length;
  const activeProjects = filtered.projects.filter((project) => project.status === 'active').length;
  const deployedReleases = filtered.releases.filter((release) => release.status === 'deployed').length;
  const providerBlockers = data.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status)).length;
  const securityIssues = filtered.securityLogs.filter((log) => ['critical', 'high', 'medium'].includes(log.severity)).length;
  const latestBackup = data.backups[0];
  const scheduledPending = filtered.content.filter(
    (item) => item.status === 'scheduled' && (!item.scheduled_execution_status || item.scheduled_execution_status === 'pending')
  ).length;
  const schedulerSucceeded = filtered.content.filter((item) => item.scheduled_execution_status === 'succeeded').length;
  const schedulerFailed = filtered.content.filter((item) => item.scheduled_execution_status === 'failed').length;
  const schedulerProcessing = filtered.content.filter((item) => item.scheduled_execution_status === 'processing').length;
  const missingCreativeAssets = filtered.content.filter((item) => item.asset_ids.length === 0).length;
  const missingSchedule = filtered.content.filter((item) => item.status === 'ready' && !item.schedule_at).length;
  const manualOnly = filtered.content.filter((item) => item.provider_status === 'manual_only' || item.content_type === 'linkedin_post_planner').length;
  const blockedByProvider = filtered.content.filter((item) =>
    ['setup_required', 'approval_pending', 'failed', 'manual_only'].includes(item.provider_status ?? '')
  ).length;
  const unlinkedAssets = filtered.assets.filter((asset) => !asset.is_linked).length;
  const assetsMissingMedia = filtered.assets.filter((asset) => !asset.has_media).length;

  return (
    <section id="advanced-analytics" className="space-y-6 rounded-[28px] border border-black/7 bg-white/84 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">Operational Analytics</p>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-[#5D6B6B] sm:text-4xl">
            Advanced Analytics
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
            Analyze workflow activity, content readiness, provider blockers, projects, releases, security, backups, and development operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => copyText('Advanced analytics report', analytics.markdownReport)}>
            <Clipboard className="h-4 w-4" />
            Copy Advanced Analytics Report
          </Button>
          <Button size="sm" variant="outline" onClick={() => copyText('Provider blockers summary', providerSummary)}>
            <RadioTower className="h-4 w-4" />
            Copy Provider Blockers
          </Button>
          <Button size="sm" variant="outline" onClick={() => copyText('Next actions', nextActionSummary || 'No next actions detected.')}>
            <Sparkles className="h-4 w-4" />
            Copy Next Actions
          </Button>
          <Button size="sm" variant="outline" onClick={downloadMarkdown}>
            <Download className="h-4 w-4" />
            Download Markdown
          </Button>
        </div>
      </div>

      {copyState ? (
        <div className="rounded-2xl border border-[#F7CBCA]/15 bg-[#D5E5E5]/55 px-4 py-3 text-sm font-black text-[#F7CBCA]">
          Copied {copyState}.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="min-w-0">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-black/45">
            <Filter className="h-4 w-4" />
            Date range
          </span>
          <Select value={range} onChange={(event) => setRange(event.target.value as DateRangeFilter)}>
            {dateRanges.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.13em] text-black/45">Platform</span>
          <Select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformFilter)}>
            {platforms.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </Select>
        </label>
        <label className="min-w-0">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.13em] text-black/45">Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            {statuses.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-2 text-sm font-black transition-colors',
              activeTab === tab.value
                ? 'border-[#F7CBCA] bg-[#F7CBCA] text-white'
                : 'border-black/10 bg-white text-black/62 hover:border-[#F7CBCA]/35 hover:text-[#F7CBCA]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {data.optionalWarnings.length > 0 ? (
        <div className="rounded-2xl border border-[#E7F5DC]/45 bg-[#D5E5E5]/35 p-4">
          <p className="font-black text-[#5D6B6B]">Some optional analytics tables are unavailable</p>
          <p className="mt-1 text-sm leading-6 text-black/58">
            {data.optionalWarnings.slice(0, 3).join(' ')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Total content items" value={filtered.content.length} helper="Filtered workspace records" icon={Layers3} />
        <MetricTile label="Ready content" value={readyContent} helper="Ready for next workflow step" icon={CheckCircle2} />
        <MetricTile label="Scheduled content" value={scheduledContent} helper="Items with scheduled state" icon={CalendarClock} />
        <MetricTile label="Published content" value={publishedContent} helper="Provider-confirmed records" icon={CheckCircle2} />
        <MetricTile label="Failed / setup required" value={failedOrSetup} helper="Needs operator review" icon={AlertTriangle} />
        <MetricTile label="Total tasks" value={filtered.tasks.length} helper="Task records in range" icon={Clipboard} />
        <MetricTile label="Completed tasks" value={completedTasks} helper="Completed task status only" icon={CheckCircle2} />
        <MetricTile label="Tasks needing review" value={tasksNeedingReview} helper="Manager review queue" icon={Gauge} />
        <MetricTile label="Active projects" value={activeProjects} helper="Project status is active" icon={FolderKanban} />
        <MetricTile label="Deployed releases" value={deployedReleases} helper="Release status is deployed" icon={ExternalLink} />
        <MetricTile label="Provider blockers" value={providerBlockers} helper="Configured provider readiness" icon={RadioTower} />
        <MetricTile label="Latest backup status" value={latestBackup ? label(latestBackup.status) : 'No backup'} helper={latestBackup ? formatDateTime(latestBackup.created_at) : 'No backup history yet'} icon={ShieldCheck} />
      </div>

      {activeTab === 'advanced' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsSection title="Content Analytics" description="Real Content Studio counts by platform, status, and type.">
            <div className="grid gap-5 lg:grid-cols-3">
              <CountBars counts={analytics.contentPlatformCounts} total={filtered.content.length} emptyText="No content for this filter" />
              <CountBars counts={analytics.contentStatusCounts} total={filtered.content.length} emptyText="No status data yet" />
              <CountBars counts={analytics.contentTypeCounts} total={filtered.content.length} emptyText="No content type data yet" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Missing creative assets" value={missingCreativeAssets} icon={AlertTriangle} />
              <MetricTile label="Missing schedule time" value={missingSchedule} icon={CalendarClock} />
              <MetricTile label="Blocked by provider" value={blockedByProvider} icon={RadioTower} />
              <MetricTile label="Manual-only items" value={manualOnly} icon={Clipboard} />
            </div>
          </AnalyticsSection>

          <AnalyticsSection title="Publishing Attempts Analytics" description="Safe publish attempt summaries. Raw tokens and provider credentials are not shown.">
            <div className="grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.attemptStatusCounts} total={filtered.attempts.length} emptyText="No publish attempts yet" />
              <CountBars counts={analytics.attemptProviderCounts} total={filtered.attempts.length} emptyText="No provider attempt data yet" />
            </div>
            <div className="mt-5">
              <DataTable
                headers={['Date', 'Provider', 'Action', 'Content item', 'Status', 'Safe message']}
                emptyText="No latest failed attempts for this filter"
                rows={filtered.attempts
                  .filter((attempt) => ['failed', 'setup_required', 'approval_pending', 'manual_only', 'unsupported'].includes(attempt.status))
                  .slice(0, 6)
                  .map((attempt) => [
                    formatDateTime(attempt.created_at),
                    label(providerKey(attempt.provider)),
                    label(attempt.action_type),
                    attempt.content_title,
                    label(attempt.status),
                    attempt.safe_message || attempt.external_id || 'No safe message recorded',
                  ])}
              />
            </div>
          </AnalyticsSection>

          <AnalyticsSection title="Scheduler Analytics" description="Read-only scheduler status from Content Studio records. Scheduler behavior is unchanged.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile label="Scheduled pending" value={scheduledPending} icon={CalendarClock} />
              <MetricTile label="Scheduler succeeded" value={schedulerSucceeded} icon={CheckCircle2} />
              <MetricTile label="Scheduler failed" value={schedulerFailed} icon={AlertTriangle} />
              <MetricTile label="Setup required" value={filtered.content.filter((item) => item.scheduled_execution_status === 'setup_required').length} icon={RadioTower} />
              <MetricTile label="Approval pending" value={filtered.content.filter((item) => item.scheduled_execution_status === 'approval_pending').length} icon={Gauge} />
              <MetricTile label="Processing" value={schedulerProcessing} icon={Sparkles} />
            </div>
            <p className="mt-4 rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4 text-sm font-semibold leading-6 text-black/58">
              {data.schedulerLine}
            </p>
          </AnalyticsSection>

          <AnalyticsSection title="Next Best Actions" description="Ranked from real blockers, review queues, and setup status.">
            <div className="space-y-3">
              {analytics.nextActions.length > 0 ? analytics.nextActions.map((action) => (
                <div key={`${action.priority}-${action.title}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/55 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-[#5D6B6B]">{action.title}</p>
                    <p className="mt-1 text-sm leading-6 text-black/58">{action.reason}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#F7CBCA]">{action.priority}</p>
                  </div>
                  <Link href={safeDashboardHref(action.href)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                    {action.cta}
                  </Link>
                </div>
              )) : <EmptyState title="No urgent next actions detected" helper="The selected filters do not show urgent operational blockers." />}
            </div>
          </AnalyticsSection>
        </div>
      ) : null}

      {activeTab === 'provider' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsSection title="Provider Blocker Analytics" description="Grouped by provider with next recommended action. No secrets or token values are displayed.">
            <DataTable
              headers={['Provider', 'Status', 'Blocked items', 'Common blocker', 'Next action']}
              emptyText="No provider readiness data yet"
              rows={analytics.providerBlockedItems.map((entry) => [
                entry.provider,
                label(entry.status),
                String(entry.blockedItems),
                entry.commonBlocker || 'No common blocker detected',
                entry.nextAction,
              ])}
            />
          </AnalyticsSection>
          <AnalyticsSection title="Recovery Analytics" description="Operational recovery signals from failed content, notifications, and provider attempts.">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Failed content" value={filtered.content.filter((item) => item.status === 'failed').length} icon={AlertTriangle} />
              <MetricTile label="Setup required" value={filtered.content.filter((item) => item.status === 'setup_required').length} icon={RadioTower} />
              <MetricTile label="Approval pending" value={filtered.content.filter((item) => item.status === 'approval_pending').length} icon={Gauge} />
              <MetricTile label="Token missing attempts" value={filtered.attempts.filter((attempt) => attempt.status === 'token_missing').length} icon={ShieldCheck} />
              <MetricTile label="Manual-only skipped" value={filtered.attempts.filter((attempt) => attempt.status === 'manual_only').length} icon={Clipboard} />
              <MetricTile label="Unsupported attempts" value={filtered.attempts.filter((attempt) => attempt.status === 'unsupported').length} icon={AlertTriangle} />
            </div>
            <div className="mt-5">
              <CountBars counts={analytics.notificationSeverityCounts} total={filtered.notifications.length} emptyText="No notification data yet" />
            </div>
          </AnalyticsSection>
        </div>
      ) : null}

      {activeTab === 'work' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsSection title="Task & Agent Analytics" description="Task workflow counts by status, priority, and agent. Timing indicators are omitted when timestamps are not sufficient.">
            <div className="grid gap-5 lg:grid-cols-3">
              <CountBars counts={analytics.taskStatusCounts} total={filtered.tasks.length} emptyText="No tasks yet" />
              <CountBars counts={analytics.taskPriorityCounts} total={filtered.tasks.length} emptyText="No task priority data yet" />
              <CountBars counts={analytics.taskAgentCounts} total={filtered.tasks.length} emptyText="No task agent data yet" />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Prompt Library Analytics" description="Prompt counts by safe metadata only. Prompt body content is not displayed here.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Total prompts" value={filtered.prompts.length} icon={Library} />
              <MetricTile label="Favorite prompts" value={filtered.prompts.filter((prompt) => prompt.is_favorite).length} icon={Sparkles} />
              <MetricTile label="Most copied count" value={Math.max(0, ...filtered.prompts.map((prompt) => prompt.usage_count))} icon={Clipboard} />
              <MetricTile label="Recently used" value={filtered.prompts.filter((prompt) => prompt.last_used_at && inRange(prompt.last_used_at, range)).length} icon={Gauge} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.promptCategoryCounts} total={filtered.prompts.length} emptyText="No prompt categories yet" />
              <CountBars counts={analytics.promptToolCounts} total={filtered.prompts.length} emptyText="No prompt tool data yet" />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Creative Assets Analytics" description="Metadata-only asset analytics. Binary files are not loaded or exported.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Total assets" value={filtered.assets.length} icon={Layers3} />
              <MetricTile label="Image assets" value={filtered.assets.filter((asset) => !asset.is_video).length} icon={Layers3} />
              <MetricTile label="Video assets" value={filtered.assets.filter((asset) => asset.is_video).length} icon={Layers3} />
              <MetricTile label="Linked assets" value={filtered.assets.filter((asset) => asset.is_linked).length} icon={CheckCircle2} />
              <MetricTile label="Unlinked assets" value={unlinkedAssets} icon={AlertTriangle} />
              <MetricTile label="Missing media URL" value={assetsMissingMedia} icon={AlertTriangle} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.assetTypeCounts} total={filtered.assets.length} emptyText="No asset type data yet" />
              <CountBars counts={analytics.assetStatusCounts} total={filtered.assets.length} emptyText="No asset status data yet" />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Safe Patch / Code Fix Analytics" description="Planning-only development operations. No patches or code execution are run from analytics.">
            <div className="grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.safePatchStatusCounts} total={filtered.safePatchPlans.length} emptyText="No safe patch plans yet" />
              <CountBars counts={analytics.safePatchRiskCounts} total={filtered.safePatchPlans.length} emptyText="No safe patch risk data yet" />
              <CountBars counts={analytics.codeFixIssueCounts} total={filtered.codeFixProposals.length} emptyText="No code fix proposals yet" />
              <CountBars counts={analytics.codeFixSeverityCounts} total={filtered.codeFixProposals.length} emptyText="No code fix severity data yet" />
            </div>
          </AnalyticsSection>
        </div>
      ) : null}

      {activeTab === 'project' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsSection title="Project Analytics" description="Workspace project readiness and operational link coverage.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricTile label="Total projects" value={filtered.projects.length} icon={FolderKanban} />
              <MetricTile label="Active" value={filtered.projects.filter((project) => project.status === 'active').length} icon={CheckCircle2} />
              <MetricTile label="Planning" value={filtered.projects.filter((project) => project.status === 'planning').length} icon={Gauge} />
              <MetricTile label="Ready to deploy" value={filtered.projects.filter((project) => project.status === 'ready_to_deploy').length} icon={ExternalLink} />
              <MetricTile label="Deployed" value={filtered.projects.filter((project) => project.status === 'deployed').length} icon={CheckCircle2} />
              <MetricTile label="Missing GitHub URL" value={filtered.projects.filter((project) => !project.github_url).length} icon={AlertTriangle} />
              <MetricTile label="Missing production URL" value={filtered.projects.filter((project) => !project.production_url).length} icon={AlertTriangle} />
            </div>
            <div className="mt-5">
              <CountBars counts={analytics.projectStatusCounts} total={filtered.projects.length} emptyText="No projects yet" />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Release Analytics" description="Release stability and verification counts from Release Manager records.">
            <div className="grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.releaseStatusCounts} total={filtered.releases.length} emptyText="No releases yet" />
              <CountBars counts={analytics.releaseTypeCounts} total={filtered.releases.length} emptyText="No release type data yet" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Known issues" value={filtered.releases.filter((release) => Boolean(release.known_issues?.trim())).length} icon={AlertTriangle} />
              <MetricTile label="Build failed" value={filtered.releases.filter((release) => release.build_status === 'failed').length} icon={AlertTriangle} />
              <MetricTile label="Typecheck failed" value={filtered.releases.filter((release) => release.typecheck_status === 'failed').length} icon={AlertTriangle} />
              <MetricTile label="Deploy failed" value={filtered.releases.filter((release) => release.deploy_status === 'failed').length} icon={AlertTriangle} />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="GitHub Workflow Analytics" description="Read-only workflow analytics from imported issues and saved PR reviews. No GitHub writes occur.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Linked GitHub issues" value={filtered.githubIssueLinks.length} icon={GitPullRequest} />
              <MetricTile label="Issues converted to tasks" value={filtered.githubIssueLinks.length} icon={Clipboard} />
              <MetricTile label="PR reviews" value={filtered.pullRequestReviews.length} icon={GitPullRequest} />
              <MetricTile label="High risk PR reviews" value={filtered.pullRequestReviews.filter((review) => ['high', 'critical'].includes(review.risk_level)).length} icon={AlertTriangle} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.prRiskCounts} total={filtered.pullRequestReviews.length} emptyText="No PR review risk data yet" />
              <CountBars counts={analytics.prRecommendationCounts} total={filtered.pullRequestReviews.length} emptyText="No PR recommendation data yet" />
            </div>
          </AnalyticsSection>
        </div>
      ) : null}

      {activeTab === 'security' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsSection title="Backup Analytics" description="Backup metadata only. Full backup contents and secrets are not displayed.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Latest backup date" value={latestBackup ? formatDateTime(latestBackup.created_at) : 'No backup'} icon={ShieldCheck} />
              <MetricTile label="Backup records" value={filtered.backups.length} icon={Clipboard} />
              <MetricTile label="Backup warnings" value={filtered.backups.filter((backup) => Boolean(backup.warnings?.trim())).length} icon={AlertTriangle} />
              <MetricTile label="Secrets excluded" value="Yes" helper="Backup Center redacts sensitive fields" icon={ShieldCheck} />
            </div>
            <div className="mt-5">
              <DataTable
                headers={['Date', 'Status', 'Categories', 'Warnings']}
                emptyText="No backup records yet"
                rows={filtered.backups.slice(0, 6).map((backup) => [
                  formatDateTime(backup.created_at),
                  label(backup.status),
                  backup.categories.length > 0 ? backup.categories.join(', ') : 'No categories recorded',
                  backup.warnings || 'None',
                ])}
              />
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Security & System Health Analytics" description="Security audit summaries and current health snapshot. No secrets or raw credentials are shown.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Security issues" value={securityIssues} icon={ShieldCheck} />
              <MetricTile label="Audit records" value={filtered.securityLogs.length} icon={Clipboard} />
              <MetricTile label="System health" value={data.systemHealth ? `${data.systemHealth.score}%` : 'Unavailable'} helper={data.systemHealth?.label} icon={Gauge} />
              <MetricTile label="Needs setup checks" value={data.systemHealth?.needsSetup ?? 0} icon={AlertTriangle} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <CountBars counts={analytics.securitySeverityCounts} total={filtered.securityLogs.length} emptyText="No security audit records yet" />
              <div className="space-y-3">
                {(data.systemHealth?.topActions ?? []).length > 0 ? data.systemHealth?.topActions.map((action) => (
                  <Link key={action.id} href={safeDashboardHref(action.href)} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-3 hover:bg-white">
                    <span className="min-w-0 truncate text-sm font-black text-[#5D6B6B]">{action.title}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
                  </Link>
                )) : <EmptyState title="No system health actions yet" />}
              </div>
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="Operational Guardrails" description="Metrics shown here are real operational records, not inferred marketing performance.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['No fake marketing performance', 'Impressions, clicks, spend, conversions, revenue, ROI, and engagement rate are intentionally omitted unless real provider metrics exist.'],
                ['No secrets exposed', 'Tokens, authorization headers, raw environment values, and provider credentials are excluded from analytics props and reports.'],
                ['Read-only analytics', 'This view does not execute tasks, publish content, change scheduler behavior, write to GitHub, or deploy releases.'],
                ['Workspace scoped', 'Data is fetched server-side from the active workspace and rendered as sanitized summary records.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                  <p className="font-black text-[#5D6B6B]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">{description}</p>
                </div>
              ))}
            </div>
          </AnalyticsSection>
        </div>
      ) : null}
    </section>
  );
}
