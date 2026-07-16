'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Image as ImageIcon, RadioTower, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Label, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useActionToast } from '@/hooks/useActionToast';
import {
  getMetaConnectionSettingsAction,
  selectMetaAdAccountAction,
  selectMetaFacebookPageAction,
  selectMetaInstagramAccountAction,
  type MetaConnectionSettingsState,
} from './actions';

const initialState: MetaConnectionSettingsState = {
  error: null,
  status: 'not_connected',
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  grantedScopes: [],
  requiredOrganicScopes: [],
  missingOrganicScopes: [],
  connectedMetaUserId: null,
  connectedMetaApplication: null,
  scopesVerified: false,
  scopeWarning: null,
  pages: [],
  adAccounts: [],
  selectedFacebookPageId: null,
  selectedFacebookPageName: null,
  selectedInstagramBusinessAccountId: null,
  selectedInstagramUsername: null,
  selectedInstagramAssociatedFacebookPageId: null,
  selectedMetaAdAccountId: null,
  selectedMetaAdAccountName: null,
  selectedMetaAdAccountCurrency: null,
  selectedMetaAdAccountTimezone: null,
};

function statusLabel(status: MetaConnectionSettingsState['status']) {
  if (status === 'connected') {
    return 'Ready';
  }

  if (status === 'not_connected') {
    return 'Not Connected';
  }

  return 'Setup Required';
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None';
}

