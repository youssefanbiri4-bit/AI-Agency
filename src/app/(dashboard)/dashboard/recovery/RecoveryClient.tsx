'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardCopy,
  ExternalLink,
  Filter,
  LifeBuoy,
  RadioTower,
  Search,
} from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CodeInline } from '@/components/ui/TextSafety';
import { toast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import type { ContentStudioPlatform } from '@/types/database';

export type RecoveryIssueCategory =
  | 'failed'
  | 'setup_required'
  | 'approval_pending'
  | 'token_missing'
  | 'quota_limit'
  | 'manual_only'
  | 'unsupported'
  | 'scheduler_failed'
  | 'media_missing'
  | 'asset_missing'
  | 'public_url_missing'
  | 'provider_connection_missing'
  | 'account_selection_missing'
  | 'permission_missing';

export interface RecoveryIssue {
  id: string;
  itemId: string | null;
  title: string;
  platform: ContentStudioPlatform | 'openai' | 'scheduler' | 'media';
  provider: 'OpenAI' | 'Meta' | 'Google Ads' | 'Pinterest' | 'LinkedIn' | 'Scheduler' | 'Media';
  contentType: string;
  status: string;
  category: RecoveryIssueCategory;
  reason: string;
  lastAttemptAt: string | null;
  lastAttemptStatus: string | null;
  nextAction: string;
  fixSteps: string[];
  missing: string[];
  retryable: boolean;
  contentHref: string | null;
  setupHref: string;
  creativeHref: string | null;
  reportText: string;
}

export interface ProviderBlockerGroup {
  provider: string;
  count: number;
  mostCommonBlocker: string;
  nextAction: string;
}

interface RecoveryClientProps {
  issues: RecoveryIssue[];
  providerBlockers: ProviderBlockerGroup[];
  schedulerIssues: RecoveryIssue[];
}

type CategoryFilter = RecoveryIssueCategory | 'all' | 'scheduler';
type ProviderFilter = RecoveryIssue['provider'] | 'all';
type PlatformFilter = ContentStudioPlatform | 'all';

const categoryFilters: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All issues' },
  { value: 'failed', label: 'Failed' },
  { value: 'setup_required', label: 'Setup Required' },
  { value: 'approval_pending', label: 'Approval Pending' },
  { value: 'token_missing', label: 'Token Missing' },
  { value: 'manual_only', label: 'Manual Only' },
  { value: 'unsupported', label: 'Unsupported' },
  { value: 'scheduler', label: 'Scheduler' },
];

const platformFilters: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const providerFilters: Array<{ value: ProviderFilter; label: string }> = [
  { value: 'all', label: 'All providers' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Meta', label: 'Meta' },
  { value: 'Google Ads', label: 'Google Ads' },
  { value: 'Pinterest', label: 'Pinterest' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Scheduler', label: 'Scheduler' },
  { value: 'Media', label: 'Media' },
];

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    failed: 'فشل',
    setup_required: 'الإعداد مطلوب',
    approval_pending: 'قيد المراجعة',
    token_missing: 'Token missing',
    quota_limit: 'Quota limit',
    manual_only: 'Manual only',
    unsupported: 'Unsupported',
    scheduler_failed: 'Scheduler failed',
    media_missing: 'Media missing',
    asset_missing: 'Asset missing',
    public_url_missing: 'Public URL missing',
    provider_connection_missing: 'Provider connection missing',
    account_selection_missing: 'Account selection missing',
    permission_missing: 'Permission missing',
  };

  return labels[value] ?? value.replace(/_/g, ' ');
}

function issueStatusForBadge(issue: RecoveryIssue): Parameters<typeof StatusBadge>[0]['status'] {
  if (issue.category === 'scheduler_failed') return 'failed';
  if (issue.category === 'media_missing' || issue.category === 'asset_missing') return 'setup_required';
  if (issue.category === 'public_url_missing') return 'setup_required';
  if (issue.category === 'provider_connection_missing') return 'setup_required';
  if (issue.category === 'account_selection_missing') return 'setup_required';
  if (issue.category === 'permission_missing') return 'setup_required';
  if (!issue.retryable && issue.category === 'failed') return 'needs_fix';
  return issue.category as Parameters<typeof StatusBadge>[0]['status'];
}

