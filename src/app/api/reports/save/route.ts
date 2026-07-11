import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestId, createApiError, createApiSuccess } from '@/lib/api-response';
import { saveClientReport } from '@/actions/reports/actions';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  taskIds: z.array(z.string().uuid()).optional(),
  template: z.enum(['full', 'executive', 'performance']).optional(),
  password: z.string().min(4).max(64).optional(),
  period: z.string().max(120).optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createApiError('Invalid JSON body', { status: 400, requestId });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createApiError('Invalid request payload', { status: 400, requestId });
  }

  try {
    const result = await saveClientReport(parsed.data);

    if (!result.ok) {
      return createApiError(result.error || 'Failed to save report', {
        status: result.error?.includes('required') ? 403 : 500,
        requestId,
      });
    }

    return createApiSuccess(
      {
        reportId: result.reportId,
        filename: result.filename,
      },
      {
        message: 'Report saved successfully.',
        requestId,
      }
    );
  } catch (error) {
    reportAppError('Save report API error', error, { requestId });
    return createApiError('Failed to save report', { status: 500, requestId });
  }
}