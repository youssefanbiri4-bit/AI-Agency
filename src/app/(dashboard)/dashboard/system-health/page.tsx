import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  DatabaseBackup,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  HardDrive,
  LifeBuoy,
  LockKeyhole,
  RadioTower,
  Rocket,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { getSystemHealthForCurrentWorkspace, type HealthStatus, type IssuePriority } from '@/lib/data/system-health';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CodeInline } from '@/components/ui/TextSafety';
import { cn } from '@/lib/utils';
import { SystemHealthCopyButton } from './SystemHealthCopyButton';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { getRBACContext, hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';

const badgeStatus: Record<HealthStatus, Parameters<typeof StatusBadge>[0]['status']> = {
  ready: 'ready',
  setup_required: 'setup_required',
  needs_review: 'Awaiting Data',
  approval_pending: 'approval_pending',
  quota_limit: 'quota_limit',
  token_missing: 'token_missing',
  manual_only: 'manual_only',
  unsupported: 'unsupported',
  error: 'error',
};

const priorityStyles: Record<IssuePriority, string> = {
  critical: 'border-[#F7CBCA]/24 bg-[#F7CBCA]/10 text-[#B51F30]',
  high: 'border-[#F7CBCA]/24 bg-[#D5E5E5]/70 text-[#F7CBCA]',
  medium: 'border-[#E7F5DC]/34 bg-[#E7F5DC]/22 text-[#8A4300]',
  low: 'border-black/10 bg-white text-black/60',
};

function HealthSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/7 bg-white/92 p-5 shadow-[0_22px_58px_rgba(93,107,107,0.08)] ring-1 ring-white/70">
      <div className="mb-5 border-b border-black/6 pb-4">
        <h2 className="text-lg font-black text-[#5D6B6B]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-black/58">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, helper, icon }: { label: string; value: string | number; helper: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/72 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label}</p>
          <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#F7CBCA] shadow-sm">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-black/55">{helper}</p>
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 75) return 'text-[#5D6B6B]';
  if (score >= 50) return 'text-[#8A4300]';
  return 'text-[#B51F30]';
}

function safeDashboardHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

