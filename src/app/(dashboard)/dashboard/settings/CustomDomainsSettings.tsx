'use client';

import { useState, useActionState } from 'react';
import { Globe, CheckCircle, XCircle, Clock, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { addCustomDomainAction, removeCustomDomainAction } from '@/app/(dashboard)/dashboard/settings/actions/white-label';
import type { WorkspaceBrandingSettingsState } from '@/app/(dashboard)/dashboard/settings/actions/_shared';
import type { CustomDomain, DomainStatus } from '@/types/white-label';
import { CNAME_TARGET } from '@/types/white-label';

const STATUS_CONFIG: Record<DomainStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  verifying: { icon: AlertTriangle, color: 'text-blue-500', label: 'Verifying' },
  verified: { icon: CheckCircle, color: 'text-emerald-500', label: 'Verified' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  removed: { icon: XCircle, color: 'text-gray-400', label: 'Removed' },
};

function DomainRow({
  domain,
  onRemove,
  disabled,
}: {
  domain: CustomDomain;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const config = STATUS_CONFIG[domain.status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{domain.domain}</p>
          <p className="text-xs text-foreground-muted">
            {config.label}
            {domain.verifiedAt && (
              <> · Verified {new Date(domain.verifiedAt).toLocaleDateString()}</>
            )}
            {domain.errorMessage && (
              <span className="text-red-500"> · {domain.errorMessage}</span>
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(domain.id)}
        disabled={disabled}
        className="shrink-0 rounded-lg p-2 text-foreground-muted hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CustomDomainsSettings({
  initialData,
}: {
  initialData: WorkspaceBrandingSettingsState;
}) {
  const [state, formAction, isPending] = useActionState(addCustomDomainAction, initialData);
  const [removePending, setRemovePending] = useState(false);

  const handleRemoveDomain = async (id: string) => {
    setRemovePending(true);
    try {
      await removeCustomDomainAction(id);
    } finally {
      setRemovePending(false);
    }
  };

  const domains = state.settings?.customDomains ?? initialData.settings?.customDomains ?? [];

  return (
    <Card>
      <CardHeader
        title="Custom Domains"
        description="Connect your own domain to the platform. Configure DNS to point to our CNAME target."
      />

      <div className="space-y-4 p-6 pt-0">
        {state.message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {state.message}
          </div>
        )}
        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="flex gap-2">
          <input
            type="text"
            name="domain"
            placeholder="app.yourcompany.com"
            className="flex-1 h-10 rounded-lg border border-border bg-white px-3 text-sm focus:border-[#F7CBCA] focus:outline-none focus:ring-2 focus:ring-[#F7CBCA]/18"
          />
          <Button type="submit" disabled={isPending} size="sm">
            <Plus className="h-4 w-4" />
            {isPending ? 'Adding...' : 'Add Domain'}
          </Button>
        </form>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-bold text-blue-800 mb-2">DNS Configuration Required</h4>
          <p className="text-xs text-blue-700 mb-2">
            After adding a domain, create the following DNS record:
          </p>
          <div className="rounded bg-white border border-border p-3 font-mono text-xs">
            <p><span className="font-bold">Type:</span> CNAME</p>
            <p><span className="font-bold">Host:</span> @ (or your subdomain)</p>
            <p><span className="font-bold">Value:</span> {CNAME_TARGET}</p>
          </div>
          <p className="mt-2 text-xs text-blue-600">
            DNS propagation may take up to 48 hours. The domain will be verified automatically.
          </p>
        </div>

        {domains.length > 0 ? (
          <div className="space-y-2">
            {domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                onRemove={(id) => {
                  void handleRemoveDomain(id);
                }}
                disabled={removePending}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-divider bg-surface/60 p-6 text-center">
            <Globe className="mx-auto mb-3 h-8 w-8 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">No custom domains configured yet.</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Add a domain above to get started with custom branding.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
