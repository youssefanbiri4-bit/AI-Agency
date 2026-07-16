/**
 * Referral & Rewards Service (W16-T2)
 *
 * Full referral lifecycle + points-based rewards:
 *  - createReferral(): persist an invitation row for a workspace member
 *  - getReferralStats(): live counts + shareable link for the current user
 *  - resolveReferralCode(): look up the referrer from a code
 *  - completeReferral(): mark a referral completed on signup + grant reward
 *  - getReferralLeaderboard(): top referrers by completed invites
 *  - reward ledger helpers (getRewardBalance, grantReward)
 *
 * All DB access goes through the admin (service-role) client.
 */

import { logger } from '@/lib/logger';
import { getSupabaseAdmin, createSupabaseServerClient } from '@/lib/supabase-server';
import crypto from 'crypto';

const referralLog = logger.child('referral');

// Reward configuration
export const REWARD_POINTS_PER_REFERRAL = 100;
export const REWARD_TIERS: Array<{ name: string; minPoints: number }> = [
  { name: 'Advocate', minPoints: 0 },
  { name: 'Connector', minPoints: 300 },
  { name: 'Champion', minPoints: 600 },
  { name: 'VIP Partner', minPoints: 1000 },
];

export interface ReferralCode {
  code: string;
  userId: string;
  workspaceId: string;
  usesCount: number;
  maxUses: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface ReferralStats {
  totalInvites: number;
  completedInvites: number;
  pendingInvites: number;
  referralLink: string;
  referralCode: string | null;
  rewardPoints: number;
  rewardTier: string;
}

export interface ReferralLeaderboardEntry {
  userId: string;
  fullName: string | null;
  email: string | null;
  completed: number;
  points: number;
}

/**
 * Generate a unique, verifiable referral code for a user+workspace.
 */
export function generateReferralCode(userId: string, workspaceId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}:${workspaceId}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`)
    .digest('hex')
    .slice(0, 10);
  return `AF-${hash.toUpperCase()}`;
}

export function createReferralLink(code: string, baseUrl: string): string {
  return `${baseUrl}/auth/signup?ref=${encodeURIComponent(code)}`;
}

export function getReferralBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://agentflow-ai.vercel.app'
  );
}

export function parseReferralCode(searchParams: URLSearchParams): string | null {
  return searchParams.get('ref') || null;
}

export function isValidReferralCode(code: string): boolean {
  return /^AF-[A-Z0-9]{10}$/.test(code);
}

/**
 * Create a persisted referral invitation for the current user.
 */
export async function createReferral(
  userId: string,
  workspaceId: string,
  invitedEmail?: string,
  ttlDays = 365
): Promise<{ code: string; link: string } | null> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return null;

  const code = generateReferralCode(userId, workspaceId);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('referrals').insert({
    code,
    referrer_user_id: userId,
    referrer_workspace_id: workspaceId,
    referred_email: invitedEmail ?? null,
    status: 'pending',
    expires_at: expiresAt,
  });

  if (error) {
    referralLog.error('Failed to create referral', { error: error.message });
    return null;
  }

  return { code, link: createReferralLink(code, getReferralBaseUrl()) };
}

/**
 * Live referral stats for the current user in the active workspace.
 */
export async function getReferralStats(
  workspaceId: string,
  userId?: string
): Promise<ReferralStats> {
  const { client: supabase } = getSupabaseAdmin();
  const effectiveUserId = userId ?? (await getCurrentUserId());

  const base: ReferralStats = {
    totalInvites: 0,
    completedInvites: 0,
    pendingInvites: 0,
    referralLink: '',
    referralCode: null,
    rewardPoints: 0,
    rewardTier: REWARD_TIERS[0].name,
  };

  if (!supabase || !effectiveUserId) return base;

  const { data: rows } = await supabase
    .from('referrals')
    .select('code, status')
    .eq('referrer_user_id', effectiveUserId)
    .eq('referrer_workspace_id', workspaceId);

  const completed = (rows ?? []).filter((r) => r.status === 'completed').length;
  const pending = (rows ?? []).filter((r) => r.status === 'pending').length;
  const code = rows?.[0]?.code ?? null;

  const { data: rewardRows } = await supabase
    .from('referral_rewards')
    .select('points')
    .eq('user_id', effectiveUserId)
    .eq('workspace_id', workspaceId);
  const points = (rewardRows ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0);

  const tier = REWARD_TIERS.slice()
    .reverse()
    .find((t) => points >= t.minPoints)?.name ?? REWARD_TIERS[0].name;

  return {
    totalInvites: (rows ?? []).length,
    completedInvites: completed,
    pendingInvites: pending,
    referralLink: code ? createReferralLink(code, getReferralBaseUrl()) : '',
    referralCode: code,
    rewardPoints: points,
    rewardTier: tier,
  };
}

/**
 * Find the referrer (user + workspace) for a given code.
 */
export async function resolveReferralCode(
  code: string
): Promise<{ userId: string; workspaceId: string } | null> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from('referrals')
    .select('referrer_user_id, referrer_workspace_id, status')
    .eq('code', code)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data || data.status === 'completed' || data.status === 'expired') return null;
  return { userId: data.referrer_user_id, workspaceId: data.referrer_workspace_id };
}

/**
 * Complete a referral on signup and grant the referrer a reward.
 */
export async function completeReferral(
  code: string,
  referredUserId: string,
  referredEmail?: string
): Promise<boolean> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return false;

  const referrer = await resolveReferralCode(code);
  if (!referrer) return false;

  const { data: refRow, error: fetchErr } = await supabase
    .from('referrals')
    .select('id, reward_granted')
    .eq('code', code)
    .eq('referrer_user_id', referrer.userId)
    .eq('referrer_workspace_id', referrer.workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !refRow) return false;

  const { error: updErr } = await supabase
    .from('referrals')
    .update({
      status: 'completed',
      referred_user_id: referredUserId,
      referred_email: referredEmail ?? null,
      completed_at: new Date().toISOString(),
      reward_granted: true,
    })
    .eq('id', refRow.id);

  if (updErr) {
    referralLog.error('Failed to complete referral', { error: updErr.message });
    return false;
  }

  await grantReward(
    referrer.userId,
    referrer.workspaceId,
    REWARD_POINTS_PER_REFERRAL,
    `Referral completed (${referredEmail ?? referredUserId})`,
    refRow.id
  );

  return true;
}

/**
 * Append a reward entry to the ledger and return the new balance.
 */
export async function grantReward(
  userId: string,
  workspaceId: string,
  points: number,
  reason: string,
  referralId?: string
): Promise<number> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return 0;

  const { error } = await supabase.from('referral_rewards').insert({
    user_id: userId,
    workspace_id: workspaceId,
    points,
    reason,
    referral_id: referralId ?? null,
  });

  if (error) {
    referralLog.error('Failed to grant reward', { error: error.message });
    return 0;
  }

  const { data: rows } = await supabase
    .from('referral_rewards')
    .select('points')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  return (rows ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0);
}

export async function getRewardBalance(userId: string, workspaceId: string): Promise<number> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return 0;
  const { data } = await supabase
    .from('referral_rewards')
    .select('points')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);
  return (data ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0);
}

/**
 * Workspace-wide leaderboard of top referrers.
 */
export async function getReferralLeaderboard(
  workspaceId: string,
  limit = 10
): Promise<ReferralLeaderboardEntry[]> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return [];

  const { data: completed } = await supabase
    .from('referrals')
    .select('referrer_user_id')
    .eq('referrer_workspace_id', workspaceId)
    .eq('status', 'completed');

  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('user_id, points')
    .eq('workspace_id', workspaceId);

  const completedByUser = new Map<string, number>();
  for (const r of completed ?? []) {
    completedByUser.set(r.referrer_user_id, (completedByUser.get(r.referrer_user_id) ?? 0) + 1);
  }
  const pointsByUser = new Map<string, number>();
  for (const r of rewards ?? []) {
    pointsByUser.set(r.user_id, (pointsByUser.get(r.user_id) ?? 0) + (r.points ?? 0));
  }

  const userIds = Array.from(new Set([...completedByUser.keys(), ...pointsByUser.keys()]));
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return userIds
    .map((uid) => ({
      userId: uid,
      fullName: profileMap.get(uid)?.full_name ?? null,
      email: profileMap.get(uid)?.email ?? null,
      completed: completedByUser.get(uid) ?? 0,
      points: pointsByUser.get(uid) ?? 0,
    }))
    .sort((a, b) => b.completed - a.completed || b.points - a.points)
    .slice(0, limit);
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
