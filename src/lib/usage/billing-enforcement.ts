/**
 * Soft Usage Limits (No Hard Enforcement)
 *
 * Internal platform — usage is tracked but operations are never blocked.
 * All functions return "allowed" unconditionally.
 */

import { type QuotaType } from '@/lib/usage/quotas';

export interface EnforcementResult {
  allowed: boolean;
  blocked: boolean;
  quotaType: QuotaType;
  current: number;
  limit: number | null;
  percentUsed: number;
  message: string;
  retryAfterSeconds?: number;
  upgradeRequired: boolean;
}

export interface EnforcementError {
  code: 'QUOTA_EXCEEDED' | 'BILLING_LIMIT_EXCEEDED';
  message: string;
  quotaType: QuotaType;
  current: number;
  limit: number | null;
  percentUsed: number;
  retryAfterSeconds?: number;
  upgradeUrl: string;
}

/**
 * Always returns allowed — no hard limits enforced.
 */
export async function checkBillingLimit(
  _workspaceId: string,
  type: QuotaType,
  _amount?: number
): Promise<EnforcementResult> {
  return {
    allowed: true,
    blocked: false,
    quotaType: type,
    current: 0,
    limit: null,
    percentUsed: 0,
    message: `Soft limit check: ${type} — allowed (no enforcement)`,
    upgradeRequired: false,
  };
}

/**
 * Always returns allowed — never throws.
 */
export async function enforceBillingLimit(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<EnforcementResult> {
  return checkBillingLimit(workspaceId, type, amount);
}

/**
 * Always returns allowed — never throws.
 */
export async function enforceMultipleBillingLimits(
  workspaceId: string,
  checks: Array<{ type: QuotaType; amount?: number }>
): Promise<EnforcementResult[]> {
  return Promise.all(checks.map((c) => checkBillingLimit(workspaceId, c.type, c.amount ?? 1)));
}

export function createEnforcementError(): Error {
  return new Error('Billing enforcement is disabled on this internal platform.');
}

/**
 * Always returns ok — never blocks.
 */
export async function enforceApiBillingLimit(
  workspaceId: string,
  type: QuotaType,
  amount = 1
): Promise<{ ok: true; result: EnforcementResult } | { ok: false; response: Response }> {
  const result = await checkBillingLimit(workspaceId, type, amount);
  return { ok: true, result };
}

export async function clearEnforcementCache(_workspaceId: string): Promise<void> {
  // No-op — no caching needed without enforcement
}

/**
 * Always returns empty — no enforcement statuses.
 */
export async function getAllEnforcementStatuses(
  _workspaceId: string
): Promise<EnforcementResult[]> {
  return [];
}