function buildRecoveryReport(issues: RecoveryIssue[], blockers: ProviderBlockerGroup[]) {
  const failed = issues.filter((issue) => issue.category === 'failed' || issue.category === 'scheduler_failed').length;
  const setup = issues.filter((issue) => issue.category === 'setup_required' || issue.category === 'provider_connection_missing').length;
  const approval = issues.filter((issue) => issue.category === 'approval_pending').length;
  const topIssues = issues.slice(0, 5);

  return [
    'AgentFlow AI Recovery Report',
    '',
    `Total issues: ${issues.length}`,
    `Failed: ${failed}`,
    `Setup required: ${setup}`,
    `Approval pending: ${approval}`,
    '',
    'Provider blockers:',
    ...blockers.map((blocker) => `- ${blocker.provider}: ${blocker.count} issue(s). ${blocker.mostCommonBlocker}. Next: ${blocker.nextAction}`),
    '',
    'Top items needing action:',
    ...topIssues.map((issue) => `- ${issue.title} / ${issue.provider} / ${categoryLabel(issue.category)}: ${issue.nextAction}`),
    '',
    'Next best actions:',
    '- Open Provider Setup for setup, token, account, or approval blockers.',
    '- Open Content Studio items for missing copy/media or retry from the existing item workflow.',
    '- Run Scheduler Now only from existing admin scheduler controls when setup is ready.',
  ].join('\n');
}

