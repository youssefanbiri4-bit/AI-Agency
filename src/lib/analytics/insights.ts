/**
 * Advanced Analytics & Insights Engine
 *
 * W15-T2: Senior Analytics Engineer deliverable.
 *
 * Provides:
 *  - Usage trends + forecasting (Redis-cached daily series + least-squares
 *    forecast with R² confidence band).
 *  - Churn prediction + per-member risk scores (recency/frequency/decay model).
 *  - Team performance dashboard (task throughput, completion rate, cycle time,
 *    department breakdown).
 *  - Exportable CSV serializer for the insights report.
 *
 * All reads go through the admin (service-role) client and are cached in Redis
 * (with in-memory fallback when Redis is unavailable), mirroring the existing
 * usage analytics engine in src/lib/usage/analytics.ts.
 */

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getRedisClient } from '@/lib/redis';

const INSIGHTS_CACHE_TTL = 300; // 5 minutes
const MAX_DAILY_POINTS = 180;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DailyUsagePoint {
  date: string; // YYYY-MM-DD
  total: number;
  byType: Record<string, number>;
}

export interface UsageForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface UsageTrendsForecast {
  daily: DailyUsagePoint[];
  forecast: UsageForecastPoint[];
  totalLast30: number;
  totalPrev30: number;
  changePercent: number;
  /** R² of the least-squares fit (0..1) — forecast confidence signal. */
  fitQuality: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export type ChurnSegment = 'healthy' | 'watch' | 'at_risk' | 'churn_risk';

export interface ChurnRiskScore {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  department: string | null;
  riskScore: number; // 0..100 (higher = more likely to churn)
  segment: ChurnSegment;
  daysSinceLastActivity: number | null;
  monthlyUsage: number;
  prevMonthlyUsage: number;
  usageDeltaPercent: number;
  signals: string[];
}

export interface TeamPerformanceMember {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  department: string | null;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completionRate: number; // 0..100
  avgCycleHours: number | null;
  tasksLast30: number;
}

export interface DepartmentPerformance {
  department: string;
  members: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface TeamPerformance {
  members: TeamPerformanceMember[];
  byDepartment: DepartmentPerformance[];
  totals: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    completionRate: number;
    activeMembers: number;
  };
}

export interface InsightsSummary {
  workspaceId: string;
  generatedAt: string;
  usage: UsageTrendsForecast;
  churn: {
    scores: ChurnRiskScore[];
    segments: Record<ChurnSegment, number>;
    averageRisk: number;
  };
  team: TeamPerformance;
}

// ─── Redis cache helper ──────────────────────────────────────────────────────

async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = INSIGHTS_CACHE_TTL
): Promise<T> {
  const redis = await getRedisClient();
  if (!redis) return fetcher();

  try {
    const cached = await redis.get(`insights:${key}`);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // cache miss / error — proceed to fetch
  }

  const data = await fetcher();
  try {
    await redis.setex(`insights:${key}`, ttl, JSON.stringify(data));
  } catch {
    // cache write failure is non-critical
  }
  return data;
}

// ─── Least-squares forecast ──────────────────────────────────────────────────

/**
 * Simple ordinary-least-squares linear regression over an integer-indexed
 * series. Returns the predicted next `horizon` points plus a +/- 1 std-dev band
 * and the R² fit quality (0..1).
 */
function linearForecast(
  series: number[],
  horizon: number
): { forecast: UsageForecastPoint[]; fitQuality: number } {
  const n = series.length;
  if (n < 3) {
    const last = series[n - 1] ?? 0;
    return {
      forecast: Array.from({ length: horizon }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return {
          date: d.toISOString().split('T')[0],
          predicted: Math.max(0, Math.round(last)),
          lower: Math.max(0, Math.round(last)),
          upper: Math.max(0, Math.round(last)),
        };
      }),
      fitQuality: 0,
    };
  }

  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xMean) * (series[i] - yMean);
    sxx += (i - xMean) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;

  // R²
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * i + intercept;
    ssTot += (series[i] - yMean) ** 2;
    ssRes += (series[i] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  // Residual std-dev for the confidence band
  const residualStd = Math.sqrt(Math.max(ssRes / Math.max(1, n - 2), 0));

  const forecast: UsageForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = n - 1 + h;
    const pred = Math.max(0, slope * idx + intercept);
    const band = Math.sqrt(idx) * residualStd;
    const d = new Date();
    d.setDate(d.getDate() + h);
    forecast.push({
      date: d.toISOString().split('T')[0],
      predicted: Math.round(pred),
      lower: Math.max(0, Math.round(pred - band)),
      upper: Math.max(0, Math.round(pred + band)),
    });
  }

  return { forecast, fitQuality: Math.round(r2 * 100) / 100 };
}

