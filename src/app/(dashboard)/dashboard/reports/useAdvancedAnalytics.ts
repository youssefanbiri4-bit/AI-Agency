import { useMemo } from 'react';
import { countBy, providerKey, filterData, buildNextActions, buildMarkdownReport } from './analytics-utils';
import { dateRanges } from './analytics-constants';
import type { AdvancedAnalyticsData, DateRangeFilter, PlatformFilter, StatusFilter } from './analytics-types';

export function useAdvancedAnalytics(
  data: AdvancedAnalyticsData,
  range: DateRangeFilter,
  platform: PlatformFilter,
  status: StatusFilter,
) {
  const filtered = useMemo(
    () => filterData(data, range, platform, status),
    [data, platform, range, status],
  );

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
      const providerContent = filtered.content.filter(
        (item) => providerKey(item.platform) === providerKey(name) || name.toLowerCase().includes(item.platform.replace('_', ' ')),
      );
      const blockers = providerContent.filter(
        (item) =>
          ['failed', 'setup_required', 'approval_pending', 'manual_only'].includes(item.status) ||
          ['failed', 'setup_required', 'approval_pending', 'manual_only'].includes(item.provider_status ?? ''),
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

  return { filtered, analytics };
}
