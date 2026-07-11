import { describe, it, expect } from 'vitest';
import { buildPageAccessContext, evaluatePageAccess, extractDashboardArea, resolveEffectiveDepartment } from '@/lib/auth/require-page-access';

describe('RBAC Page Access - smoke tests', () => {
  describe('extractDashboardArea', () => {
    it('extracts root dashboard area', () => {
      expect(extractDashboardArea('/dashboard')).toBe('dashboard');
    });

    it('extracts first segment after /dashboard/', () => {
      expect(extractDashboardArea('/dashboard/tasks')).toBe('tasks');
      expect(extractDashboardArea('/dashboard/reels/new')).toBe('reels');
      expect(extractDashboardArea('/dashboard/settings/roles')).toBe('settings');
      expect(extractDashboardArea('/dashboard/ai-studio')).toBe('ai-studio');
      expect(extractDashboardArea('/dashboard/content-studio')).toBe('content-studio');
    });

    it('returns null for non-dashboard routes', () => {
      expect(extractDashboardArea('/login')).toBeNull();
      expect(extractDashboardArea('/api/tasks')).toBeNull();
    });
  });

  describe('buildPageAccessContext', () => {
    it('normalizes unknown role to viewer (fail-closed default)', () => {
      const ctx = buildPageAccessContext({ role: 'unknown' });
      expect(ctx).not.toBeNull();
      expect(ctx!.role).toBe('viewer');
      expect(ctx!.effectiveDepartment).toBeNull();
    });

    it('builds context for owner role', () => {
      const ctx = buildPageAccessContext({ role: 'owner', assignedDepartment: 'social' });
      expect(ctx).not.toBeNull();
      expect(ctx!.role).toBe('owner');
      expect(ctx!.effectiveDepartment).toBe('social');
    });

    it('builds context for viewer role', () => {
      const ctx = buildPageAccessContext({ role: 'viewer', assignedDepartment: 'content' });
      expect(ctx).not.toBeNull();
      expect(ctx!.role).toBe('viewer');
      expect(ctx!.effectiveDepartment).toBe('content');
    });

    it('nulls out invalid department values', () => {
      const ctx = buildPageAccessContext({ role: 'editor', assignedDepartment: 'invalid-dept' });
      expect(ctx).not.toBeNull();
      expect(ctx!.effectiveDepartment).toBeNull();
    });
  });

  describe('evaluatePageAccess', () => {
    it('allows owner to access any page', () => {
      const ctx = buildPageAccessContext({ role: 'owner' })!;
      expect(evaluatePageAccess('/dashboard/tasks', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/settings', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/reels', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/security', ctx).allowed).toBe(true);
    });

    it('allows admin to access admin-only pages', () => {
      const ctx = buildPageAccessContext({ role: 'admin' })!;
      expect(evaluatePageAccess('/dashboard/settings', ctx).allowed).toBe(true);
    });

    it('allows viewer to access global areas', () => {
      const ctx = buildPageAccessContext({ role: 'viewer', assignedDepartment: 'social' })!;
      expect(evaluatePageAccess('/dashboard', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/alex', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/settings', ctx).allowed).toBe(true);
    });

    it('restricts viewer from department-specific areas outside their dept', () => {
      const socialViewer = buildPageAccessContext({ role: 'viewer', assignedDepartment: 'social' })!;
      // social dept features: ['reels', 'campaigns', 'content-studio']
      expect(evaluatePageAccess('/dashboard/reels', socialViewer).allowed).toBe(true);
      // creative dept features: ['creative-assets', 'reels', 'ai-studio']
      expect(evaluatePageAccess('/dashboard/creative-assets', socialViewer).allowed).toBe(false);
    });

    it('allows operator without department to reach operational areas', () => {
      const ctx = buildPageAccessContext({ role: 'operator', assignedDepartment: null })!;
      expect(evaluatePageAccess('/dashboard/tasks', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/reels', ctx).allowed).toBe(true);
    });

    it('allows editor in content dept to access content-library', () => {
      // content dept features: ['prompt-library', 'content-library', 'knowledge-base']
      const ctx = buildPageAccessContext({ role: 'editor', assignedDepartment: 'content' })!;
      expect(evaluatePageAccess('/dashboard/content-library', ctx).allowed).toBe(true);
      expect(evaluatePageAccess('/dashboard/prompt-library', ctx).allowed).toBe(true);
    });

    it('editor cannot access tasks (operations dept)', () => {
      const ctx = buildPageAccessContext({ role: 'editor', assignedDepartment: 'content' })!;
      // tasks is in 'operations' dept features, not 'content'
      expect(evaluatePageAccess('/dashboard/tasks', ctx).allowed).toBe(false);
    });
  });

  describe('resolveEffectiveDepartment', () => {
    it('allows admin to use department cookie override', () => {
      const dept = resolveEffectiveDepartment({
        assignedDepartment: 'social',
        role: 'admin',
        cookieDepartment: 'creative',
      });
      expect(dept).toBe('creative');
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

    it('ignores cookie override for non-admins', () => {
      const dept = resolveEffectiveDepartment({
        assignedDepartment: 'social',
        role: 'editor',
        cookieDepartment: 'creative',
      });
      expect(dept).toBe('social');
    });

    it('allows owner to use department cookie override', () => {
      const dept = resolveEffectiveDepartment({
        assignedDepartment: 'social',
        role: 'owner',
        cookieDepartment: 'creative',
      });
      expect(dept).toBe('creative');
    });

    it('returns assigned department when no cookie set', () => {
      const dept = resolveEffectiveDepartment({
        assignedDepartment: 'content',
        role: 'editor',
      });
      expect(dept).toBe('content');
    });
  });
});