// ─── Usage trends + forecast ─────────────────────────────────────────────────

export async function getUsageTrendsForecast(
  workspaceId: string,
  days: number = 90,
  forecastDays: number = 14
): Promise<UsageTrendsForecast> {
  return getCachedOrFetch(`usage:${workspaceId}:${days}:${forecastDays}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) {
      return {
        daily: [],
        forecast: [],
        totalLast30: 0,
        totalPrev30: 0,
        changePercent: 0,
        fitQuality: 0,
        trendDirection: 'flat',
      };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const { data: events } = await supabase
      .from('usage_events')
      .select('quota_type, amount, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap = new Map<string, Record<string, number>>();
    for (const event of events ?? []) {
      const date = event.created_at.split('T')[0];
      if (!dailyMap.has(date)) dailyMap.set(date, {});
      const day = dailyMap.get(date)!;
      day[event.quota_type] = (day[event.quota_type] ?? 0) + (event.amount ?? 1);
    }

    const daily: DailyUsagePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const byType = dailyMap.get(dateStr) ?? {};
      const total = Object.values(byType).reduce((s, v) => s + v, 0);
      daily.push({ date: dateStr, total, byType });
    }

    const series = daily.map((d) => d.total);
    const { forecast, fitQuality } = linearForecast(series, forecastDays);

    const last30 = daily.slice(-30);
    const prev30 = daily.slice(-60, -30);
    const totalLast30 = last30.reduce((s, d) => s + d.total, 0);
    const totalPrev30 = prev30.reduce((s, d) => s + d.total, 0);
    const changePercent = totalPrev30 > 0
      ? Math.round(((totalLast30 - totalPrev30) / totalPrev30) * 100)
      : totalLast30 > 0 ? 100 : 0;

    // 7-day moving average slope → trend direction
    const recent = series.slice(-7);
    const earlier = series.slice(-14, -7);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / Math.max(1, earlier.length);
    const trendDirection: UsageTrendsForecast['trendDirection'] =
      recentAvg > earlierAvg * 1.1 ? 'up' :
      recentAvg < earlierAvg * 0.9 ? 'down' : 'flat';

    return {
      daily: daily.slice(-MAX_DAILY_POINTS),
      forecast,
      totalLast30,
      totalPrev30,
      changePercent,
      fitQuality,
      trendDirection,
    };
  });
}

// ─── Churn risk scoring ──────────────────────────────────────────────────────

function segmentForScore(score: number): ChurnSegment {
  if (score >= 70) return 'churn_risk';
  if (score >= 45) return 'at_risk';
  if (score >= 25) return 'watch';
  return 'healthy';
}

export async function getChurnRiskScores(workspaceId: string): Promise<ChurnRiskScore[]> {
  return getCachedOrFetch(`churn:${workspaceId}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) return [];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, department')
      .eq('workspace_id', workspaceId);
    if (!members || members.length === 0) return [];

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Most recent activity per user (usage_events + tasks created_at)
    const [{ data: lastEvents }, { data: lastTasks }, { data: monthEvents }, { data: prevEvents }] =
      await Promise.all([
        supabase
          .from('usage_events')
          .select('user_id, created_at')
          .eq('workspace_id', workspaceId)
          .not('user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1_000),
        supabase
          .from('tasks')
          .select('user_id, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1_000),
        supabase
          .from('usage_events')
          .select('user_id, amount')
          .eq('workspace_id', workspaceId)
          .not('user_id', 'is', null)
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('usage_events')
          .select('user_id, amount')
          .eq('workspace_id', workspaceId)
          .not('user_id', 'is', null)
          .gte('created_at', prevMonthStart.toISOString())
          .lt('created_at', monthStart.toISOString()),
      ]);

    // Latest activity timestamp per user (max of last event / last task)
    const lastActivity = new Map<string, string>();
    const recordActivity = (rows: Array<{ user_id: string | null; created_at: string }> | null) => {
      for (const r of rows ?? []) {
        if (!r.user_id) continue;
        const cur = lastActivity.get(r.user_id);
        if (!cur || r.created_at > cur) lastActivity.set(r.user_id, r.created_at);
      }
    };
    recordActivity(lastEvents as Array<{ user_id: string | null; created_at: string }> | null);
    recordActivity(lastTasks as Array<{ user_id: string | null; created_at: string }> | null);

    const monthUsage = new Map<string, number>();
    for (const e of monthEvents ?? []) {
      if (!e.user_id) continue;
      monthUsage.set(e.user_id, (monthUsage.get(e.user_id) ?? 0) + (e.amount ?? 1));
    }
    const prevUsage = new Map<string, number>();
    for (const e of prevEvents ?? []) {
      if (!e.user_id) continue;
      prevUsage.set(e.user_id, (prevUsage.get(e.user_id) ?? 0) + (e.amount ?? 1));
    }

    const now = Date.now();
    const scores: ChurnRiskScore[] = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      const last = lastActivity.get(m.user_id) ?? null;
      const daysSince = last
        ? Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const monthly = monthUsage.get(m.user_id) ?? 0;
      const prev = prevUsage.get(m.user_id) ?? 0;
      const usageDeltaPercent = prev > 0
        ? Math.round(((monthly - prev) / prev) * 100)
        : monthly > 0 ? 100 : 0;

      const signals: string[] = [];
      let score = 0;

      // Recency component (up to 45 pts)
      if (daysSince === null) {
        score += 45;
        signals.push('Never active in this workspace');
      } else if (daysSince >= 30) {
        score += 45;
        signals.push(`No activity for ${daysSince} days`);
      } else if (daysSince >= 14) {
        score += 28;
        signals.push(`Inactive for ${daysSince} days`);
      } else if (daysSince >= 7) {
        score += 14;
      }

      // Usage decay component (up to 35 pts)
      if (prev > 0 && monthly < prev * 0.5) {
        score += 35;
        signals.push(`Usage dropped ${Math.abs(usageDeltaPercent)}% vs last month`);
      } else if (prev > 0 && monthly < prev * 0.8) {
        score += 18;
        signals.push(`Usage down ${Math.abs(usageDeltaPercent)}% vs last month`);
      } else if (prev === 0 && monthly === 0) {
        score += 25;
        signals.push('No usage this month');
      }

      // Volume component (up to 20 pts) — low absolute usage adds risk
      if (monthly === 0 && (prev > 0 || daysSince === null)) {
        score += 20;
      } else if (monthly > 0 && monthly < 5) {
        score += 10;
      }

      score = Math.max(0, Math.min(100, score));

      return {
        userId: m.user_id,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        role: m.role,
        department: m.department ?? null,
        riskScore: score,
        segment: segmentForScore(score),
        daysSinceLastActivity: daysSince,
        monthlyUsage: monthly,
        prevMonthlyUsage: prev,
        usageDeltaPercent,
        signals,
      };
    });

    return scores.sort((a, b) => b.riskScore - a.riskScore);
  });
}

