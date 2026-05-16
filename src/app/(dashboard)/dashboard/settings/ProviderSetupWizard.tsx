'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  Image as ImageIcon,
  ListChecks,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import type {
  ProviderSetupCheckStatus,
  ProviderSetupStatus,
  ProviderSetupWizardProvider,
  ProviderSetupWizardState,
} from './actions';

interface ProviderSetupWizardProps {
  state: ProviderSetupWizardState | null;
}

const providerIcons: Record<ProviderSetupWizardProvider['key'], typeof Sparkles> = {
  openai: Sparkles,
  meta: RadioTower,
  google_ads: Search,
  pinterest: ImageIcon,
  linkedin: ClipboardList,
  github: GitBranch,
  scheduler: CalendarClock,
  supabase_storage: Database,
};

const statusStyles: Record<ProviderSetupStatus | ProviderSetupCheckStatus, string> = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  setup_required: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  missing: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  token_missing: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  permission_missing: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  customer_id_missing: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  board_missing: 'border-[#F7CBCA]/35 bg-[#F7CBCA]/10 text-[#9F1D36]',
  approval_pending: 'border-[#E7F5DC]/50 bg-[#E7F5DC]/16 text-[#8A4A00]',
  quota_limit: 'border-[#E7F5DC]/50 bg-[#E7F5DC]/16 text-[#8A4A00]',
  credits_required: 'border-[#E7F5DC]/50 bg-[#E7F5DC]/16 text-[#8A4A00]',
  needs_review: 'border-black/10 bg-white text-black/64',
  manual_only: 'border-[#F7CBCA]/20 bg-[#F7CBCA]/8 text-[#F7CBCA]',
  unsupported: 'border-black/10 bg-white text-black/54',
  error: 'border-red-300 bg-red-50 text-red-800',
};

function formatStatus(value: ProviderSetupStatus | ProviderSetupCheckStatus) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function SetupBadge({
  status,
  label,
}: {
  status: ProviderSetupStatus | ProviderSetupCheckStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusStyles[status]}`}
    >
      {label ?? formatStatus(status)}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ready' | 'setup_required' | 'approval_pending' | 'manual_only' | 'error';
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/86 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.08em] text-black/46">{label}</p>
        <SetupBadge status={tone} label=" " />
      </div>
      <p className="mt-3 text-3xl font-black text-[#5D6B6B]">{value}</p>
    </div>
  );
}

export function ProviderSetupWizard({ state }: ProviderSetupWizardProps) {
  const [selectedKey, setSelectedKey] =
    useState<ProviderSetupWizardProvider['key']>('meta');
  const selectedProvider = useMemo(() => {
    return state?.providers.find((provider) => provider.key === selectedKey) ?? state?.providers[0] ?? null;
  }, [selectedKey, state?.providers]);

  if (!state) {
    return (
      <Card id="provider-setup-wizard">
        <CardHeader
          title="Provider Setup Wizard"
          description="Loading provider readiness diagnostics."
        />
        <div className="muted-panel p-4 text-sm text-black/58">Preparing setup checks...</div>
      </Card>
    );
  }

  if (state.error) {
    return (
      <Card id="provider-setup-wizard">
        <CardHeader
          title="Provider Setup Wizard"
          description="Provider readiness diagnostics for the active workspace."
        />
        <Notice tone="warning" title="Provider setup unavailable">
          {state.error}
        </Notice>
      </Card>
    );
  }

  return (
    <Card id="provider-setup-wizard" className="overflow-hidden border-[#F7CBCA]/14 bg-[#F1F7F7]/70">
      <CardHeader
        title="Provider Setup Wizard"
        description="See every external provider, missing requirement, approval blocker, and next setup action in one place."
        action={<SetupBadge status={state.summary.criticalBlockers > 0 ? 'setup_required' : 'ready'} />}
      />

      <div className="space-y-6">
        <div className="dashboard-stat-grid">
          <SummaryTile label="Ready" value={state.summary.ready} tone="ready" />
          <SummaryTile label="Missing Setup" value={state.summary.missingSetup} tone="setup_required" />
          <SummaryTile label="Approval Pending" value={state.summary.approvalPending} tone="approval_pending" />
          <SummaryTile label="Manual-only" value={state.summary.manualOnly} tone="manual_only" />
          <SummaryTile label="Critical Blockers" value={state.summary.criticalBlockers} tone="error" />
        </div>

        <div className="rounded-2xl border border-[#F7CBCA]/14 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D5E5E5] text-[#F7CBCA]">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.08em] text-black/42">
                  Next Best Action
                </p>
                <h3 className="mt-1 text-lg font-black text-black">{state.nextBestAction.title}</h3>
                <p className="mt-1 text-sm leading-6 text-black/58">{state.nextBestAction.detail}</p>
              </div>
            </div>
            {state.nextBestAction.href ? (
              <div className="flex flex-wrap gap-2">
                <Link href={state.nextBestAction.href} className={buttonStyles({ variant: 'primary' })}>
                  <ExternalLink className="h-4 w-4" />
                  Open Setup
                </Link>
                <Link href="/dashboard/system-health" className={buttonStyles({ variant: 'outline' })}>
                  <Gauge className="h-4 w-4" />
                  View System Health
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {state.providers.map((provider) => {
              const Icon = providerIcons[provider.key];
              const isSelected = selectedProvider?.key === provider.key;

              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedKey(provider.key)}
                  className={`rounded-2xl border bg-white/88 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#F7CBCA]/28 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F7CBCA] ${
                    isSelected ? 'border-[#F7CBCA]/30 ring-1 ring-[#F7CBCA]/18' : 'border-black/8'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F7F7] text-[#F7CBCA]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-black">{provider.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/54">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-black/34" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <SetupBadge status={provider.status} />
                    <span className="text-xs font-semibold text-black/46">{provider.statusLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProvider ? (
            <div className="rounded-2xl border border-black/8 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <SetupBadge status={selectedProvider.status} />
                    <p className="text-xs font-semibold text-black/46">
                      Generated {new Date(state.generatedAt).toLocaleString()}
                    </p>
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-black">{selectedProvider.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-black/58">{selectedProvider.description}</p>
                </div>
                {selectedProvider.primaryActionHref ? (
                  <Link
                    href={selectedProvider.primaryActionHref}
                    className={buttonStyles({ variant: 'outline', size: 'sm' })}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {selectedProvider.primaryActionLabel}
                  </Link>
                ) : null}
              </div>

              {selectedProvider.safeLastError ? (
                <div className="mt-5 rounded-2xl border border-[#F7CBCA]/22 bg-[#F7CBCA]/8 p-4">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#F7CBCA]" />
                    <div>
                      <p className="text-sm font-black text-black">Last safe error</p>
                      <p className="mt-1 text-sm leading-6 text-black/62">{selectedProvider.safeLastError}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {selectedProvider.checklist.map((item) => (
                  <div
                    key={`${selectedProvider.key}-${item.label}`}
                    className="rounded-2xl border border-black/8 bg-[#F1F7F7]/74 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#F7CBCA] shadow-sm">
                          {item.status === 'present' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-black">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-black/58">{item.explanation}</p>
                          <p className="mt-2 text-xs font-semibold text-black/48">
                            Next: {item.nextAction}
                          </p>
                        </div>
                      </div>
                      <SetupBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>

              <Notice tone="info" title="Security boundary">
                This wizard only shows present, missing, needs review, approval pending, or manual-only states. Secret values, tokens, and encryption keys stay server-side.
              </Notice>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
