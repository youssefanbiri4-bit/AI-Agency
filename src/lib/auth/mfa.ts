import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  resolveMfaAssuranceState,
  type AuthenticatorAssuranceLevel,
  type MfaAssuranceState,
} from '@/lib/auth/mfa-shared';

export type { AuthenticatorAssuranceLevel, MfaAssuranceState };
export { resolveMfaAssuranceState };

export interface MfaTotpFactorSummary {
  id: string;
  friendlyName: string | null;
  status: string;
  createdAt: string | null;
}

export interface MfaStatusSnapshot {
  enabled: boolean;
  factors: MfaTotpFactorSummary[];
  assurance: MfaAssuranceState;
}

export async function getMfaAssuranceState(
  supabase: SupabaseClient<Database>
): Promise<MfaAssuranceState> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    return {
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      requiresVerification: false,
    };
  }

  return resolveMfaAssuranceState({
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  });
}

export async function listVerifiedTotpFactors(
  supabase: SupabaseClient<Database>
): Promise<MfaTotpFactorSummary[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error || !data?.totp) {
    return [];
  }

  return data.totp
    .filter((factor) => factor.status === 'verified')
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
      status: factor.status,
      createdAt: factor.created_at ?? null,
    }));
}

export async function getPrimaryVerifiedTotpFactor(
  supabase: SupabaseClient<Database>
): Promise<MfaTotpFactorSummary | null> {
  const factors = await listVerifiedTotpFactors(supabase);
  return factors[0] ?? null;
}

export async function getMfaStatusSnapshot(
  supabase: SupabaseClient<Database>
): Promise<MfaStatusSnapshot> {
  const [assurance, factors] = await Promise.all([
    getMfaAssuranceState(supabase),
    listVerifiedTotpFactors(supabase),
  ]);

  return {
    enabled: factors.length > 0,
    factors,
    assurance,
  };
}