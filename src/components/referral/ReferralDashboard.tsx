'use client';

import { useState, useCallback } from 'react';
import {
  Gift,
  Users,
  Trophy,
  Copy,
  Check,
  Star,
  Zap,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ShareWidget } from '@/components/marketing/ShareWidget';
import { cn } from '@/lib/utils';

interface ReferralStats {
  totalInvites: number;
  completedInvites: number;
  pendingInvites: number;
  referralLink: string;
  referralCode: string | null;
  rewardPoints: number;
  rewardTier: string;
}

interface ReferralDashboardProps {
  stats: ReferralStats;
  className?: string;
}

const TIER_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  minPoints: number;
}> = {
  Advocate: { icon: Star, color: '#6B7280', minPoints: 0 },
  Connector: { icon: Zap, color: '#3B82F6', minPoints: 300 },
  Champion: { icon: Trophy, color: '#F59E0B', minPoints: 600 },
  'VIP Partner': { icon: Crown, color: '#8B5CF6', minPoints: 1000 },
};

export function ReferralDashboard({
  stats,
  className,
}: ReferralDashboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    if (stats.referralLink) {
      try {
        await navigator.clipboard.writeText(stats.referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
      }
    }
  }, [stats.referralLink]);

  const tierConfig = TIER_CONFIG[stats.rewardTier] || TIER_CONFIG.Advocate;
  const TierIcon = tierConfig.icon;

  return (
    <Card className={className}>
      <CardHeader
        title="Referral Program"
        description="Invite friends and earn rewards for each successful referral."
        action={
          <Badge tone="primary">
            <TierIcon className="h-3 w-3" />
            {stats.rewardTier}
          </Badge>
        }
      />

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{stats.totalInvites}</p>
              <p className="text-sm text-foreground-muted">Total Invites</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Check className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{stats.completedInvites}</p>
              <p className="text-sm text-foreground-muted">Completed</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Gift className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{stats.rewardPoints}</p>
              <p className="text-sm text-foreground-muted">Reward Points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral link */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-bold text-foreground">Your Referral Link</p>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-sm text-foreground-muted">
            {stats.referralLink || 'No referral link yet'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={!stats.referralLink}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Share widget */}
      {stats.referralLink && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-foreground">Share via</p>
          <ShareWidget
            url={stats.referralLink}
            title="Join AgentFlow AI"
            text="I've been using AgentFlow AI to manage my AI agency operations. Check it out!"
            variant="buttons"
          />
        </div>
      )}

      {/* Tier progress */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-bold text-foreground">Reward Tier Progress</p>
        <div className="flex items-center gap-4">
          {Object.entries(TIER_CONFIG).map(([tier, config]) => {
            const isActive = stats.rewardTier === tier;
            const isAchieved = stats.rewardPoints >= config.minPoints;
            const TierIconComp = config.icon;

            return (
              <div key={tier} className="flex items-center gap-2">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isAchieved
                      ? 'bg-success/10 text-success'
                      : 'bg-surface-elevated text-foreground-muted'
                )}>
                  <TierIconComp className="h-4 w-4" />
                </div>
                <div className="hidden sm:block">
                  <p className={cn(
                    'text-xs font-bold',
                    isActive ? 'text-foreground' : 'text-foreground-muted'
                  )}>
                    {tier}
                  </p>
                  <p className="text-xs text-foreground-muted">{config.minPoints} pts</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
