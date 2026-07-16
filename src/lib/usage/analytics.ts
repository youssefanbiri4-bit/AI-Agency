/**
 * Usage Analytics Engine
 *
 * Provides consumption trends, per-member analytics, usage forecasting,
 * and anomaly detection for the Usage Analytics Dashboard.
 *
 * Integrates with Redis for caching and health snapshots for correlation.
 */

import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getRedisClient } from '@/lib/redis';
import type { QuotaType } from '@/lib/usage/quotas';

const ANALYTICS_CACHE_TTL = 300; // 5 minutes

export interface ConsumptionTrend {
  quotaType: QuotaType;
  label: string;
  currentPeriod: number;
  previousPeriod: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  dailyAverage: number;
  projectedMonthEnd: number;
  daysRemaining: number;
  status: 'healthy' | 'warning' | 'critical' | 'exceeded';
  limit: number | null;
}

export interface DailyConsumption {
  date: string;
  total: number;
  byType: Record<string, number>;
}

export interface MemberUsageAnalytics {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  totalUsage: number;
  byType: Record<string, number>;
  usagePercentOfTotal: number;
  avgDailyUsage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  alerts: UsageAlert[];
}

export interface UsageAlert {
  type: 'approaching_limit' | 'limit_exceeded' | 'unusual_spike' | 'inactive_member';
  severity: 'warning' | 'critical';
  quotaType?: string;
  message: string;
  current?: number;
  limit?: number | null;
  percentUsed?: number;
}

export interface UsageForecast {
  quotaType: QuotaType;
  label: string;
  currentUsage: number;
  limit: number | null;
  dailyRate: number;
  daysUntilLimit: number | null;
  projectedDate: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface UsageAnalyticsSummary {
  workspaceId: string;
  generatedAt: string;
  trends: ConsumptionTrend[];
  forecasts: UsageForecast[];
  memberAnalytics: MemberUsageAnalytics[];
  alerts: UsageAlert[];
  totalConsumption: {
    thisMonth: number;
    lastMonth: number;
    changePercent: number;
  };
  healthCorrelation: {
    healthScore: number | null;
    healthStatus: string | null;
    usageDuringDegradation: number;
  };
}

const QUOTA_LABELS: Record<string, string> = {
  ai_generations: 'AI Generations',
  tasks: 'Tasks',
  creative_assets: 'Creative Assets',
  content_items: 'Content Items',
  content_publishes: 'Content Publishes',
  reels_publishes: 'Reel Publishes',
  cost_usd: 'Estimated Cost',
};

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousMonthRange(date: Date): { start: string; end: string } {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getMonthRange(prev);
}

async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = ANALYTICS_CACHE_TTL
): Promise<T> {
  const redis = await getRedisClient();
  if (!redis) return fetcher();

  try {
    const cached = await redis.get(`analytics:${key}`);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Cache miss or error — proceed to fetch
  }

  const data = await fetcher();

  try {
    await redis.setex(`analytics:${key}`, ttl, JSON.stringify(data));
  } catch {
    // Cache write failure is non-critical
  }

  return data;
}

/**
 * Get consumption trends comparing current month to previous month.
 */
