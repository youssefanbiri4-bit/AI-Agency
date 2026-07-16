'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Gift, Share2, UserPlus, CheckCircle2, Clock, Trophy, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/toast';
import { loadReferralStatsAction, createReferralLinkAction } from '@/actions/referrals';

interface ReferralStats {
  totalInvites: number;
  completedInvites: number;
  pendingInvites: number;
  referralLink: string;
  referralCode: string | null;
  rewardPoints: number;
  rewardTier: string;
}

interface LeaderboardEntry {
  userId: string;
  fullName: string | null;
  email: string | null;
  completed: number;
  points: number;
}

interface ReferralData {
  stats: ReferralStats;
  leaderboard: LeaderboardEntry[];
  rewardPerReferral: number;
  tiers: Array<{ name: string; minPoints: number }>;
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadReferralStatsAction()
      .then((result) => {
        if (mounted && result.data) setData(result.data);
        if (mounted && result.error) setError(result.error);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load referral data');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCopyLink = async () => {
    if (!data?.stats.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.stats.referralLink);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleGenerate = async () => {
    setIsCreating(true);
    const res = await createReferralLinkAction();
    setIsCreating(false);
    if (res.data) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                referralCode: res.data!.code,
                referralLink: res.data!.link,
              },
            }
          : prev
      );
      toast.success('New referral link generated!');
    } else {
      toast.error(res.error ?? 'Could not generate link');
    }
  };

  const shareText = (network: 'twitter' | 'linkedin' | 'email') => {
    const link = data?.stats.referralLink ?? '';
    const msg = 'Join me on AgentFlow AI — the AI agency operations workspace:';
    if (network === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${msg} ${link}`)}`, '_blank');
    } else if (network === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
    } else {
      window.open(`mailto:?subject=Join my AgentFlow AI workspace&body=${encodeURIComponent(`${msg} ${link}`)}`, '_blank');
    }
  };

  if (isLoading) {
    return <LoadingState title="Loading Referrals" description="Fetching referral statistics..." />;
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Referrals" title="Referral Program" description="Invite your team to AgentFlow AI." />
        <Notice tone="danger" title="Could not load referral data">{error}</Notice>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Referrals"
        title="Referral Program"
        description="Invite collaborators to your workspace and earn reward points for every completed signup."
        actions={
          <Button variant="outline" size="sm" onClick={handleCopyLink} disabled={!stats?.referralCode}>
            {copied ? <><CheckCircle2 className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Link</>}
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D5E5E5]/40 text-[#F7CBCA]"><UserPlus className="h-6 w-6" /></div>
            <div>
              <p className="text-2xl font-black text-black">{stats?.totalInvites || 0}</p>
              <p className="text-sm text-black/54">Total Invites</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-500"><CheckCircle2 className="h-6 w-6" /></div>
            <div>
              <p className="text-2xl font-black text-black">{stats?.completedInvites || 0}</p>
              <p className="text-sm text-black/54">Completed</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-500"><Clock className="h-6 w-6" /></div>
            <div>
              <p className="text-2xl font-black text-black">{stats?.pendingInvites || 0}</p>
              <p className="text-sm text-black/54">Pending</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D5E5E5]/40 text-[#F7CBCA]"><Gift className="h-6 w-6" /></div>
            <div>
              <p className="text-2xl font-black text-black">{stats?.rewardPoints || 0}</p>
              <p className="text-sm text-black/54">Reward Points · {stats?.rewardTier}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card>
        <CardHeader
          title="Your Referral Link"
          description={`Earn ${data?.rewardPerReferral ?? 100} points for every referral that signs up.`}
          action={<StatusBadge status={stats?.referralCode ? 'Ready' : 'Not Connected'} type="system" size="sm" />}
        />
        <div className="space-y-4">
          {stats?.referralCode ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-black/8 bg-[#F1F7F7]/50 p-4">
                <code className="flex-1 break-all text-sm font-mono text-black/80">{stats.referralLink}</code>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(stats.referralLink, '_blank')}>
                    <ExternalLink className="h-4 w-4" /> Open
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="soft" size="sm" onClick={() => shareText('twitter')}><Share2 className="h-4 w-4" /> Share on Twitter</Button>
                <Button variant="soft" size="sm" onClick={() => shareText('linkedin')}><Share2 className="h-4 w-4" /> Share on LinkedIn</Button>
                <Button variant="soft" size="sm" onClick={() => shareText('email')}><Gift className="h-4 w-4" /> Share via Email</Button>
              </div>
            </>
          ) : (
            <Button onClick={handleGenerate} disabled={isCreating}>
              <Sparkles className="h-4 w-4" /> {isCreating ? 'Generating…' : 'Generate referral link'}
            </Button>
          )}
        </div>
      </Card>

      {/* Rewards tiers */}
      <Card>
        <CardHeader title="Reward Tiers" description="Points unlock status tiers as you refer more collaborators." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 pt-0">
          {(data?.tiers ?? []).map((tier) => {
            const reached = (stats?.rewardPoints ?? 0) >= tier.minPoints;
            return (
              <div key={tier.name} className={`rounded-lg border p-4 ${reached ? 'border-[#F7CBCA]/40 bg-[#D5E5E5]/20' : 'border-black/8'}`}>
                <p className="text-sm font-bold text-black">{tier.name}</p>
                <p className="text-xs text-black/54">{tier.minPoints}+ pts</p>
                {reached && <StatusBadge status="Active" type="system" size="sm" className="mt-2" />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader title="Workspace Leaderboard" description="Top referrers in your workspace." />
        {data?.leaderboard && data.leaderboard.length > 0 ? (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-divider text-xs font-black uppercase tracking-[0.13em] text-foreground-muted">
                  <th className="pb-2 pr-3">Member</th>
                  <th className="pb-2 pr-3 text-right">Completed</th>
                  <th className="pb-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((entry, i) => (
                  <tr key={entry.userId} className="border-b border-divider last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                        <span className="font-bold text-foreground">{entry.fullName ?? entry.email ?? 'Unknown'}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{entry.completed}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{entry.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-4"><Notice tone="info" title="No referrals yet">Be the first to invite a collaborator and earn points.</Notice></div>
        )}
      </Card>

      <Notice tone="info" title="Rewards program">
        Referral rewards are points-based and grant status tiers. They are non-monetary and intended for internal platform recognition.
      </Notice>
    </div>
  );
}