export function MetaConnectionSettings() {
  const [pageState, pageFormAction, pagePending] = useActionState(
    selectMetaFacebookPageAction,
    initialState
  );
  const [instagramState, instagramFormAction, instagramPending] = useActionState(
    selectMetaInstagramAccountAction,
    initialState
  );
  const [adAccountState, adAccountFormAction, adAccountPending] = useActionState(
    selectMetaAdAccountAction,
    initialState
  );
  const [loadedState, setLoadedState] = useState<MetaConnectionSettingsState>(initialState);
  const activeState = adAccountState.message || adAccountState.error
    ? adAccountState
    : instagramState.message || instagramState.error
    ? instagramState
    : pageState.message || pageState.error
      ? pageState
      : loadedState;
  const instagramOptions = activeState.pages.filter((page) => page.instagramBusinessAccountId);

  useEffect(() => {
    let isMounted = true;

    void getMetaConnectionSettingsAction().then((settings) => {
      if (!isMounted) {
        return;
      }

      setLoadedState(settings);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useActionToast({
    isPending: pagePending,
    state: pageState,
    loadingMessage: 'Saving Facebook Page...',
    successMessage: (state) => state.message,
    errorMessage: (state) => state.error ?? 'Facebook Page setup required.',
  });

  useActionToast({
    isPending: instagramPending,
    state: instagramState,
    loadingMessage: 'Saving Instagram account...',
    successMessage: (state) => state.message,
    errorMessage: (state) => state.error ?? 'Instagram Business Account setup required.',
  });

  useActionToast({
    isPending: adAccountPending,
    state: adAccountState,
    loadingMessage: 'Saving Meta Ad Account...',
    successMessage: (state) => state.message,
    errorMessage: (state) => state.error ?? 'Meta Ad Account is not selected.',
  });

  return (
    <Card>
      <CardHeader
        title="Meta / Facebook / Instagram Connection"
        description="Choose the organic publishing targets used by Content Studio."
        action={<StatusBadge status={statusLabel(activeState.status)} type="system" size="sm" />}
      />

      <div className="space-y-4">
        {activeState.error ? (
          <Notice tone="warning" title="Meta publishing setup">
            {activeState.error}
          </Notice>
        ) : null}

        {activeState.scopeWarning ? (
          <Notice tone="warning" title="Scope verification warning">
            {activeState.scopeWarning}
          </Notice>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="muted-panel p-4">
            <p className="text-sm font-bold text-black">Connection status</p>
            <p className="mt-2 text-sm leading-6 text-black/58">
              {activeState.status === 'connected'
                ? 'Meta account connected.'
                : 'Connect Meta before selecting publishing targets.'}
            </p>
            <p className="mt-2 text-xs text-black/44">
              User: {activeState.connectedMetaUserId ?? 'Not available'}
            </p>
            <p className="mt-1 text-xs text-black/44">
              App: {activeState.connectedMetaApplication ?? 'Not available'}
            </p>
          </div>

          <div className="muted-panel p-4">
            <p className="text-sm font-bold text-black">Granted scopes</p>
            <p className="mt-2 break-words text-sm leading-6 text-black/58">
              {formatList(activeState.grantedScopes)}
            </p>
            {activeState.missingOrganicScopes.length > 0 ? (
              <p className="mt-2 text-xs font-semibold text-[#F7CBCA]">
                Missing: {activeState.missingOrganicScopes.join(', ')}
              </p>
            ) : (
              <p className="mt-2 text-xs font-semibold text-black/48">
                Organic publishing scopes are present.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <form action={pageFormAction} className="muted-panel p-4">
            <div className="flex items-start gap-3">
              <RadioTower className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-black">Facebook Pages found</p>
                <p className="mt-1 text-sm leading-6 text-black/58">
                  Selected: {activeState.selectedFacebookPageName ?? 'Missing page'}
                </p>
                <div className="mt-4">
                  <Label htmlFor="facebook_page_id">Facebook Page</Label>
                  <Select
                    id="facebook_page_id"
                    name="facebook_page_id"
                    defaultValue={activeState.selectedFacebookPageId ?? ''}
                    disabled={activeState.status !== 'connected' || pagePending}
                  >
                    <option value="">Choose a Page</option>
                    {activeState.pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="mt-4"
                  disabled={activeState.status !== 'connected' || pagePending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {pagePending ? 'Saving...' : 'Save Facebook Page'}
                </Button>
              </div>
            </div>
          </form>

          <form action={instagramFormAction} className="muted-panel p-4">
            <div className="flex items-start gap-3">
              <ImageIcon className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-black">Instagram Business Accounts found</p>
                <p className="mt-1 text-sm leading-6 text-black/58">
                  Selected: {activeState.selectedInstagramUsername ?? 'Missing account'}
                </p>
                <div className="mt-4">
                  <Label htmlFor="instagram_business_account_id">Instagram Account</Label>
                  <Select
                    id="instagram_business_account_id"
                    name="instagram_business_account_id"
                    defaultValue={activeState.selectedInstagramBusinessAccountId ?? ''}
                    disabled={activeState.status !== 'connected' || instagramPending}
                  >
                    <option value="">Choose an Instagram account</option>
                    {instagramOptions.map((page) => (
                      <option
                        key={`${page.id}-${page.instagramBusinessAccountId}`}
                        value={page.instagramBusinessAccountId ?? ''}
                      >
                        {page.instagramUsername
                          ? `@${page.instagramUsername}`
                          : page.instagramBusinessAccountId}{' '}
                        via {page.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="mt-4"
                  disabled={activeState.status !== 'connected' || instagramPending}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {instagramPending ? 'Saving...' : 'Save Instagram Account'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <form action={adAccountFormAction} className="muted-panel p-4">
          <div className="flex items-start gap-3">
            <RadioTower className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-black">Meta Ads Account</p>
              <p className="mt-1 text-sm leading-6 text-black/58">
                Selected: {activeState.selectedMetaAdAccountName ?? 'Missing ad account'}
              </p>
              <p className="mt-1 text-xs text-black/44">
                Currency: {activeState.selectedMetaAdAccountCurrency ?? 'Not available'} · Timezone:{' '}
                {activeState.selectedMetaAdAccountTimezone ?? 'Not available'}
              </p>
              <div className="mt-4">
                <Label htmlFor="meta_ad_account_id">Meta Ad Account</Label>
                <Select
                  id="meta_ad_account_id"
                  name="meta_ad_account_id"
                  defaultValue={activeState.selectedMetaAdAccountId ?? ''}
                  disabled={activeState.status !== 'connected' || adAccountPending}
                >
                  <option value="">Choose an ad account</option>
                  {activeState.adAccounts.map((account) => (
                    <option key={account.accountId ?? account.id} value={account.accountId ?? account.id ?? ''}>
                      {account.name ?? account.accountId ?? account.id} · {account.currency ?? 'currency unknown'} ·{' '}
                      {account.timezoneName ?? 'timezone unknown'}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="submit"
                variant="outline"
                className="mt-4"
                disabled={activeState.status !== 'connected' || adAccountPending}
              >
                <ShieldCheck className="h-4 w-4" />
                {adAccountPending ? 'Saving...' : 'Save Meta Ad Account'}
              </Button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap gap-3">
          <Link href="/api/ads/meta/connect" className={buttonStyles({ variant: 'primary' })}>
            <RefreshCw className="h-4 w-4" />
            Reconnect Meta
          </Link>
        </div>
      </div>
    </Card>
  );
}
