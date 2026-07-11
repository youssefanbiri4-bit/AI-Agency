export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2' | (string & {});

export interface MfaAssuranceState {
  currentLevel: AuthenticatorAssuranceLevel | null;
  nextLevel: AuthenticatorAssuranceLevel | null;
  requiresVerification: boolean;
}

export function resolveMfaAssuranceState(input: {
  currentLevel: AuthenticatorAssuranceLevel | null;
  nextLevel: AuthenticatorAssuranceLevel | null;
}): MfaAssuranceState {
  const requiresVerification =
    input.nextLevel === 'aal2' && input.currentLevel !== 'aal2';

  return {
    currentLevel: input.currentLevel,
    nextLevel: input.nextLevel,
    requiresVerification,
  };
}

export function buildMfaRedirectUrl(requestUrl: string, redirectTo: string) {
  const mfaUrl = new URL('/auth/mfa', requestUrl);
  mfaUrl.searchParams.set('redirectTo', redirectTo);
  return mfaUrl;
}