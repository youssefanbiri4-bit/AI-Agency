'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ClipboardCheck, FileText, Search } from 'lucide-react';
import type { GeneratedReportItem } from '@/features/reports/data/reports';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/FormControls';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/utils';

type DepartmentFilter = 'all' | 'research' | 'content' | 'sales';
type StatusFilter = 'all' | 'completed' | 'needs_review';

interface ReportsListClientProps {
  reports: GeneratedReportItem[];
}

function getDepartmentFilterKey(report: GeneratedReportItem): Exclude<DepartmentFilter, 'all'> | 'other' {
  const value = `${report.departmentKey} ${report.departmentLabel}`.toLowerCase();

  if (value.includes('research')) return 'research';
  if (value.includes('content')) return 'content';
  if (value.includes('sales')) return 'sales';

  return 'other';
}

function getReportDateLabel(report: GeneratedReportItem) {
  if (report.completedAt) {
    return `Completed ${formatDateTime(report.completedAt)}`;
  }

  return `Updated ${formatDateTime(report.updatedAt)}`;
}

export function ReportsListClient({ reports }: ReportsListClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredReports = reports.filter((report) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      report.title.toLowerCase().includes(normalizedSearch) ||
      report.summaryPreview.toLowerCase().includes(normalizedSearch) ||
      report.agentName.toLowerCase().includes(normalizedSearch);
    const matchesDepartment =
      departmentFilter === 'all' || getDepartmentFilterKey(report) === departmentFilter;
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
            Report Library
          </p>
          <h2 className="mt-2 break-words text-2xl font-black tracking-normal text-black">
            Generated Reports
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
            Client-ready reports derived from completed and review-ready task output.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-lg border border-[#F7CBCA]/8 bg-white/58 px-3 py-2 text-sm font-bold text-black shadow-sm backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
          {filteredReports.length} of {reports.length} reports
        </div>
      </div>

      <div className="grid min-w-0 gap-3 rounded-lg border border-[#F7CBCA]/8 bg-white/58 p-4 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] lg:grid-cols-[minmax(0,1fr)_190px_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/34" />
          <Input
            type="search"
            placeholder="Search reports by title, summary, or agent"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="ps-10"
          />
        </div>

        <Select
          aria-label="Filter reports by department"
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value as DepartmentFilter)}
        >
          <option value="all">All Departments</option>
          <option value="research">Research</option>
          <option value="content">Content</option>
          <option value="sales">Sales</option>
        </Select>

        <Select
          aria-label="Filter reports by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="needs_review">Needs Review</option>
        </Select>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No generated reports yet. Run and approve tasks to create reports."
          description="Completed and review-ready structured outputs will appear here."
          action={
            <Link href="/dashboard/tasks" className={buttonStyles()}>
              View Tasks
            </Link>
          }
        />
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No reports match these filters"
          description="Try another report title, summary, agent, department, or status."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filteredReports.map((report) => (
            <Card key={report.taskId}>
              <CardHeader
                title={report.title}
                description={report.summaryPreview}
                action={<StatusBadge status={report.status} type="task" size="sm" />}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Agent</p>
                  <p className="mt-1 break-words text-sm font-semibold text-black">{report.agentName}</p>
                </div>
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Department</p>
                  <p className="mt-1 break-words text-sm font-semibold text-black">
                    {report.departmentLabel}
                  </p>
                </div>
                <div className="muted-panel p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/38">Report Date</p>
                  <p className="mt-1 text-sm font-semibold text-black">{getReportDateLabel(report)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/62">
                  <FileText className="h-3.5 w-3.5" />
                  {report.recommendationsCount} recommendations
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/62">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {report.nextActionsCount} next actions
                </span>
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/62">
                  {report.qualityNotesCount} quality notes
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-black/52">
                  {report.agentType} / Created {formatDateTime(report.createdAt)}
                </p>
                <Link href={report.href} className={buttonStyles({ size: 'sm' })}>
                  Open Report
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
