import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookMarked,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DatabaseBackup,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  Layers3,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  PenSquare,
  Plus,
  RadioTower,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  SearchCode,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getServerTranslator, type ServerTranslator } from '@/i18n/server';
import { cn, formatDateTime, formatTimeAgo } from '@/lib/utils';
import type { TaskStatus } from '@/types';
import { WavingRobot } from '@/components/dashboard/WavingRobot';
import { DashboardSchedulerButton } from './DashboardSchedulerButton';
import {
  type ProviderRow,
  type TodayAction,
  type UsageWidgetData,
  readinessBadgeStatuses,
} from './utils';

// ---------------------------------------------------------------------------
// CommandCard — the primary dashboard section wrapper
// ---------------------------------------------------------------------------

export function CommandCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_32px_rgba(93,107,107,0.06)] ring-1 ring-foreground/5',
        'transition-all duration-200 ease-out',
        'hover:shadow-[0_16px_40px_rgba(93,107,107,0.10)] hover:border-border-strong',
        className
      )}
    >
      <div className="mb-6 flex min-w-0 flex-col gap-2 border-b border-divider pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-foreground-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ManagerStat — top-level metric card
// ---------------------------------------------------------------------------

export function ManagerStat({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'berry',
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: typeof FileText;
  tone?: 'berry' | 'coral' | 'peach' | 'dark';
}) {
  const accent =
    tone === 'coral'
      ? 'bg-[#F7CBCA]/14 text-[#B51F30]'
      : tone === 'peach'
        ? 'bg-[#E7F5DC]/28 text-[#8A4300]'
        : tone === 'dark'
          ? 'bg-[#5D6B6B] text-[#D5E5E5]'
          : 'bg-[#D5E5E5] text-[#F7CBCA]';

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-[0_16px_42px_rgba(93,107,107,0.07)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(93,107,107,0.12)] hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-foreground">{value}</p>
        </div>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', accent)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-foreground-muted">{helper}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressRow — labeled progress bar
// ---------------------------------------------------------------------------

export function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-black/70">{label}</span>
        <span className="font-mono text-sm font-black text-[#5D6B6B]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F7F7] ring-1 ring-black/5">
        <div className="h-full rounded-full bg-[#F7CBCA]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SmallMetric — compact number display
// ---------------------------------------------------------------------------

export function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-all duration-200 ease-out hover:border-border-strong">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardContentFallback — safe mode / loading placeholder
// ---------------------------------------------------------------------------

export function DashboardContentFallback() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[var(--theme-background,#F1F7F7)] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-8">
        <Notice tone="warning" title="Dashboard is running in safe mode">
          Core navigation is available while workspace data finishes loading. If a provider or database request is slow, this page stays usable instead of returning to an infinite loading screen.
        </Notice>

        <section className="rounded-2xl border border-black/7 bg-white/90 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-center">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
                <Sparkles className="h-3.5 w-3.5" />
                Safe dashboard shell
              </div>
              <h1 className="text-3xl font-black leading-tight tracking-normal text-[#5D6B6B] sm:text-4xl xl:text-5xl">
                Agency Command Center
              </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-black/60">
            The dashboard shell is ready. Heavy widgets load separately so one slow request cannot block the whole workspace.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
                  <Plus className="h-5 w-5" />
                  Create Task
                </Link>
                <Link href="/dashboard/content-studio" className={buttonStyles({ size: 'lg', variant: 'secondary' })}>
                  <PenSquare className="h-5 w-5" />
                  Content Studio
                </Link>
                <Link href="/dashboard/system-health" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                  <Gauge className="h-5 w-5" />
                  System Health
                </Link>
                <Link href="/dashboard/alex" className={buttonStyles({ size: 'lg', variant: 'outline' })}>
                  <Bot className="h-5 w-5" />
                  Open Alex
                </Link>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-black/7 bg-[#F1F7F7]/72 p-4">
              <WavingRobot />
            </div>
          </div>
        </section>

        <div className="dashboard-stat-grid">
          <ManagerStat label="Tasks" value="..." helper="Loading with timeout protection" icon={FileText} />
          <ManagerStat label="Reviews" value="..." helper="Safe fallback remains visible" icon={AlertCircle} tone="coral" />
          <ManagerStat label="Content" value="..." helper="Widgets load independently" icon={CheckCircle2} tone="dark" />
          <ManagerStat label="Providers" value="..." helper="Provider checks cannot freeze this page" icon={RadioTower} />
        </div>

        <CommandCard title="Workspace Shortcuts" description="Routes stay available even while dashboard data is recovering.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Open Alex', '/dashboard/alex', Bot],
              ['Agent Library', '/dashboard/agent-library', Bot],
              ['Workflow Builder', '/dashboard/agent-library/workflows', Layers3],
              ['AI Studio', '/dashboard/ai-studio', Sparkles],
              ['Projects', '/dashboard/projects', FolderKanban],
              ['Settings', '/dashboard/settings', Settings],
              ['Tasks', '/dashboard/tasks', ClipboardList],
              ['Reports', '/dashboard/reports', BarChart3],
            ].map(([label, href, Icon]) => (
              <Link
                key={label as string}
                href={href as string}
                className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full justify-start' })}
              >
                <Icon className="h-5 w-5" />
                {label as string}
              </Link>
            ))}
          </div>
        </CommandCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProviderSnapshotCard — single provider row in the snapshot sidebar
// ---------------------------------------------------------------------------

export function ProviderSnapshotCard({ provider }: { provider: ProviderRow }) {
  return (      <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-[#5D6B6B]">{provider.name}</p>
          <p className="mt-1 text-sm leading-6 text-black/58">{provider.nextAction}</p>
        </div>
        <StatusBadge status={readinessBadgeStatuses[provider.status]} type="system" size="sm" />
      </div>
      <Link href="/dashboard/settings#provider-setup-wizard" className="mt-2 inline-flex text-sm font-semibold text-[#F7CBCA] hover:text-black">
        {provider.status === 'ready' || provider.status === 'manual_only' ? 'Open Settings' : 'Fix Now'}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TodayActionCard — single action item in Today's Actions list
// ---------------------------------------------------------------------------

export function TodayActionCard({ action }: { action: TodayAction }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 transition-colors hover:bg-white lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-black text-[#5D6B6B]">{action.title}</p>
          <StatusBadge status={action.status} type="system" size="sm" />
        </div>
        <p className="mt-1 text-sm leading-6 text-black/58">{action.reason}</p>
      </div>
      <Link href={action.href} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
        {action.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LatestItemCard — clickable card for a task, content item, or publish attempt
// ---------------------------------------------------------------------------

export function LatestTaskCard({
  task,
}: {
  task: { id: string; title: string; status: string; updated_at: string };
}) {
  return (
    <Link href={`/dashboard/tasks/${task.id}`} className="block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-bold leading-5 text-[#5D6B6B]">{task.title}</p>
        <StatusBadge status={task.status as TaskStatus} type="task" size="sm" />
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">{formatTimeAgo(task.updated_at)}</p>
    </Link>
  );
}

export function LatestContentCard({
  item,
}: {
  item: { id: string; title: string; status: string; updated_at: string };
}) {
  return (
    <Link href={`/dashboard/content-studio?item=${item.id}`} className="block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-bold leading-5 text-[#5D6B6B]">{item.title}</p>
        <StatusBadge status={item.status as TaskStatus} type="task" size="sm" />
      </div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">{formatTimeAgo(item.updated_at)}</p>
    </Link>
  );
}

export function LatestPublishAttemptCard({
  attempt,
}: {
  attempt: { id: string; action_type: string; provider: string; status: string; created_at: string; error_message?: string | null };
}) {
  return (
    <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-[#5D6B6B]">{attempt.action_type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</p>
          <p className="mt-1 text-sm text-black/58">{attempt.provider} / {formatDateTime(attempt.created_at)}</p>
        </div>
        <StatusBadge status={attempt.status as TaskStatus} type="system" size="sm" />
      </div>
      {attempt.error_message ? <p className="mt-2 text-sm leading-6 text-black/58">{attempt.error_message}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkShortcutsGrid — fixed grid of manager shortcuts
// ---------------------------------------------------------------------------

export const workShortcuts: Array<[string, string, typeof Bot]> = [
  ['Open Alex', '/dashboard/alex', Bot],
  ['Content Studio', '/dashboard/content-studio', PenSquare],
  ['Creative Assets', '/dashboard/creative-assets', ImageIcon],
  ['Projects', '/dashboard/projects', FolderKanban],
  ['Plan Safe Patch', '/dashboard/safe-patch-planner', SearchCode],
  ['Open Backup Center', '/dashboard/backups', DatabaseBackup],
  ['Prompt Library', '/dashboard/prompt-library', ClipboardList],
  ['Reports', '/dashboard/reports', BarChart3],
  ['System Health', '/dashboard/system-health', Gauge],
  ['Security Center', '/dashboard/security', LockKeyhole],
  ['Docs', '/dashboard/docs', BookMarked],
  ['Settings', '/dashboard/settings', Settings],
];

export function WorkShortcutsGrid() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {workShortcuts.map(([label, href, Icon]) => (
        <Link
          key={label as string}
          href={href as string}
          className={buttonStyles({ variant: 'outline', size: 'lg', className: 'w-full justify-start' })}
        >
          <Icon className="h-5 w-5" />
          {label as string}
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManagerShortcutsGrid — extended list of manager shortcuts for the sidebar
// ---------------------------------------------------------------------------

export const managerShortcuts: Array<[string, string, typeof Bot]> = [
  ['Open Alex', '/dashboard/alex', Bot],
  ['Instagram Studio', '/dashboard/content-studio?tab=instagram', Megaphone],
  ['Projects', '/dashboard/projects', FolderKanban],
  ['Plan Software Project', '/dashboard/software-planner', Sparkles],
  ['Releases', '/dashboard/releases', Rocket],
  ['Prompt Library', '/dashboard/prompt-library', ClipboardList],
  ['Plan Campaign', '/dashboard/content-studio#one-click-campaign-planner', Sparkles],
  ['Facebook Studio', '/dashboard/content-studio?tab=facebook', Megaphone],
  ['Google Ads Studio', '/dashboard/content-studio?tab=google_ads', BarChart3],
  ['Content Calendar', '/dashboard/calendar', CalendarDays],
  ['Recovery Center', '/dashboard/recovery', LifeBuoy],
  ['Backup Center', '/dashboard/backups', DatabaseBackup],
  ['Monthly Report', '/dashboard/reports#monthly-agency-report', FileText],
  ['Pinterest Studio', '/dashboard/content-studio?tab=pinterest', ImageIcon],
  ['LinkedIn Planner', '/dashboard/content-studio?tab=linkedin', ClipboardList],
  ['Creative Assets', '/dashboard/creative-assets', ImageIcon],
  ['Reports', '/dashboard/reports', Layers3],
  ['Docs', '/dashboard/docs', BookMarked],
  ['Provider Setup', '/dashboard/settings#provider-setup-wizard', ShieldCheck],
  ['Brand Kit', '/dashboard/settings#brand-kit', Sparkles],
  ['Settings', '/dashboard/settings', Settings],
];

export function ManagerShortcutsGrid() {
  return (      <div className="grid gap-2 sm:grid-cols-2">
        {managerShortcuts.map(([label, href, Icon]) => (
        <Link key={label as string} href={href as string} className={buttonStyles({ variant: 'outline', className: 'justify-start' })}>
          <Icon className="h-4 w-4" />
          {label as string}
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProviderRowsSection — renders the provider snapshot list
// ---------------------------------------------------------------------------

export function ProviderRowsSection({ providerRows }: { providerRows: ProviderRow[] }) {
  return (
    <div className="space-y-2">
      {providerRows.map((provider) => (
        <ProviderSnapshotCard key={provider.name} provider={provider} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectSnapshotCard
// ---------------------------------------------------------------------------

export function ProjectSnapshotCard({
  projectSnapshot,
}: {
  projectSnapshot: {
    total: number;
    active: number;
    readyToDeploy: number;
    deployed: number;
    latest: { id: string; name: string; status: string; updated_at: string } | null;
  };
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SmallMetric label="Active projects" value={projectSnapshot.active} />
        <SmallMetric label="Ready to deploy" value={projectSnapshot.readyToDeploy} />
        <SmallMetric label="Deployed" value={projectSnapshot.deployed} />
        <SmallMetric label="Total projects" value={projectSnapshot.total} />
      </div>
      {projectSnapshot.latest ? (
        <Link href={`/dashboard/projects/${projectSnapshot.latest.id}`} className="mt-4 block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest project</p>
          <p className="mt-1 font-black text-[#5D6B6B]">{projectSnapshot.latest.name}</p>
          <p className="mt-1 text-sm leading-6 text-black/58">
            {projectSnapshot.latest.status.replace(/_/g, ' ')} / {formatTimeAgo(projectSnapshot.latest.updated_at)}
          </p>
        </Link>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">
          No project records yet.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ReleaseSnapshotCard
// ---------------------------------------------------------------------------

export function ReleaseSnapshotCard({
  releaseSnapshot,
}: {
  releaseSnapshot: {
    total: number;
    deployed: number;
    failed: number;
    readyToDeploy: number;
    latest: { id: string; title: string; status: string; updated_at: string } | null;
  };
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SmallMetric label="Ready to deploy" value={releaseSnapshot.readyToDeploy} />
        <SmallMetric label="Deployed releases" value={releaseSnapshot.deployed} />
        <SmallMetric label="Failed releases" value={releaseSnapshot.failed} />
        <SmallMetric label="Total releases" value={releaseSnapshot.total} />
      </div>
      {releaseSnapshot.latest ? (
        <Link href={`/dashboard/releases/${releaseSnapshot.latest.id}`} className="mt-4 block rounded-2xl border border-black/7 bg-[#F1F7F7]/60 p-4 hover:bg-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Latest release</p>
          <p className="mt-1 font-black text-[#5D6B6B]">{releaseSnapshot.latest.title}</p>
          <p className="mt-1 text-sm leading-6 text-black/58">{releaseSnapshot.latest.status.replace(/_/g, ' ')} / {formatTimeAgo(releaseSnapshot.latest.updated_at)}</p>
        </Link>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white p-4 text-sm text-black/55">No release records yet.</p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// UsageWidget — compact usage & limits summary for the main dashboard
// ---------------------------------------------------------------------------

export function UsageWidget({ usageWidgetData }: { usageWidgetData: UsageWidgetData }) {
  const { plan, quotas } = usageWidgetData;

  function getColor(percent: number) {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <CommandCard
      title="Usage & Limits"
      description={`Plan: ${plan}`}
      action={
        <Link href="/dashboard/usage" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
          View Details
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {quotas.map((q) => (
          <div key={q.type}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{q.label}</span>
              <span className="text-xs font-semibold text-black/55">
                {q.current}{q.limit !== null ? ` / ${q.limit}` : ''}
              </span>
            </div>
            {q.limit !== null ? (
              <div className="relative">
                <div className="h-2 overflow-hidden rounded-full bg-[#F1F7F7] ring-1 ring-black/5">
                  <div
                    className={`h-full rounded-full transition-all ${getColor(q.percent)}`}
                    style={{ width: `${q.percent}%` }}
                  />
                </div>
                <span
                  className={`mt-0.5 block text-[10px] font-bold ${
                    q.percent >= 90
                      ? 'text-red-500'
                      : q.percent >= 70
                        ? 'text-amber-500'
                        : 'text-black/42'
                  }`}
                >
                  {q.percent}%
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-black/42">Unlimited</span>
            )}
          </div>
        ))}
      </div>
    </CommandCard>
  );
}

// ---------------------------------------------------------------------------
// OpsCard — compact internal ops quick-links card
// ---------------------------------------------------------------------------

export function OpsCard({
  unreadCount,
  recentNotifications,
  isAdmin,
}: {
  unreadCount: number;
  recentNotifications: Array<{
    id: string;
    title: string;
    message: string;
    created_at: string;
    severity: string;
  }>;
  isAdmin: boolean;
}) {
  return (
    <CommandCard
      title="Internal Ops"
      description="Quick-access panel for workspace usage, system health, and team notifications."
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href="/dashboard/usage"
          className={buttonStyles({ variant: 'outline', className: 'w-full justify-start' })}
        >
          <BarChart3 className="h-4 w-4" />
          Usage & Limits
        </Link>
        <Link
          href="/dashboard/notifications"
          className={buttonStyles({ variant: 'outline', className: 'w-full justify-start' })}
        >
          <Bell className="h-4 w-4" />
          Notifications
          {unreadCount > 0 ? (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F7CBCA] px-1.5 text-[10px] font-bold leading-none text-white">
              {unreadCount}
            </span>
          ) : null}
        </Link>
        <Link
          href="/dashboard/system-health"
          className={buttonStyles({ variant: 'outline', className: 'w-full justify-start' })}
        >
          <Gauge className="h-4 w-4" />
          System Health
        </Link>
      </div>
      {isAdmin && recentNotifications.length > 0 ? (
        <div className="mt-6 space-y-2 border-t border-black/6 pt-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">
            Latest Notifications
          </p>
          {recentNotifications.map((n) => (
            <Link
              key={n.id}
              href="/dashboard/notifications"
              className="block rounded-xl border border-black/7 bg-[#F1F7F7]/60 p-2 transition-colors hover:bg-white"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-[#5D6B6B]">{n.title}</p>
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none',
                    n.severity === 'error'
                      ? 'bg-red-100 text-red-700'
                      : n.severity === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-[#D5E5E5] text-[#5D6B6B]'
                  )}
                >
                  {n.severity}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-black/55 line-clamp-1">{n.message}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/42">
                {formatTimeAgo(n.created_at)}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </CommandCard>
  );
}

// ---------------------------------------------------------------------------
// HeroSection — the top welcome card
// ---------------------------------------------------------------------------

export function HeroSection({
  canRunScheduler,
  t: tProp,
}: {
  canRunScheduler: boolean;
  t?: ServerTranslator;
}) {
  const t = tProp ?? getServerTranslator('en');

  return (
    <section className="rounded-2xl border border-black/7 bg-white/90 p-5 shadow-[0_24px_70px_rgba(93,107,107,0.08)] sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-center">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F7CBCA]/14 bg-[#F1F7F7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#F7CBCA]">
            <Sparkles className="h-3.5 w-3.5" />
            {t('page.dashboard.managerWorkspace', 'Manager workspace')}
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-normal text-[#5D6B6B] sm:text-4xl xl:text-5xl">
            {t('page.dashboard.title', 'Agency Command Center')}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-black/60">
            {t('page.dashboard.description', "Manage today's tasks, content, campaigns, provider setup, and publishing readiness from one place.")}
          </p>

          {/* Primary CTAs — the three actions above the fold */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard/create-task" className={buttonStyles({ size: 'lg' })}>
              <Plus className="h-5 w-5" />
              {t('page.dashboard.ctaCreateTask', 'Create Task')}
            </Link>
            {canRunScheduler ? (
              <DashboardSchedulerButton canRunScheduler={canRunScheduler} />
            ) : (
              <Link href="/dashboard/system-health" className={buttonStyles({ size: 'lg', variant: 'secondary' })}>
                <RefreshCw className="h-5 w-5" />
                {t('page.dashboard.ctaRunScheduler', 'Run Scheduler')}
              </Link>
            )}
            <Link
              href="/dashboard/tasks?status=needs_review"
              className={buttonStyles({ size: 'lg', variant: 'outline' })}
            >
              <ClipboardList className="h-5 w-5" />
              {t('page.dashboard.ctaReviewQueue', 'Review Queue')}
            </Link>
          </div>

          {/* Secondary quick links — kept visible but de-emphasised */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/content-studio" className={buttonStyles({ size: 'sm', variant: 'ghost' })}>
              <PenSquare className="h-4 w-4" />
              Content Studio
            </Link>
            <Link href="/dashboard/system-health" className={buttonStyles({ size: 'sm', variant: 'ghost' })}>
              <Gauge className="h-4 w-4" />
              System Health
            </Link>
            <Link href="/dashboard/alex" className={buttonStyles({ size: 'sm', variant: 'ghost' })}>
              <Bot className="h-4 w-4" />
              Open Alex
            </Link>
            <Link href="/dashboard/backups" className={buttonStyles({ size: 'sm', variant: 'ghost' })}>
              <DatabaseBackup className="h-4 w-4" />
              Open Backup Center
            </Link>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-black/7 bg-[#F1F7F7]/72 p-4">
          <WavingRobot />
          <div className="mt-3 grid gap-2">
            <Link href="/dashboard/projects" className={buttonStyles({ variant: 'outline', className: 'w-full justify-start' })}>
              <FolderKanban className="h-4 w-4" />
              Open Projects
            </Link>
            {!canRunScheduler ? (
              <DashboardSchedulerButton canRunScheduler={canRunScheduler} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HealthScoreCard — compact 4-metric scorecard (above the fold)
// ---------------------------------------------------------------------------

export function HealthScoreCard({
  providerStatus,
  schedulerHealthy,
  reviewQueue,
  readyContent,
  t: tProp,
}: {
  providerStatus: { active: number; total: number };
  schedulerHealthy: boolean;
  reviewQueue: number;
  readyContent: number;
  t?: ServerTranslator;
}) {
  const t = tProp ?? getServerTranslator('en');
  const allProvidersReady = providerStatus.total > 0 && providerStatus.active === providerStatus.total;

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-[0_12px_32px_rgba(93,107,107,0.06)] ring-1 ring-foreground/5 transition-all duration-200 ease-out hover:shadow-[0_16px_40px_rgba(93,107,107,0.10)] hover:border-border-strong">
      <div className="mb-5 border-b border-divider pb-4">
        <h2 className="text-lg font-black text-foreground">{t('page.dashboard.healthScorecard', 'Health Scorecard')}</h2>
        <p className="mt-1 text-sm leading-6 text-foreground-muted">
          {t('page.dashboard.healthScorecardDescription', 'Four critical signals for the workspace at a glance.')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('page.dashboard.providerStatus', 'Provider Status')}
          value={`${providerStatus.active}/${providerStatus.total}`}
          icon={RadioTower}
          tone={allProvidersReady ? 'success' : 'warning'}
          subtitle={t('page.dashboard.readyLabel', 'ready')}
        />
        <StatCard
          title={t('page.dashboard.schedulerHealth', 'Scheduler Health')}
          value={schedulerHealthy ? t('page.dashboard.schedulerRunning', 'Running') : t('page.dashboard.schedulerNeedsSetup', 'Needs setup')}
          icon={RefreshCw}
          tone={schedulerHealthy ? 'success' : 'warning'}
        />
        <StatCard
          title={t('page.dashboard.reviewQueue', 'Review Queue')}
          value={reviewQueue}
          icon={AlertCircle}
          tone={reviewQueue > 0 ? 'danger' : 'neutral'}
          subtitle={t('page.dashboard.reviewQueueSubtitle', 'Tasks pending review')}
        />
        <StatCard
          title={t('page.dashboard.readyContent', 'Ready Content')}
          value={readyContent}
          icon={CheckCircle2}
          tone="success"
          subtitle={t('page.dashboard.readyToPublish', 'Ready to publish')}
        />
      </div>
    </section>
  );
}