export function RecoveryClient({
  issues,
  providerBlockers,
  schedulerIssues,
}: RecoveryClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [retryableOnly, setRetryableOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(issues[0]?.id ?? null);

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        if (categoryFilter === 'scheduler') {
          if (issue.provider !== 'Scheduler' && issue.category !== 'scheduler_failed') return false;
        } else if (categoryFilter !== 'all' && issue.category !== categoryFilter) {
          return false;
        }

        if (platformFilter !== 'all' && issue.platform !== platformFilter) {
          return false;
        }

        if (providerFilter !== 'all' && issue.provider !== providerFilter) {
          return false;
        }

        if (retryableOnly && !issue.retryable) {
          return false;
        }

        if (query.trim()) {
          const haystack = [issue.title, issue.reason, issue.nextAction, issue.provider, issue.contentType]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query.trim().toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    [categoryFilter, issues, platformFilter, providerFilter, query, retryableOnly]
  );

  const selectedIssue =
    filteredIssues.find((issue) => issue.id === selectedIssueId) ??
    filteredIssues[0] ??
    null;

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error('تعذر نسخ التقرير.');
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader
          title="Recovery Filters"
          description="Narrow the workspace by issue category, platform, provider, retryability, or item text."
          action={<Filter className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search issues"
              className="ps-9"
            />
          </div>
          <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}>
            {categoryFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </Select>
          <Select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as PlatformFilter)}>
            {platformFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </Select>
          <Select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}>
            {providerFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm font-bold text-black/64">
            <input
              type="checkbox"
              checked={retryableOnly}
              onChange={(event) => setRetryableOnly(event.currentTarget.checked)}
              className="h-4 w-4 rounded border-black/18 text-[#F7CBCA] focus:ring-[#F7CBCA]"
            />
            Retryable only
          </label>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card>
          <CardHeader
            title="Issue List"
            description={`${filteredIssues.length} issue${filteredIssues.length === 1 ? '' : 's'} match the current filters.`}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyText('Recovery report', buildRecoveryReport(issues, providerBlockers))}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy Recovery Report
              </Button>
            }
          />

          {filteredIssues.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="No recovery issues found"
              description="Everything looks clear. Create or schedule content to continue tracking publishing readiness."
              action={
                <Link href="/dashboard/content-studio" className={buttonStyles({ variant: 'secondary' })}>
                  Open Content Studio
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={cn(
                    'w-full rounded-lg border p-4 text-start shadow-sm transition-colors',
                    selectedIssue?.id === issue.id
                      ? 'border-[#F7CBCA]/35 bg-[#D5E5E5]/42'
                      : 'border-black/8 bg-white hover:border-[#F7CBCA]/20 hover:bg-[#F1F7F7]'
                  )}
                >
                  <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-black text-[#5D6B6B]">{issue.title}</p>
                        <StatusBadge status={issueStatusForBadge(issue)} type="system" size="sm" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-black/58">{issue.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-black/46">
                        <span>{issue.provider}</span>
                        <span>{issue.contentType}</span>
                        <span>{categoryLabel(issue.category)}</span>
                        {issue.lastAttemptAt ? <span>{formatDateTime(issue.lastAttemptAt)}</span> : null}
                      </div>
                    </div>
                    <span className="w-fit min-w-fit rounded-full border border-black/8 bg-[#F1F7F7] px-3 py-1 text-xs font-black leading-5 text-black/58">
                      {issue.retryable ? 'Retryable' : 'يحتاج إلى إصلاح'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Issue Details"
            description="Safe summary, missing setup, and recommended next actions. Secrets and raw credentials are never shown."
            action={<AlertTriangle className="h-5 w-5 text-[#F7CBCA]" />}
          />
          {!selectedIssue ? (
            <p className="text-sm text-black/56">Select an issue to see recovery details.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F7CBCA]">What happened</p>
                <h3 className="mt-1 break-words text-xl font-black text-[#5D6B6B]">{selectedIssue.title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/60">{selectedIssue.reason}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Provider</p>
                  <p className="mt-1 font-bold text-[#5D6B6B]">{selectedIssue.provider}</p>
                </div>
                <div className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-black/38">Last Attempt</p>
                  <p className="mt-1 font-bold text-[#5D6B6B]">
                    {selectedIssue.lastAttemptAt ? formatDateTime(selectedIssue.lastAttemptAt) : 'No attempt logged'}
                  </p>
                </div>
              </div>
              {selectedIssue.missing.length > 0 ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-black/38">Missing setup</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedIssue.missing.map((entry) => (
                      <span key={entry} className="rounded-full border border-[#F7CBCA]/18 bg-[#D5E5E5]/55 px-3 py-1 text-xs font-bold text-[#F7CBCA]">
                        <CodeInline>{entry}</CodeInline>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/38">Recommended fix steps</p>
                <ul className="mt-2 space-y-2">
                  {selectedIssue.fixSteps.map((step) => (
                    <li key={step} className="rounded-lg border border-black/8 bg-white px-3 py-2 text-sm leading-6 text-black/62">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedIssue.contentHref ? (
                  <Link href={selectedIssue.contentHref} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                    Open Content Item
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link href={selectedIssue.setupHref} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                  Open Provider Setup
                </Link>
                {selectedIssue.creativeHref ? (
                  <Link href={selectedIssue.creativeHref} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                    Open Creative Assets
                  </Link>
                ) : null}
                <Link
                  href={`/dashboard/safe-patch-planner?context=${encodeURIComponent(selectedIssue.reportText)}`}
                  className={buttonStyles({ variant: 'outline', size: 'sm' })}
                >
                  Plan Fix
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText('Error summary', selectedIssue.reportText)}
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Copy Error Summary
                </Button>
              </div>
              <p className="text-sm leading-6 text-black/54">
                Retry behavior: use the existing content item workflow after setup is fixed. This center does not introduce new provider execution.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Provider Blockers Board"
          description="Grouped by provider so the manager can clear the biggest operational blockers first."
          action={<RadioTower className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {providerBlockers.map((blocker) => (
            <div key={blocker.provider} className="rounded-lg border border-black/8 bg-[#F1F7F7]/62 p-4">
              <p className="font-black text-[#5D6B6B]">{blocker.provider}</p>
              <p className="mt-2 text-3xl font-black text-[#F7CBCA]">{blocker.count}</p>
              <p className="mt-2 text-sm leading-6 text-black/58">{blocker.mostCommonBlocker}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-black/66">{blocker.nextAction}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scheduler Recovery"
          description="Scheduled items that failed, became setup-required, are approval-pending, or appear stuck."
        />
        {schedulerIssues.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/10 bg-white p-4 text-sm text-black/56">
            No scheduler recovery issues found.
          </p>
        ) : (
          <div className="space-y-3">
            {schedulerIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-black/8 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-black text-[#5D6B6B]">{issue.title}</p>
                    <p className="mt-1 text-sm leading-6 text-black/58">{issue.reason}</p>
                  </div>
                  <StatusBadge status={issueStatusForBadge(issue)} type="system" size="sm" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {issue.contentHref ? (
                    <Link href={issue.contentHref} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                      Open Item
                    </Link>
                  ) : null}
                  <Link href="/dashboard/settings#provider-setup-wizard" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                    Open Provider Setup
                  </Link>
                  <Link href="/dashboard" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                    Run Scheduler Now
                  </Link>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText('Scheduler summary', issue.reportText)}>
                    Copy Scheduler Summary
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