export default async function SystemHealthPage() {
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
      entityType: 'system_health',
      message: 'Blocked System Health Center page access.',
      metadata: { role: access.data.role },
    });

    return <AccessDenied />;
  }

  const result = await getSystemHealthForCurrentWorkspace();
  const summary = result.summary;

  if (!summary) {
    return (
      <div className="-mx-4 -my-6 min-h-screen bg-[#F1F7F7] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Notice tone="warning" title="System Health unavailable">
          {result.error ?? 'Workspace health data could not be loaded.'}
        </Notice>
      </div>
    );
  }

  const providerIssues = summary.providers.filter((provider) => !['ready', 'manual_only'].includes(provider.status)).length;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#F1F7F7] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-8">
        {summary.dataNotice ? (
          <Notice tone="warning" title="Health data notice">
            {summary.dataNotice}
          </Notice>
        ) : null}

        <section className="rounded-[28px] border border-black/7 bg-white/90 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F7CBCA]">System Health Center</p>
              <h1 className="mt-3 text-4xl font-black tracking-normal text-[#5D6B6B] sm:text-5xl">System Health</h1>
              <p className="mt-3 max-w-4xl text-base leading-7 text-black/60">
                Monitor providers, storage, scheduling, publishing readiness, project setup, and operational blockers from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SystemHealthCopyButton reportText={summary.reportText} />
              <Link href="/dashboard/alex?template=provider-health-report-agent" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
                <Bot className="h-4 w-4" />
                Summarize with Provider Health Report Agent
              </Link>
              <Link href="/dashboard/alex?template=deployment-review-agent" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <Rocket className="h-4 w-4" />
                Deployment Review Agent
              </Link>
              <Link href="/dashboard/settings#provider-setup-wizard" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                Open Provider Setup
              </Link>
              <Link href="/dashboard/security" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <LockKeyhole className="h-4 w-4" />
                Open Security Center
              </Link>
              <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <DatabaseBackup className="h-4 w-4" />
                Open Backup Center
              </Link>
              <Link href="/dashboard/settings/roles" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <ShieldCheck className="h-4 w-4" />
                Roles & Permissions
              </Link>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ['Healthy', summary.badges.healthy],
              ['Needs Setup', summary.badges.needsSetup],
              ['Approval Pending', summary.badges.approvalPending],
              ['Errors', summary.badges.errors],
              ['Manual Only', summary.badges.manualOnly],
            ].map(([label, value]) => (
              <span key={label} className="rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#5D6B6B]/72">
                {label}: {value}
              </span>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <HealthSection title="Overall Health Score" description="Calculated from verifiable checks only. Needs Review items receive partial credit instead of being marked ready.">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full border-[12px] border-[#D5E5E5] bg-white shadow-inner">
                <div className="text-center">
                  <p className={cn('text-4xl font-black', scoreTone(summary.score))}>{summary.score}%</p>
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{summary.label}</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-6 text-black/62">
                  Provider issues: {providerIssues} / Critical blockers: {summary.metrics.recovery.criticalBlockers}
                </p>
                <div className="mt-4 space-y-2">
                  {(summary.topBlockers.length > 0 ? summary.topBlockers : ['No top blockers detected.']).map((blocker) => (
                    <div key={blocker} className="rounded-xl border border-black/7 bg-[#F1F7F7]/70 px-3 py-2 text-sm font-bold text-[#5D6B6B]">
                      {blocker}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </HealthSection>

          <HealthSection title="Core System Checks">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['Auth & Workspace', 'Authentication & Workspace', ShieldCheck],
                ['Supabase Database', 'Supabase Database', Database],
                ['Supabase Storage', 'Supabase Storage', HardDrive],
                ['Environment', 'Environment / Server Setup', ServerCog],
                ['Providers', 'Provider Health', RadioTower],
                ['Recovery', 'Operational Health', LifeBuoy],
              ].map(([label, area, Icon]) => {
                const areaChecks = summary.checks.filter((check) => check.area === area);
                const unresolved = areaChecks.filter((check) => check.status !== 'ready' && check.status !== 'manual_only').length;
                return (
                  <div key={label as string} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#5D6B6B]">{label as string}</p>
                        <p className="mt-1 text-sm text-black/55">{areaChecks.length} check(s)</p>
                      </div>
                      <Icon className="h-5 w-5 text-[#F7CBCA]" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-black/62">{unresolved} need review or setup</p>
                  </div>
                );
              })}
            </div>
          </HealthSection>
        </div>

        <HealthSection title="Provider Health" description="Read-only provider diagnostics. Secret values and tokens are never displayed.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.providers.map((provider) => (
              <div key={provider.name} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-[#5D6B6B]">{provider.name}</h3>
                  <StatusBadge status={badgeStatus[provider.status]} type="system" size="sm" />
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-black/58">
                  {provider.details.slice(0, 4).map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                <Link href={safeDashboardHref(provider.href)} className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
                  {provider.cta}
                </Link>
              </div>
            ))}
          </div>
        </HealthSection>

        <HealthSection title="Alex Assistant / OpenAI" description="Personal AI assistant readiness for the agency manager.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(() => {
              const openaiProvider = summary.providers.find((p) => p.name === 'OpenAI');
              const alexStatus = openaiProvider?.status === 'ready' ? 'ready' : 'setup_required';
              const modelValue = process.env.OPENAI_MODEL || 'gpt-5.5';
              const keyPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
              return (
                <>
                  <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-[#5D6B6B]">Alex Assistant</h3>
                      <StatusBadge status={badgeStatus[alexStatus]} type="system" size="sm" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-black/58">
                      {alexStatus === 'ready' ? 'Alex is ready. Open /dashboard/alex to chat.' : 'Alex setup required. Add OPENAI_API_KEY.'}
                    </p>
                    <Link href="/dashboard/alex" className={buttonStyles({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
                      <Bot className="h-4 w-4" />
                      Open Alex
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-[#5D6B6B]">OPENAI_API_KEY</h3>
                      <StatusBadge status={keyPresent ? 'ready' : 'setup_required'} type="system" size="sm" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-black/58">
                      {keyPresent ? 'Present (value not shown)' : 'Missing. Add in Vercel Environment Variables.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-[#5D6B6B]">OPENAI_MODEL</h3>
                      <StatusBadge status="ready" type="system" size="sm" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-black/58">
                      {modelValue === 'gpt-5.5' && !process.env.OPENAI_MODEL?.trim()
                        ? 'Default: gpt-5.5 (OPENAI_MODEL not set)'
                        : `Using: ${modelValue}`}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </HealthSection>

        <HealthSection title="Operational Health" description="Real counts from workspace content, publishing attempts, tasks, projects, releases, assets, and recovery-style blockers.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Content Items" value={summary.metrics.content.total} helper={`${summary.metrics.content.ready} ready / ${summary.metrics.content.failed} failed`} icon={<ClipboardList className="h-5 w-5" />} />
            <MetricCard label="Publish Attempts" value={summary.metrics.attempts.total} helper={`${summary.metrics.attempts.succeeded} succeeded / ${summary.metrics.attempts.failed} failed`} icon={<RadioTower className="h-5 w-5" />} />
            <MetricCard label="Tasks" value={summary.metrics.tasks.pending + summary.metrics.tasks.processing + summary.metrics.tasks.needs_review + summary.metrics.tasks.completed + summary.metrics.tasks.failed} helper={`${summary.metrics.tasks.needs_review} need review`} icon={<FileText className="h-5 w-5" />} />
            <MetricCard label="Projects" value={summary.metrics.projects.total} helper={`${summary.metrics.projects.active} active / ${summary.metrics.projects.ready_to_deploy} ready`} icon={<FolderKanban className="h-5 w-5" />} />
            <MetricCard label="Releases" value={summary.metrics.releases.total} helper={`${summary.metrics.releases.failed} failed / latest: ${summary.metrics.releases.latest}`} icon={<Rocket className="h-5 w-5" />} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Recovery Issues" value={summary.metrics.recovery.totalIssues} helper={`${summary.metrics.recovery.criticalBlockers} critical blockers`} icon={<LifeBuoy className="h-5 w-5" />} />
            <MetricCard label="Assets Missing Media" value={summary.metrics.assets.missingMedia} helper={`${summary.metrics.assets.linked} linked / ${summary.metrics.assets.unlinked} unlinked`} icon={<HardDrive className="h-5 w-5" />} />
            <MetricCard label="Setup Required Content" value={summary.metrics.content.setup_required} helper={`${summary.metrics.content.approval_pending} approval pending`} icon={<AlertTriangle className="h-5 w-5" />} />
            <MetricCard label="Manual Only" value={summary.metrics.content.manual_only + summary.metrics.attempts.manual_only} helper="LinkedIn/manual handoff workflows" icon={<Gauge className="h-5 w-5" />} />
          </div>
        </HealthSection>

        <HealthSection title="Backup Status" description="Workspace export readiness. Backup content is downloaded by the manager and full JSON is not stored in the database.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
              <div className="flex items-start gap-3">
                <DatabaseBackup className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
                <div>
                  <p className="font-black text-[#5D6B6B]">Backup Center available</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">
                    Create sanitized JSON and Markdown workspace exports. Secrets, provider tokens,
                    raw env values, task execution credentials, and binary asset files are excluded.
                  </p>
                </div>
              </div>
            </div>
            <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline' })}>
              <DatabaseBackup className="h-4 w-4" />
              Open Backup Center
            </Link>
          </div>
        </HealthSection>

        <HealthSection title="Top Issues to Fix" description="Ranked from real blockers and setup gaps.">
          {summary.actions.length === 0 ? (
            <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/70 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#F7CBCA]" />
                <p className="font-black text-[#5D6B6B]">No ranked issues detected.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.actions.map((action) => (
                <div key={action.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em]', priorityStyles[action.priority])}>
                        {action.priority}
                      </span>
                      <p className="font-black text-[#5D6B6B]">{action.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/58">{action.reason}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-black/42">{action.relatedArea}</p>
                  </div>
                  <Link href={safeDashboardHref(action.href)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                    {action.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </HealthSection>

        <HealthSection title="Environment Presence" description="Presence only. Values are never rendered or copied.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.envChecks.map((env) => (
              <div key={env.name} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
                <CodeInline>{env.name}</CodeInline>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.13em] text-[#F7CBCA]">{env.status}</p>
                <p className="mt-2 text-sm leading-6 text-black/56">{env.note}</p>
              </div>
            ))}
          </div>
        </HealthSection>

        <HealthSection title="Health Details Table">
          <div className="overflow-x-auto rounded-2xl border border-black/7">
            <table className="min-w-[960px] w-full border-collapse bg-white text-left text-sm">
              <thead className="bg-[#5D6B6B] text-[#D5E5E5]">
                <tr>
                  {['Area', 'Check', 'Status', 'Details', 'Next Action'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.checks.map((check) => (
                  <tr key={`${check.area}-${check.check}`} className="border-t border-black/7 align-top">
                    <td className="px-4 py-3 font-bold text-[#5D6B6B]">{check.area}</td>
                    <td className="px-4 py-3 text-black/68">{check.check}</td>
                    <td className="px-4 py-3"><StatusBadge status={badgeStatus[check.status]} type="system" size="sm" /></td>
                    <td className="max-w-[360px] px-4 py-3 leading-6 text-black/58">{check.details}</td>
                    <td className="max-w-[260px] px-4 py-3 leading-6 text-black/58">{check.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HealthSection>
      </div>
    </div>
  );
}
