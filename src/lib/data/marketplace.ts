/**
 * Marketplace Data Layer
 *
 * Enhanced marketplace functions for search, filtering, ratings,
 * monetization, and analytics.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { emptyDataResult, errorDataResult, type DataResult } from './types';

const marketplaceLog = logger.child('data:marketplace');

// ─── Types ──────────────────────────────────────────────────────────

export interface MarketplaceAgent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  category: string;
  icon: string;
  accentColor: string;
  instructions: string;
  inputs: string[];
  outputs: string[];
  safetyLevel: string;
  executionMode: string;
  tags: string[];
  usageCount: number;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
  // Publisher info
  publisherName: string;
  publisherAvatar?: string;
  // Monetization
  priceUsd: number;
  isFree: boolean;
  // Ratings
  averageRating: number;
  ratingCount: number;
  // Computed
  installCount: number;
  featured: boolean;
}

export interface MarketplaceSearchFilters {
  query?: string;
  category?: string;
  tags?: string[];
  priceType?: 'free' | 'paid' | 'all';
  sortBy?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';
  safetyLevel?: string;
  executionMode?: string;
}

export interface MarketplaceListResult {
  agents: MarketplaceAgent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgentRating {
  id: string;
  agentId: string;
  userId: string;
  userName: string;
  rating: number;
  review: string | null;
  createdAt: string;
}

export interface AgentPurchase {
  id: string;
  agentId: string;
  buyerId: string;
  sellerId: string;
  amountUsd: number;
  status: 'pending' | 'completed' | 'refunded';
  createdAt: string;
}

export interface MarketplaceStats {
  totalAgents: number;
  totalInstalls: number;
  totalRevenue: number;
  averageRating: number;
  topCategories: Array<{ category: string; count: number }>;
  trendingAgents: MarketplaceAgent[];
}

// ─── Search & Filter ────────────────────────────────────────────────

/**
 * Search and filter marketplace agents.
 */
