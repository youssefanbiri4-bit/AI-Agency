import { describe, expect, it } from 'vitest';
import {
  buildPageAccessContext,
  evaluatePageAccess,
  extractDashboardArea,
  resolveEffectiveDepartment,
} from '@/lib/auth/require-page-access';
import type { Department } from '@/types/auth';

describe('require-page-access', () => {
  it('extracts dashboard area segments', () => {
    expect(extractDashboardArea('/dashboard')).toBe('dashboard');
    expect(extractDashboardArea('/dashboard/reels/new')).toBe('reels');
    expect(extractDashboardArea('/dashboard/settings/roles')).toBe('settings');
  });

  it('allows global areas for viewers', () => {
    const ctx = buildPageAccessContext({ role: 'viewer', assignedDepartment: 'social' });
    expect(ctx).not.toBeNull();
    expect(evaluatePageAccess('/dashboard/settings', ctx!).allowed).toBe(true);
    expect(evaluatePageAccess('/dashboard/alex', ctx!).allowed).toBe(true);
  });

  it('restricts department areas for viewers', () => {
    const socialViewer = buildPageAccessContext({
      role: 'viewer',
      assignedDepartment: 'social',
    })!;

    expect(evaluatePageAccess('/dashboard/reels', socialViewer).allowed).toBe(true);
    expect(evaluatePageAccess('/dashboard/creative-assets', socialViewer).allowed).toBe(false);
  });

  it('allows admins to use department cookie override', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social',
      role: 'admin',
      cookieDepartment: 'creative',
    });

    expect(dept).toBe('creative');
  });

  it('ignores department cookie override for non-admins', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social' as Department,
      role: 'editor',
      cookieDepartment: 'creative',
    });

    expect(dept).toBe('social');
  });

  it('allows operators without department to reach operational areas', () => {
    const ctx = buildPageAccessContext({ role: 'operator', assignedDepartment: null })!;
    expect(evaluatePageAccess('/dashboard/tasks', ctx).allowed).toBe(true);
  });
});