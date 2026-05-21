import { emptyDataResult, type DataResult } from '@/lib/data/types';

// Lightweight provider wrapper abstractions for hardening
// These wrappers are designed to be extended with real network calls and caching later,
// but provide stable, isolated interfaces for integration.

export async function fetchMetaAdAccountsWithCache(_workspaceId: string, _userId: string): Promise<DataResult<any>> {
  // Placeholder: to be replaced with real fetch + cache logic
  return emptyDataResult([], false);
}

export async function fetchMetaCampaignsWithCache(_workspaceId: string, _accountId: string, _userId: string): Promise<DataResult<any>> {
  // Placeholder: to be replaced with real fetch + cache logic
  return emptyDataResult({ state: 'not_connected', campaigns: [] }, false);
}

export async function fetchGoogleAdsCampaignMetricsWithCache(_workspaceId: string, _customerId: string, _userId: string): Promise<DataResult<any>> {
  // Placeholder: to be replaced with real fetch + cache logic
  return emptyDataResult({ state: 'not_connected', customers: [] }, false);
}
