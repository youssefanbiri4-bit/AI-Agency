'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clipboard, ExternalLink, Search } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';

export interface PublishAttemptTimelineItem {
  id: string;
  createdAt: string;
  provider: string;
  actionType: string;
  contentItemId: string | null;
  contentTitle: string;
  contentType: string;
  status: string;
  message: string;
  externalId: string | null;
  safeSummary: string;
}

interface OperationalReportClientProps {
  attempts: PublishAttemptTimelineItem[];
  reportText: string;
}

export function CopyOperationalReportButton({
  reportText,
  label = 'Copy Operational Report',
}: {
  reportText: string;
  label?: string;
}) {
  const toast = useToast();

  async function copyReportSummary() {
    await navigator.clipboard.writeText(reportText);
    toast.success('Report copied.', {
      description: 'Operational report summary is ready to share.',
    });
  }

  return (
    <button type="button" className={buttonStyles()} onClick={copyReportSummary}>
      <Clipboard className="h-4 w-4" />
      {label}
    </button>
  );
}

function matchesDate(value: string, range: string) {
  if (range === 'all') {
    return true;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const days = Number(range);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
}

export function OperationalReportClient({ attempts, reportText }: OperationalReportClientProps) {
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [contentType, setContentType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [search, setSearch] = useState('');

  const providers = useMemo(
    () => Array.from(new Set(attempts.map((attempt) => attempt.provider))).sort(),
    [attempts]
  );
  const statuses = useMemo(
    () => Array.from(new Set(attempts.map((attempt) => attempt.status))).sort(),
    [attempts]
  );
  const contentTypes = useMemo(
    () => Array.from(new Set(attempts.map((attempt) => attempt.contentType))).sort(),
    [attempts]
  );

  const filteredAttempts = attempts.filter((attempt) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      attempt.contentTitle.toLowerCase().includes(normalizedSearch) ||
      attempt.message.toLowerCase().includes(normalizedSearch) ||
      attempt.externalId?.toLowerCase().includes(normalizedSearch);

    return (
      matchesSearch &&
      (provider === 'all' || attempt.provider === provider) &&
      (status === 'all' || attempt.status === status) &&
      (contentType === 'all' || attempt.contentType === contentType) &&
      matchesDate(attempt.createdAt, dateRange)
    );
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">Publish Operations</p>
          <h2 className="mt-2 break-words text-2xl font-black tracking-normal text-[#5D6B6B]">
            Publish Attempts Timeline
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
            Real Content Studio publish and draft-creation attempts. Secrets and raw credentials are never shown.
          </p>
        </div>

        <CopyOperationalReportButton reportText={reportText} />
      </div>

      <div className="grid min-w-0 gap-3 rounded-2xl border border-black/7 bg-white/90 p-4 shadow-[0_18px_42px_rgba(93,107,107,0.06)] lg:grid-cols-[minmax(0,1fr)_150px_160px_190px_150px]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
          <Input
            type="search"
            placeholder="Search attempts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ps-10"
          />
        </div>
        <Select aria-label="Provider filter" value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option value="all">All providers</option>
          {providers.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select aria-label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Content type filter"
          value={contentType}
          onChange={(event) => setContentType(event.target.value)}
        >
          <option value="all">All content types</option>
          {contentTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select aria-label="Date range filter" value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
          <option value="all">All dates</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </div>

      <Card className="rounded-2xl border-black/7 bg-white/92 shadow-[0_22px_55px_rgba(93,107,107,0.08)]">
        <CardHeader
          title="Publish Attempts"
          description={`${filteredAttempts.length} of ${attempts.length} attempts shown`}
        />

        {attempts.length === 0 ? (
          <EmptyState
            icon={Clipboard}
            title="No publish attempts yet"
            description="Create or schedule content from Content & Ads Studio to start tracking activity."
          />
        ) : filteredAttempts.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No attempts match these filters"
            description="Try another provider, status, content type, date range, or search term."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#F1F7F7] text-xs font-black uppercase tracking-[0.14em] text-black/42">
                  <th className="rounded-l-xl border-y border-l border-black/7 px-3 py-3">Date</th>
                  <th className="border-y border-black/7 px-3 py-3">Provider</th>
                  <th className="border-y border-black/7 px-3 py-3">Action</th>
                  <th className="border-y border-black/7 px-3 py-3">Content item</th>
                  <th className="border-y border-black/7 px-3 py-3">Status</th>
                  <th className="border-y border-black/7 px-3 py-3">Message</th>
                  <th className="border-y border-black/7 px-3 py-3">External ID</th>
                  <th className="rounded-r-xl border-y border-r border-black/7 px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} className="align-top transition-colors hover:bg-[#F1F7F7]/75">
                    <td className="border-b border-black/6 px-3 py-4 font-medium text-black/62">
                      {formatDateTime(attempt.createdAt)}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 font-bold text-black">
                      {attempt.provider}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4 text-black/62">
                      {attempt.actionType}
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      {attempt.contentItemId ? (
                        <Link
                          href={`/dashboard/content-studio?item=${attempt.contentItemId}`}
                          className="inline-flex max-w-[220px] items-center gap-1.5 break-words font-bold text-black hover:text-[#F7CBCA]"
                        >
                          {attempt.contentTitle}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </Link>
                      ) : (
                        <span className="font-medium text-black/50">{attempt.contentTitle}</span>
                      )}
                      <p className="mt-1 text-xs font-medium text-black/42">{attempt.contentType}</p>
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      <StatusBadge
                        status={attempt.status as Parameters<typeof StatusBadge>[0]['status']}
                        type="system"
                        size="sm"
                      />
                    </td>
                    <td className="max-w-[260px] border-b border-black/6 px-3 py-4 text-black/62">
                      {attempt.message || 'No message recorded.'}
                    </td>
                    <td className="max-w-[210px] border-b border-black/6 px-3 py-4 font-mono text-xs text-black/58">
                      <span className="block truncate">{attempt.externalId || 'none'}</span>
                    </td>
                    <td className="border-b border-black/6 px-3 py-4">
                      {attempt.contentItemId ? (
                        <Link
                          href={`/dashboard/content-studio?item=${attempt.contentItemId}`}
                          className={buttonStyles({ variant: 'outline', size: 'sm' })}
                        >
                          Open
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-black/42">No item</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