export async function getConsumptionTrends(workspaceId: string): Promise<ConsumptionTrend[]> {
  return getCachedOrFetch(`trends:${workspaceId}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) return [];

    const now = new Date();
    const currentRange = getMonthRange(now);
    const previousRange = getPreviousMonthRange(now);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    const quotaTypes: QuotaType[] = [
      'ai_generations', 'tasks', 'creative_assets',
      'content_items', 'content_publishes', 'reels_publishes',
    ];

    const { data: currentEvents } = await supabase
      .from('usage_events')
      .select('quota_type, amount')
      .eq('workspace_id', workspaceId)
      .gte('created_at', currentRange.start)
      .lte('created_at', currentRange.end);

    const { data: previousEvents } = await supabase
      .from('usage_events')
      .select('quota_type, amount')
      .eq('workspace_id', workspaceId)
      .gte('created_at', previousRange.start)
      .lte('created_at', previousRange.end);

    const currentByType: Record<string, number> = {};
    const previousByType: Record<string, number> = {};

    for (const event of currentEvents ?? []) {
      currentByType[event.quota_type] = (currentByType[event.quota_type] ?? 0) + (event.amount ?? 1);
    }
    for (const event of previousEvents ?? []) {
      previousByType[event.quota_type] = (previousByType[event.quota_type] ?? 0) + (event.amount ?? 1);
    }

    const { data: limitsData } = await supabase
      .from('usage_limits')
      .select('max_ai_generations_per_month, max_creative_assets, max_content_items, metadata')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const limitsMap: Record<string, number | null> = {};
    if (limitsData) {
      limitsMap.ai_generations = limitsData.max_ai_generations_per_month;
      limitsMap.creative_assets = limitsData.max_creative_assets;
      limitsMap.content_items = limitsData.max_content_items;
      const meta = (limitsData.metadata as Record<string, unknown>) ?? {};
      limitsMap.tasks = typeof meta.max_tasks === 'number' ? meta.max_tasks : 40;
      limitsMap.content_publishes = limitsMap.content_items;
      limitsMap.reels_publishes = typeof meta.max_reels_publishes_per_month === 'number'
        ? meta.max_reels_publishes_per_month : 10;
    }

    return quotaTypes.map((qt) => {
      const current = currentByType[qt] ?? 0;
      const previous = previousByType[qt] ?? 0;
      const changePercent = previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : current > 0 ? 100 : 0;
      const dailyAverage = dayOfMonth > 0 ? Math.round((current / dayOfMonth) * 10) / 10 : 0;
      const projectedMonthEnd = Math.round(dailyAverage * daysInMonth);
      const limit = limitsMap[qt] ?? null;

      let status: ConsumptionTrend['status'] = 'healthy';
      if (limit !== null) {
        const pct = (current / limit) * 100;
        if (pct >= 100) status = 'exceeded';
        else if (pct >= 95) status = 'critical';
        else if (pct >= 80) status = 'warning';
      }

      return {
        quotaType: qt,
        label: QUOTA_LABELS[qt] ?? qt,
        currentPeriod: current,
        previousPeriod: previous,
        changePercent,
        direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'flat',
        dailyAverage,
        projectedMonthEnd,
        daysRemaining,
        status,
        limit,
      };
    });
  });
}

/**
 * Get daily consumption data for chart rendering.
 */
export async function getDailyConsumption(
  workspaceId: string,
  days: number = 30
): Promise<DailyConsumption[]> {
  return getCachedOrFetch(`daily:${workspaceId}:${days}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) return [];

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

    const result: DailyConsumption[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const byType = dailyMap.get(dateStr) ?? {};
      const total = Object.values(byType).reduce((s, v) => s + v, 0);
      result.push({ date: dateStr, total, byType });
    }

    return result;
  });
}

/**
 * Get per-member usage analytics with alerts.
 */
