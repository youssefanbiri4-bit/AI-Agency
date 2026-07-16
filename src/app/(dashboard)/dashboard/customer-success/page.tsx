import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getActiveWorkspaceIdFromCookie, getSupabaseAdmin } from '@/lib/supabase-server';
import { getCurrentUserWorkspace, getCurrentWorkspaceMembership } from '@/lib/data/workspaces';
import { normalizeWorkspaceRole } from '@/lib/auth/rbac';
import { hasPermission } from '@/lib/auth/rbac-client';
import { AccessDenied } from '@/components/auth/AccessDenied';
import {
  listSupportTickets,
  listFeedback,
  listNpsResponses,
  getNpsSummary,
  listChurnAlerts,
  getChurnRiskSummary,
  getRetentionAnalytics,
} from '@/lib/data/customer-success';
import { CustomerSuccessClient } from './CustomerSuccessClient';
import type { CsPageData } from './types';

export const dynamic = 'force-dynamic';


export default async function CustomerSuccessPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/dashboard?access_denied=1');

  const workspaceId = await getActiveWorkspaceIdFromCookie();
  const wsResult = await getCurrentUserWorkspace(supabase, workspaceId);
  if (!wsResult.data) redirect('/dashboard?access_denied=1');

  const membership = await getCurrentWorkspaceMembership(supabase, wsResult.data.id, auth.user.id);
  const role = normalizeWorkspaceRole(membership.data?.role, wsResult.data, auth.user.id);
  if (!hasPermission(role, 'admin')) return <AccessDenied />;

  const admin = getSupabaseAdmin();
  const client = admin.client;

  const emptyData: CsPageData = {
    tickets: [],
    feedback: [],
    nps: [],
    npsSummary: { count: 0, average: 0, promoters: 0, passives: 0, detractors: 0, nps: 0, trend: [] },
    churnAlerts: [],
    churn: { riskScore: 0, level: 'low', signals: [], openAlerts: 0, cancelScheduled: 0 },
    retention: {
      totalMembers: 0,
      activeMembers30d: 0,
      activeRate: 0,
      dailyActive: [],
      thisMonthEvents: 0,
      lastMonthEvents: 0,
      eventChangePercent: 0,
      nps: { count: 0, average: 0, promoters: 0, passives: 0, detractors: 0, nps: 0, trend: [] },
    },
    isConfigured: Boolean(client),
  };

  if (!client) {
    return <CustomerSuccessClient data={emptyData} />;
  }

  const [tickets, feedback, nps, npsSummary, churnAlerts, churn, retention] = await Promise.all([
    listSupportTickets(wsResult.data.id, client),
    listFeedback(wsResult.data.id, client),
    listNpsResponses(wsResult.data.id, client),
    getNpsSummary(wsResult.data.id, client),
    listChurnAlerts(wsResult.data.id, client, { includeAcknowledged: true }),
    getChurnRiskSummary(wsResult.data.id),
    getRetentionAnalytics(wsResult.data.id),
  ]);

  const data: CsPageData = {
    tickets: tickets.data ?? [],
    feedback: feedback.data ?? [],
    nps: nps.data ?? [],
    npsSummary: npsSummary.data ?? emptyData.npsSummary,
    churnAlerts: churnAlerts.data ?? [],
    churn,
    retention,
    isConfigured: true,
  };

  return <CustomerSuccessClient data={data} />;
}
