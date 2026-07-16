/**
 * Playbook Execution API
 *
 * POST /api/orchestrator/playbook - Execute a workflow playbook
 * GET /api/orchestrator/playbook?id=xxx - Get playbook details
 */

import { z } from 'zod';
import { withUnifiedApiHandler, unifiedSuccess, unifiedError } from '@/lib/unified-api-handler';
import { executePlaybook, loadPlaybook, validatePlaybook } from '@/lib/orchestrator/playbook-executor';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

const ExecutePlaybookSchema = z.object({
  playbookId: z.string().uuid(),
  inputData: z.record(z.string(), z.unknown()).default({}),
});

// ─── POST /api/orchestrator/playbook ────────────────────────────────

export const POST = withUnifiedApiHandler(
  async (request, data, ctx) => {
    const typed = data as z.infer<typeof ExecutePlaybookSchema>;
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (authResult.error || !authResult.context) {
      return unifiedError(authResult.error ?? 'Access denied', ctx, { status: 403 });
    }

    // Load and validate playbook first
    const playbook = await loadPlaybook(typed.playbookId, authResult.context.workspace.id);
    if (!playbook) {
      return unifiedError('Playbook not found', ctx, { status: 404 });
    }

    const validation = validatePlaybook(playbook);
    if (!validation.valid) {
      return unifiedError('Invalid playbook', ctx, {
        status: 400,
        meta: { errors: validation.errors, warnings: validation.warnings },
      });
    }

    // Execute
    const result = await executePlaybook(
      typed.playbookId,
      authResult.context.workspace.id,
      typed.inputData,
      authResult.context.user.id
    );

    return unifiedSuccess(result, ctx, {
      message: `Playbook "${result.playbookName}" ${result.status}`,
      status: result.status === 'queued' ? 202 : 200,
    });
  },
  {
    methods: ['POST'],
    schema: ExecutePlaybookSchema,
    requireAuth: true,
  }
);

// ─── GET /api/orchestrator/playbook?id=xxx ──────────────────────────

export const GET = withUnifiedApiHandler(
  async (request, _data, ctx) => {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return unifiedError(authResult.error ?? 'Access denied', ctx, { status: 403 });
    }

    const url = new URL(request.url);
    const playbookId = url.searchParams.get('id');

    if (!playbookId) {
      return unifiedError('playbook id is required', ctx, { status: 400 });
    }

    const playbook = await loadPlaybook(playbookId, authResult.context.workspace.id);
    if (!playbook) {
      return unifiedError('Playbook not found', ctx, { status: 404 });
    }

    const validation = validatePlaybook(playbook);

    return unifiedSuccess({
      playbook,
      validation,
    }, ctx);
  },
  {
    methods: ['GET'],
    requireAuth: true,
  }
);
