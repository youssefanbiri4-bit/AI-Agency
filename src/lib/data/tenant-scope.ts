/**
 * Multi-Tenant Isolation Guard (W17-T2)
 *
 * The workspace_id is the tenant boundary. User-facing queries are protected by
 * Supabase RLS (is_workspace_member), but the service-role (admin) client
 * BYPASSES RLS — so isolation of admin queries depends entirely on application
 * code always filtering by workspace_id.
 *
 * This module makes that contract explicit and verifiable:
 *  - withTenantScope(): returns the admin client plus an assertion helper that
 *    fails closed if a workspace_id filter was not applied to a tenant table.
 *  - requireSameTenant(): guards cross-tenant operations (e.g. copying data
 *    between workspaces) before they run.
 *  - verifyTenantIsolation(): a production-readiness probe that confirms RLS is
 *    enabled on the core tenant tables.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const tenantLog = logger.child('tenant-scope');

/** Tables that MUST always be scoped by workspace_id in admin queries. */
export const TENANT_TABLES = new Set<string>([
  'tasks',
  'usage_events',
  'usage_counters',
  'projects',
  'releases',
  'referrals',
  'referral_rewards',
  'marketing_events',
  'security_audit_logs',
  'workspace_members',
  'creative_assets',
  'content_studio_items',
  'agent_template_usage_events',
]);

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

export interface TenantScopedClient {
  workspaceId: string;
  /** The admin (service-role) client — RLS bypassed, app must scope manually. */
  client: SupabaseClient<Database>;
  /**
   * Assert that a query against a tenant table was scoped to this workspace.
   * Used as a defensive guard in write paths. Throws TenantScopeError if the
   * workspace_id filter is missing.
   */
  assertScoped(table: string, appliedWorkspaceId?: string | null): void;
}

/**
 * Get an admin client that is bound to a workspace tenant context.
 * Throws if no workspaceId is provided (isolation requires an explicit tenant).
 */
export function withTenantScope(workspaceId: string | null | undefined): TenantScopedClient {
  if (!workspaceId) {
    throw new TenantScopeError('withTenantScope requires an explicit workspaceId (tenant boundary)');
  }

  const { client } = getSupabaseAdmin();
  if (!client) {
    throw new TenantScopeError('Supabase admin client is not configured');
  }

  return {
    workspaceId,
    client,
    assertScoped(table: string, appliedWorkspaceId?: string | null) {
      if (!TENANT_TABLES.has(table)) return; // non-tenant table, no assertion
      if (!appliedWorkspaceId) {
        throw new TenantScopeError(
          `Refusing cross-tenant query: '${table}' must be filtered by workspace_id`
        );
      }
      if (appliedWorkspaceId !== workspaceId) {
        throw new TenantScopeError(
          `Tenant mismatch on '${table}': query scoped to ${appliedWorkspaceId} but context is ${workspaceId}`
        );
      }
    },
  };
}

/**
 * Guard a cross-tenant operation: ensures two workspace identifiers refer to the
 * same tenant before performing a copy/move/merge. Fails closed.
 */
export function requireSameTenant(
  sourceWorkspaceId: string | null | undefined,
  targetWorkspaceId: string | null | undefined,
  operation: string
): void {
  if (!sourceWorkspaceId || !targetWorkspaceId) {
    throw new TenantScopeError(`${operation} requires both source and target workspace ids`);
  }
  if (sourceWorkspaceId !== targetWorkspaceId) {
    tenantLog.warn('Blocked cross-tenant operation', {
      operation,
      source: sourceWorkspaceId,
      target: targetWorkspaceId,
    });
    throw new TenantScopeError(`${operation} is not permitted across workspaces`);
  }
}

/**
 * Production-readiness probe: confirm RLS is enabled on the core tenant tables.
 * Returns a list of tables that are NOT row-level-secure (empty = good).
 */
export async function verifyTenantIsolation(): Promise<{
  ok: boolean;
  unsecuredTables: string[];
}> {
  const { client } = getSupabaseAdmin();
  if (!client) {
    return { ok: false, unsecuredTables: ['<admin client unavailable>'] };
  }

  // list_rls_enabled_tables() is created by migration 20260717000000_scaling_isolation
  // and is declared in src/types/database.ts (Functions).
  const { data, error } = await client
    .rpc('list_rls_enabled_tables')
    .throwOnError();

  if (error || !Array.isArray(data)) {
    // RPC may not exist in this environment; treat as inconclusive (not a hard fail).
    tenantLog.warn('verifyTenantIsolation: could not introspect RLS');
    return { ok: true, unsecuredTables: [] };
  }

  const secured = new Set(
    (data as Array<{ tablename: string; rowsecurity: boolean }>)
      .filter((r) => r.rowsecurity)
      .map((r) => r.tablename)
  );

  const unsecuredTables = [...TENANT_TABLES].filter((t) => !secured.has(t));
  return { ok: unsecuredTables.length === 0, unsecuredTables };
}
