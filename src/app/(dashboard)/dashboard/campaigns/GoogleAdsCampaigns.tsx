import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import {
  type GoogleAdsCampaignMetricsRow,
  type GoogleAdsCustomerCampaignsState,
} from '@/lib/data/ad-connections';
import { GoogleCampaignAnalysisTaskForm } from './GoogleCampaignAnalysisTaskForm';

interface GoogleAdsCampaignsProps {
  state: GoogleAdsCustomerCampaignsState;
  campaigns: GoogleAdsCampaignMetricsRow[];
  customerId: string;
}

type GoogleAdsCampaignBadgeStatus =
  | 'Ready'
  | 'Setup Required'
  | 'No Data'
  | 'Awaiting Data';

const GOOGLE_ADS_CONNECT_HREF = '/api/ads/google/connect';
const warmOutlineButtonClassName =
  'border-[#5D6B6B]/12 bg-[#F1F7F7] text-[#5D6B6B] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]';

function displayValue(value: string | null) {
  return value?.trim() || 'Unavailable';
}

function formatMetricValue(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

function formatIntegerMetric(value: number | null | undefined) {
  return formatMetricValue(value, { maximumFractionDigits: 0 });
}

function formatPercentMetric(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return `${formatMetricValue(value * 100, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatMoneyUnitMetric(value: number | null | undefined) {
  return formatMetricValue(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hasMetrics(campaign: GoogleAdsCampaignMetricsRow) {
  return [
    campaign.impressions,
    campaign.clicks,
    campaign.ctr,
    campaign.averageCpc,
    campaign.cost,
    campaign.conversions,
    campaign.conversionsValue,
  ].some((value) => typeof value === 'number' && Number.isFinite(value));
}

function getCampaignBadgeStatus(campaign: GoogleAdsCampaignMetricsRow): GoogleAdsCampaignBadgeStatus {
  return hasMetrics(campaign) ? 'Ready' : 'No Data';
}

function CampaignField({ label, value }: { label: string; value: string | null }) {
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

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-2 shadow-sm">
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/42">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold text-black">{value}</dd>
    </div>
  );
}

function GoogleAdsCampaignsStatePanel({
  message,
  actionLabel,
  badgeStatus,
}: {
  message: string;
  actionLabel?: string;
  badgeStatus: GoogleAdsCampaignBadgeStatus;
}) {
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-[#5D6B6B]/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h5 className="break-words text-sm font-bold text-black">Campaigns</h5>
          <StatusBadge status={badgeStatus} type="system" size="sm" />
        </div>
        <p className="mt-2 text-sm leading-6 text-black/58">{message}</p>
      </div>

      {actionLabel && (
        <Link
          href={GOOGLE_ADS_CONNECT_HREF}
          className={buttonStyles({
            variant: 'outline',
            size: 'sm',
            className: warmOutlineButtonClassName,
          })}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function renderGoogleAdsCampaignsState(state: GoogleAdsCustomerCampaignsState) {
  if (state === 'empty') {
    return <GoogleAdsCampaignsStatePanel message="No campaigns found." badgeStatus="No Data" />;
  }

  if (state === 'token_invalid') {
    return (
      <GoogleAdsCampaignsStatePanel
        message="Google Ads token expired or invalid."
        actionLabel="Reconnect Google Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (state === 'permission_issue') {
    return (
      <GoogleAdsCampaignsStatePanel
        message="Google Ads permission issue. Check customer access and Google Ads permissions."
        badgeStatus="Setup Required"
      />
    );
  }

  if (state === 'api_issue') {
    return (
      <GoogleAdsCampaignsStatePanel
        message="Google Ads developer token / API issue. Check API access and server configuration."
        badgeStatus="Setup Required"
      />
    );
  }

  if (state === 'not_requested') {
    return (
      <GoogleAdsCampaignsStatePanel
        message="Campaign metrics were not loaded because this page caps Google Ads rendering at 100 total campaigns."
        badgeStatus="Awaiting Data"
      />
    );
  }

  return (
    <GoogleAdsCampaignsStatePanel
      message="Google Ads campaigns could not be loaded."
      badgeStatus="Setup Required"
    />
  );
}

function MetricsGrid({ campaign }: { campaign: GoogleAdsCampaignMetricsRow }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MetricField label="impressions" value={formatIntegerMetric(campaign.impressions)} />
      <MetricField label="clicks" value={formatIntegerMetric(campaign.clicks)} />
      <MetricField label="ctr" value={formatPercentMetric(campaign.ctr)} />
      <MetricField label="average_cpc" value={formatMoneyUnitMetric(campaign.averageCpc)} />
      <MetricField label="cost" value={formatMoneyUnitMetric(campaign.cost)} />
      <MetricField label="conversions" value={formatMetricValue(campaign.conversions)} />
      <MetricField
        label="conversion_value"
        value={formatMoneyUnitMetric(campaign.conversionsValue)}
      />
    </dl>
  );
}

function GoogleAdsCampaignMetricsPanel({
  campaign,
}: {
  campaign: GoogleAdsCampaignMetricsRow;
}) {
  const metricsAvailable = hasMetrics(campaign);

  return (
    <div className="mt-4 space-y-4 border-t border-[#5D6B6B]/8 pt-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="break-words text-sm font-bold text-black">
            Last 30 days metrics
          </h6>
          <p className="mt-1 text-xs font-semibold text-black/48">
            LAST_30_DAYS
          </p>
        </div>
        <StatusBadge
          status={metricsAvailable ? 'Ready' : 'No Data'}
          type="system"
          size="sm"
        />
      </div>

      {metricsAvailable ? (
        <MetricsGrid campaign={campaign} />
      ) : (
        <div className="rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-3 shadow-sm">
          <p className="text-sm leading-6 text-black/58">No metrics available.</p>
        </div>
      )}

      <GoogleCampaignAnalysisTaskForm
        customerId={campaign.customerId}
        campaignId={campaign.campaignId}
      />
    </div>
  );
}

export function GoogleAdsCampaigns({
  state,
  campaigns,
  customerId,
}: GoogleAdsCampaignsProps) {
  if (state !== 'connected') {
    return renderGoogleAdsCampaignsState(state);
  }

  return (
    <div className="mt-4 min-w-0 space-y-3 border-t border-[#5D6B6B]/8 pt-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h5 className="break-words text-sm font-bold text-black">Campaigns</h5>
          <p className="mt-1 text-sm leading-6 text-black/58">
            {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
          </p>
        </div>
        <StatusBadge status="Ready" type="system" size="sm" />
      </div>

      <div className="grid gap-3">
        {campaigns.map((campaign, index) => (
          <details
            key={`${customerId}-${campaign.campaignId}`}
            className="group rounded-2xl border border-[#5D6B6B]/8 bg-white px-4 py-3 shadow-sm transition-all hover:border-[#F7CBCA]/22 hover:shadow-[0_16px_34px_rgba(202,40,81,0.10)]"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-[#F1F7F7]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h6 className="break-words text-sm font-bold text-black">
                    {displayValue(campaign.campaignName)}
                  </h6>
                  <StatusBadge
                    status={getCampaignBadgeStatus(campaign)}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-1 break-words text-xs font-semibold text-black/48">
                  {displayValue(campaign.status)} · {displayValue(campaign.channelType)}
                </p>
              </div>
              <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-[#F7CBCA]/70 transition-transform group-open:rotate-180')} />
            </summary>

            <div className="mt-3 px-1">
              <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CampaignField label="campaign_id" value={campaign.campaignId} />
                <CampaignField label="status" value={campaign.status} />
                <CampaignField label="channel_type" value={campaign.channelType} />
                <CampaignField label="start_date" value={campaign.startDate} />
                <CampaignField label="end_date" value={campaign.endDate} />
              </dl>

              <GoogleAdsCampaignMetricsPanel campaign={campaign} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
