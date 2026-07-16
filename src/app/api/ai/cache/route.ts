import { NextResponse } from 'next/server';
import { getAICacheStats, invalidateAICache } from '@/lib/ai/ai-cache';
import { requireWorkspaceAccessWithRBAC } from '@/lib/auth/rbac';

export async function GET() {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = getAICacheStats();

  return NextResponse.json({
    cache: {
      size: stats.size,
      hitRate: Math.round(stats.hitRate * 100) / 100,
      hits: stats.hits,
      misses: stats.misses,
      evictions: stats.evictions,
    },
    cost: {
      totalSavedTokens: stats.totalSavedTokens,
      totalSavedCost: Math.round(stats.totalSavedCost * 10000) / 10000,
      estimatedMonthlySavings: Math.round(stats.totalSavedCost * 30 * 100) / 100,
    },
  });
}

export async function DELETE() {
  const rbac = await requireWorkspaceAccessWithRBAC({ minRole: 'admin' });
  if (!rbac.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invalidated = invalidateAICache();

  return NextResponse.json({
    success: true,
    invalidatedEntries: invalidated,
  });
}
