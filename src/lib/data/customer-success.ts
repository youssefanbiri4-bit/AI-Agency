import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  SupportTicketRecord,
  CustomerFeedbackRecord,
  NpsResponseRecord,
  ChurnAlertRecord,
  UsageLimitRecord,
} from '@/types/database';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { emptyDataResult, errorDataResult, type DataResult } from '@/lib/data/types';

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export interface CreateSupportTicketInput {
  workspaceId: string;
  userId: string;
  subject: string;
  description: string;
  priority?: string;
  category?: string;
}

export async function listSupportTickets(
  workspaceId: string,
  client: SupabaseClient<Database>,
  opts: { status?: string; limit?: number } = {}
): Promise<DataResult<SupportTicketRecord[]>> {
  let query = client
    .from('support_tickets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (opts.status) query = query.eq('status', opts.status);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) return errorDataResult([], error.message);
  return emptyDataResult((data ?? []) as SupportTicketRecord[], true);
}

export async function getSupportTicket(
  id: string,
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<SupportTicketRecord | null>> {
  const { data, error } = await client
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function createSupportTicket(
  input: CreateSupportTicketInput,
  client: SupabaseClient<Database>
): Promise<DataResult<SupportTicketRecord | null>> {
  const { data, error } = await client
    .from('support_tickets')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'normal',
      category: input.category ?? 'general',
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data as SupportTicketRecord, true);
}

export async function updateSupportTicket(
  id: string,
  workspaceId: string,
  patch: { status?: string; priority?: string; category?: string; assigned_to?: string | null },
  client: SupabaseClient<Database>
): Promise<DataResult<SupportTicketRecord | null>> {
  const update: Database['public']['Tables']['support_tickets']['Update'] = {
    status: patch.status,
    priority: patch.priority,
    category: patch.category,
    assigned_to: patch.assigned_to ?? null,
  };
  if (patch.status === 'resolved' || patch.status === 'closed') {
    update.resolved_at = new Date().toISOString();
  }
  const { data, error } = await client
    .from('support_tickets')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function deleteSupportTicket(
  id: string,
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<boolean>> {
  const { error } = await client
    .from('support_tickets')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) return errorDataResult(false, error.message);
  return emptyDataResult(true, true);
}

// ---------------------------------------------------------------------------
// Customer feedback
// ---------------------------------------------------------------------------

export interface CreateFeedbackInput {
  workspaceId: string;
  userId: string | null;
  rating: number | null;
  message: string;
  category?: string;
  authorEmail?: string | null;
}

export async function listFeedback(
  workspaceId: string,
  client: SupabaseClient<Database>,
  opts: { limit?: number } = {}
): Promise<DataResult<CustomerFeedbackRecord[]>> {
  const { data, error } = await client
    .from('customer_feedback')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) return errorDataResult([], error.message);
  return emptyDataResult((data ?? []) as CustomerFeedbackRecord[], true);
}

export async function createFeedback(
  input: CreateFeedbackInput,
  client: SupabaseClient<Database>
): Promise<DataResult<CustomerFeedbackRecord | null>> {
  const { data, error } = await client
    .from('customer_feedback')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      rating: input.rating,
      message: input.message,
      category: input.category ?? 'general',
      author_email: input.authorEmail ?? null,
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data as CustomerFeedbackRecord, true);
}

export async function deleteFeedback(
  id: string,
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<boolean>> {
  const { error } = await client
    .from('customer_feedback')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) return errorDataResult(false, error.message);
  return emptyDataResult(true, true);
}

// ---------------------------------------------------------------------------
// NPS
// ---------------------------------------------------------------------------

export interface CreateNpsInput {
  workspaceId: string;
  userId: string | null;
  score: number;
  comment?: string | null;
  period?: string;
}

export interface NpsSummary {
  count: number;
  average: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number; // promoters% - detractors%
  trend: { period: string; nps: number; count: number }[];
}

export async function listNpsResponses(
  workspaceId: string,
  client: SupabaseClient<Database>,
  opts: { limit?: number } = {}
): Promise<DataResult<NpsResponseRecord[]>> {
  const { data, error } = await client
    .from('nps_responses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) return errorDataResult([], error.message);
  return emptyDataResult((data ?? []) as NpsResponseRecord[], true);
}

export async function createNpsResponse(
  input: CreateNpsInput,
  client: SupabaseClient<Database>
): Promise<DataResult<NpsResponseRecord | null>> {
  const { data, error } = await client
    .from('nps_responses')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      score: input.score,
      comment: input.comment ?? null,
      period: input.period ?? new Date().toISOString().slice(0, 7),
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data as NpsResponseRecord, true);
}

export async function getNpsSummary(
  workspaceId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<NpsSummary>> {
  const { data, error } = await client
    .from('nps_responses')
    .select('score, period')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) return errorDataResult(null as never, error.message);

  const responses = (data ?? []) as { score: number; period: string }[];
  const promoters = responses.filter((r) => r.score >= 9).length;
  const passives = responses.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const count = responses.length;
  const average = count > 0 ? Math.round((responses.reduce((s, r) => s + r.score, 0) / count) * 10) / 10 : 0;
  const nps = count > 0 ? Math.round(((promoters - detractors) / count) * 100) : 0;

  const byPeriod = new Map<string, { total: number; promoters: number; detractors: number; count: number }>();
  for (const r of responses) {
    const p = byPeriod.get(r.period) ?? { total: 0, promoters: 0, detractors: 0, count: 0 };
    p.total += r.score;
    p.count += 1;
    if (r.score >= 9) p.promoters += 1;
    if (r.score <= 6) p.detractors += 1;
    byPeriod.set(r.period, p);
  }
  const trend = Array.from(byPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      count: v.count,
      nps: v.count > 0 ? Math.round(((v.promoters - v.detractors) / v.count) * 100) : 0,
    }));

  return emptyDataResult({ count, average, promoters, passives, detractors, nps, trend }, true);
}

