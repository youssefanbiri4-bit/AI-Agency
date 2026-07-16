'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/FormControls';
import { cn, formatDateTime } from '@/lib/utils';
import { useAdvancedAnalytics } from './useAdvancedAnalytics';
import { dateRanges, platforms, statuses, tabs } from './analytics-constants';
import { label, providerKey, inRange } from './analytics-utils';
import {
  MetricTile,
  AnalyticsSection,
  CountBars,
  EmptyState,
  DataTable,
  NextActionsList,
} from './analytics-components';
import type {
  AdvancedAnalyticsData,
  DateRangeFilter,
  PlatformFilter,
  StatusFilter,
  AnalyticsTab,
} from './analytics-types';

export type {
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
  AdvancedAnalyticsData,
} from './analytics-types';

export function AdvancedAnalyticsClient({ data }: { data: AdvancedAnalyticsData }) {
  const [range, setRange] = useState<DateRangeFilter>('last_30_days');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('advanced');
  const [copyState, setCopyState] = useState<string | null>(null);

  const { filtered, analytics } = useAdvancedAnalytics(data, range, platform, status);

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
    ['failed', 'setup_required'].includes(item.status),
  ).length;
  const tasksNeedingReview = filtered.tasks.filter((task) => task.status === 'needs_review').length;
  const completedTasks = filtered.tasks.filter((task) => task.status === 'completed').length;
  const activeProjects = filtered.projects.filter((project) => project.status === 'active').length;
  const deployedReleases = filtered.releases.filter((release) => release.status === 'deployed').length;
  const providerBlockers = data.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status)).length;
  const securityIssues = filtered.securityLogs.filter((log) => ['critical', 'high', 'medium'].includes(log.severity)).length;
  const latestBackup = data.backups[0];
  const scheduledPending = filtered.content.filter(
    (item) => item.status === 'scheduled' && (!item.scheduled_execution_status || item.scheduled_execution_status === 'pending'),
  ).length;
  const schedulerSucceeded = filtered.content.filter((item) => item.scheduled_execution_status === 'succeeded').length;
  const schedulerFailed = filtered.content.filter((item) => item.scheduled_execution_status === 'failed').length;
  const schedulerProcessing = filtered.content.filter((item) => item.scheduled_execution_status === 'processing').length;
  const missingCreativeAssets = filtered.content.filter((item) => item.asset_ids.length === 0).length;
  const missingSchedule = filtered.content.filter((item) => item.status === 'ready' && !item.schedule_at).length;
  const manualOnly = filtered.content.filter((item) => item.provider_status === 'manual_only' || item.content_type === 'linkedin_post_planner').length;
  const blockedByProvider = filtered.content.filter((item) =>
    ['setup_required', 'approval_pending', 'failed', 'manual_only'].includes(item.provider_status ?? ''),
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
                : 'border-black/10 bg-white text-black/62 hover:border-[#F7CBCA]/35 hover:text-[#F7CBCA]',
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
            <NextActionsList actions={analytics.nextActions} />
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
                  <a key={action.id} href={action.href} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-3 hover:bg-white">
                    <span className="min-w-0 truncate text-sm font-black text-[#5D6B6B]">{action.title}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-[#F7CBCA]" />
                  </a>
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
