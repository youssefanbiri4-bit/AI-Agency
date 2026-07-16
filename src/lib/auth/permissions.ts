import type { ApiKeyScope } from '@/types/database';
import type { RBACRole } from '@/types/auth';
import { normalizeRole } from '@/lib/auth/rbac-client';

/**
 * Public REST API scopes. A key is granted a subset of these; resource routes
 * require one or more scopes via `withApiAuth`.
 */

export const API_SCOPES: ApiKeyScope[] = [
  'agents:read',
  'agents:write',
  'prompts:read',
  'prompts:write',
  'team:read',
  'usage:read',
  'api:keys:manage',
];

export const API_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'agents:read': 'Read agents',
  'agents:write': 'Create & manage agents',
  'prompts:read': 'Read prompt library',
  'prompts:write': 'Create & manage prompts',
  'team:read': 'Read team members',
  'usage:read': 'Read usage & limits',
  'api:keys:manage': 'Manage API keys',
};

/**
 * RBAC -> API scope bridge. Improves team permissions by mapping a workspace
 * role to the set of API scopes it may grant to generated keys. Admins/owners
 * get full scope; lower roles get a progressively read-only subset.
 */
export function scopesForRole(role: RBACRole | string | null | undefined): ApiKeyScope[] {
  switch (normalizeRole(role)) {
    case 'owner':
    case 'admin':
      return [...API_SCOPES];
    case 'editor':
      return ['agents:read', 'agents:write', 'prompts:read', 'prompts:write', 'team:read', 'usage:read'];
    case 'operator':
      return ['agents:read', 'prompts:read', 'team:read', 'usage:read'];
    case 'viewer':
    default:
      return ['agents:read', 'prompts:read', 'usage:read'];
  }
}

export function isApiScope(value: string): value is ApiKeyScope {
  return (API_SCOPES as string[]).includes(value);
}

export function hasApiScope(granted: string[] | null | undefined, required: string): boolean {
  if (!granted) return false;
  if (granted.includes(required)) return true;
  // Write scopes imply the matching read scope.
  const [resource, action] = required.split(':');
  if (action === 'read' && granted.includes(`${resource}:write`)) return true;
  return false;
}

/** Returns the required scopes not satisfied by `granted`. Empty = allowed. */
export function requireApiScopes(granted: string[] | null | undefined, required: string[]): string[] {
  return required.filter((scope) => !hasApiScope(granted, scope));
}
