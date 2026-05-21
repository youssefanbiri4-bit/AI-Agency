import { z } from 'zod';
import { executeTask } from '@/lib/n8n';
import { logger } from '@/lib/logger';
import { getWorkspace } from '@/lib/data/workspaces-server';

const taskExecuteSchema = z.object({
  taskPayload: z.any(), // More specific schema can be added if TaskExecutionPayload is defined
  taskExecutionId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export async function POST(req: Request) {
    // Attempt to get Request ID from headers or generate one
    const requestIdHeader = req.headers.get('X-Request-ID');
    const requestId = requestIdHeader ?? `req-${Math.random().toString(36).substring(2, 10)}`;
    const log = logger.child(requestId);

  try {
    const existingWorkspace = await getWorkspace(null);
    if (!existingWorkspace?.data) {
        log.warn('Workspace not found or initial check failed', { workspaceId: null });
        return new Response(JSON.stringify({ message: 'Workspace context not available', requestId }), { status: 400 });
    }

    const body = await req.json();
    const validation = taskExecuteSchema.safeParse(body);

    if (!validation.success) {
      log.warn('Invalid task execution payload', { errors: validation.error.flatten() });
      return new Response(JSON.stringify({ message: 'Invalid payload', errors: validation.error.flatten(), requestId }), { status: 400 });
    }

    const { taskPayload, taskExecutionId, workspaceId } = validation.data;
    log.info('Received task execution request', { workspaceId, taskExecutionId, payloadKeys: Object.keys(taskPayload) });

    // Ensure workspaceId from payload matches context if available/required
    if (existingWorkspace.data.id !== workspaceId) {
        log.warn('Workspace ID mismatch between request payload and context', { requestedWorkspaceId: workspaceId, contextWorkspaceId: existingWorkspace.data.id });
        return new Response(JSON.stringify({ message: 'Workspace ID mismatch', requestId }), { status: 400 });
    }

    const result = await executeTask(taskPayload, taskExecutionId, workspaceId);

    if (result.error) {
      log.error('Failed to execute task', { workspaceId, taskExecutionId, error: result.error });
      return new Response(JSON.stringify({ message: 'Failed to execute task', error: result.error, requestId }), { status: 500 });
    }

    log.info('Task execution successful', { workspaceId, taskExecutionId, result });
    return new Response(JSON.stringify({ success: true, result, requestId }), { status: 200 });

  } catch (error: unknown) {
    log.error('Error during task execution request', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ message: 'Internal Server Error', error: error instanceof Error ? error.message : String(error), requestId }), { status: 500 });
  }
}

