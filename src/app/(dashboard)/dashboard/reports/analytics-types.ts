export type DateRangeFilter = 'this_month' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all_time';
export type PlatformFilter = 'all' | 'instagram' | 'facebook' | 'google_ads' | 'pinterest' | 'linkedin';
export type StatusFilter =
  | 'all'
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'setup_required'
  | 'approval_pending'
  | 'manual_only';
export type AnalyticsTab =
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

export interface NextAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  href: string;
  cta: string;
}

export interface FilteredData {
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
  notifications: AdvancedAnalyticsNotification[];
}
