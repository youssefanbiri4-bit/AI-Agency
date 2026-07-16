/**
 * Centralized Paid Ads Actions with Production Gate
 */

import 'server-only';
import { assertProductionGate } from '@/lib/production/gate';
import { checkWorkspaceUserRateLimit, RATE_LIMIT_ACTIONS } from '@/lib/sliding-window-rate-limit';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- payload reserved for future provider delegation
export async function gatedPaidAdsPublish(workspaceId: string, userId: string, payload: Record<string, unknown>) {
  await assertProductionGate(workspaceId);

  // Sliding window rate limit for paid ad publishing
  const publishLimit = await checkWorkspaceUserRateLimit(
    workspaceId,
    userId,
    RATE_LIMIT_ACTIONS.CONTENT_PUBLISH,
    { limit: 10, windowMs: 60_000 } // Stricter limit for paid ads
  );
  if (!publishLimit.allowed) {
    throw new Error(`Paid ads publishing rate limit reached. Please wait ${Math.ceil(publishLimit.resetInMs / 1000)} seconds before retrying.`);
  }

  // Delegate to actual provider action (e.g. from content-studio or ads)
  // For now this is the guard entry point
  return { success: true, note: 'Gate passed. Actual publish delegated to provider.' };
}
