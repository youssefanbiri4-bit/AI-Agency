'use server';

import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { getMarketingMetrics, getExperimentMetrics } from '@/lib/data/marketing-analytics';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

const actionsLog = logger.child('actions:marketing');

export interface MarketingAnalyticsResult {
  success: boolean;
  data?: {
    metrics: Awaited<ReturnType<typeof getMarketingMetrics>>;
    experiments: Awaited<ReturnType<typeof getExperimentMetrics>>;
  };
  error?: string;
}

/**
 * Get marketing analytics for the current workspace.
 */
export async function getMarketingAnalyticsAction(): Promise<MarketingAnalyticsResult> {
  try {
    const supabase = getSupabaseAdmin().client;
    if (!supabase) {
      return { success: false, error: 'Supabase admin client not available' };
    }
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Access denied' };
    }

    const { id: workspaceId } = authResult.context.workspace;

    const [metrics, experiments] = await Promise.all([
      getMarketingMetrics(workspaceId),
      getExperimentMetrics(workspaceId),
    ]);

    return {
      success: true,
      data: {
        metrics,
        experiments,
      },
    };
  } catch (err) {
    actionsLog.error('getMarketingAnalyticsAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get marketing analytics',
    };
  }
}
