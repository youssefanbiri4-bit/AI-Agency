'use client';

import { useState, useActionState } from 'react';
import { Shield, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { saveSSOProviderAction } from '@/app/(dashboard)/dashboard/settings/actions/white-label';
import type { WorkspaceBrandingSettingsState } from '@/app/(dashboard)/dashboard/settings/actions/_shared';
import type { SSOProviderConfig, SSOProviderType } from '@/types/white-label';
import { SSO_PROVIDER_INFO, defaultSSOProviderConfig } from '@/types/white-label';

const PROVIDER_ICONS: Record<SSOProviderType, string> = {
  google_workspace: 'G',
  microsoft_entra: 'M',
  okta: 'O',
};

const PROVIDER_COLORS: Record<SSOProviderType, string> = {
  google_workspace: 'bg-blue-500',
  microsoft_entra: 'bg-indigo-500',
  okta: 'bg-blue-600',
};

function ProviderCard({
  provider,
  onToggle,
  isPending: _isPending,
}: {
  provider: SSOProviderConfig;
  onToggle: (provider: SSOProviderConfig) => void;
  isPending?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const info = SSO_PROVIDER_INFO[provider.type];

  return (
    <div className={`rounded-lg border ${provider.enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'} overflow-hidden`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-lg ${PROVIDER_COLORS[provider.type]}`}>
            {PROVIDER_ICONS[provider.type]}
          </div>
          <div>
            <p className="text-sm font-bold">{info.name}</p>
            <p className="text-xs text-foreground-muted">
              {provider.enabled ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-3 w-3" /> Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-foreground-muted">
                  <XCircle className="h-3 w-3" /> Disabled
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-divider p-4 space-y-3">
          <p className="text-xs text-foreground-muted">{info.description}</p>

          <div className="grid gap-3 md:grid-cols-2">
            {provider.type === 'microsoft_entra' && (
              <div>
                <label className="text-xs font-bold text-foreground-muted">Tenant ID</label>
                <input
                  type="text"
                  value={provider.tenantId ?? ''}
                  onChange={(e) => onToggle({ ...provider, tenantId: e.target.value || null })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-1 h-9 w-full rounded border border-border bg-surface-elevated px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
                />
              </div>
            )}

            {(provider.type === 'google_workspace' || provider.type === 'okta') && (
              <div>
                <label className="text-xs font-bold text-foreground-muted">Client ID</label>
                <input
                  type="text"
                  value={provider.clientId ?? ''}
                  onChange={(e) => onToggle({ ...provider, clientId: e.target.value || null })}
                  placeholder="OAuth 2.0 Client ID"
                  className="mt-1 h-9 w-full rounded border border-border bg-surface-elevated px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
                />
              </div>
            )}

            {provider.type === 'okta' && (
              <>
                <div>
                  <label className="text-xs font-bold text-foreground-muted">Issuer URL</label>
                  <input
                    type="text"
                    value={provider.issuerUrl ?? ''}
                    onChange={(e) => onToggle({ ...provider, issuerUrl: e.target.value || null })}
                    placeholder="https://your-domain.okta.com"
                    className="mt-1 h-9 w-full rounded border border-border bg-surface-elevated px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground-muted">Okta Domain</label>
                  <input
                    type="text"
                    value={provider.domain ?? ''}
                    onChange={(e) => onToggle({ ...provider, domain: e.target.value || null })}
                    placeholder="your-domain.okta.com"
                    className="mt-1 h-9 w-full rounded border border-border bg-surface-elevated px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-foreground-muted">Callback URL</label>
              <input
                type="text"
                value={provider.callbackUrl ?? ''}
                onChange={(e) => onToggle({ ...provider, callbackUrl: e.target.value || null })}
                placeholder="https://yourapp.com/auth/callback/sso"
                className="mt-1 h-9 w-full rounded border border-border bg-surface-elevated px-2 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground-muted">
              Allowed Email Domains (one per line)
            </label>
            <textarea
              value={provider.domains.join('\n')}
              onChange={(e) => onToggle({
                ...provider,
                domains: e.target.value.split(/[\n,]/).map((d) => d.trim()).filter(Boolean),
              })}
              placeholder="yourcompany.com&#10;subsidiary.com"
              rows={3}
              className="mt-1 w-full rounded border border-border bg-surface-elevated px-2 py-1 font-mono text-xs focus:border-[#F7CBCA] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(e) => onToggle({ ...provider, enabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-surface after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-border after:bg-surface-elevated after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
            <span className="text-sm font-bold">Enable {info.name} SSO</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SSOSettings({
  initialData,
}: {
  initialData: WorkspaceBrandingSettingsState;
}) {
  const [state, formAction, isPending] = useActionState(saveSSOProviderAction, initialData);
  const [providers, setProviders] = useState<SSOProviderConfig[]>(
    state.settings?.ssoProviders ?? initialData.settings?.ssoProviders ?? []
  );

  function updateProvider(provider: SSOProviderConfig) {
    setProviders((prev) => {
      const idx = prev.findIndex((p) => p.type === provider.type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = provider;
        return next;
      }
      return [...prev, provider];
    });
  }

  function handleSubmit(provider: SSOProviderConfig) {
    const fd = new FormData();
    fd.set('providerType', provider.type);
    fd.set('enabled', provider.enabled ? 'on' : 'off');
    if (provider.clientId) fd.set('clientId', provider.clientId);
    if (provider.tenantId) fd.set('tenantId', provider.tenantId);
    if (provider.domain) fd.set('ssoDomain', provider.domain);
    if (provider.issuerUrl) fd.set('issuerUrl', provider.issuerUrl);
    if (provider.callbackUrl) fd.set('callbackUrl', provider.callbackUrl);
    fd.set('allowSignUp', provider.allowSignUp ? 'on' : 'off');
    fd.set('allowedDomains', provider.domains.join('\n'));
    formAction(fd);
  }

  const allProviders: SSOProviderType[] = ['google_workspace', 'microsoft_entra', 'okta'];

  return (
    <Card>
      <CardHeader
        title="Single Sign-On (SSO)"
        description="Configure identity providers for workspace成员 to sign in with their corporate accounts."
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

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">SSO Foundation</h4>
              <p className="text-xs text-amber-700 mt-1">
                SSO configuration is stored securely. To complete setup, you will also need to:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-700 list-disc list-inside">
                <li>Configure OAuth 2.0 credentials in your identity provider</li>
                <li>Set the callback URL in your provider&apos;s app settings</li>
                <li>Add the provider&apos;s Client ID and Tenant/Domain above</li>
                <li>Enable the provider and save</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {allProviders.map((type) => {
            const existing = providers.find((p) => p.type === type);
            const provider = existing ?? { ...defaultSSOProviderConfig, type };
            return (
              <ProviderCard
                key={type}
                provider={provider}
                onToggle={updateProvider}
                isPending={isPending}
              />
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => {
              const lastEdited = providers[providers.length - 1];
              if (lastEdited) handleSubmit(lastEdited);
            }}
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save SSO Settings'}
          </Button>
        </div>

        <div className="rounded-xl border border-divider bg-surface/60 p-4 text-xs leading-6 text-foreground-muted">
          <p className="font-bold mb-1">Environment Variables Required</p>
          <p>For SSO to work in production, ensure these environment variables are set:</p>
          <ul className="mt-2 space-y-1 font-mono">
            <li><code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code></li>
            <li><code>MICROSOFT_CLIENT_ID</code> / <code>MICROSOFT_CLIENT_SECRET</code></li>
            <li><code>OKTA_CLIENT_ID</code> / <code>OKTA_CLIENT_SECRET</code> / <code>OKTA_ISSUER</code></li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
