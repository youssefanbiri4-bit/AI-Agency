import Link from 'next/link';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import {
  getMetaAdAccountsForWorkspace,
  type MetaAdAccountsForWorkspaceData,
} from '@/lib/data/ad-connections';
import { MetaCampaigns } from './MetaCampaigns';

interface MetaAdAccountsProps {
  workspaceId: string | null | undefined;
  userId: string | null | undefined;
}

type MetaAccountBadgeStatus = 'Ready' | 'Setup Required' | 'No Data';

const META_CONNECT_HREF = '/api/ads/meta/connect';
const gradientButtonClassName =
  'border-[#F7CBCA] bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA] text-white shadow-[0_12px_26px_rgba(202,40,81,0.20)] hover:border-[#5D6B6B] hover:from-[#5D6B6B] hover:to-[#F7CBCA] hover:text-white';
const warmOutlineButtonClassName =
  'border-[#5D6B6B]/12 bg-[#F1F7F7] text-[#5D6B6B] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]';

function displayValue(value: string | number | null) {
  if (value === null || value === '') {
    return 'Unavailable';
  }

  return String(value);
}

function AccountField({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/42">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-black">
        {displayValue(value)}
      </dd>
    </div>
  );
}

function MetaAdAccountsState({
  message,
  actionLabel,
  badgeStatus,
}: {
  message: string;
  actionLabel?: string;
  badgeStatus: MetaAccountBadgeStatus;
}) {
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4 rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="break-words text-sm font-bold text-black">Meta ad accounts</h4>
          <StatusBadge status={badgeStatus} type="system" size="sm" />
        </div>
        <p className="mt-2 text-sm leading-6 text-black/58">{message}</p>
      </div>

      {actionLabel && (
        <Link
          href={META_CONNECT_HREF}
          className={buttonStyles({
            variant: actionLabel.startsWith('Reconnect') ? 'outline' : 'primary',
            size: 'sm',
            className: actionLabel.startsWith('Reconnect')
              ? warmOutlineButtonClassName
              : gradientButtonClassName,
          })}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function renderMetaAdAccountsState(data: MetaAdAccountsForWorkspaceData) {
  if (data.state === 'not_connected') {
    return (
      <MetaAdAccountsState
        message="No Meta Ads connection is available."
        actionLabel="Connect Meta Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'empty') {
    return (
      <MetaAdAccountsState
        message="No ad accounts found."
        badgeStatus="No Data"
      />
    );
  }

  if (data.state === 'token_invalid') {
    return (
      <MetaAdAccountsState
        message="Token expired or invalid."
        actionLabel="Reconnect Meta Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'permission_issue') {
    return (
      <MetaAdAccountsState
        message="Meta API permission issue. Check ads_read access and Meta account permissions."
        actionLabel="Reconnect Meta Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'error') {
    return (
      <MetaAdAccountsState
        message="Meta ad accounts could not be loaded."
        badgeStatus="Setup Required"
      />
    );
  }

  return null;
}

export async function MetaAdAccounts({ workspaceId, userId }: MetaAdAccountsProps) {
  const result =
    workspaceId && userId
      ? await getMetaAdAccountsForWorkspace(workspaceId, userId)
      : {
          data: {
            state: 'not_connected',
            accounts: [],
          } satisfies MetaAdAccountsForWorkspaceData,
          error: null,
          isConfigured: true,
        };
  const { data } = result;

  if (data.state !== 'connected') {
    return renderMetaAdAccountsState(data);
  }

  return (
    <div className="mt-4 min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-bold text-black">Meta ad accounts</h4>
          <p className="mt-1 text-sm leading-6 text-black/58">
            {data.accounts.length} connected {data.accounts.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <StatusBadge status="Ready" type="system" size="sm" />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.accounts.map((account, index) => (
          <article
            key={account.id ?? account.accountId ?? `meta-account-${index}`}
            className={cn(
              'min-w-0 rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm transition-all',
              'hover:border-[#F7CBCA]/22 hover:shadow-[0_18px_38px_rgba(202,40,81,0.10)]'
            )}
          >
            <dl className="dashboard-stat-grid">
              <AccountField label="account_id" value={account.accountId} />
              <AccountField label="name" value={account.name} />
              <AccountField label="account_status" value={account.accountStatus} />
              <AccountField label="currency" value={account.currency} />
              <AccountField label="timezone_name" value={account.timezoneName} />
            </dl>

            <MetaCampaigns
              state={account.campaignsState}
              campaigns={account.campaigns}
              accountId={account.accountId ?? account.id}
              currency={account.currency}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
