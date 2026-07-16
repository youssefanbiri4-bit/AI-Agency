/**
 * Audit Log Export Route
 *
 * Exports audit logs as a downloadable JSON or CSV file.
 * Admin-only access. Rate-limited (per user + per IP) to 5 exports per minute.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie } from '@/lib/supabase-server';
import { getCurrentUserWorkspace } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac';
import { exportAuditLogs } from '@/lib/data/audit-logs';
import {
  checkRateLimitComposite,
  buildRateLimitExceededHeaders,
  getClientIpFromHeaders,
} from '@/lib/rate-limit';

function toCsv(records: Array<Record<string, unknown>>): string {
  const columns = [
    'id',
    'createdAt',
    'severity',
    'eventType',
    'userId',
    'entityType',
    'entityId',
    'message',
    'ipHash',
    'metadata',
  ];
  const escape = (value: unknown): string => {
    const str = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  };
  const header = columns.join(',');
  const rows = records.map((record) => columns.map((col) => escape(record[col])).join(','));
  return [header, ...rows].join('\n');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  // Rate limit: 5 exports per minute per IP + per user.
  const clientIp = getClientIpFromHeaders(request.headers);
  const rateResult = await checkRateLimitComposite([
    { key: `audit-export:ip:${clientIp}`, limit: 5, windowMs: 60_000 },
  ]);

  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: rateResult.headers }
    );
  }

  // Authenticate
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const activeWorkspaceId = await getActiveWorkspaceIdFromCookie();
  const workspaceResult = await getCurrentUserWorkspace(supabase, activeWorkspaceId);

  if (!workspaceResult.data) {
    return NextResponse.json({ error: 'No active workspace.' }, { status: 403 });
  }

  // Check admin permission
  const role = normalizeWorkspaceRole(null, workspaceResult.data, user.id);

  if (!hasPermission(role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  // Per-user export quota (the "user" dimension).
  const userRate = await checkRateLimitComposite([
    { key: `audit-export:user:${user.id}`, limit: 5, windowMs: 60_000 },
  ]);
  if (!userRate.allowed) {
    return NextResponse.json(
      { error: 'Export rate limit exceeded for this account. Try again later.' },
      { status: 429, headers: userRate.headers }
    );
  }

  // Export logs
  const severity = url.searchParams.get('severity') || undefined;
  const eventType = url.searchParams.get('eventType') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;

  const result = await exportAuditLogs(supabase, workspaceResult.data.id, {
    severity: severity as never,
    eventType,
    search,
    dateFrom,
    dateTo,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const records = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  const stamp = new Date().toISOString().split('T')[0];
  const baseName = `audit-logs-${workspaceResult.data.id.slice(0, 8)}-${stamp}`;

  if (format === 'csv') {
    const csv = toCsv(records);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        'Cache-Control': 'no-store',
        ...buildRateLimitExceededHeaders(userRate.denied ?? { allowed: true, remaining: 5, resetAt: Date.now() + 60_000 }),
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        workspaceId: workspaceResult.data.id,
        totalRecords: records.length,
        records,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${baseName}.json"`,
        'Cache-Control': 'no-store',
      },
    }
  );
}
