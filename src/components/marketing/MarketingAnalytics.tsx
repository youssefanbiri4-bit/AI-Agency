'use client';

import { useMemo } from 'react';
import {
  BarChart3,
  Users,
  MousePointerClick,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface MarketingMetrics {
  pageViews: number;
  uniqueVisitors: number;
  conversionRate: number;
  signupRate: number;
  referralSignups: number;
  organicTraffic: number;
  paidTraffic: number;
  socialTraffic: number;
  emailTraffic: number;
  topReferrers: Array<{ source: string; visits: number; conversions: number }>;
  recentCampaigns: Array<{ name: string; sent: number; opened: number; clicked: number }>;
}

interface MarketingAnalyticsProps {
  metrics: MarketingMetrics;
  previousMetrics?: Partial<MarketingMetrics>;
  className?: string;
}

function MetricCard({
  label,
  value,
  previousValue,
  icon,
  format = 'number',
  trend,
}: {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  format?: 'number' | 'percent';
  trend?: 'up' | 'down';
}) {
  const change = previousValue !== undefined && previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
          <div>
            <p className="text-sm text-foreground-muted">{label}</p>
            <p className="text-xl font-black text-foreground">
              {format === 'percent'
                ? `${value.toFixed(1)}%`
                : value.toLocaleString()}
            </p>
          </div>
        </div>

        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-bold',
            (trend === 'down' ? -change : change) >= 0 ? 'text-success' : 'text-danger'
          )}>
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

function TrafficBar({ label, value, maxValue, color }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 text-sm text-foreground-muted">{label}</div>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-16 text-right text-sm font-bold text-foreground">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export function MarketingAnalytics({
  metrics,
  previousMetrics,
  className,
}: MarketingAnalyticsProps) {
  const maxTraffic = useMemo(() => {
    return Math.max(
      metrics.organicTraffic,
      metrics.paidTraffic,
      metrics.socialTraffic,
      metrics.emailTraffic,
      1
    );
  }, [metrics]);

  return (
    <Card className={className}>
      <CardHeader
        title="Marketing Analytics"
        description="Traffic sources, conversions, and campaign performance."
      />

      {/* Key metrics grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Page Views"
          value={metrics.pageViews}
          previousValue={previousMetrics?.pageViews}
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          label="Unique Visitors"
          value={metrics.uniqueVisitors}
          previousValue={previousMetrics?.uniqueVisitors}
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          label="Conversion Rate"
          value={metrics.conversionRate}
          previousValue={previousMetrics?.conversionRate}
          icon={<MousePointerClick className="h-5 w-5 text-primary" />}
          format="percent"
        />
        <MetricCard
          label="Referral Signups"
          value={metrics.referralSignups}
          previousValue={previousMetrics?.referralSignups}
          icon={<Share2 className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Traffic sources */}
      <div className="mt-6">
        <p className="mb-4 text-sm font-bold text-foreground">Traffic Sources</p>
        <div className="space-y-3">
          <TrafficBar
            label="Organic"
            value={metrics.organicTraffic}
            maxValue={maxTraffic}
            color="#22C55E"
          />
          <TrafficBar
            label="Paid"
            value={metrics.paidTraffic}
            maxValue={maxTraffic}
            color="#3B82F6"
          />
          <TrafficBar
            label="Social"
            value={metrics.socialTraffic}
            maxValue={maxTraffic}
            color="#8B5CF6"
          />
          <TrafficBar
            label="Email"
            value={metrics.emailTraffic}
            maxValue={maxTraffic}
            color="#F59E0B"
          />
        </div>
      </div>

      {/* Top referrers */}
      {metrics.topReferrers.length > 0 && (
        <div className="mt-6">
          <p className="mb-4 text-sm font-bold text-foreground">Top Referrers</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-bold text-foreground">Source</th>
                  <th className="pb-2 text-right font-bold text-foreground">Visits</th>
                  <th className="pb-2 text-right font-bold text-foreground">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topReferrers.slice(0, 5).map((ref) => (
                  <tr key={ref.source} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{ref.source}</td>
                    <td className="py-2 text-right text-foreground-muted">{ref.visits.toLocaleString()}</td>
                    <td className="py-2 text-right text-foreground-muted">{ref.conversions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent campaigns */}
      {metrics.recentCampaigns.length > 0 && (
        <div className="mt-6">
          <p className="mb-4 text-sm font-bold text-foreground">Recent Campaigns</p>
          <div className="space-y-3">
            {metrics.recentCampaigns.slice(0, 3).map((campaign) => {
              const openRate = campaign.sent > 0 ? (campaign.opened / campaign.sent) * 100 : 0;
              const clickRate = campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0;

              return (
                <div
                  key={campaign.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                >
                  <div>
                    <p className="font-bold text-foreground">{campaign.name}</p>
                    <p className="text-sm text-foreground-muted">
                      {campaign.sent.toLocaleString()} sent
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{openRate.toFixed(1)}%</p>
                      <p className="text-xs text-foreground-muted">open rate</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{clickRate.toFixed(1)}%</p>
                      <p className="text-xs text-foreground-muted">click rate</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
