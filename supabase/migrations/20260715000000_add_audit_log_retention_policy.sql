-- AgentFlow-AI: Audit Log Retention Policy
-- 
-- Provides a database-level function to clean up old audit log entries
-- according to severity-based retention periods.
--
-- Retention periods:
--   critical: 365 days (1 year)
--   warning:  180 days (6 months)
--   info:      90 days (3 months)
--
-- This function is designed to be called:
--   1. By a Vercel cron job (every 24h)
--   2. By the application server after startup
--   3. Manually from the audit log viewer UI (admin only)

-- ─── Retention Function ────────────────────────────────────────────────────

create or replace function public.clean_old_audit_logs()
returns table(
  severity text,
  deleted_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  record record;
  cutoff timestamptz;
  deleted bigint;
begin
  -- Critical: 365 days
  cutoff := now() - interval '365 days';
  delete from public.security_audit_logs
  where severity = 'critical' and created_at < cutoff;
  get diagnostics deleted = row_count;
  severity := 'critical';
  deleted_count := deleted;
  return next;

  -- Warning: 180 days
  cutoff := now() - interval '180 days';
  delete from public.security_audit_logs
  where severity = 'warning' and created_at < cutoff;
  get diagnostics deleted = row_count;
  severity := 'warning';
  deleted_count := deleted;
  return next;

  -- Info: 90 days
  cutoff := now() - interval '90 days';
  delete from public.security_audit_logs
  where severity = 'info' and created_at < cutoff;
  get diagnostics deleted = row_count;
  severity := 'info';
  deleted_count := deleted;
  return next;

  -- Any records without a severity (fallback): 90 days
  cutoff := now() - interval '90 days';
  delete from public.security_audit_logs
  where (severity is null or severity not in ('critical', 'warning', 'info'))
    and created_at < cutoff;
  get diagnostics deleted = row_count;
  severity := 'unknown';
  deleted_count := deleted;
  return next;
end;
$$;

-- ─── Retention Stats View ──────────────────────────────────────────────────

create or replace view public.audit_log_retention_stats as
select
  severity,
  count(*) as record_count,
  min(created_at) as oldest_record,
  max(created_at) as newest_record,
  case
    when severity = 'critical' then '365 days'
    when severity = 'warning' then '180 days'
    when severity = 'info' then '90 days'
    else '90 days'
  end as retention_period,
  case
    when severity = 'critical' then now() - interval '365 days'
    when severity = 'warning' then now() - interval '180 days'
    when severity = 'info' then now() - interval '90 days'
    else now() - interval '90 days'
  end as retention_cutoff
from public.security_audit_logs
group by severity
order by severity;

-- ─── Apply to existing logs table ──────────────────────────────────────────

comment on function public.clean_old_audit_logs() is
  'Deletes audit log entries older than their severity-specific retention period. Returns per-severity deletion counts.';

comment on view public.audit_log_retention_stats is
  'Retention statistics for security_audit_logs: current record counts, date ranges, and retention periods per severity.';
