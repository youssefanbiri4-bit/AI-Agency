/**
 * Orchestrator Health & Monitoring API
 *
 * GET /api/orchestrator/health - System health check
 * GET /api/orchestrator/health?workspaceId=xxx - Workspace metrics
 * GET /api/orchestrator/health?workspaceId=xxx&report=true - Full report
 */

import { withUnifiedApiHandler, unifiedSuccess, unifiedError } from '@/lib/unified-api-handler';
import {
  checkOrchestratorHealth,
  getExecutionMetrics,
  generatePerformanceReport,
} from '@/lib/orchestrator/monitoring';
import { getWorkspaceCostBudget, getCostSummary } from '@/lib/orchestrator/cost-control';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

// ─── GET /api/orchestrator/health ───────────────────────────────────

export const GET = withUnifiedApiHandler(
  async (request, _data, ctx) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const report = url.searchParams.get('report') === 'true';
    const days = parseInt(url.searchParams.get('days') ?? '7', 10);

    // System health check (always available)
    const health = await checkOrchestratorHealth();

    // If no workspace ID, return just health
    if (!workspaceId) {
      return unifiedSuccess({ health }, ctx);
    }

    // Verify access
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return unifiedError(authResult.error ?? 'Access denied', ctx, { status: 403 });
    }

    // Get metrics and budget
    const [metrics, budget, costSummary] = await Promise.all([
      getExecutionMetrics(workspaceId, days),
      getWorkspaceCostBudget(workspaceId),
      getCostSummary(workspaceId, days),
    ]);

    // Full report if requested
    if (report) {
      const fullReport = await generatePerformanceReport(workspaceId, days);
      return unifiedSuccess({
        health,
        metrics,
        budget,
        costSummary,
        report: fullReport,
      }, ctx);
    }

    return unifiedSuccess({
      health,
      metrics,
      budget,
      costSummary,
    }, ctx);
  },
  {
    methods: ['GET'],
    requireAuth: false, // Health check can be public
  }
);
