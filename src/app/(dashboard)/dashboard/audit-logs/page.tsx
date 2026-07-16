import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  History,
  Info,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import {
  queryAuditLogs,
  getAuditLogStats,
  getDistinctEventTypes,
  getRetentionSummary,
  RETENTION_DAYS,
  type AuditLogFilter,
  type AuditLogSeverity,
} from '@/lib/data/audit-logs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { buttonStyles } from '@/components/ui/Button';
import { CodeInline } from '@/components/ui/TextSafety';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { cn } from '@/lib/utils';

// ─── Server Component ──────────────────────────────────────────────────────

interface AuditLogsPageProps {
  searchParams: Promise<{
    search?: string;
    severity?: string;
    eventType?: string;
    entityType?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

const SEVERITY_STYLES: Record<AuditLogSeverity, string> = {
  critical: 'bg-[#F7CBCA]/16 text-[#A30D1D] border-[#F7CBCA]/35',
  warning: 'bg-[#F7CBCA]/10 text-[#B51F30] border-[#F7CBCA]/25',
  info: 'bg-[#E8F8EF] text-[#0F5F3E] border-[#0F7A4F]/20',
};

const SEVERITY_ICONS: Record<AuditLogSeverity, React.ReactNode> = {
  critical: <ShieldAlert className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />,
};

function SeverityBadge({ severity }: { severity: AuditLogSeverity }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold leading-5',
        SEVERITY_STYLES[severity]
      )}
    >
      {SEVERITY_ICONS[severity]}
      {severity}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!user || !workspaceResult.data) {
    return (
      <Notice tone="warning" title="Audit Logs unavailable">
        Authentication and an active workspace are required.
      </Notice>
    );
  }

  // Check admin permission
  const role = normalizeWorkspaceRole(
    null,
    workspaceResult.data,
    user.id
  );

  if (!hasPermission(role, 'admin')) {
    return <AccessDenied />;
  }

  const params = await searchParams;

  // Parse filters from search params
  const filter: AuditLogFilter = {
    search: params.search || undefined,
    severity: params.severity
      ? (params.severity.split(',') as AuditLogSeverity[])
      : undefined,
    eventType: params.eventType || undefined,
    entityType: params.entityType || undefined,
    userId: params.userId || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    page: params.page ? Math.max(1, Number(params.page)) : 1,
    pageSize: 25,
  };

  // Fetch data
  const [logsResult, statsResult, retentionResult, eventTypesResult] = await Promise.all([
    queryAuditLogs(supabase, workspaceResult.data.id, filter),
    getAuditLogStats(supabase, workspaceResult.data.id),
    getRetentionSummary(supabase, workspaceResult.data.id),
    getDistinctEventTypes(supabase, workspaceResult.data.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Security Monitoring"
        title="Audit Log Viewer"
        description="Review security-sensitive events, authentication attempts, permission changes, and system operations. Logs are retained according to severity-based retention policy."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/audit-logs/export?format=json&${new URLSearchParams(
                Object.fromEntries(
                  Object.entries(params).filter(([k]) => k !== 'page')
                )
              ).toString()}`}
              className={buttonStyles({ variant: 'outline' })}
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Link>
            <Link
              href={`/dashboard/audit-logs/export?format=csv&${new URLSearchParams(
                Object.fromEntries(
                  Object.entries(params).filter(([k]) => k !== 'page')
                )
              ).toString()}`}
              className={buttonStyles({ variant: 'outline' })}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
            <Link href="/dashboard/security" className={buttonStyles({ variant: 'outline' })}>
              <ShieldAlert className="h-4 w-4" />
              Security Center
            </Link>
          </div>
        }
      />

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Total Events</p>
          <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{statsResult.data?.total ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Critical</p>
          <p className="mt-2 text-2xl font-black text-[#A30D1D]">{statsResult.data?.bySeverity.critical ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Warnings</p>
          <p className="mt-2 text-2xl font-black text-[#B51F30]">{statsResult.data?.bySeverity.warning ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">Info</p>
          <p className="mt-2 text-2xl font-black text-[#0F5F3E]">{statsResult.data?.bySeverity.info ?? 0}</p>
        </Card>
      </div>

      {/* Filter form */}
      <Card>
        <CardHeader
          title="Filters"
          description="Search and filter audit log entries."
          action={<Search className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              Search
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={params.search ?? ''}
              placeholder="Search event type, message, entity..."
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80 placeholder:text-black/35"
            />
          </div>
          <div className="w-[150px]">
            <label htmlFor="severity" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              defaultValue={params.severity ?? ''}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="critical,warning">Critical + Warning</option>
            </select>
          </div>
          <div className="w-[200px]">
            <label htmlFor="eventType" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              Event Type
            </label>
            <select
              id="eventType"
              name="eventType"
              defaultValue={params.eventType ?? ''}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80"
            >
              <option value="">All event types</option>
              {(eventTypesResult.data ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[150px]">
            <label htmlFor="entityType" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              Entity Type
            </label>
            <input
              id="entityType"
              name="entityType"
              type="text"
              defaultValue={params.entityType ?? ''}
              placeholder="e.g. task, api_key"
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80 placeholder:text-black/35"
            />
          </div>
          <div className="w-[160px]">
            <label htmlFor="userId" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              Actor (user id)
            </label>
            <input
              id="userId"
              name="userId"
              type="text"
              defaultValue={params.userId ?? ''}
              placeholder="user uuid"
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80 placeholder:text-black/35"
            />
          </div>
          <div className="w-[150px]">
            <label htmlFor="dateFrom" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              From
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={params.dateFrom ?? ''}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80"
            />
          </div>
          <div className="w-[150px]">
            <label htmlFor="dateTo" className="block text-xs font-bold uppercase tracking-[0.12em] text-black/42 mb-1">
              To
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={params.dateTo ?? ''}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/80"
            />
          </div>
          <button
            type="submit"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
          >
            <Search className="h-4 w-4" />
            Apply
          </button>
          <Link
            href="/dashboard/audit-logs"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            Clear
          </Link>
        </form>
      </Card>

      {/* Logs table */}
      <Card>
        <CardHeader
          title="Security Events"
          description={
            logsResult.data
              ? `Showing ${logsResult.data.records.length} of ${logsResult.data.total} records (page ${logsResult.data.page} of ${logsResult.data.totalPages})`
              : 'No records found'
          }
        />

        {logsResult.error ? (
          <Notice tone="danger" title="Query failed">
            {logsResult.error}
          </Notice>
        ) : logsResult.data && logsResult.data.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                  <th className="px-3 py-3 w-[160px]">Timestamp</th>
                  <th className="px-3 py-3 w-[90px]">Severity</th>
                  <th className="px-3 py-3 w-[180px]">Event Type</th>
                  <th className="px-3 py-3">Message</th>
                  <th className="px-3 py-3 w-[100px]">Entity</th>
                  <th className="px-3 py-3 w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logsResult.data.records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-black/6 align-top hover:bg-[#F1F7F7]/40 transition-colors"
                  >
                    <td className="px-3 py-3 text-xs text-black/58 whitespace-nowrap">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <SeverityBadge severity={record.severity} />
                    </td>
                    <td className="px-3 py-3">
                      <CodeInline>{record.eventType}</CodeInline>
                    </td>
                    <td className="px-3 py-3 text-black/68 max-w-[400px] break-words">
                      {record.message || <span className="text-black/35 italic">No message</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-black/52">
                      {record.entityType ? (
                        <span>
                          {record.entityType}
                          {record.entityId && `:${record.entityId.slice(0, 8)}`}
                        </span>
                      ) : (
                        <span className="text-black/35 italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-bold text-[#5D6B6B] hover:text-[#F7CBCA] transition-colors">
                          Details
                        </summary>
                        <div className="mt-2 rounded-lg border border-black/8 bg-[#F1F7F7]/72 p-3 text-xs text-black/58 whitespace-pre-wrap max-w-[300px] break-words">
                          <p><strong>ID:</strong> {record.id}</p>
                          {record.userId && <p><strong>User:</strong> {record.userId.slice(0, 12)}...</p>}
                          {record.ipHash && <p><strong>IP Hash:</strong> {record.ipHash}</p>}
                          {record.entityId && <p><strong>Entity ID:</strong> {record.entityId}</p>}
                          {Object.keys(record.metadata).length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[#5D6B6B]">Metadata</summary>
                              <pre className="mt-1 text-[10px] leading-4">
                                {JSON.stringify(record.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-6 text-center">
            <History className="mx-auto h-10 w-10 text-[#F7CBCA]" />
            <p className="mt-3 font-black text-[#5D6B6B]">No audit log entries found</p>
            <p className="mt-1 text-sm text-black/55">
              {filter.search || filter.severity || filter.eventType
                ? 'Try adjusting your filters.'
                : 'Audit events will appear here as security-sensitive operations are performed.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {logsResult.data && logsResult.data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {logsResult.data.page > 1 && (
              <Link
                href={`/dashboard/audit-logs?page=${logsResult.data.page - 1}${params.search ? `&search=${params.search}` : ''}${params.severity ? `&severity=${params.severity}` : ''}${params.eventType ? `&eventType=${params.eventType}` : ''}${params.entityType ? `&entityType=${params.entityType}` : ''}${params.userId ? `&userId=${params.userId}` : ''}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ''}${params.dateTo ? `&dateTo=${params.dateTo}` : ''}`}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-black/58">
              Page {logsResult.data.page} of {logsResult.data.totalPages}
            </span>
            {logsResult.data.page < logsResult.data.totalPages && (
              <Link
                href={`/dashboard/audit-logs?page=${logsResult.data.page + 1}${params.search ? `&search=${params.search}` : ''}${params.severity ? `&severity=${params.severity}` : ''}${params.eventType ? `&eventType=${params.eventType}` : ''}${params.entityType ? `&entityType=${params.entityType}` : ''}${params.userId ? `&userId=${params.userId}` : ''}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ''}${params.dateTo ? `&dateTo=${params.dateTo}` : ''}`}
                className={buttonStyles({ variant: 'outline', size: 'sm' })}
              >
                Next
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* Retention info */}
      <Notice tone="info" title="Retention Policy & Compliance">
        <p className="text-sm leading-6">
          Audit logs are automatically cleaned up based on severity:
          <strong className="ml-1">critical</strong> ({RETENTION_DAYS.critical} days),
          <strong className="ml-1">warning</strong> ({RETENTION_DAYS.warning} days),
          <strong className="ml-1">info</strong> ({RETENTION_DAYS.info} days).
          Old logs are deleted by a scheduled cron job. This policy ensures
          compliance (GDPR storage limitation) while managing storage costs.
        </p>
        {retentionResult.data && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-black/8 bg-white/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">Total retained</p>
              <p className="mt-1 text-lg font-black text-[#5D6B6B]">{retentionResult.data.total}</p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">Eligible for deletion</p>
              <p className="mt-1 text-lg font-black text-[#B51F30]">{retentionResult.data.eligibleForDeletion}</p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white/60 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-black/42">Next scheduled cleanup</p>
              <p className="mt-1 text-sm font-bold text-[#0F5F3E]">Daily cron</p>
            </div>
          </div>
        )}
        {retentionResult.data && retentionResult.data.eligibleForDeletion > 0 && (
          <p className="mt-3 text-xs text-black/55">
            {retentionResult.data.eligibleBySeverity.critical} critical,{' '}
            {retentionResult.data.eligibleBySeverity.warning} warning, and{' '}
            {retentionResult.data.eligibleBySeverity.info} info records are past their
            retention window and will be purged on the next run.
          </p>
        )}
      </Notice>
    </div>
  );
}