// ─── Team performance ────────────────────────────────────────────────────────

export async function getTeamPerformance(workspaceId: string): Promise<TeamPerformance> {
  return getCachedOrFetch(`team:${workspaceId}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) {
      return { members: [], byDepartment: [], totals: emptyTotals() };
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, department')
      .eq('workspace_id', workspaceId);
    if (!members || members.length === 0) {
      return { members: [], byDepartment: [], totals: emptyTotals() };
    }

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const { data: tasks } = await supabase
      .from('tasks')
      .select('user_id, status, created_at, completed_at, agent_type')
      .eq('workspace_id', workspaceId);

    const memberAgg = new Map<string, {
      total: number; completed: number; failed: number;
      cycleMsTotal: number; cycleCount: number; last30: number;
    }>();
    for (const m of members) {
      memberAgg.set(m.user_id, { total: 0, completed: 0, failed: 0, cycleMsTotal: 0, cycleCount: 0, last30: 0 });
    }

    const deptAgg = new Map<string, { members: Set<string>; total: number; completed: number }>();

    for (const t of tasks ?? []) {
      if (!t.user_id || !memberAgg.has(t.user_id)) continue;
      const agg = memberAgg.get(t.user_id)!;
      agg.total += 1;
      if (t.status === 'completed') {
        agg.completed += 1;
        if (t.completed_at && t.created_at) {
          const ms = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
          if (ms >= 0) {
            agg.cycleMsTotal += ms;
            agg.cycleCount += 1;
          }
        }
      } else if (t.status === 'failed') {
        agg.failed += 1;
      }
      if (t.created_at >= monthStart.toISOString()) agg.last30 += 1;

      const dept = t.agent_type ?? 'unassigned';
      if (!deptAgg.has(dept)) deptAgg.set(dept, { members: new Set(), total: 0, completed: 0 });
      const d = deptAgg.get(dept)!;
      d.total += 1;
      if (t.status === 'completed') d.completed += 1;
      d.members.add(t.user_id);
    }

    const memberList: TeamPerformanceMember[] = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      const agg = memberAgg.get(m.user_id)!;
      const completionRate = agg.total > 0
        ? Math.round((agg.completed / agg.total) * 100) : 0;
      const avgCycleHours = agg.cycleCount > 0
        ? Math.round((agg.cycleMsTotal / agg.cycleCount / (1000 * 60 * 60)) * 10) / 10 : null;

      return {
        userId: m.user_id,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        role: m.role,
        department: m.department ?? null,
        totalTasks: agg.total,
        completedTasks: agg.completed,
        failedTasks: agg.failed,
        completionRate,
        avgCycleHours,
        tasksLast30: agg.last30,
      };
    }).sort((a, b) => b.totalTasks - a.totalTasks);

    const byDepartment: DepartmentPerformance[] = Array.from(deptAgg.entries()).map(([department, d]) => ({
      department,
      members: d.members.size,
      totalTasks: d.total,
      completedTasks: d.completed,
      completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    })).sort((a, b) => b.totalTasks - a.totalTasks);

    const totals = memberList.reduce((acc, m) => {
      acc.totalTasks += m.totalTasks;
      acc.completedTasks += m.completedTasks;
      acc.failedTasks += m.failedTasks;
      if (m.totalTasks > 0) acc.activeMembers += 1;
      return acc;
    }, emptyTotals());

    totals.completionRate = totals.totalTasks > 0
      ? Math.round((totals.completedTasks / totals.totalTasks) * 100) : 0;

    return { members: memberList, byDepartment, totals };
  });
}

function emptyTotals() {
  return { totalTasks: 0, completedTasks: 0, failedTasks: 0, completionRate: 0, activeMembers: 0 };
}

// ─── Aggregate summary ───────────────────────────────────────────────────────

export async function getInsightsSummary(workspaceId: string): Promise<InsightsSummary> {
  const [usage, churn, team] = await Promise.all([
    getUsageTrendsForecast(workspaceId),
    getChurnRiskScores(workspaceId),
    getTeamPerformance(workspaceId),
  ]);

  const segments: Record<ChurnSegment, number> = {
    healthy: 0, watch: 0, at_risk: 0, churn_risk: 0,
  };
  for (const c of churn) segments[c.segment] += 1;
  const averageRisk = churn.length > 0
    ? Math.round(churn.reduce((s, c) => s + c.riskScore, 0) / churn.length)
    : 0;

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    usage,
    churn: { scores: churn, segments, averageRisk },
    team,
  };
}

// ─── CSV export ──────────────────────────────────────────────────────────────

export function exportInsightsCsv(summary: InsightsSummary): string {
  const lines: string[] = [];
  lines.push('=== USAGE TRENDS & FORECAST ===');
  lines.push('Date,Total,Type Breakdown');
  for (const d of summary.usage.daily) {
    const breakdown = Object.entries(d.byType)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    lines.push([d.date, d.total, breakdown].join(','));
  }
  lines.push('');
  lines.push('Forecast Date,Predicted,Lower,Upper');
  for (const f of summary.usage.forecast) {
    lines.push([f.date, f.predicted, f.lower, f.upper].join(','));
  }

  lines.push('');
  lines.push('=== CHURN RISK SCORES ===');
  lines.push('Member,Email,Role,Department,Risk Score,Segment,Days Inactive,This Month,Last Month,Usage Δ %,Signals');
  for (const c of summary.churn.scores) {
    lines.push([
      c.fullName ?? c.email ?? 'Unknown',
      c.email ?? '',
      c.role,
      c.department ?? '',
      c.riskScore,
      c.segment,
      c.daysSinceLastActivity ?? '',
      c.monthlyUsage,
      c.prevMonthlyUsage,
      `${c.usageDeltaPercent}%`,
      `"${c.signals.join(' | ')}"`,
    ].join(','));
  }

  lines.push('');
  lines.push('=== TEAM PERFORMANCE ===');
  lines.push('Member,Email,Role,Department,Total Tasks,Completed,Failed,Completion %,Avg Cycle (h),Last 30d');
  for (const m of summary.team.members) {
    lines.push([
      m.fullName ?? m.email ?? 'Unknown',
      m.email ?? '',
      m.role,
      m.department ?? '',
      m.totalTasks,
      m.completedTasks,
      m.failedTasks,
      m.completionRate,
      m.avgCycleHours ?? '',
      m.tasksLast30,
    ].join(','));
  }

  lines.push('');
  lines.push('=== DEPARTMENT PERFORMANCE ===');
  lines.push('Department,Members,Total Tasks,Completed,Completion %');
  for (const d of summary.team.byDepartment) {
    lines.push([d.department, d.members, d.totalTasks, d.completedTasks, d.completionRate].join(','));
  }

  return lines.join('\n');
}
