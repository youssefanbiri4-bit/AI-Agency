import { describe, expect, it } from 'vitest';
import { buildMfaRedirectUrl, resolveMfaAssuranceState } from '@/lib/auth/mfa-shared';

describe('mfa-shared', () => {
  it('requires verification when next level is aal2 but current is not', () => {
    const state = resolveMfaAssuranceState({
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });

    expect(state.requiresVerification).toBe(true);
  });

  it('does not require verification when MFA is not enrolled', () => {
    const state = resolveMfaAssuranceState({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });

    expect(state.requiresVerification).toBe(false);
  });

  it('does not require verification once session is aal2', () => {
    const state = resolveMfaAssuranceState({
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });

    expect(state.requiresVerification).toBe(false);
  });

  it('builds MFA redirect URLs with redirectTo', () => {
    const url = buildMfaRedirectUrl('https://agentflow.example/auth/login', '/dashboard/tasks');

    expect(url.pathname).toBe('/auth/mfa');
    expect(url.searchParams.get('redirectTo')).toBe('/dashboard/tasks');
  });
});