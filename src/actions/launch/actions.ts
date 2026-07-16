'use server';

import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import { getLaunchMetrics, getGrowthMetrics } from '@/lib/data/launch-metrics';
import { logger } from '@/lib/logger';

const actionsLog = logger.child('actions:launch');

export interface LaunchMetricsResult {
  success: boolean;
  data?: {
    launch: Awaited<ReturnType<typeof getLaunchMetrics>>;
    growth: Awaited<ReturnType<typeof getGrowthMetrics>>;
  };
  error?: string;
}

/**
 * Get launch and growth metrics for the current workspace.
 */
export async function getLaunchMetricsAction(): Promise<LaunchMetricsResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Access denied' };
    }

    const { id: workspaceId } = authResult.context.workspace;

    const [launch, growth] = await Promise.all([
      getLaunchMetrics(workspaceId),
      getGrowthMetrics(workspaceId),
    ]);

    return {
      success: true,
      data: {
        launch,
        growth,
      },
    };
  } catch (err) {
    actionsLog.error('getLaunchMetricsAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get launch metrics',
    };
  }
}
