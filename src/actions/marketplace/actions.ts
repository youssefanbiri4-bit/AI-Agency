'use server';

import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';
import {
  searchMarketplaceAgents,
  getMarketplaceAgent,
  getFeaturedMarketplaceAgents,
  getMarketplaceCategories,
  getMarketplaceStats,
  getPublisherAnalytics,
  addAgentRating,
  getAgentRatings,
  setAgentPrice,
  recordAgentInstall,
  type MarketplaceSearchFilters,
} from '@/lib/data/marketplace';
import { cloneMarketplaceAgent, publishAgentBuilderAgent } from '@/lib/data/agent-builder';
import { logger } from '@/lib/logger';

const actionsLog = logger.child('actions:marketplace');

// ─── Search & Browse ────────────────────────────────────────────────

export interface MarketplaceActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function searchMarketplaceAction(
  filters: MarketplaceSearchFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<MarketplaceActionResult> {
  try {
    const result = await searchMarketplaceAgents(filters, page, pageSize);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('searchMarketplaceAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Search failed' };
  }
}

export async function getFeaturedAgentsAction(): Promise<MarketplaceActionResult> {
  try {
    const result = await getFeaturedMarketplaceAgents(6);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getFeaturedAgentsAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get featured agents' };
  }
}

export async function getMarketplaceCategoriesAction(): Promise<MarketplaceActionResult> {
  try {
    const result = await getMarketplaceCategories();
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getMarketplaceCategoriesAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get categories' };
  }
}

export async function getMarketplaceStatsAction(): Promise<MarketplaceActionResult> {
  try {
    const result = await getMarketplaceStats();
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getMarketplaceStatsAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get stats' };
  }
}

// ─── Agent Details ──────────────────────────────────────────────────

export async function getMarketplaceAgentAction(
  identifier: string,
  bySlug: boolean = false
): Promise<MarketplaceActionResult> {
  try {
    const result = await getMarketplaceAgent(identifier, bySlug);
    if (result.error) return { success: false, error: result.error };
    if (!result.data) return { success: false, error: 'Agent not found' };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getMarketplaceAgentAction failed', {
      identifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get agent' };
  }
}

// ─── Clone / Install ────────────────────────────────────────────────

export async function cloneMarketplaceAgentAction(
  agentId: string
): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'editor' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Access denied' };
    }

    const workspaceId = authResult.context.workspace.id;
    const userId = authResult.context.user.id;

    // Get the agent first
    const agentResult = await getMarketplaceAgent(agentId);
    if (agentResult.error || !agentResult.data) {
      return { success: false, error: 'Agent not found' };
    }

    // Clone to workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloneResult = await cloneMarketplaceAgent(agentResult.data as any, workspaceId, userId);
    if (cloneResult.error || !cloneResult.data) {
      return { success: false, error: cloneResult.error ?? 'Failed to clone agent' };
    }

    // Record install
    await recordAgentInstall(agentId, userId, workspaceId, 0);

    actionsLog.info('Cloned marketplace agent', {
      agentId,
      workspaceId,
      clonedId: cloneResult.data.id,
    });

    return { success: true, data: cloneResult.data };
  } catch (err) {
    actionsLog.error('cloneMarketplaceAgentAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to clone agent' };
  }
}

// ─── Publish Agent ──────────────────────────────────────────────────

export async function publishAgentToMarketplaceAction(
  agentId: string,
  priceUsd: number = 0
): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Admin access required to publish' };
    }

    const workspaceId = authResult.context.workspace.id;

    // Publish to marketplace
    const publishResult = await publishAgentBuilderAgent(agentId, workspaceId, 'marketplace');
    if (publishResult.error || !publishResult.data) {
      return { success: false, error: publishResult.error ?? 'Failed to publish agent' };
    }

    // Set price if paid
    if (priceUsd > 0) {
      await setAgentPrice(agentId, workspaceId, priceUsd);
    }

    actionsLog.info('Published agent to marketplace', {
      agentId,
      workspaceId,
      priceUsd,
    });

    return { success: true, data: publishResult.data };
  } catch (err) {
    actionsLog.error('publishAgentToMarketplaceAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish agent' };
  }
}

export async function unpublishAgentFromMarketplaceAction(
  agentId: string
): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Admin access required' };
    }

    const workspaceId = authResult.context.workspace.id;

    const result = await publishAgentBuilderAgent(agentId, workspaceId, 'workspace');
    if (result.error || !result.data) {
      return { success: false, error: result.error ?? 'Failed to unpublish agent' };
    }

    actionsLog.info('Unpublished agent from marketplace', { agentId, workspaceId });
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('unpublishAgentFromMarketplaceAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to unpublish agent' };
  }
}

// ─── Ratings & Reviews ──────────────────────────────────────────────

export async function addAgentRatingAction(
  agentId: string,
  rating: number,
  review?: string
): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Access denied' };
    }

    const userId = authResult.context.user.id;
    const userName = 'User'; // Would come from user profile

    const result = await addAgentRating(agentId, userId, userName, rating, review);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('addAgentRatingAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add rating' };
  }
}

export async function getAgentRatingsAction(
  agentId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<MarketplaceActionResult> {
  try {
    const result = await getAgentRatings(agentId, page, pageSize);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getAgentRatingsAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get ratings' };
  }
}

// ─── Publisher Analytics ────────────────────────────────────────────

export async function getPublisherAnalyticsAction(): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'viewer' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Access denied' };
    }

    const workspaceId = authResult.context.workspace.id;
    const result = await getPublisherAnalytics(workspaceId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('getPublisherAnalyticsAction failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to get analytics' };
  }
}

// ─── Pricing ────────────────────────────────────────────────────────

export async function setAgentPriceAction(
  agentId: string,
  priceUsd: number
): Promise<MarketplaceActionResult> {
  try {
    const authResult = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
    if (authResult.error || !authResult.context) {
      return { success: false, error: authResult.error ?? 'Admin access required' };
    }

    const workspaceId = authResult.context.workspace.id;
    const result = await setAgentPrice(agentId, workspaceId, priceUsd);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err) {
    actionsLog.error('setAgentPriceAction failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to set price' };
  }
}
