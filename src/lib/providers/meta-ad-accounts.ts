import { emptyDataResult, type DataResult } from '@/lib/data/types';

type MetaAdAccount = Record<string, unknown>;

type MetaCampaign = Record<string, unknown>;

type GoogleAdsCampaignMetricCustomer = Record<string, unknown>;

type MetaNotConnected<T> = {
  state: 'not_connected';
  // kept generic shape for future connected states
} & T;

// Lightweight provider wrapper abstractions for hardening
// These wrappers are designed to be extended with real network calls and caching later,
// but provide stable, isolated interfaces for integration.

export async function fetchMetaAdAccountsWithCache(
  workspaceId: string,
  userId: string
): Promise<DataResult<MetaAdAccount[]>> {
  // Placeholder: to be replaced with real fetch + cache logic
  // Ensure parameters are marked as intentionally used for lint.
  void workspaceId;
  void userId;

  return emptyDataResult([], false);
}

export async function fetchMetaCampaignsWithCache(
  workspaceId: string,
  accountId: string,
  userId: string
): Promise<DataResult<MetaNotConnected<{ campaigns: MetaCampaign[] }>>> {
  // Placeholder: to be replaced with real fetch + cache logic
  void workspaceId;
  void accountId;
  void userId;

  return emptyDataResult({ state: 'not_connected', campaigns: [] }, false);
}

export async function fetchGoogleAdsCampaignMetricsWithCache(
  workspaceId: string,
  customerId: string,
  userId: string
): Promise<DataResult<MetaNotConnected<{ customers: GoogleAdsCampaignMetricCustomer[] }>>> {
  // Placeholder: to be replaced with real fetch + cache logic
  void workspaceId;
  void customerId;
  void userId;

  return emptyDataResult({ state: 'not_connected', customers: [] }, false);
}
