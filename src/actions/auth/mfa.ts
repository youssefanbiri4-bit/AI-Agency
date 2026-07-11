'use server';

import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import {
  getMfaAssuranceState,
  getMfaStatusSnapshot,
  getPrimaryVerifiedTotpFactor,
} from '@/lib/auth/mfa';
import { getClientIpFromHeaders } from '@/lib/rate-limit';
import {
  buildAuthRateLimitMessage,
  checkAuthBruteForce,
  recordAuthAttempt,
  recordAuthFailure,
} from '@/lib/auth/auth-brute-force';
import { invalidateOtherSessions } from '@/lib/auth/session-management';
import { writeSessionActivityCookie } from '@/lib/auth/session-cookie-writer';
import { logger } from '@/lib/logger';

const authMfaLog = logger.child('auth:mfa');

export interface MfaStatusActionResult {
  success: boolean;
  status: number;
  error?: string;
  enabled?: boolean;
  enrolled?: boolean;
  factorId?: string;
  friendlyName?: string | null;
  factorCreatedAt?: string | null;
  requiresVerification?: boolean;
  currentLevel?: string | null;
  nextLevel?: string | null;
}

export interface MfaEnrollActionResult {
  factorId?: string;
  qrCodeUri?: string;
  secret?: string;
  error?: string;
}

export interface MfaVerifyEnrollmentActionResult {
  verified: boolean;
  error?: string;
}

export interface MfaVerifyActionResult {
  success: boolean;
  status: number;
  error?: string;
  retryAfterSeconds?: number;
}

export interface MfaUnenrollActionResult {
  success: boolean;
  status: number;
  error?: string;
}

export async function getMfaStatusAction(): Promise<MfaStatusActionResult> {
  if (!isSupabaseServerConfigured) {
    return {
      success: false,
      status: 503,
      error: 'Supabase is not configured yet.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: 401, error: 'Not authenticated.' };
  }

  const snapshot = await getMfaStatusSnapshot(supabase);
  const primaryFactor = snapshot.factors[0];

  return {
    success: true,
    status: 200,
    enabled: snapshot.enabled,
    enrolled: snapshot.enabled,
    factorId: primaryFactor?.id,
    friendlyName: primaryFactor?.friendlyName ?? null,
    factorCreatedAt: primaryFactor?.createdAt ?? null,
    requiresVerification: snapshot.assurance.requiresVerification,
    currentLevel: snapshot.assurance.currentLevel,
    nextLevel: snapshot.assurance.nextLevel,
  };
}

export async function enrollMfaAction(): Promise<MfaEnrollActionResult> {
  if (!isSupabaseServerConfigured) {
    return { error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated.' };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator app',
  });

  if (error || !data) {
    authMfaLog.warn('mfa enroll failed', { error: error?.message });
    return { error: error?.message ?? 'Could not start MFA enrollment.' };
  }

  authMfaLog.info('mfa enroll started', { factorId: data.id });
  return {
    factorId: data.id,
    qrCodeUri: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaEnrollmentAction(
  factorId: string,
  code: string
): Promise<MfaVerifyEnrollmentActionResult> {
  const normalizedCode = code.replace(/\s+/g, '').trim();

  if (!factorId?.trim() || !/^\d{6}$/.test(normalizedCode)) {
    return { verified: false, error: 'Enter a valid 6-digit authenticator code.' };
  }

  if (!isSupabaseServerConfigured) {
    return { verified: false, error: 'Supabase is not configured yet.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError || !challenge) {
    return {
      verified: false,
      error: challengeError?.message ?? 'Could not verify authenticator code.',
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: normalizedCode,
  });

  if (verifyError) {
    authMfaLog.warn('mfa enrollment verify failed', { factorId, error: verifyError.message });
    return { verified: false, error: verifyError.message };
  }

  await invalidateOtherSessions(supabase, 'mfa_enabled');
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  writeSessionActivityCookie(await cookies(), clientIp);

  authMfaLog.info('mfa enrollment verified', { factorId });
  return { verified: true };
}

export async function verifyMfaLoginAction(code: string): Promise<MfaVerifyActionResult> {
  const normalizedCode = code.replace(/\s+/g, '').trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return { success: false, status: 400, error: 'Enter a valid 6-digit authenticator code.' };
  }

  if (!isSupabaseServerConfigured) {
    return {
      success: false,
      status: 503,
      error: 'Supabase is not configured yet.',
    };
  }

  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);

  const bruteForceCheck = await checkAuthBruteForce('login', clientIp, 'mfa-verify');
  if (!bruteForceCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: buildAuthRateLimitMessage(bruteForceCheck.reason ?? 'rate_limit', bruteForceCheck.retryAfterSeconds),
      retryAfterSeconds: bruteForceCheck.retryAfterSeconds,
    };
  }

  await recordAuthAttempt('login', clientIp, 'mfa-verify');

  const supabase = await createSupabaseServerClient();
  const assurance = await getMfaAssuranceState(supabase);

  if (!assurance.requiresVerification) {
    authMfaLog.info('mfa verify skipped — session already at required assurance level', { clientIp });
    return { success: true, status: 200 };
  }

  const factor = await getPrimaryVerifiedTotpFactor(supabase);
  if (!factor) {
    return {
      success: false,
      status: 400,
      error: 'No verified authenticator app is enrolled for this account.',
    };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });

  if (challengeError || !challenge) {
    authMfaLog.warn('mfa challenge failed', {
      clientIp,
      error: challengeError?.message,
    });
    return {
      success: false,
      status: 400,
      error: challengeError?.message ?? 'Could not start MFA challenge.',
    };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: normalizedCode,
  });

  if (verifyError) {
    await recordAuthFailure('login', clientIp, 'mfa-verify');
    authMfaLog.warn('mfa verify failed', {
      clientIp,
      factorId: factor.id,
      error: verifyError.message,
    });

    return { success: false, status: 401, error: verifyError.message };
  }

  writeSessionActivityCookie(await cookies(), clientIp);
  authMfaLog.info('mfa verify succeeded', { clientIp, factorId: factor.id });
  return { success: true, status: 200 };
}

export async function unenrollMfaAction(factorId: string): Promise<MfaUnenrollActionResult> {
  if (!factorId?.trim()) {
    return { success: false, status: 400, error: 'Missing MFA factor id.' };
  }

  if (!isSupabaseServerConfigured) {
    return {
      success: false,
      status: 503,
      error: 'Supabase is not configured yet.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, status: 401, error: 'Not authenticated.' };
  }

  const verifiedFactors = await getPrimaryVerifiedTotpFactor(supabase);
  if (!verifiedFactors || verifiedFactors.id !== factorId) {
    return { success: false, status: 404, error: 'MFA factor not found for this account.' };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    authMfaLog.warn('mfa unenroll failed', {
      factorId,
      error: error.message,
    });
    return { success: false, status: 400, error: error.message };
  }

  authMfaLog.info('mfa unenroll succeeded', { factorId });
  return { success: true, status: 200 };
}