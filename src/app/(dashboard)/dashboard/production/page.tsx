import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Gauge,
  LockKeyhole,
  Megaphone,
  RadioTower,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import {
  canManageSecurity,
  getWorkspaceAccessContext,
} from '@/lib/workspace-permissions';
import { getProductionReadiness, type ProductionCheck } from '@/lib/production-readiness';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';

export const dynamic = 'force-dynamic';

const statusLabels = {
  ready: 'جاهز / Ready',
  blocked: 'محظور / Blocked',
  warning: 'تحذير / Warning',
  not_configured: 'غير مضبوط / Not configured',
};

const statusStyles = {
  ready: 'border-[#0F7A4F]/20 bg-[#E8F8EF] text-[#0F5F3E]',
  blocked: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/14 text-[#A30D1D]',
  warning: 'border-[#E7F5DC]/50 bg-[#E7F5DC]/28 text-[#8A4300]',
  not_configured: 'border-black/10 bg-white text-black/58',
};

function StatusPill({ status }: { status: ProductionCheck['status'] | 'ready' | 'blocked' | 'warning' }) {
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-black', statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}

function Section({
  title,
  description,
  checks,
}: {
  title: string;
  description: string;
  checks: ProductionCheck[];
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.key} className="rounded-lg border border-black/7 bg-[#F1F7F7]/68 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-[#5D6B6B]">{check.label}</p>
                <p className="mt-2 text-sm leading-6 text-black/58">{check.message}</p>
              </div>
              <StatusPill status={check.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DecisionCard({
  title,
  ready,
  detail,
  icon: Icon,
}: {
  title: string;
  ready: boolean;
  detail: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      ready
        ? 'border-[#0F7A4F]/20 bg-[#E8F8EF]'
        : 'border-[#F7CBCA]/28 bg-[#F7CBCA]/10'
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          ready ? 'bg-white text-[#0F7A4F]' : 'bg-white text-[#B51F30]'
        )}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-[#5D6B6B]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-black/60">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ProductionOperationsPage() {
  const access = await getWorkspaceAccessContext();

  if (access.error || !access.data) {
    return <AccessDenied />;
  }

  if (!canManageSecurity(access.data.role)) {
    await logSecurityAuditEvent({
      supabase: access.data.supabase,
      workspaceId: access.data.workspace.id,
      userId: access.data.user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'production_readiness',
      message: 'Blocked Production Operations page access.',
      metadata: { role: access.data.role },
    });

    return <AccessDenied />;
  }

  const readiness = await getProductionReadiness({
    supabase: access.data.supabase,
    workspaceId: access.data.workspace.id,
    userId: access.data.user.id,
    logEvent: true,
  });
  const StatusIcon =
    readiness.overallStatus === 'ready'
      ? CheckCircle2
      : readiness.overallStatus === 'warning'
        ? AlertTriangle
        : XCircle;

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#F1F7F7] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px] space-y-8">
        <PageHeader
          eyebrow="Production launch control"
          title="Production Operations"
          description="A hard launch gate for real-client work and paid ads. The platform stays blocked until security, monitoring, providers, rate limits, backups, environment, and spend controls are green."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/security" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <LockKeyhole className="h-4 w-4" />
                Security
              </Link>
              <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <Gauge className="h-4 w-4" />
                System Health
              </Link>
              <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                <DatabaseBackup className="h-4 w-4" />
                Backups
              </Link>
            </div>
          }
        />

        <section className="rounded-[28px] border border-black/7 bg-white/92 p-6 shadow-[0_24px_70px_rgba(93,107,107,0.08)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5D6B6B] text-white">
                  <StatusIcon className="h-7 w-7" />
                </span>
                <div>
                  <StatusPill status={readiness.overallStatus} />
                  <h1 className="mt-3 text-4xl font-black text-[#5D6B6B]">
                    Readiness score: {readiness.score}%
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-black/60">
                آخر فحص: {new Date(readiness.checkedAt).toLocaleString()}. لا يتم عرض أي قيم سرية هنا؛ كل الفحوص تعرض وجود الإعدادات فقط.
              </p>
            </div>
            <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/80 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Launch mode</p>
              <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{readiness.spendControls.launch_mode}</p>
              <p className="mt-2 text-sm leading-6 text-black/58">
                Paid ads enabled: {readiness.spendControls.paid_ads_enabled ? 'yes' : 'no'}.
                Daily limit: {readiness.spendControls.max_daily_ad_spend ?? 'not set'}.
              </p>
            </div>
          </div>
        </section>

        {readiness.blockers.length > 0 ? (
          <Notice tone="warning" title="Production is blocked / الإنتاج محظور">
            {readiness.blockers.slice(0, 6).join(' | ')}
          </Notice>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <DecisionCard
            title="Internal use"
            ready={readiness.safeToUseInternally}
            detail={readiness.safeToUseInternally ? 'Allowed for private operator use.' : 'Blocked until core security and migration checks pass.'}
            icon={ShieldCheck}
          />
          <DecisionCard
            title="Real clients"
            ready={readiness.safeForRealClients}
            detail={readiness.safeForRealClients ? 'All production requirements are green.' : 'Blocked until every production gate is green.'}
            icon={RadioTower}
          />
          <DecisionCard
            title="Paid ads"
            ready={readiness.safeForPaidAds}
            detail={readiness.safeForPaidAds ? 'Paid ads gate is green.' : 'Blocked until providers, spend controls, confirmation, and launch mode are green.'}
            icon={Megaphone}
          />
        </div>

        <Section title="Environment" description="Presence checks only. No values are displayed." checks={readiness.env} />
        <Section title="Supabase migrations" description="Production tables required by the launch gate." checks={readiness.migrations} />
        <Section title="Security" description="Alex, n8n callback replay protection, CSP, and release audit proof." checks={readiness.security} />
        <Section title="Rate limits" description="Current in-memory limits and persistent production rate limit readiness." checks={readiness.rateLimits} />
        <Section title="Providers" description="OpenAI and provider OAuth/env readiness without exposing tokens." checks={readiness.providers} />
        <Section title="Paid Ads Safety Gate" description="Hard gate for real paid ads and paid campaign drafts." checks={readiness.paidAds} />
        <Section title="Backups" description="Backup feature and latest backup metadata." checks={readiness.backups} />
        <Section title="Monitoring" description="Error logging, operational audit logs, and deployment log visibility." checks={readiness.monitoring} />

        <Card>
          <CardHeader
            title="Recommended actions"
            description="Fix these before the platform can call itself fully ready for real agency production."
          />
          <div className="space-y-3">
            {(readiness.recommendedActions.length > 0
              ? readiness.recommendedActions
              : ['No recommended actions. All gates are green.']
            ).map((action) => (
              <div key={action} className="rounded-lg border border-black/7 bg-white p-4 text-sm font-semibold leading-6 text-black/65">
                {action}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
