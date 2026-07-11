import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRequestId, createApiError, createApiSuccess } from '@/lib/api-response';
import { accessSharedReportAction } from '@/actions/reports/actions';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  password: z.string().min(1).max(128).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = getRequestId(_request);
  const { token } = await context.params;

  if (!token?.trim()) {
    return createApiError('Invalid share token', { status: 400, requestId });
  }

  try {
    const result = await accessSharedReportAction(token);

    if (!result.ok && !result.requiresPassword) {
      return createApiError(result.error || 'Share link unavailable', {
        status: result.error?.includes('not found') ? 404 : 403,
        requestId,
      });
    }

    return createApiSuccess(
      {
        title: result.title,
        expiresAt: result.expiresAt,
        requiresPassword: result.requiresPassword ?? false,
      },
      { message: 'Share link metadata loaded.', requestId }
    );
  } catch (error) {
    reportAppError('Share report metadata API error', error, { requestId, token });
    return createApiError('Failed to load share link', { status: 500, requestId });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const requestId = getRequestId(request);
  const { token } = await context.params;

  if (!token?.trim()) {
    return createApiError('Invalid share token', { status: 400, requestId });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createApiError('Invalid request payload', { status: 400, requestId });
  }

  try {
    const result = await accessSharedReportAction(token, parsed.data.password);

    if (!result.ok) {
      const status = result.requiresPassword
        ? 401
        : result.error?.includes('not found')
          ? 404
          : 403;

      return createApiError(result.error || 'Access denied', { status, requestId });
    }

    return createApiSuccess(
      {
        signedUrl: result.signedUrl,
        filename: result.filename,
        title: result.title,
        expiresAt: result.expiresAt,
      },
      { message: 'Signed download URL created.', requestId }
    );
  } catch (error) {
    reportAppError('Share report access API error', error, { requestId, token });
    return createApiError('Failed to access shared report', { status: 500, requestId });
  }
}