import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type { MetaCampaignInsights } from '@/lib/ads/meta';
import {
  type MetaCampaignInsightsState,
  type MetaCampaignsState,
  type MetaCampaignWithInsights,
} from '@/lib/data/ad-connections';
import { buildMetaPerformanceDiagnosis } from '@/lib/ads/meta-diagnosis';
import { MetaCampaignAnalysisTaskForm } from './MetaCampaignAnalysisTaskForm';

interface MetaCampaignsProps {
  state: MetaCampaignsState;
  campaigns: MetaCampaignWithInsights[];
  accountId: string | null;
  currency: string | null;
}

type MetaCampaignBadgeStatus = 'Ready' | 'Setup Required' | 'No Data' | 'Awaiting Data';

const META_CONNECT_HREF = '/api/ads/meta/connect';
const warmOutlineButtonClassName =
  'border-[#5D6B6B]/12 bg-[#F1F7F7] text-[#5D6B6B] hover:border-[#F7CBCA]/35 hover:bg-[#D5E5E5]/55 hover:text-[#F7CBCA]';

function displayValue(value: string | null) {
  return value?.trim() || 'Unavailable';
}

function formatMetricValue(value: number | null | undefined, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}${suffix}`;
}

function formatMoneyMetric(value: number | null | undefined, currency: string | null) {
  const formatted = formatMetricValue(value);

  if (formatted === 'Unavailable') {
    return formatted;
  }

  return currency ? `${formatted} ${currency}` : formatted;
}

function getInsightsBadgeStatus(state: MetaCampaignInsightsState): MetaCampaignBadgeStatus {
  if (state === 'connected') {
    return 'Ready';
  }

  if (state === 'empty') {
    return 'No Data';
  }

  if (state === 'token_invalid' || state === 'permission_issue') {
    return 'Setup Required';
  }

  return 'Awaiting Data';
}

function getCampaignBadgeStatus(campaign: MetaCampaignWithInsights): MetaCampaignBadgeStatus {
  if (campaign.insightsState === 'connected') {
    return 'Ready';
  }

  if (campaign.insightsState === 'empty') {
    return 'No Data';
  }

  if (
    campaign.insightsState === 'token_invalid' ||
    campaign.insightsState === 'permission_issue'
  ) {
    return 'Setup Required';
  }

  return 'Awaiting Data';
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

function MetaCampaignsStatePanel({
  message,
  actionLabel,
  badgeStatus,
}: {
  message: string;
  actionLabel?: string;
  badgeStatus: MetaCampaignBadgeStatus;
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
          href={META_CONNECT_HREF}
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

function renderMetaCampaignsState(state: MetaCampaignsState) {
  if (state === 'empty') {
    return <MetaCampaignsStatePanel message="No campaigns found." badgeStatus="No Data" />;
  }

  if (state === 'token_invalid') {
    return (
      <MetaCampaignsStatePanel
        message="Token expired or invalid."
        actionLabel="Reconnect Meta Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  if (state === 'permission_issue') {
    return (
      <MetaCampaignsStatePanel
        message="Meta API permission issue. Check ads_read access and Meta account permissions."
        actionLabel="Reconnect Meta Ads"
        badgeStatus="Setup Required"
      />
    );
  }

  return (
    <MetaCampaignsStatePanel
      message="Meta campaigns could not be loaded."
      badgeStatus="Setup Required"
    />
  );
}

function renderInsightsStateMessage(state: MetaCampaignInsightsState) {
  if (state === 'empty') {
    return 'No insights were returned for the last 30 days.';
  }

  if (state === 'not_requested') {
    return 'Insights were not loaded for this campaign because this page caps Meta API reads at 25 campaigns per account and 50 total.';
  }

  if (state === 'token_invalid') {
    return 'Token expired or invalid.';
  }

  if (state === 'permission_issue') {
    return 'Meta API permission issue. Check ads_read access and Meta account permissions.';
  }

  if (state === 'error') {
    return 'Meta campaign insights could not be loaded.';
  }

  return null;
}

function MetricsGrid({
  insights,
  currency,
}: {
  insights: MetaCampaignInsights;
  currency: string | null;
}) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <MetricField label="spend" value={formatMoneyMetric(insights.spend, currency)} />
      <MetricField label="impressions" value={formatMetricValue(insights.impressions)} />
      <MetricField label="reach" value={formatMetricValue(insights.reach)} />
      <MetricField label="clicks" value={formatMetricValue(insights.clicks)} />
      <MetricField label="ctr" value={formatMetricValue(insights.ctr, '%')} />
      <MetricField label="cpc" value={formatMoneyMetric(insights.cpc, currency)} />
      <MetricField label="cpm" value={formatMoneyMetric(insights.cpm, currency)} />
      <MetricField label="leads" value={formatMetricValue(insights.leads)} />
      <MetricField label="conversions" value={formatMetricValue(insights.conversions)} />
    </dl>
  );
}

function DiagnosisBlock({ insights }: { insights: MetaCampaignInsights | null }) {
  const diagnosis = buildMetaPerformanceDiagnosis(insights);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0">
        <h6 className="text-xs font-bold uppercase tracking-[0.14em] text-black/42">
          Local diagnosis
        </h6>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-black/62">
          {diagnosis.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <h6 className="text-xs font-bold uppercase tracking-[0.14em] text-black/42">
          Next actions
        </h6>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-black/62">
          {diagnosis.nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MetaCampaignInsightsPanel({
  campaign,
  accountId,
  currency,
}: {
  campaign: MetaCampaignWithInsights;
  accountId: string | null;
  currency: string | null;
}) {
  const stateMessage = renderInsightsStateMessage(campaign.insightsState);
  const canCreateTask =
    Boolean(accountId && campaign.id) &&
    (campaign.insightsState === 'connected' || campaign.insightsState === 'empty');

  return (
    <div className="mt-4 space-y-4 border-t border-[#5D6B6B]/8 pt-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="break-words text-sm font-bold text-black">
            Last 30 days metrics
          </h6>
          {campaign.insights?.dateStart && campaign.insights.dateStop && (
            <p className="mt-1 text-xs font-semibold text-black/48">
              {campaign.insights.dateStart} to {campaign.insights.dateStop}
            </p>
          )}
        </div>
        <StatusBadge
          status={getInsightsBadgeStatus(campaign.insightsState)}
          type="system"
          size="sm"
        />
      </div>

      {stateMessage && (
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#5D6B6B]/8 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-black/58">{stateMessage}</p>
          {(campaign.insightsState === 'token_invalid' ||
            campaign.insightsState === 'permission_issue') && (
            <Link
              href={META_CONNECT_HREF}
              className={buttonStyles({
                variant: 'outline',
                size: 'sm',
                className: warmOutlineButtonClassName,
              })}
            >
              Reconnect Meta Ads
            </Link>
          )}
        </div>
      )}

      {campaign.insightsState === 'connected' && campaign.insights && (
        <MetricsGrid insights={campaign.insights} currency={currency} />
      )}

      {(campaign.insightsState === 'connected' || campaign.insightsState === 'empty') && (
        <DiagnosisBlock insights={campaign.insights} />
      )}

      {canCreateTask && accountId && campaign.id && (
        <MetaCampaignAnalysisTaskForm accountId={accountId} campaignId={campaign.id} />
      )}
    </div>
  );
}

export function MetaCampaigns({
  state,
  campaigns,
  accountId,
  currency,
}: MetaCampaignsProps) {
  if (state !== 'connected') {
    return renderMetaCampaignsState(state);
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
            key={campaign.id ?? `meta-campaign-${index}`}
            className="group rounded-2xl border border-[#5D6B6B]/8 bg-white px-4 py-3 shadow-sm transition-all hover:border-[#F7CBCA]/22 hover:shadow-[0_16px_34px_rgba(202,40,81,0.10)]"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-[#F1F7F7]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h6 className="break-words text-sm font-bold text-black">
                    {displayValue(campaign.name)}
                  </h6>
                  <StatusBadge
                    status={getCampaignBadgeStatus(campaign)}
                    type="system"
                    size="sm"
                  />
                </div>
                <p className="mt-1 break-words text-xs font-semibold text-black/48">
                  {displayValue(campaign.effectiveStatus ?? campaign.status)} ·{' '}
                  {displayValue(campaign.objective)}
                </p>
              </div>
              <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-[#F7CBCA]/70 transition-transform group-open:rotate-180')} />
            </summary>

            <div className="mt-3 px-1">
              <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CampaignField label="campaign_id" value={campaign.id} />
                <CampaignField label="status" value={campaign.status} />
                <CampaignField label="effective_status" value={campaign.effectiveStatus} />
                <CampaignField label="objective" value={campaign.objective} />
                <CampaignField label="buying_type" value={campaign.buyingType} />
                <CampaignField label="updated_time" value={campaign.updatedTime} />
              </dl>

              <MetaCampaignInsightsPanel
                campaign={campaign}
                accountId={accountId}
                currency={currency}
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
