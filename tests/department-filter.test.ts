import { describe, expect, it } from 'vitest';
import {
  buildDepartmentListScope,
  contentStudioItemRbacDepartment,
  creativeAssetRbacDepartment,
  filterRowsByDepartmentScope,
  scopeIncludesDepartment,
  userCanAccessRbacDepartment,
} from '@/lib/data/department-filter';

describe('department-filter', () => {
  it('mirrors user_can_access_rbac_department for owner/admin bypass', () => {
    expect(userCanAccessRbacDepartment('owner', null, 'creative')).toBe(true);
    expect(userCanAccessRbacDepartment('admin', 'social', 'paid_ads')).toBe(true);
  });

  it('mirrors operator cross-dept access without assigned department', () => {
    expect(userCanAccessRbacDepartment('operator', null, 'operations')).toBe(true);
  });

  it('restricts viewers to their assigned department', () => {
    expect(userCanAccessRbacDepartment('viewer', 'social', 'social')).toBe(true);
    expect(userCanAccessRbacDepartment('viewer', 'social', 'creative')).toBe(false);
  });

  it('scopes admin view-as department lists', () => {
    expect(
      buildDepartmentListScope({
        role: 'admin',
        assignedDepartment: 'social',
        effectiveDepartment: 'creative',
      })
    ).toEqual(['creative']);
  });

  it('does not scope admin lists without view-as override', () => {
    expect(
      buildDepartmentListScope({
        role: 'admin',
        assignedDepartment: 'social',
      })
    ).toBeNull();
  });

  it('scopes members to their department', () => {
    expect(
      buildDepartmentListScope({
        role: 'editor',
        assignedDepartment: 'content',
      })
    ).toEqual(['content']);
  });

  it('maps creative assets to RBAC departments', () => {
    expect(creativeAssetRbacDepartment('reel_video', 'instagram')).toBe('social');
    expect(creativeAssetRbacDepartment('ad_creative', 'meta')).toBe('paid_ads');
    expect(creativeAssetRbacDepartment('image', 'instagram')).toBe('creative');
  });

  it('maps content studio items to RBAC departments', () => {
    expect(contentStudioItemRbacDepartment('instagram', 'instagram_reel')).toBe('social');
    expect(contentStudioItemRbacDepartment('google_ads', 'google_ads_campaign_draft')).toBe('paid_ads');
    expect(contentStudioItemRbacDepartment('linkedin', 'linkedin_post')).toBe('content');
  });

  it('filters rows by department scope', () => {
    const rows = [
      { id: '1', asset_type: 'reel_video', platform: 'instagram' },
      { id: '2', asset_type: 'image', platform: 'instagram' },
    ];

    const scoped = filterRowsByDepartmentScope(rows, ['creative'], (row) =>
      creativeAssetRbacDepartment(row.asset_type, row.platform)
    );

    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.id).toBe('2');
    expect(scopeIncludesDepartment(['social'], 'social')).toBe(true);
    expect(scopeIncludesDepartment(['social'], 'creative')).toBe(false);
  });
});