export async function getMemberAnalytics(workspaceId: string): Promise<MemberUsageAnalytics[]> {
  return getCachedOrFetch(`members:${workspaceId}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) return [];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId);

    if (!members || members.length === 0) return [];

    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const { data: events } = await supabase
      .from('usage_events')
      .select('user_id, quota_type, amount, created_at')
      .eq('workspace_id', workspaceId)
      .not('user_id', 'is', null)
      .gte('created_at', monthStart.toISOString());

    const { data: limitsData } = await supabase
      .from('usage_limits')
      .select('max_ai_generations_per_month, max_creative_assets, max_content_items, metadata')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const limitsMap: Record<string, number | null> = {};
    if (limitsData) {
      limitsMap.ai_generations = limitsData.max_ai_generations_per_month;
      limitsMap.creative_assets = limitsData.max_creative_assets;
      limitsMap.content_items = limitsData.max_content_items;
      const meta = (limitsData.metadata as Record<string, unknown>) ?? {};
      limitsMap.tasks = typeof meta.max_tasks === 'number' ? meta.max_tasks : 40;
      limitsMap.content_publishes = limitsMap.content_items;
      limitsMap.reels_publishes = typeof meta.max_reels_publishes_per_month === 'number'
        ? meta.max_reels_publishes_per_month : 10;
    }

    const userUsageMap: Record<string, Record<string, number>> = {};
    const userDailyMap: Record<string, Map<string, number>> = {};

    for (const event of events ?? []) {
      if (!event.user_id) continue;
      if (!userUsageMap[event.user_id]) userUsageMap[event.user_id] = {};
      userUsageMap[event.user_id][event.quota_type] =
        (userUsageMap[event.user_id][event.quota_type] ?? 0) + (event.amount ?? 1);

      if (!userDailyMap[event.user_id]) userDailyMap[event.user_id] = new Map();
      const day = event.created_at.split('T')[0];
      userDailyMap[event.user_id].set(
        day,
        (userDailyMap[event.user_id].get(day) ?? 0) + (event.amount ?? 1)
      );
    }

    const totalAllUsage = Object.values(userUsageMap).reduce(
      (sum, usage) => sum + Object.values(usage).reduce((s, v) => s + v, 0),
      0
    );

    const dayOfMonth = new Date().getDate();

    const result: MemberUsageAnalytics[] = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      const usage = userUsageMap[m.user_id] ?? {};
      const totalUsage = Object.values(usage).reduce((s, v) => s + v, 0);
      const dailyMap = userDailyMap[m.user_id] ?? new Map();

      const dailyValues = Array.from(dailyMap.values());
      const recentDays = dailyValues.slice(-7);
      const olderDays = dailyValues.slice(0, -7);
      const recentAvg = recentDays.length > 0
        ? recentDays.reduce((s, v) => s + v, 0) / recentDays.length : 0;
      const olderAvg = olderDays.length > 0
        ? olderDays.reduce((s, v) => s + v, 0) / olderDays.length : recentAvg;

      let trend: MemberUsageAnalytics['trend'] = 'stable';
      if (recentAvg > olderAvg * 1.2) trend = 'increasing';
      else if (recentAvg < olderAvg * 0.8) trend = 'decreasing';

      const alerts: UsageAlert[] = [];
      for (const [qt, used] of Object.entries(usage)) {
        const limit = limitsMap[qt];
        if (limit !== null && limit !== undefined && limit > 0) {
          const pct = (used / limit) * 100;
          if (pct >= 100) {
            alerts.push({
              type: 'limit_exceeded',
              severity: 'critical',
              quotaType: qt,
              message: `${QUOTA_LABELS[qt] ?? qt} limit exceeded`,
              current: used,
              limit,
              percentUsed: Math.round(pct),
            });
          } else if (pct >= 80) {
            alerts.push({
              type: 'approaching_limit',
              severity: pct >= 95 ? 'critical' : 'warning',
              quotaType: qt,
              message: `${QUOTA_LABELS[qt] ?? qt} at ${Math.round(pct)}%`,
              current: used,
              limit,
              percentUsed: Math.round(pct),
            });
          }
        }
      }

      if (totalUsage === 0 && dayOfMonth > 3) {
        alerts.push({
          type: 'inactive_member',
          severity: 'warning',
          message: 'No usage recorded this month',
        });
      }

      return {
        userId: m.user_id,
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? null,
        role: m.role,
        totalUsage,
        byType: usage,
        usagePercentOfTotal: totalAllUsage > 0
          ? Math.round((totalUsage / totalAllUsage) * 100) : 0,
        avgDailyUsage: dayOfMonth > 0
          ? Math.round((totalUsage / dayOfMonth) * 10) / 10 : 0,
        trend,
        alerts,
      };
    });

    return result.sort((a, b) => b.totalUsage - a.totalUsage);
  });
}

/**
 * Generate usage forecasts for each quota type.
 */
export async function getUsageForecasts(workspaceId: string): Promise<UsageForecast[]> {
  return getCachedOrFetch(`forecasts:${workspaceId}`, async () => {
    const { client: supabase } = getSupabaseAdmin();
    if (!supabase) return [];

    const now = new Date();
    const dayOfMonth = now.getDate();

    const trends = await getConsumptionTrends(workspaceId);

    return trends
      .filter((t) => t.quotaType !== 'cost_usd')
      .map((t) => {
        const limit = (() => {
          switch (t.quotaType) {
            case 'ai_generations': return 20;
            case 'tasks': return 40;
            case 'creative_assets': return 50;
            case 'content_items': return 30;
            case 'content_publishes': return 30;
            case 'reels_publishes': return 10;
            default: return null;
          }
        })();

        const dailyRate = dayOfMonth > 0 ? t.currentPeriod / dayOfMonth : 0;
        let daysUntilLimit: number | null = null;
        let projectedDate: string | null = null;
        let confidence: UsageForecast['confidence'] = 'medium';

        if (limit !== null && dailyRate > 0) {
          const remaining = limit - t.currentPeriod;
          if (remaining <= 0) {
            daysUntilLimit = 0;
          } else {
            daysUntilLimit = Math.ceil(remaining / dailyRate);
            const projDate = new Date(now);
            projDate.setDate(projDate.getDate() + daysUntilLimit);
            projectedDate = projDate.toISOString().split('T')[0];
          }
          confidence = dayOfMonth >= 15 ? 'high' : 'medium';
        } else if (dailyRate === 0) {
          confidence = 'low';
        }

        return {
          quotaType: t.quotaType,
          label: t.label,
          currentUsage: t.currentPeriod,
          limit,
          dailyRate: Math.round(dailyRate * 10) / 10,
          daysUntilLimit,
          projectedDate,
          confidence,
        };
      });
  });
}

/**
 * Get all analytics data in a single call (for the dashboard).
 */
export async function getUsageAnalyticsSummary(
  workspaceId: string
): Promise<UsageAnalyticsSummary> {
  const [trends, forecasts, memberAnalytics, dailyConsumption] = await Promise.all([
    getConsumptionTrends(workspaceId),
    getUsageForecasts(workspaceId),
    getMemberAnalytics(workspaceId),
    getDailyConsumption(workspaceId, 30),
  ]);

  const thisMonthTotal = dailyConsumption
    .filter((d) => {
      const date = new Date(d.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, d) => sum + d.total, 0);

  const lastMonthTotal = dailyConsumption
    .filter((d) => {
      const date = new Date(d.date);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear();
    })
    .reduce((sum, d) => sum + d.total, 0);

  const changePercent = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : thisMonthTotal > 0 ? 100 : 0;

  const allAlerts: UsageAlert[] = [];
  memberAnalytics.forEach((m) => allAlerts.push(...m.alerts));
  trends.forEach((t) => {
    if (t.status === 'exceeded') {
      allAlerts.push({
        type: 'limit_exceeded',
        severity: 'critical',
        quotaType: t.quotaType,
        message: `${t.label} limit exceeded (${t.currentPeriod} used)`,
        current: t.currentPeriod,
        limit: t.limit,
        percentUsed: t.limit ? Math.round((t.currentPeriod / t.limit) * 100) : undefined,
      });
    } else if (t.status === 'critical') {
      allAlerts.push({
        type: 'approaching_limit',
        severity: 'critical',
        quotaType: t.quotaType,
        message: `${t.label} at critical level`,
        current: t.currentPeriod,
        limit: t.limit,
        percentUsed: t.limit ? Math.round((t.currentPeriod / t.limit) * 100) : undefined,
      });
    }
  });

  let healthScore: number | null = null;
  let healthStatus: string | null = null;
  let usageDuringDegradation = 0;

  try {
    const { getLatestHealthSnapshot } = await import('@/lib/db/health-snapshot');
    const snapshot = await getLatestHealthSnapshot(workspaceId);
    if (snapshot) {
      healthScore = snapshot.score;
      healthStatus = snapshot.status;
      if (snapshot.status !== 'healthy') {
        usageDuringDegradation = thisMonthTotal;
      }
    }
  } catch {
    // Health snapshot not available
  }

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    trends,
    forecasts,
    memberAnalytics,
    alerts: allAlerts,
    totalConsumption: {
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal,
      changePercent,
    },
    healthCorrelation: {
      healthScore,
      healthStatus,
      usageDuringDegradation,
    },
  };
}

/**
 * Export analytics data as CSV string.
 */
export function exportUsageCsv(
  trends: ConsumptionTrend[],
  memberAnalytics: MemberUsageAnalytics[],
  dailyConsumption: DailyConsumption[]
): string {
  const lines: string[] = [];

  lines.push('=== USAGE TRENDS ===');
  lines.push('Quota Type,Current Period,Previous Period,Change %,Daily Avg,Projected Month End,Status');
  for (const t of trends) {
    lines.push([
      t.label,
      t.currentPeriod,
      t.previousPeriod,
      `${t.changePercent}%`,
      t.dailyAverage,
      t.projectedMonthEnd,
      t.status,
    ].join(','));
  }

  lines.push('');
  lines.push('=== TEAM MEMBER USAGE ===');
  lines.push('Member,Email,Role,AI Gen,Tasks,Assets,Content,Publishes,Reels,Total,% of Total,Avg Daily,Trend');
  for (const m of memberAnalytics) {
    lines.push([
      m.fullName ?? m.email ?? 'Unknown',
      m.email ?? '',
      m.role,
      m.byType.ai_generations ?? 0,
      m.byType.tasks ?? 0,
      m.byType.creative_assets ?? 0,
      m.byType.content_items ?? 0,
      m.byType.content_publishes ?? 0,
      m.byType.reels_publishes ?? 0,
      m.totalUsage,
      `${m.usagePercentOfTotal}%`,
      m.avgDailyUsage,
      m.trend,
    ].join(','));
  }

  lines.push('');
  lines.push('=== DAILY CONSUMPTION ===');
  lines.push('Date,Total,AI Gen,Tasks,Assets,Content,Publishes,Reels');
  for (const d of dailyConsumption) {
    lines.push([
      d.date,
      d.total,
      d.byType.ai_generations ?? 0,
      d.byType.tasks ?? 0,
      d.byType.creative_assets ?? 0,
      d.byType.content_items ?? 0,
      d.byType.content_publishes ?? 0,
      d.byType.reels_publishes ?? 0,
    ].join(','));
  }

  return lines.join('\n');
}
