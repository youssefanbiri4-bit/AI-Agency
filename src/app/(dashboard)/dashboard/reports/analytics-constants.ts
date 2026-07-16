import type { DateRangeFilter, PlatformFilter, StatusFilter, AnalyticsTab } from './analytics-types';

export const dateRanges: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all_time', label: 'All time' },
];

export const platforms: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export const statuses: Array<{ value: StatusFilter; label: string }> = [
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

export const tabs: Array<{ value: AnalyticsTab; label: string }> = [
  { value: 'advanced', label: 'Advanced Analytics' },
  { value: 'provider', label: 'Provider Analytics' },
  { value: 'work', label: 'Work Analytics' },
  { value: 'project', label: 'Project Analytics' },
  { value: 'security', label: 'Security & Backup' },
];
