/**
 * MFA Enforcement
 *
 * Provides workspace-level MFA enforcement for owner/admin roles.
 * When enabled, users with owner or admin roles must have MFA enabled
 * to access the dashboard.
 *
 * The enforcement state is stored in workspace integration_settings
 * under the `mfa_enforcement` key.
 *
 * Usage:
 *   - `checkMfaEnforcement()` in edge middleware for dashboard routes
 *   - `getMfaEnforcementStatus()` for settings UI
 *   - `setMfaEnforcement()` for admin configuration
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { JsonObject } from '@/types';
import type { StrictWorkspaceRole } from '@/lib/permissions-matrix';
import {
  getMfaStatusSnapshot,
} from '@/lib/auth/mfa';
import { logger } from '@/lib/logger';

const mfaEnforcementLog = logger.child('auth:mfa-enforcement');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MfaEnforcementConfig {
  /** Whether MFA is enforced for owner/admin roles */
  enabled: boolean;
  /** Which roles are required to have MFA */
  enforcedRoles: Array<'owner' | 'admin'>;
  /** Grace period in seconds before enforcement takes effect (for setup) */
  gracePeriodSeconds: number;
  /** Whether to show a warning banner instead of blocking */
  warningOnly: boolean;
}

export interface MfaEnforcementStatus {
  /** Current enforcement config */
  config: MfaEnforcementConfig;
  /** Whether the current user is subject to enforcement */
  userIsEnforced: boolean;
  /** Whether the current user has MFA enabled */
  userHasMfa: boolean;
  /** Overall enforcement result */
  requiresAction: boolean;
  /** Message for the user */
  message: string | null;
  /** Redirect URL if enforcement requires action */
  redirectUrl: string | null;
}

// ─── Default Configuration ─────────────────────────────────────────────────

export const DEFAULT_MFA_ENFORCEMENT: MfaEnforcementConfig = {
  enabled: false,
  enforcedRoles: ['owner', 'admin'],
  gracePeriodSeconds: 7 * 24 * 60 * 60, // 7 days
  warningOnly: true, // Default to warning-only mode
};

export const MFA_ENFORCEMENT_SETTINGS_KEY = 'mfa_enforcement';

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Get the MFA enforcement configuration for a workspace.
 * Stored in integration_settings.settings.mfa_enforcement.
 */
export async function getMfaEnforcementConfig(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<MfaEnforcementConfig> {
  try {
    const { data } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!data?.settings) {
      return { ...DEFAULT_MFA_ENFORCEMENT };
    }

    const enforcement = (data.settings as Record<string, unknown>)[MFA_ENFORCEMENT_SETTINGS_KEY];
    if (!enforcement || typeof enforcement !== 'object') {
      return { ...DEFAULT_MFA_ENFORCEMENT };
    }

    const raw = enforcement as Record<string, unknown>;

    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MFA_ENFORCEMENT.enabled,
      enforcedRoles: Array.isArray(raw.enforcedRoles)
        ? raw.enforcedRoles.filter((r): r is 'owner' | 'admin' => r === 'owner' || r === 'admin')
        : [...DEFAULT_MFA_ENFORCEMENT.enforcedRoles],
      gracePeriodSeconds: typeof raw.gracePeriodSeconds === 'number'
        ? raw.gracePeriodSeconds
        : DEFAULT_MFA_ENFORCEMENT.gracePeriodSeconds,
      warningOnly: typeof raw.warningOnly === 'boolean'
        ? raw.warningOnly
        : DEFAULT_MFA_ENFORCEMENT.warningOnly,
    };
  } catch {
    return { ...DEFAULT_MFA_ENFORCEMENT };
  }
}

/**
 * Set the MFA enforcement configuration for a workspace.
 */
export async function setMfaEnforcementConfig(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  config: Partial<MfaEnforcementConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await getMfaEnforcementConfig(supabase, workspaceId);
    const updated: MfaEnforcementConfig = {
      ...current,
      ...config,
    };

    // Read current settings
    const { data: existing } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const settings = ((existing?.settings ?? {}) as Record<string, unknown>);
    settings[MFA_ENFORCEMENT_SETTINGS_KEY] = updated;

    const { error } = await supabase
      .from('integration_settings')
      .upsert({
        workspace_id: workspaceId,
        settings: settings as JsonObject,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    mfaEnforcementLog.info('MFA enforcement config updated', {
      workspaceId,
      enabled: updated.enabled,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Enforcement Check ──────────────────────────────────────────────────────

/**
 * Check MFA enforcement status for a user in a workspace.
 * Returns whether the user needs to set up MFA.
 */
export async function checkMfaEnforcement(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  userRole: StrictWorkspaceRole | string | null
): Promise<MfaEnforcementStatus> {
  const config = await getMfaEnforcementConfig(supabase, workspaceId);

  // Check if the user's role is in the enforced roles list
  const userIsEnforced = config.enabled && (
    (userRole === 'owner' && config.enforcedRoles.includes('owner')) ||
    (userRole === 'admin' && config.enforcedRoles.includes('admin'))
  );

  if (!userIsEnforced) {
    return {
      config,
      userIsEnforced: false,
      userHasMfa: false,
      requiresAction: false,
      message: null,
      redirectUrl: null,
    };
  }

  // Check if the user has MFA enabled
  const mfaSnapshot = await getMfaStatusSnapshot(supabase);
  const userHasMfa = mfaSnapshot.enabled;

  if (userHasMfa) {
    return {
      config,
      userIsEnforced: true,
      userHasMfa: true,
      requiresAction: false,
      message: null,
      redirectUrl: null,
    };
  }

  // User is enforced but doesn't have MFA
  if (config.warningOnly) {
    return {
      config,
      userIsEnforced: true,
      userHasMfa: false,
      requiresAction: false,
      message: 'MFA is recommended for your role. Set up an authenticator app in Security Settings.',
      redirectUrl: null,
    };
  }

  // Strict mode: block access
  return {
    config,
    userIsEnforced: true,
    userHasMfa: false,
    requiresAction: true,
    message: 'Multi-factor authentication (MFA) is required for your role. Set up an authenticator app before continuing.',
    redirectUrl: '/dashboard/settings#security-mfa',
  };
}

// ─── Middleware Integration Helpers ─────────────────────────────────────────

/**
 * Server-side function to check if a user needs to be redirected for MFA setup.
 * Called from edge middleware for dashboard route protection.
 *
 * Returns the redirect URL if MFA enforcement requires action, null otherwise.
 */
export async function getMfaEnforcementRedirect(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  userRole: StrictWorkspaceRole | string | null
): Promise<string | null> {
  if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
    return null; // Only enforce for owner/admin
  }

  const status = await checkMfaEnforcement(supabase, workspaceId, userId, userRole);

  if (status.requiresAction) {
    mfaEnforcementLog.warn('MFA enforcement triggered redirect', {
      workspaceId,
      userId,
      role: userRole,
    });
    return status.redirectUrl;
  }

  return null;
}

/**
 * Check if a user is required to be on an MFA page but isn't.
 * Used by middleware to prevent redirect loops.
 */
export function isMfaEnforcementRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard/settings') ||
    pathname.startsWith('/auth/mfa') ||
    pathname.startsWith('/onboarding');
}
