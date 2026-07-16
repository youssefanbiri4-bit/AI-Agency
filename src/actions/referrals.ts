'use server';

import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import {
  getReferralStats,
  getReferralLeaderboard,
  createReferral,
  REWARD_POINTS_PER_REFERRAL,
  REWARD_TIERS,
} from '@/lib/marketing/referral-service';

export async function loadReferralStatsAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    const workspaceId = workspaceResult.data?.id;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!workspaceId || !user) {
      return { data: null, error: 'Workspace required' };
    }

    const [stats, leaderboard] = await Promise.all([
      getReferralStats(workspaceId, user.id),
      getReferralLeaderboard(workspaceId),
    ]);

    return {
      data: { stats, leaderboard, rewardPerReferral: REWARD_POINTS_PER_REFERRAL, tiers: REWARD_TIERS },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load referral stats',
    };
  }
}

export async function createReferralLinkAction(invitedEmail?: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
    const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);
    const workspaceId = workspaceResult.data?.id;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!workspaceId || !user) {
      return { data: null, error: 'Workspace required' };
    }

    const result = await createReferral(user.id, workspaceId, invitedEmail);
    if (!result) return { data: null, error: 'Could not create referral link' };
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to create referral link' };
  }
}

