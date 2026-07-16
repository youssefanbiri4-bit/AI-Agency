/**
 * Orchestrator API Routes
 *
 * Provides REST endpoints for:
 * - Workflow execution
 * - Playbook execution
 * - Health checks
 * - Cost monitoring
 */

import { z } from 'zod';
import { withUnifiedApiHandler, unifiedSuccess, unifiedError } from '@/lib/unified-api-handler';
import { executeUnifiedWorkflow, getWorkflowStatus } from '@/lib/orchestrator/unified-orchestrator';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

// ─── Schemas ────────────────────────────────────────────────────────

const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().uuid().optional(),
  agentTypes: z.array(z.string()).min(1).max(10),
  inputData: z.record(z.string(), z.unknown()).default({}),
  mode: z.enum(['n8n', 'orchestrator', 'hybrid']).optional(),
  maxBudgetUsd: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

// ─── POST /api/orchestrator/execute ─────────────────────────────────

export const POST = withUnifiedApiHandler(
  async (request, data, ctx) => {
    const typed = data as z.infer<typeof ExecuteWorkflowSchema>;
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (authResult.error || !authResult.context) {
      return unifiedError(authResult.error ?? 'Access denied', ctx, { status: 403 });
    }

    const result = await executeUnifiedWorkflow({
      ...typed,
      workspaceId: authResult.context.workspace.id,
      userId: authResult.context.user.id,
    });

    return unifiedSuccess(result, ctx, {
      message: `Workflow ${result.status}`,
      status: result.status === 'queued' ? 202 : 200,
    });
  },
  {
    methods: ['POST'],
    schema: ExecuteWorkflowSchema,
    requireAuth: true,
  }
);

// ─── GET /api/orchestrator/execute?executionId=xxx ──────────────────

export const GET = withUnifiedApiHandler(
  async (request, _data, ctx) => {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return unifiedError(authResult.error ?? 'Access denied', ctx, { status: 403 });
    }

    const url = new URL(request.url);
    const executionId = url.searchParams.get('executionId');

    if (!executionId) {
      return unifiedError('executionId is required', ctx, { status: 400 });
    }

    const result = await getWorkflowStatus(executionId, authResult.context.workspace.id);

    if (!result) {
      return unifiedError('Workflow not found', ctx, { status: 404 });
    }

    return unifiedSuccess(result, ctx);
  },
  {
    methods: ['GET'],
    requireAuth: true,
  }
);
