import { NextResponse } from 'next/server';
import { getRequestId, createApiError } from '@/lib/api-response';
import { requireSessionAdmin } from '@/lib/api/auth';
import { withApiHandler } from '@/lib/api/handler';
import { listSupportTickets, listFeedback, listNpsResponses } from '@/lib/data/customer-success';

export const dynamic = 'force-dynamic';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export const GET = withApiHandler(async (request: Request): Promise<NextResponse> => {
  const requestId = getRequestId(request);
  const session = await requireSessionAdmin(request);
  if (session.response) return session.response;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'tickets';
  const format = url.searchParams.get('format') ?? 'csv';

  if (!['tickets', 'feedback', 'nps'].includes(type)) {
    return createApiError('VALIDATION_ERROR', { status: 400, requestId, message: 'type must be tickets|feedback|nps' });
  }

  let rows: Record<string, unknown>[] = [];
  if (type === 'tickets') {
    const r = await listSupportTickets(session.workspaceId!, session.supabase!);
    rows = (r.data ?? []).map((x) => ({
      id: x.id, subject: x.subject, status: x.status, priority: x.priority,
      category: x.category, created_at: x.created_at, resolved_at: x.resolved_at,
    }));
  } else if (type === 'feedback') {
    const r = await listFeedback(session.workspaceId!, session.supabase!);
    rows = (r.data ?? []).map((x) => ({
      id: x.id, rating: x.rating ?? '', category: x.category, message: x.message, created_at: x.created_at,
    }));
  } else {
    const r = await listNpsResponses(session.workspaceId!, session.supabase!);
    rows = (r.data ?? []).map((x) => ({
      id: x.id, score: x.score, comment: x.comment ?? '', period: x.period, created_at: x.created_at,
    }));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return NextResponse.json({ type, exportedAt: new Date().toISOString(), rows }, {
      headers: { 'content-disposition': `attachment; filename="${type}-${stamp}.json"` },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${type}-${stamp}.csv"`,
    },
  });
});
