'use client';

import {
  TrendingUp,
  Download,
  DollarSign,
  Star,
  Users,
  BarChart3,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface PublisherStats {
  totalPublished: number;
  totalInstalls: number;
  totalRevenue: number;
  averageRating: number;
  topAgents: Array<{ name: string; installs: number; revenue: number }>;
}

interface PublisherAnalyticsProps {
  stats: PublisherStats;
  className?: string;
}

export function PublisherAnalytics({ stats, className }: PublisherAnalyticsProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Published Agents"
          value={stats.totalPublished}
          icon={<Users className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="Total Installs"
          value={stats.totalInstalls}
          icon={<Download className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          label="Total Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          label="Average Rating"
          value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
          icon={<Star className="h-5 w-5" />}
          color="info"
        />
      </div>

      {/* Top Agents */}
      <Card>
        <CardHeader
          title="Top Performing Agents"
          description="Your most popular agents by installs and revenue"
        />
        <div className="p-6">
          {stats.topAgents.length === 0 && (
            <p className="text-sm text-foreground-muted">
              No published agents yet. Publish your first agent to see analytics here.
            </p>
          )}
          <div className="space-y-4">
            {stats.topAgents.map((agent, index) => (
              <div
                key={agent.name}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">{agent.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-foreground-muted">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {agent.installs} installs
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${agent.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Badge tone={agent.revenue > 0 ? 'success' : 'neutral'}>
                  {agent.revenue > 0 ? 'Earning' : 'Free'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Revenue Tips */}
      <Card>
        <CardHeader
          title="Monetization Tips"
          description="How to maximize your marketplace earnings"
        />
        <div className="space-y-3 p-6">
          <Tip
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            title="Set competitive pricing"
            description="Research similar agents and price competitively. Free agents build reputation, paid agents generate revenue."
          />
          <Tip
            icon={<Star className="h-4 w-4 text-primary" />}
            title="Earn 5-star ratings"
            description="High-quality agents with good reviews rank higher and get more installs."
          />
          <Tip
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            title="Track your analytics"
            description="Monitor install trends and adjust your strategy based on what works."
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info';
}) {
  const colorStyles: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  };

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      <div className="flex items-center justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorStyles[color])}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

// ─── Tip ────────────────────────────────────────────────────────────

function Tip({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-foreground">{title}</h4>
        <p className="text-sm text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}