// ---------------------------------------------------------------------------
// Churn alerts
// ---------------------------------------------------------------------------

export async function listChurnAlerts(
  workspaceId: string,
  client: SupabaseClient<Database>,
  opts: { includeAcknowledged?: boolean } = {}
): Promise<DataResult<ChurnAlertRecord[]>> {
  let query = client
    .from('churn_alerts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (!opts.includeAcknowledged) query = query.eq('acknowledged', false);
  const { data, error } = await query;
  if (error) return errorDataResult([], error.message);
  return emptyDataResult((data ?? []) as ChurnAlertRecord[], true);
}

export async function acknowledgeChurnAlert(
  id: string,
  workspaceId: string,
  userId: string,
  client: SupabaseClient<Database>
): Promise<DataResult<ChurnAlertRecord | null>> {
  const { data, error } = await client
    .from('churn_alerts')
    .update({
      acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data ?? null, true);
}

export async function createChurnAlert(
  input: {
    workspaceId: string;
    signalType: string;
    severity: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
  client: SupabaseClient<Database>
): Promise<DataResult<ChurnAlertRecord | null>> {
  const { data, error } = await client
    .from('churn_alerts')
    .insert({
      workspace_id: input.workspaceId,
      signal_type: input.signalType,
      severity: input.severity,
      title: input.title,
      message: input.message,
      metadata: (input.metadata ?? {}) as never,
    })
    .select('*')
    .single();
  if (error) return errorDataResult(null, error.message);
  return emptyDataResult(data as ChurnAlertRecord, true);
}

// ---------------------------------------------------------------------------
// Analytics: retention + churn risk (server-only, uses admin client)
// ---------------------------------------------------------------------------

export interface DailyActivePoint {
  date: string;
  activeUsers: number;
  events: number;
}

export interface RetentionAnalytics {
  totalMembers: number;
  activeMembers30d: number;
  activeRate: number;
  dailyActive: DailyActivePoint[];
  thisMonthEvents: number;
  lastMonthEvents: number;
  eventChangePercent: number;
  nps: NpsSummary;
}

export interface ChurnSignal {
  signalType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface ChurnRiskSummary {
  riskScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  signals: ChurnSignal[];
  openAlerts: number;
  cancelScheduled: number;
}

const LIMIT_COLUMN: Record<string, keyof UsageLimitRecord> = {
  ai_generations: 'max_ai_generations_per_month',
  creative_assets: 'max_creative_assets',
  content_items: 'max_content_items',
};

function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getRetentionAnalytics(workspaceId: string): Promise<RetentionAnalytics> {
  const admin = getSupabaseAdmin();
  const empty: RetentionAnalytics = {
    totalMembers: 0,
    activeMembers30d: 0,
    activeRate: 0,
    dailyActive: [],
    thisMonthEvents: 0,
    lastMonthEvents: 0,
    eventChangePercent: 0,
    nps: { count: 0, average: 0, promoters: 0, passives: 0, detractors: 0, nps: 0, trend: [] },
  };
  if (!admin.client) return empty;
  const supabase = admin.client;

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const current = monthRange(now);
  const prev = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const [members, events, nps] = await Promise.all([
    supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('usage_events').select('user_id, created_at').eq('workspace_id', workspaceId).gte('created_at', since30),
    getNpsSummary(workspaceId, supabase),
  ]);

  const totalMembers = members.count ?? 0;
  const eventRows = (events.data ?? []) as { user_id: string | null; created_at: string }[];
  const activeSet = new Set(eventRows.filter((e) => e.user_id).map((e) => e.user_id as string));
  const activeMembers30d = activeSet.size;
  const activeRate = totalMembers > 0 ? Math.round((activeMembers30d / totalMembers) * 100) : 0;

  // daily active users over last 30 days
  const byDay = new Map<string, { users: Set<string>; events: number }>();
  for (const e of eventRows) {
    const day = e.created_at.slice(0, 10);
    const entry = byDay.get(day) ?? { users: new Set<string>(), events: 0 };
    if (e.user_id) entry.users.add(e.user_id);
    entry.events += 1;
    byDay.set(day, entry);
  }
  const dailyActive: DailyActivePoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key);
    dailyActive.push({ date: key, activeUsers: entry?.users.size ?? 0, events: entry?.events ?? 0 });
  }

  // month-over-month event volume
  const { data: monthEvents } = await supabase
    .from('usage_events')
    .select('created_at')
    .eq('workspace_id', workspaceId);
  const all = (monthEvents ?? []) as { created_at: string }[];
  const thisMonthEvents = all.filter((e) => e.created_at >= current.start && e.created_at <= current.end).length;
  const lastMonthEvents = all.filter((e) => e.created_at >= prev.start && e.created_at <= prev.end).length;
  const eventChangePercent =
    lastMonthEvents > 0 ? Math.round(((thisMonthEvents - lastMonthEvents) / lastMonthEvents) * 100) : thisMonthEvents > 0 ? 100 : 0;

  return {
    totalMembers,
    activeMembers30d,
    activeRate,
    dailyActive,
    thisMonthEvents,
    lastMonthEvents,
    eventChangePercent,
    nps: nps.data ?? empty.nps,
  };
}

export async function computeChurnSignals(workspaceId: string): Promise<ChurnSignal[]> {
  const admin = getSupabaseAdmin();
  if (!admin.client) return [];
  const supabase = admin.client;
  const signals: ChurnSignal[] = [];
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Scheduled cancellation
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id, plan, current_period_end, cancel_at_period_end, status')
    .eq('workspace_id', workspaceId);
  const active = (subs ?? []) as {
    id: string;
    plan: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    status: string;
  }[];
  const canceling = active.filter((s) => s.cancel_at_period_end && s.status === 'active');
  if (canceling.length > 0) {
    signals.push({
      signalType: 'cancel_scheduled',
      severity: 'critical',
      title: `${canceling.length} subscription(s) set to cancel`,
      message: `Plan(s) ${canceling.map((c) => c.plan).join(', ')} will end at period close. Trigger a win-back conversation.`,
      metadata: { count: canceling.length, plans: canceling.map((c) => c.plan) },
    });
  }

  // 2. Usage approaching/exceeding limits
  const { data: limits } = await supabase
    .from('usage_limits')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (limits) {
    const { data: counters } = await supabase
      .from('usage_counters')
      .select('quota_type, count')
      .eq('workspace_id', workspaceId);
    const usageByType = new Map<string, number>();
    for (const c of (counters ?? []) as { quota_type: string; count: number }[]) {
      usageByType.set(c.quota_type, (usageByType.get(c.quota_type) ?? 0) + c.count);
    }
    const limitRow = limits as unknown as UsageLimitRecord;
    for (const [quotaType, column] of Object.entries(LIMIT_COLUMN)) {
      const max = limitRow[column] as number | null;
      if (!max) continue;
      const used = usageByType.get(quotaType) ?? 0;
      const pct = Math.round((used / max) * 100);
      if (pct >= 100) {
        signals.push({
          signalType: `limit_exceeded_${quotaType}`,
          severity: 'critical',
          title: `${quotaType} limit exceeded`,
          message: `${used} of ${max} used (${pct}%).`,
          metadata: { quotaType, used, max, pct },
        });
      } else if (pct >= 85) {
        signals.push({
          signalType: `limit_critical_${quotaType}`,
          severity: 'warning',
          title: `${quotaType} near limit`,
          message: `${used} of ${max} used (${pct}%).`,
          metadata: { quotaType, used, max, pct },
        });
      }
    }
  }

  // 3. Inactivity
  const { count: totalMembers } = await supabase
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  const { data: recent } = await supabase
    .from('usage_events')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since30);
  const activeUsers = new Set((recent ?? []).map((r) => (r as { user_id: string | null }).user_id).filter(Boolean) as string[]).size;
  const total = totalMembers ?? 0;
  const inactive = total - activeUsers;
  if (total > 0 && inactive / total >= 0.5) {
    signals.push({
      signalType: 'inactivity',
      severity: inactive / total >= 0.75 ? 'critical' : 'warning',
      title: `${inactive} of ${total} members inactive (30d)`,
      message: `Engagement drop detected. Consider re-engagement and win-back outreach.`,
      metadata: { total, activeUsers, inactive, inactiveRate: Math.round((inactive / total) * 100) },
    });
  }

  // 4. Low NPS (detractors in last 30d)
  const { data: npsRows } = await supabase
    .from('nps_responses')
    .select('score, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since30);
  const detractors = ((npsRows ?? []) as { score: number }[]).filter((r) => r.score <= 6).length;
  if (detractors >= 3) {
    signals.push({
      signalType: 'low_nps',
      severity: 'warning',
      title: `${detractors} detractor NPS response(s) (30d)`,
      message: `Recent dissatisfaction signal. Review feedback and follow up.`,
      metadata: { detractors },
    });
  }

  return signals;
}

export async function getChurnRiskSummary(workspaceId: string): Promise<ChurnRiskSummary> {
  const signals = await computeChurnSignals(workspaceId);
  const admin = getSupabaseAdmin();
  let openAlerts = 0;
  let cancelScheduled = 0;
  if (admin.client) {
    const { count } = await admin.client
      .from('churn_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('acknowledged', false);
    openAlerts = count ?? 0;
    const { data: subs } = await admin.client
      .from('subscriptions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('cancel_at_period_end', true);
    cancelScheduled = (subs ?? []).length;
  }

  let score = 0;
  for (const s of signals) {
    if (s.signalType === 'cancel_scheduled') score += 30;
    else if (s.severity === 'critical') score += 20;
    else if (s.severity === 'warning') score += 10;
  }
  if (openAlerts > 0) score += Math.min(20, openAlerts * 5);
  score = Math.min(100, score);

  const level: ChurnRiskSummary['level'] =
    score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

  return { riskScore: score, level, signals, openAlerts, cancelScheduled };
}
