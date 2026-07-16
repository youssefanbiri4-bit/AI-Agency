import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestId, createApiError } from '@/lib/api-response';
import { checkSlidingWindowRateLimit, buildWorkspaceRateLimitKey, RATE_LIMIT_ACTIONS } from '@/lib/sliding-window-rate-limit';
import { downloadClientReportPdfAction } from '@/actions/reports/actions';
import { reportAppError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  taskIds: z.array(z.string().uuid()).optional(),
  template: z.enum(['full', 'executive', 'performance']).optional(),
  password: z.string().min(4).max(64).optional(),
  period: z.string().max(120).optional(),
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
    // Sliding window rate limit for PDF report generation
    const slidingLimiter = await checkSlidingWindowRateLimit({
      key: buildWorkspaceRateLimitKey(parsed.data.workspaceId, RATE_LIMIT_ACTIONS.REPORT_EXPORT_PDF),
      limit: 3,
      windowMs: 60_000,
    });

    if (!slidingLimiter.allowed) {
      return createApiError('PDF generation rate limit reached. Please wait before retrying.', {
        status: 429,
        requestId,
        headers: {
          'Retry-After': String(Math.ceil(slidingLimiter.resetInMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    const result = await downloadClientReportPdfAction(parsed.data);

    if (!result.ok || !result.pdfBase64) {
      return createApiError(result.error || 'PDF generation failed', { status: 500, requestId });
    }

    const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename || 'client-report.pdf'}"`,
        'X-Request-ID': requestId,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportAppError('Client PDF API error', error, { requestId });
    return createApiError('Failed to generate PDF', { status: 500, requestId });
  }
}