import { describe, it, expect } from 'vitest';
import { resolveEffectiveDepartment } from '@/lib/auth/require-page-access';
import { viewAsDepartmentKey } from '@/lib/preferences/user-preferences';

describe('user preferences — view-as department', () => {
  it('builds workspace-scoped preference keys', () => {
    expect(viewAsDepartmentKey('ws-123')).toBe('view_as_department:ws-123');
  });

  it('prefers saved preference over cookie for admins', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social',
      role: 'admin',
      cookieDepartment: 'creative',
      preferenceDepartment: 'content',
    });
    expect(dept).toBe('content');
  });

  it('ignores stale cookie when admin has no saved preference', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social',
      role: 'admin',
      cookieDepartment: 'creative',
      preferenceDepartment: null,
    });
    expect(dept).toBe('social');
  });

  it('falls back to cookie when preference was not loaded', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social',
      role: 'admin',
      cookieDepartment: 'creative',
    });
    expect(dept).toBe('creative');
  });

  it('ignores preference override for non-admins', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'social',
      role: 'editor',
      cookieDepartment: 'creative',
      preferenceDepartment: 'content',
    });
    expect(dept).toBe('social');
  });

  it('returns assigned department when admin has no override', () => {
    const dept = resolveEffectiveDepartment({
      assignedDepartment: 'operations',
      role: 'owner',
    });
    expect(dept).toBe('operations');
  });
});