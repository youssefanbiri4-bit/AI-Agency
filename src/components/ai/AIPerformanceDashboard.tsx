'use client';

import { useState, useEffect } from 'react';
import { Activity, Database, Zap, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';

interface CacheStats {
  cache: {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
  };
  cost: {
    totalSavedTokens: number;
    totalSavedCost: number;
    estimatedMonthlySavings: number;
  };
}

export function AIPerformanceDashboard({ className }: { className?: string }) {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/cache');
      if (response.ok) {
        const data = await response.json();
        setCacheStats(data);
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    const loadStats = async () => {
      await fetchStats();
    };
    void loadStats();
    const interval = setInterval(() => {
      void fetchStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/ai/cache', { method: 'DELETE' });
      if (response.ok) {
        toast.success('Cache cleared');
        fetchStats();
      }
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">AI Performance</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={handleClearCache}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            Clear cache
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Cache Hit Rate"
          value={cacheStats ? `${cacheStats.cache.hitRate}%` : '—'}
          icon={Database}
          tone={cacheStats && cacheStats.cache.hitRate > 50 ? 'success' : 'warning'}
          subtitle={`${cacheStats?.cache.hits ?? 0} hits`}
        />
        <StatCard
          title="Cached Entries"
          value={cacheStats?.cache.size ?? 0}
          icon={Activity}
          tone="neutral"
          subtitle={`${cacheStats?.cache.evictions ?? 0} evictions`}
        />
        <StatCard
          title="Tokens Saved"
          value={cacheStats ? cacheStats.cost.totalSavedTokens.toLocaleString() : '—'}
          icon={Zap}
          tone="success"
          subtitle="Estimated"
        />
        <StatCard
          title="Cost Saved"
          value={cacheStats ? `$${cacheStats.cost.totalSavedCost.toFixed(4)}` : '—'}
          icon={TrendingUp}
          tone="success"
          subtitle={`$${cacheStats?.cost.estimatedMonthlySavings.toFixed(2)}/mo estimated`}
        />
      </div>

      <Card>
        <CardHeader
          title="Cache Performance"
          description="Real-time cache statistics and cost optimization"
        />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-surface p-3 text-center">
              <p className="text-2xl font-black text-foreground">{cacheStats?.cache.hits ?? 0}</p>
              <p className="text-[10px] font-bold uppercase text-foreground-muted">Cache Hits</p>
            </div>
            <div className="rounded-xl bg-surface p-3 text-center">
              <p className="text-2xl font-black text-foreground">{cacheStats?.cache.misses ?? 0}</p>
              <p className="text-[10px] font-bold uppercase text-foreground-muted">Cache Misses</p>
            </div>
            <div className="rounded-xl bg-surface p-3 text-center">
              <p className="text-2xl font-black text-foreground">{cacheStats?.cache.evictions ?? 0}</p>
              <p className="text-[10px] font-bold uppercase text-foreground-muted">Evictions</p>
            </div>
            <div className="rounded-xl bg-surface p-3 text-center">
              <p className="text-2xl font-black text-foreground">
                {cacheStats ? `${cacheStats.cache.hitRate}%` : '—'}
              </p>
              <p className="text-[10px] font-bold uppercase text-foreground-muted">Hit Rate</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-surface p-4">
            <h3 className="text-sm font-bold text-foreground">Cost Optimization</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">Total tokens saved</p>
                <p className="font-bold text-foreground">
                  {cacheStats?.cost.totalSavedTokens.toLocaleString() ?? '0'}
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Total cost saved</p>
                <p className="font-bold text-foreground">
                  ${cacheStats?.cost.totalSavedCost.toFixed(4) ?? '0.0000'}
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Estimated monthly savings</p>
                <p className="font-bold text-success">
                  ${cacheStats?.cost.estimatedMonthlySavings.toFixed(2) ?? '0.00'}
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Cache efficiency</p>
                <Badge tone={cacheStats && cacheStats.cache.hitRate > 30 ? 'success' : 'warning'}>
                  {cacheStats && cacheStats.cache.hitRate > 30 ? 'Good' : 'Needs more data'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
