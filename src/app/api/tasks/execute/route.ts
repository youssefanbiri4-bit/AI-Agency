import { z } from 'zod';
import { executeTask } from '@/lib/n8n';
import { logger } from '@/lib/logger';
import { getWorkspace } from '@/lib/data/workspaces-server';
import { createErrorResponse, handleError, AppError, ErrorLevel, validateRequired } from '@/lib/error-handler';
import { checkRateLimit } from '@/lib/rate-limit';

const taskExecuteSchema = z.object({
  taskPayload: z.record(z.any()).describe('Task execution payload'),
  taskExecutionId: z.string().uuid('Invalid task execution ID format'),
  workspaceId: z.string().uuid('Invalid workspace ID format'),
}).strict();

export async function POST(req: Request) {
  const requestIdHeader = req.headers.get('X-Request-ID');
  const requestId = requestIdHeader ?? `req-${Math.random().toString(36).substring(2, 10)}`;
  const log = logger.child(requestId);

  try {
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit({
      key: `api:tasks:execute:${clientIp}`,
      limit: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimitResult.allowed) {
      log.warn('Rate limit exceeded for task execution', { clientIp });
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) }),
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const existingWorkspace = await getWorkspace(null);
    if (!existingWorkspace?.data) {
      log.warn('Workspace not found', { workspaceId: null });
      throw new AppError('Workspace context not available', 400, ErrorLevel.MEDIUM);
    }

    const body = await req.json();
    const validation = taskExecuteSchema.safeParse(body);

    if (!validation.success) {
      log.warn('Invalid task execution payload', { errors: validation.error.flatten() });
      throw new AppError(
        'Invalid payload format',
        400,
        ErrorLevel.LOW,
        { errors: validation.error.flatten() }
      );
    }

    const { taskPayload, taskExecutionId, workspaceId } = validation.data;
    log.info('Received task execution request', { workspaceId, taskExecutionId, payloadKeys: Object.keys(taskPayload) });

    // Workspace ID validation
    if (existingWorkspace.data.id !== workspaceId) {
      log.warn('Workspace ID mismatch', { requestedWorkspaceId: workspaceId, contextWorkspaceId: existingWorkspace.data.id });
      throw new AppError('Workspace ID mismatch', 400, ErrorLevel.LOW);
    }

    const result = await executeTask(taskPayload, taskExecutionId, workspaceId);

    if (result.error) {
      log.error('Failed to execute task', { workspaceId, taskExecutionId, error: result.error });
      throw new AppError('Failed to execute task', 500, ErrorLevel.HIGH, { taskError: result.error });
    }

    log.info('Task execution successful', { workspaceId, taskExecutionId });
    return new Response(
      JSON.stringify({ success: true, result, requestId }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
      }
    );
  } catch (error: unknown) {
    return createErrorResponse(error, {
      endpoint: '/api/tasks/execute',
      requestId,
      metadata: { action: 'executeTask' },
    });
  }
}

