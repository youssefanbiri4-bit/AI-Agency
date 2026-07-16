import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Gauge,
  HardDrive,
  RadioTower,
  ServerCog,
  Sliders,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { buttonStyles } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { getRBACContext, hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { getAllQuotas, getUsageLimits, type QuotaCheckResult, type QuotaType } from '@/lib/usage/quotas';
import type { HealthStatus } from '@/lib/db/health-snapshot';

export const dynamic = 'force-dynamic';

interface SnapshotRow {
  id: string;
  status: HealthStatus;
  score: number;
  metrics: Record<string, unknown>;
  created_at: string;
}

const statusTone: Record<HealthStatus, string> = {
  healthy: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
  degraded: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
  critical: 'border-red-500/25 bg-red-500/10 text-red-700',
};

const serviceLabel: Record<string, string> = {
  database: 'Database',
  supabase: 'Supabase',
  n8n: 'n8n Automation',
  storage: 'Storage',
  env: 'Environment',
};

const serviceIcon: Record<string, typeof Activity> = {
  database: Database,
  supabase: Database,
  n8n: RadioTower,
  storage: HardDrive,
  env: ServerCog,
};

function scoreTone(score: number) {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function quotaColor(percent: number) {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const QUOTA_LABELS: Record<QuotaType, string> = {
  ai_generations: 'AI Generations',
  tasks: 'Tasks',
  creative_assets: 'Creative Assets',
  content_items: 'Content Items',
  content_publishes: 'Content Publishes',
  reels_publishes: 'Reel Publishes',
  paid_ads_spend: 'Paid Ads Spend',
  cost_usd: 'Estimated Cost',
};

export default async function OpsDashboardPage() {
  const access = await getRBACContext();

  if (access.error || !access.data) {
    return <AccessDenied />;
  }

  if (!hasPermission(access.data.role, 'admin')) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'ops_dashboard',
      message: 'Blocked Operations Dashboard page access.',
      metadata: { role: access.data.role },
    });

    return <AccessDenied />;
  }

  const { supabase, workspace } = access.data;

  // Recent global (platform) health snapshots written by the hourly cron.
  const { data: snapshotData } = await supabase
    .from('system_health_snapshots')
    .select('id, status, score, metrics, created_at')
    .is('workspace_id', null)
    .order('created_at', { ascending: false })
    .limit(24);

  const snapshots = (snapshotData ?? []) as unknown as SnapshotRow[];
  const latest = snapshots[0] ?? null;

  const quotasMap = (await getAllQuotas(workspace.id)) as Record<QuotaType, QuotaCheckResult>;
  const limits = await getUsageLimits(workspace.id);

  const quotaEntries = (Object.entries(quotasMap) as Array<[QuotaType, QuotaCheckResult]>).map(
    ([type, q]) => ({
      type,
      label: QUOTA_LABELS[type] ?? type,
      current: q.current,
      limit: q.limit,
      percent: q.percentUsed,
      blocked: !q.allowed,
    })
  );

  const blockedCount = quotaEntries.filter((q) => q.blocked).length;
  const nearLimitCount = quotaEntries.filter((q) => !q.blocked && q.percent >= 80).length;

  const latestServices =
    latest && latest.metrics && typeof latest.metrics === 'object'
      ? ((latest.metrics as Record<string, unknown>).services as
          | Record<string, { status: string; message?: string }>
          | undefined)
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Operations Dashboard"
        description="Platform health snapshots, service status, and hard usage-limit enforcement in one place. Snapshots are captured hourly by the health-snapshot cron."
        actions={
          <>
            <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <Gauge className="h-4 w-4" />
              System Health Center
            </Link>
            <Link href="/dashboard/usage" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <Sliders className="h-4 w-4" />
              Usage & Limits
            </Link>
          </>
        }
      />

      {!latest ? (
        <Notice tone="info" title="No health snapshots yet">
          The hourly health-snapshot cron has not recorded any platform snapshots yet. Trigger{' '}
          <code>/api/cron/health-snapshot</code> (with the CRON_SECRET) or open{' '}
          <code>/api/health</code> while authenticated to capture the first snapshot.
        </Notice>
      ) : null}

      {/* Top-level status tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">Platform Status</p>
          {latest ? (
            <>
              <span
                className={cn(
                  'mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-black uppercase tracking-[0.1em]',
                  statusTone[latest.status]
                )}
              >
                {latest.status}
              </span>
              <p className="mt-3 text-xs text-foreground-muted">Updated {formatTime(latest.created_at)}</p>
            </>
          ) : (
            <p className="mt-3 text-2xl font-black text-foreground-muted">—</p>
          )}
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">Health Score</p>
          <p className={cn('mt-3 text-4xl font-black tabular-nums', latest ? scoreTone(latest.score) : 'text-foreground-muted')}>
            {latest ? `${latest.score}%` : '—'}
          </p>
          <p className="mt-2 text-xs text-foreground-muted">Share of core services reporting OK</p>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">Hard-Limit Blocks</p>
          <p className={cn('mt-3 text-4xl font-black tabular-nums', blockedCount > 0 ? 'text-red-600' : 'text-emerald-600')}>
            {blockedCount}
          </p>
          <p className="mt-2 text-xs text-foreground-muted">Quotas currently blocking new operations</p>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">Near Limit</p>
          <p className={cn('mt-3 text-4xl font-black tabular-nums', nearLimitCount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            {nearLimitCount}
          </p>
          <p className="mt-2 text-xs text-foreground-muted">Quotas at or above 80% usage</p>
        </Card>
      </div>

      {/* Service status */}
      <Card>
        <CardHeader title="Service Status" description="Latest per-service result from the most recent platform health snapshot." />
        {latestServices ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(latestServices).map(([key, svc]) => {
              const Icon = serviceIcon[key] ?? Activity;
              const ok = svc.status === 'ok';
              return (
                <div key={key} className="rounded-lg border border-divider bg-surface/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-foreground-muted" />
                      <p className="font-bold text-foreground">{serviceLabel[key] ?? key}</p>
                    </div>
                    {ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground-muted">{svc.status}</p>
                  {svc.message ? <p className="mt-1 text-xs leading-5 text-foreground-muted">{svc.message}</p> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No service details available in the latest snapshot.</p>
        )}
      </Card>

      {/* Usage / hard limits */}
      <Card>
        <CardHeader
          title="Usage Limits Enforcement"
          description={`Plan: ${limits.plan}. Hard limits block new operations when exceeded. Adjust caps in Usage & Limits.`}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {quotaEntries.map((q) => (
            <div key={q.type} className="rounded-lg border border-divider bg-surface/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-foreground">{q.label}</p>
                {q.blocked ? (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-black uppercase text-red-600">Blocked</span>
                ) : q.percent >= 80 ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-black uppercase text-amber-600">Near limit</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                {q.current} / {q.limit ?? '∞'} used
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded bg-black/10">
                <div className={cn('h-2.5 rounded', quotaColor(q.percent))} style={{ width: `${Math.min(q.percent, 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-foreground-muted">{q.percent.toFixed(0)}% used</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Snapshot history */}
      <Card>
        <CardHeader title="Recent Health Snapshots" description="Most recent platform snapshots captured by the periodic cron (last 24)." />
        {snapshots.length === 0 ? (
          <p className="text-sm text-foreground-muted">No snapshots recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-divider">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="bg-surface/80">
                <tr>
                  <th className="px-4 py-3 font-black text-foreground">Time</th>
                  <th className="px-4 py-3 font-black text-foreground">Status</th>
                  <th className="px-4 py-3 font-black text-foreground">Score</th>
                  <th className="px-4 py-3 font-black text-foreground">Response</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => {
                  const responseMs =
                    s.metrics && typeof s.metrics === 'object'
                      ? (s.metrics as Record<string, unknown>).responseMs
                      : undefined;
                  return (
                    <tr key={s.id} className="border-t border-divider">
                      <td className="px-4 py-3 text-foreground-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(s.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-black uppercase', statusTone[s.status])}>
                          {s.status}
                        </span>
                      </td>
                      <td className={cn('px-4 py-3 font-bold tabular-nums', scoreTone(s.score))}>{s.score}%</td>
                      <td className="px-4 py-3 tabular-nums text-foreground-muted">
                        {typeof responseMs === 'number' ? `${responseMs}ms` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
