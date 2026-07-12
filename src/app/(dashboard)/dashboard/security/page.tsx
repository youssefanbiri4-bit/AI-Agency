import Link from 'next/link';
import {
  CheckCircle2,
  DatabaseBackup,
  FileWarning,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import {
  createSupabaseServerClient,
  getActiveWorkspaceIdFromCookie,
} from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import { logSecurityAuditEvent } from '@/lib/security-audit-log';
import { buildSecurityCenterSummary, buildSecurityReport, type SecurityStatus } from '@/lib/security-center';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { buttonStyles } from '@/components/ui/Button';
import { CodeInline } from '@/components/ui/TextSafety';
import { cn } from '@/lib/utils';
import { SecurityCopyButton } from './SecurityCopyButton';

const statusStyles: Record<SecurityStatus, string> = {
  ready: 'border-[#0F7A4F]/20 bg-[#E8F8EF] text-[#0F5F3E]',
  needs_review: 'border-[#E7F5DC]/35 bg-[#E7F5DC]/20 text-[#8A4300]',
  setup_required: 'border-[#F7CBCA]/24 bg-[#D5E5E5]/72 text-[#9F1E3F]',
  warning: 'border-[#F7CBCA]/25 bg-[#F7CBCA]/10 text-[#B51F30]',
  critical: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/16 text-[#A30D1D]',
  not_applicable: 'border-black/10 bg-white text-black/58',
};

const statusLabels: Record<SecurityStatus, string> = {
  ready: 'جاهز',
  needs_review: 'قيد المراجعة',
  setup_required: 'الإعداد مطلوب',
  warning: 'تحذير',
  critical: 'حرج',
  not_applicable: 'غير منطبق',
};

function SecurityPill({ status }: { status: SecurityStatus }) {
  return (
    <span className={cn('inline-flex min-w-fit max-w-full rounded-full border px-3 py-1 text-xs font-black leading-5 whitespace-normal break-words', statusStyles[status])}>
      {statusLabels[status]}
    </span>
  );
}

function ScoreLabel({ score }: { score: number }) {
  if (score >= 90) return 'Strong';
  if (score >= 75) return 'Good';
  if (score >= 55) return 'Needs Attention';
  return 'Critical';
}

function safeActionHref(href: string) {
  return href === '/dashboard/provider-setup' ? '/dashboard/settings#provider-setup-wizard' : href;
}

export default async function SecurityCenterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!user || !workspaceResult.data) {
    return (
      <Notice tone="warning" title="Security Center unavailable">
        Authentication and an active workspace are required.
      </Notice>
    );
  }

  const membership = await getCurrentWorkspaceMembership(supabase, workspaceResult.data.id, user.id);
  const currentRole = normalizeWorkspaceRole(membership.data?.role, workspaceResult.data, user.id);

  if (!hasPermission(currentRole, 'admin')) {
    await logSecurityAuditEvent({
      supabase,
      workspaceId: workspaceResult.data.id,
      userId: user.id,
      eventType: 'permission_denied',
      severity: 'warning',
      entityType: 'security',
      message: 'Blocked Security Center page access.',
      metadata: { role: currentRole },
    });

    return <AccessDenied />;
  }

  const summary = await buildSecurityCenterSummary({
    supabase,
    workspaceId: workspaceResult.data.id,
  });
  const report = buildSecurityReport(summary);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Strict app protection"
        title="Security Center"
        description="Review authentication, workspace isolation, RLS, file uploads, secrets, tokens, AI safety, scheduler protection, headers, audit logging, and build safety."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecurityCopyButton report={report} />
            <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline' })}>
              <ShieldCheck className="h-4 w-4" />
              Open System Health
            </Link>
            <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline' })}>
              <DatabaseBackup className="h-4 w-4" />
              Open Backup Center
            </Link>
            <Link href="/dashboard/settings/roles" className={buttonStyles({ variant: 'outline' })}>
              <LockKeyhole className="h-4 w-4" />
              Roles & Permissions
            </Link>
          </div>
        }
      />

      {membership.error ? (
        <Notice tone="warning" title="Workspace membership">
          {membership.error}
        </Notice>
      ) : null}

      <Card>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5D6B6B] text-[#D5E5E5]">
                <LockKeyhole className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F7CBCA]">Security Overview</p>
                <h2 className="mt-1 text-3xl font-black text-[#5D6B6B]">Security Score: {summary.score}%</h2>
              </div>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-black/60">
              This score is based only on checks the app can verify from code, migrations, runtime
              workspace access, and safe configuration presence. Unknown items are marked Needs Review.
            </p>
          </div>
          <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/72 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/42">Review label</p>
            <p className="mt-2 text-2xl font-black text-[#5D6B6B]"><ScoreLabel score={summary.score} /></p>
            <p className="mt-2 text-sm leading-6 text-black/58">
              Last review: {new Date(summary.lastReviewDate).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Critical issues', summary.counts.critical],
            ['High issues', summary.counts.high],
            ['Medium issues', summary.counts.medium],
            ['Low issues', summary.counts.low],
            ['Needs review cards', summary.cards.filter((card) => card.status === 'needs_review').length],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-black/7 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-black/42">{label as string}</p>
              <p className="mt-2 text-2xl font-black text-[#5D6B6B]">{value as number}</p>
            </div>
          ))}
        </div>

        <Notice tone={summary.counts.critical > 0 ? 'warning' : 'info'} title="Next recommended action">
          {summary.nextRecommendedAction}
        </Notice>
      </Card>

      <Card>
        <CardHeader
          title="Security Status Cards"
          description="OWASP-inspired defensive checks. Needs Review means the app cannot fully verify the control automatically."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.cards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-[#5D6B6B]">{card.title}</p>
                  <p className="mt-1 text-sm leading-6 text-black/58">{card.detail}</p>
                </div>
                <SecurityPill status={card.status} />
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                {card.checksReady}/{card.checksTotal} checks ready
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Security Checklist"
          description="Grouped checklist for authentication, authorization, RLS, files, secrets, AI, GitHub, scheduler, headers, logging, and build safety."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {summary.checklist.map((group) => (
            <section key={group.title} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
              <h3 className="font-black text-[#5D6B6B]">{group.title}</h3>
              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <div key={item.label} className="rounded-xl border border-black/7 bg-white p-3">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm font-bold leading-6 text-black/70">{item.label}</p>
                      <SecurityPill status={item.status} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-black/50">{item.evidence}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Backup Security"
          description="Backup Center availability and export safety controls."
          action={<DatabaseBackup className="h-5 w-5 text-[#F7CBCA]" />}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Backup Center available', 'Safe workspace exports are available at /dashboard/backups.'],
            ['Secrets excluded', 'Tokens, API keys, raw env values, authorization headers, and encrypted token fields are redacted or omitted.'],
            ['Restore disabled', 'This phase performs no restore writes, overwrites, deletes, task execution, provider publishing, or scheduler changes.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
              <p className="font-black text-[#5D6B6B]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-black/58">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link href="/dashboard/backups" className={buttonStyles({ variant: 'outline' })}>
            <DatabaseBackup className="h-4 w-4" />
            Open Backup Center
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Security Issues"
          description="Findings from static code checks, migration review, runtime workspace checks, and safe configuration checks. Secret values are never shown."
        />
        {summary.issues.length === 0 ? (
          <div className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#F7CBCA]" />
            <p className="mt-3 font-black text-[#5D6B6B]">No issues detected by current checks.</p>
            <p className="mt-1 text-sm text-black/55">Continue manual review before major production changes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/8 text-xs font-black uppercase tracking-[0.12em] text-black/42">
                  <th className="px-3 py-3">Area</th>
                  <th className="px-3 py-3">Issue</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Evidence</th>
                  <th className="px-3 py-3">Recommended fix</th>
                  <th className="px-3 py-3">Related</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.issues.map((finding) => (
                  <tr key={`${finding.area}-${finding.issue}-${finding.related}`} className="border-b border-black/6 align-top">
                    <td className="px-3 py-3 font-bold text-[#5D6B6B]">{finding.area}</td>
                    <td className="px-3 py-3 text-black/68">{finding.issue}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-[#D5E5E5] px-2.5 py-1 text-xs font-black uppercase text-[#F7CBCA]">
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3"><SecurityPill status={finding.status} /></td>
                    <td className="px-3 py-3 text-black/58">{finding.evidence}</td>
                    <td className="px-3 py-3 text-black/58">{finding.recommendedFix}</td>
                    <td className="px-3 py-3">
                      <CodeInline>{finding.related}</CodeInline>
                    </td>
                    <td className="px-3 py-3">
                      {finding.actionHref ? (
                        <Link href={safeActionHref(finding.actionHref)} className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                          Open
                        </Link>
                      ) : (
                        <span className="text-xs text-black/42">Review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="OWASP-Inspired Control Map" description="Guidance alignment only. This is not an OWASP certification or penetration test." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Broken Access Control', 'Workspace membership, RLS, owner/admin checks.'],
            ['Security Misconfiguration', 'Security headers, env presence checks, cron protection.'],
            ['Software Supply Chain Failures', 'Build checks and dependency audit recommendation.'],
            ['Cryptographic Failures', 'Token encryption readiness and no secret exposure in UI.'],
            ['Injection / Validation', 'Server action validation and upload allowlists.'],
            ['Logging & Alerting', 'Audit log table migration and publish/scheduler logs.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-2xl border border-black/7 bg-[#F1F7F7]/62 p-4">
              <FileWarning className="h-5 w-5 text-[#F7CBCA]" />
              <p className="mt-3 font-black text-[#5D6B6B]">{title}</p>
              <p className="mt-1 text-sm leading-6 text-black/58">{detail}</p>
            </div>
          ))}
        </div>
        <Notice tone="info" title="Scope note">
          This page is an internal defensive review center aligned with selected OWASP Top 10 and
          ASVS-style verification controls. It does not claim full compliance or certification.
        </Notice>
      </Card>
    </div>
  );
}
