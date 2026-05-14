import Link from 'next/link';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type {
  GoogleAdsCampaignMetricsForWorkspaceData,
  GoogleAdsCustomerCampaignsData,
} from '@/lib/data/ad-connections';
import { GoogleAdsCampaigns } from './GoogleAdsCampaigns';

interface GoogleAdsAccountsProps {
  data: GoogleAdsCampaignMetricsForWorkspaceData;
}

type GoogleAdsAccountBadgeStatus = 'Ready' | 'Setup Required' | 'No Data';

const GOOGLE_ADS_CONNECT_HREF = '/api/ads/google/connect';
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

function getCampaignCount(customer: GoogleAdsCustomerCampaignsData) {
  return customer.campaigns.length;
}

function getTotalCampaignCount(customers: GoogleAdsCustomerCampaignsData[]) {
  return customers.reduce((total, customer) => total + getCampaignCount(customer), 0);
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

function GoogleAdsAccountsState({
  message,
  actionLabel,
  badgeStatus,
}: {
  message: string;
  actionLabel?: string;
  badgeStatus: GoogleAdsAccountBadgeStatus;
}) {
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4 rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="break-words text-sm font-bold text-black">
            Accessible Google Ads customer accounts
          </h4>
          <StatusBadge status={badgeStatus} type="system" size="sm" />
        </div>
        <p className="mt-2 text-sm leading-6 text-black/58">{message}</p>
      </div>

      {actionLabel && (
        <Link
          href={GOOGLE_ADS_CONNECT_HREF}
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

function renderGoogleAdsAccountsState(data: GoogleAdsCampaignMetricsForWorkspaceData) {
  if (data.state === 'not_connected') {
    return (
      <GoogleAdsAccountsState
        message="No Google Ads connection is available."
        actionLabel="Connect Google Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'empty') {
    return (
      <GoogleAdsAccountsState
        message="No accessible customers."
        badgeStatus="No Data"
      />
    );
  }

  if (data.state === 'token_invalid') {
    return (
      <GoogleAdsAccountsState
        message="Google Ads token expired or invalid."
        actionLabel="Reconnect Google Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'permission_issue') {
    return (
      <GoogleAdsAccountsState
        message="Google Ads permission issue. Check customer access and Google Ads permissions."
        badgeStatus="Setup Required"
      />
    );
  }

  if (data.state === 'api_issue') {
    return (
      <GoogleAdsAccountsState
        message="Google Ads developer token / API issue. Check API access and server configuration."
        badgeStatus="Setup Required"
      />
    );
  }

  return (
    <GoogleAdsAccountsState
      message="Google Ads campaign metrics could not be loaded."
      badgeStatus="Setup Required"
    />
  );
}

export function GoogleAdsAccounts({ data }: GoogleAdsAccountsProps) {
  if (data.state !== 'connected') {
    return renderGoogleAdsAccountsState(data);
  }

  const totalCampaigns = getTotalCampaignCount(data.customers);

  return (
    <div className="mt-4 min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-bold text-black">
            Accessible Google Ads customer accounts
          </h4>
          <p className="mt-1 text-sm leading-6 text-black/58">
            {data.customers.length} inspected {data.customers.length === 1 ? 'account' : 'accounts'} · {totalCampaigns} {totalCampaigns === 1 ? 'campaign' : 'campaigns'}
          </p>
        </div>
        <StatusBadge status="Ready" type="system" size="sm" />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.customers.map((customer, index) => (
          <article
            key={customer.customerResourceName || `google-ads-customer-${index}`}
            className={cn(
              'min-w-0 rounded-2xl border border-[#5D6B6B]/8 bg-[#F1F7F7] p-4 shadow-sm transition-all',
              'hover:border-[#F7CBCA]/22 hover:shadow-[0_18px_38px_rgba(202,40,81,0.10)]'
            )}
          >
            <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AccountField label="customer_id" value={customer.customerId} />
              <AccountField
                label="customer_name"
                value={customer.customerName ?? customer.customerId}
              />
              <AccountField label="resource_name" value={customer.customerResourceName} />
              <AccountField label="campaigns" value={getCampaignCount(customer)} />
            </dl>

            <GoogleAdsCampaigns
              state={customer.campaignsState}
              campaigns={customer.campaigns}
              customerId={customer.customerId}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
