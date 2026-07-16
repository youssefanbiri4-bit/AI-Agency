/**
 * Centralized Creative Assets Actions with Production Gate
 */

import 'server-only';
import { assertProductionGate } from '@/lib/production/gate';
import { generateImageAction as originalGenerate } from '@/app/(dashboard)/dashboard/creative-assets/actions';
import { enforceQuota, incrementUsage } from '@/lib/usage/quotas';
import { getRBACContext, requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

export async function gatedGenerateImage(assetIdOrForm: string | FormData) {
  const access = await getRBACContext();
  const workspaceId = access.data?.workspace?.id;

  if (workspaceId) {
    // TASK 2: RBAC editor + quota for image gen
    const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (!rbac.ok) {
      throw new Error(rbac.error || 'Editor role required for creative assets.');
    }

    const userId = access.data?.user?.id;

    await assertProductionGate(workspaceId);

    await enforceQuota(workspaceId, 'ai_generations');

    const result = await originalGenerate(assetIdOrForm);

    if (result && !result.error) {
      await incrementUsage(workspaceId, 'ai_generations', 1, userId);
      await incrementUsage(workspaceId, 'creative_assets', 1, userId);
    }

    return result;
  }

  return originalGenerate(assetIdOrForm);
}

// TASK 2: Better prompt builder (used by form)
export function buildReelsOptimizedPrompt(base: string, style?: string, negative?: string): string {
  const baseClean = (base || '').trim();
  let p = [
    baseClean || 'Engaging visual for social media',
    'Vertical 9:16 format, strong hook in first 3 seconds, cinematic lighting, on-brand, high engagement social media style.',
    style || 'premium engaging',
  ].join(' ');
  if (negative) p += ` Avoid: ${negative}.`;
  return p;
}