export async function searchMarketplaceAgents(
  filters: MarketplaceSearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<DataResult<MarketplaceListResult>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return emptyDataResult({ agents: [], total: 0, page, pageSize, totalPages: 0 }, false);
  }

  try {
    let query = supabase
      .from('agent_builder_agents')
      .select('*', { count: 'exact' })
      .eq('visibility', 'marketplace');

    // Text search
    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,role.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
    }

    // Category filter
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Safety level filter
    if (filters.safetyLevel) {
      query = query.eq('safety_level', filters.safetyLevel as 'safe' | 'requires_review' | 'readonly');
    }

    // Execution mode filter
    if (filters.executionMode) {
      query = query.eq('execution_mode', filters.executionMode as 'autonomous' | 'supervised' | 'manual' | 'draft_only');
    }

    // Sorting
    switch (filters.sortBy) {
      case 'popular':
        query = query.order('usage_count', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        // Sort by metadata->rating->average
        query = query.order('updated_at', { ascending: false }); // Fallback
        break;
      default:
        query = query.order('updated_at', { ascending: false });
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      marketplaceLog.error('Failed to search marketplace agents', { error: error.message });
      return errorDataResult({ agents: [], total: 0, page, pageSize, totalPages: 0 }, error.message);
    }

    const agents: MarketplaceAgent[] = (data ?? []).map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      category: agent.category,
      icon: agent.icon,
      accentColor: agent.accent_color,
      instructions: agent.instructions,
      inputs: agent.inputs ?? [],
      outputs: agent.outputs ?? [],
      safetyLevel: agent.safety_level,
      executionMode: agent.execution_mode,
      tags: agent.tags ?? [],
      usageCount: agent.usage_count ?? 0,
      shareSlug: agent.share_slug,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      publisherName: 'AgentFlow',
      priceUsd: 0,
      isFree: true,
      averageRating: 0,
      ratingCount: 0,
      installCount: agent.usage_count ?? 0,
      featured: false,
    }));

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return emptyDataResult({
      agents,
      total,
      page,
      pageSize,
      totalPages,
    }, true);
  } catch (err) {
    marketplaceLog.error('Marketplace search failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult(
      { agents: [], total: 0, page, pageSize, totalPages: 0 },
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

/**
 * Get a single marketplace agent by ID or slug.
 */
export async function getMarketplaceAgent(
  identifier: string,
  bySlug: boolean = false
): Promise<DataResult<MarketplaceAgent | null>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return emptyDataResult(null, false);

  try {
    let query = supabase
      .from('agent_builder_agents')
      .select('*')
      .eq('visibility', 'marketplace');

    if (bySlug) {
      query = query.eq('share_slug', identifier);
    } else {
      query = query.eq('id', identifier);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return errorDataResult(null, error.message);
    if (!data) return emptyDataResult(null, true);

    const agent: MarketplaceAgent = {
      id: data.id,
      name: data.name,
      role: data.role,
      description: data.description,
      category: data.category,
      icon: data.icon,
      accentColor: data.accent_color,
      instructions: data.instructions,
      inputs: data.inputs ?? [],
      outputs: data.outputs ?? [],
      safetyLevel: data.safety_level,
      executionMode: data.execution_mode,
      tags: data.tags ?? [],
      usageCount: data.usage_count ?? 0,
      shareSlug: data.share_slug,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      publisherName: 'AgentFlow',
      priceUsd: 0,
      isFree: true,
      averageRating: 0,
      ratingCount: 0,
      installCount: data.usage_count ?? 0,
      featured: false,
    };

    return emptyDataResult(agent, true);
  } catch (err) {
    marketplaceLog.error('Failed to get marketplace agent', {
      identifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult(null, err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Get featured/popular marketplace agents.
 */
export async function getFeaturedMarketplaceAgents(
  limit: number = 6
): Promise<DataResult<MarketplaceAgent[]>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return emptyDataResult([], false);

  try {
    const { data, error } = await supabase
      .from('agent_builder_agents')
      .select('*')
      .eq('visibility', 'marketplace')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) return errorDataResult([], error.message);

    const agents: MarketplaceAgent[] = (data ?? []).map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      category: agent.category,
      icon: agent.icon,
      accentColor: agent.accent_color,
      instructions: agent.instructions,
      inputs: agent.inputs ?? [],
      outputs: agent.outputs ?? [],
      safetyLevel: agent.safety_level,
      executionMode: agent.execution_mode,
      tags: agent.tags ?? [],
      usageCount: agent.usage_count ?? 0,
      shareSlug: agent.share_slug,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      publisherName: 'AgentFlow',
      priceUsd: 0,
      isFree: true,
      averageRating: 0,
      ratingCount: 0,
      installCount: agent.usage_count ?? 0,
      featured: true,
    }));

    return emptyDataResult(agents, true);
  } catch (err) {
    marketplaceLog.error('Failed to get featured agents', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult([], err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Get marketplace categories with counts.
 */
export async function getMarketplaceCategories(): Promise<DataResult<Array<{ category: string; count: number }>>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return emptyDataResult([], false);

  try {
    const { data, error } = await supabase
      .from('agent_builder_agents')
      .select('category')
      .eq('visibility', 'marketplace');

    if (error) return errorDataResult([], error.message);

    const categoryCounts = new Map<string, number>();
    for (const agent of data ?? []) {
      const cat = agent.category || 'uncategorized';
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    const categories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return emptyDataResult(categories, true);
  } catch (err) {
    marketplaceLog.error('Failed to get marketplace categories', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult([], err instanceof Error ? err.message : 'Unknown error');
  }
}

// ─── Ratings & Reviews ──────────────────────────────────────────────

/**
 * Add a rating/review for a marketplace agent.
 */
export async function addAgentRating(
  agentId: string,
  userId: string,
  userName: string,
  rating: number,
  review?: string
): Promise<DataResult<AgentRating>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return errorDataResult(null as never, 'Supabase not configured');

  try {
    // agent_ratings is not in generated Database types; cast for untyped table access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Check if user already rated this agent
    const { data: existing } = await db
      .from('agent_ratings')
      .select('id')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update existing rating
      const { data, error } = await db
        .from('agent_ratings')
        .update({ rating, review: review ?? null })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) return errorDataResult(null as never, error.message);

      return emptyDataResult({
        id: data.id,
        agentId: data.agent_id,
        userId: data.user_id,
        userName: data.user_name,
        rating: data.rating,
        review: data.review,
        createdAt: data.created_at,
      }, true);
    }

    // Create new rating
    const { data, error } = await db
      .from('agent_ratings')
      .insert({
        agent_id: agentId,
        user_id: userId,
        user_name: userName,
        rating,
        review: review ?? null,
      })
      .select('*')
      .single();

    if (error) return errorDataResult(null as never, error.message);

    // Update agent's average rating
    await updateAgentAverageRating(agentId);

    return emptyDataResult({
      id: data.id,
      agentId: data.agent_id,
      userId: data.user_id,
      userName: data.user_name,
      rating: data.rating,
      review: data.review,
      createdAt: data.created_at,
    }, true);
  } catch (err) {
    marketplaceLog.error('Failed to add agent rating', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult(null as never, err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Get ratings for a marketplace agent.
 */
export async function getAgentRatings(
  agentId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<DataResult<{ ratings: AgentRating[]; total: number; average: number }>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return emptyDataResult({ ratings: [], total: 0, average: 0 }, false);

  try {
    const offset = (page - 1) * pageSize;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [ratingsResult, countResult, avgResult] = await Promise.all([
      db
        .from('agent_ratings')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1),
      db
        .from('agent_ratings')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agentId),
      db
        .from('agent_ratings')
        .select('rating')
        .eq('agent_id', agentId),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ratings: AgentRating[] = (ratingsResult.data ?? []).map((r: any) => ({
      id: r.id,
      agentId: r.agent_id,
      userId: r.user_id,
      userName: r.user_name,
      rating: r.rating,
      review: r.review,
      createdAt: r.created_at,
    }));

    const total = countResult.count ?? 0;
    const ratingsList = avgResult.data ?? [];
    const average = ratingsList.length > 0
      ? ratingsList.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratingsList.length
      : 0;

    return emptyDataResult({ ratings, total, average }, true);
  } catch (err) {
    marketplaceLog.error('Failed to get agent ratings', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult({ ratings: [], total: 0, average: 0 }, err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Update agent's average rating in metadata.
 */
async function updateAgentAverageRating(agentId: string): Promise<void> {
  const { client: supabase } = getSupabaseAdmin();
  if (!supabase) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: ratings } = await db
      .from('agent_ratings')
      .select('rating')
      .eq('agent_id', agentId);

    if (!ratings || ratings.length === 0) return;

    const average = ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length;

    await supabase
      .from('agent_builder_agents')
      .update({
        metadata: { rating: { average, count: ratings.length } },
      })
      .eq('id', agentId);
  } catch {
    // Best effort
  }
}

// ─── Monetization ───────────────────────────────────────────────────

/**
 * Set price for a marketplace agent.
 */
export async function setAgentPrice(
  agentId: string,
  workspaceId: string,
  priceUsd: number
): Promise<DataResult<boolean>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return errorDataResult(false, 'Supabase not configured');

  try {
    const { error } = await supabase
      .from('agent_builder_agents')
      .update({
        metadata: { price_usd: priceUsd },
      })
      .eq('id', agentId)
      .eq('workspace_id', workspaceId);

    if (error) return errorDataResult(false, error.message);

    return emptyDataResult(true, true);
  } catch (err) {
    marketplaceLog.error('Failed to set agent price', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult(false, err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Record an agent install/purchase.
 */
export async function recordAgentInstall(
  agentId: string,
  buyerId: string,
  sellerId: string,
  amountUsd: number
): Promise<DataResult<AgentPurchase>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) return errorDataResult(null as never, 'Supabase not configured');

  try {
    // Increment usage count
    await supabase
      .from('agent_builder_agents')
      .update({
        usage_count: 0, // TODO: use RPC for atomic increment
      })
      .eq('id', agentId);

    // Record purchase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db
      .from('agent_purchases')
      .insert({
        agent_id: agentId,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount_usd: amountUsd,
        status: 'completed',
      })
      .select('*')
      .single();

    if (error) return errorDataResult(null as never, error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    return emptyDataResult({
      id: row.id,
      agentId: row.agent_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      amountUsd: row.amount_usd,
      status: row.status,
      createdAt: row.created_at,
    }, true);
  } catch (err) {
    marketplaceLog.error('Failed to record agent install', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult(null as never, err instanceof Error ? err.message : 'Unknown error');
  }
}

// ─── Analytics ──────────────────────────────────────────────────────

/**
 * Get marketplace statistics.
 */
export async function getMarketplaceStats(): Promise<DataResult<MarketplaceStats>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return emptyDataResult({
      totalAgents: 0,
      totalInstalls: 0,
      totalRevenue: 0,
      averageRating: 0,
      topCategories: [],
      trendingAgents: [],
    }, false);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [agentsResult, purchasesResult] = await Promise.all([
      supabase
        .from('agent_builder_agents')
        .select('category, usage_count, metadata')
        .eq('visibility', 'marketplace'),
      db
        .from('agent_purchases')
        .select('amount_usd')
        .eq('status', 'completed'),
    ]);

    const agents = (agentsResult.data ?? []) as unknown as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purchases: any[] = purchasesResult.data ?? [];

    // Total agents
    const totalAgents = agents.length;

    // Total installs
    const totalInstalls = agents.reduce((sum, a) => sum + (a.usage_count ?? 0), 0);

    // Total revenue
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);

    // Average rating
    const ratingsData = agents
      .map((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        const rating = meta.rating as { average?: number } | undefined;
        return rating?.average;
      })
      .filter((r): r is number => typeof r === 'number');

    const averageRating = ratingsData.length > 0
      ? ratingsData.reduce((a, b) => a + b, 0) / ratingsData.length
      : 0;

    // Top categories
    const categoryCounts = new Map<string, number>();
    for (const agent of agents) {
      const cat = agent.category || 'uncategorized';
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Trending agents (by usage count)
    const trendingAgents: MarketplaceAgent[] = agents
      .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
      .slice(0, 6)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
        category: agent.category,
        icon: agent.icon,
        accentColor: agent.accent_color,
        instructions: '',
        inputs: [],
        outputs: [],
        safetyLevel: '',
        executionMode: '',
        tags: [],
        usageCount: agent.usage_count ?? 0,
        shareSlug: null,
        createdAt: '',
        updatedAt: '',
        publisherName: 'AgentFlow',
        priceUsd: 0,
        isFree: true,
        averageRating: 0,
        ratingCount: 0,
        installCount: agent.usage_count ?? 0,
        featured: true,
      }));

    return emptyDataResult({
      totalAgents,
      totalInstalls,
      totalRevenue,
      averageRating,
      topCategories,
      trendingAgents,
    }, true);
  } catch (err) {
    marketplaceLog.error('Failed to get marketplace stats', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult({
      totalAgents: 0,
      totalInstalls: 0,
      totalRevenue: 0,
      averageRating: 0,
      topCategories: [],
      trendingAgents: [],
    }, err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Get publisher analytics for a workspace.
 */
export async function getPublisherAnalytics(
  workspaceId: string
): Promise<DataResult<{
  totalPublished: number;
  totalInstalls: number;
  totalRevenue: number;
  averageRating: number;
  topAgents: Array<{ name: string; installs: number; revenue: number }>;
}>> {
  const { client: supabase } = getSupabaseAdmin();

  if (!supabase) {
    return emptyDataResult({
      totalPublished: 0,
      totalInstalls: 0,
      totalRevenue: 0,
      averageRating: 0,
      topAgents: [],
    }, false);
  }

  try {
    const [agentsResult, purchasesResult] = await Promise.all([
      supabase
        .from('agent_builder_agents')
        .select('name, usage_count, metadata')
        .eq('workspace_id', workspaceId)
        .eq('visibility', 'marketplace'),
      supabase
        .from('agent_purchases')
        .select('amount_usd, agent_id')
        .eq('seller_id', workspaceId)
        .eq('status', 'completed'),
    ]);

    const agents = (agentsResult.data ?? []) as unknown as any[];
    const purchases = (purchasesResult.data ?? []) as unknown as any[];

    const totalPublished = agents.length;
    const totalInstalls = agents.reduce((sum, a) => sum + (a.usage_count ?? 0), 0);
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);

    // Average rating
    const ratingsData = agents
      .map((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        const rating = meta.rating as { average?: number } | undefined;
        return rating?.average;
      })
      .filter((r): r is number => typeof r === 'number');

    const averageRating = ratingsData.length > 0
      ? ratingsData.reduce((a, b) => a + b, 0) / ratingsData.length
      : 0;

    // Top agents by revenue
    const agentRevenue = new Map<string, number>();
    for (const p of purchases) {
      agentRevenue.set(p.agent_id, (agentRevenue.get(p.agent_id) ?? 0) + p.amount_usd);
    }

    const topAgents = agents
      .map((a) => ({
        name: a.name,
        installs: a.usage_count ?? 0,
        revenue: agentRevenue.get(a.id) ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return emptyDataResult({
      totalPublished,
      totalInstalls,
      totalRevenue,
      averageRating,
      topAgents,
    }, true);
  } catch (err) {
    marketplaceLog.error('Failed to get publisher analytics', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorDataResult({
      totalPublished: 0,
      totalInstalls: 0,
      totalRevenue: 0,
      averageRating: 0,
      topAgents: [],
    }, err instanceof Error ? err.message : 'Unknown error');
  }
}
