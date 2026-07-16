import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ContentStudioItemWithAssets } from '@/features/content-studio/data/content-studio';
import type { ContentStudioStatus, CreativeAssetRecord } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessState =
  | 'ready'
  | 'setup_required'
  | 'approval_pending'
  | 'quota_limit'
  | 'token_missing'
  | 'manual_only'
  | 'unsupported'
  | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const contentStatuses: ContentStudioStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'failed',
  'setup_required',
  'approval_pending',
];

export const readinessBadgeStatuses: Record<ReadinessState, Parameters<typeof StatusBadge>[0]['status']> = {
  ready: 'ready',
  setup_required: 'setup_required',
  approval_pending: 'approval_pending',
  quota_limit: 'quota_limit',
  token_missing: 'token_missing',
  manual_only: 'manual_only',
  unsupported: 'unsupported',
  error: 'error',
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function safeString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

export function isVideoAsset(asset: CreativeAssetRecord) {
  return (
    asset.asset_type === 'video' ||
    asset.asset_type === 'reel_video' ||
    asset.metadata?.media_type === 'video' ||
    Boolean(asset.metadata?.video)
  );
}

export function isManualOnlyItem(item: ContentStudioItemWithAssets) {
  return item.content_type === 'linkedin_post_planner' || item.provider_status === 'manual_only';
}

export function getReadinessState(value: {
  state?: string;
  status?: string;
  isConfigured?: boolean;
  isReady?: boolean;
}) {
  if (value.state) {
    return value.state as ReadinessState;
  }

  if (value.status === 'configured' || value.status === 'ready' || value.isConfigured || value.isReady) {
    return 'ready';
  }

  if (value.status === 'approval_pending') return 'approval_pending';
  if (value.status === 'quota_limit') return 'quota_limit';
  return 'setup_required';
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

export function getMetaEnvironmentMissing() {
  return ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'].filter(
    (key) => !process.env[key]?.trim()
  );
}

export function getMetaProviderState({
  missingEnvironment,
  status,
  requiredSelection,
}: {
  missingEnvironment: string[];
  status: string | null | undefined;
  requiredSelection: string | null;
}): ReadinessState {
  if (missingEnvironment.length > 0) return 'setup_required';
  if (!status || status === 'not_connected') return 'token_missing';
  if (status === 'expired' || status === 'revoked') return 'token_missing';
  if (status !== 'connected') return 'setup_required';
  return requiredSelection ? 'ready' : 'setup_required';
}

export function getGoogleAdsProviderState({
  isConfigured,
  status,
}: {
  isConfigured: boolean;
  status: string | null | undefined;
}): ReadinessState {
  if (!isConfigured) return 'setup_required';
  if (!status || status === 'not_connected') return 'token_missing';
  if (status === 'expired' || status === 'revoked') return 'token_missing';
  return status === 'connected' ? 'ready' : 'setup_required';
}

export function getPinterestProviderState(): ReadinessState {
  return 'setup_required';
}

export function fallbackProviderReadiness(): { state: ReadinessState } {
  return {
    state: 'setup_required',
  };
}
