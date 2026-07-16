'use client';

import { useState } from 'react';
import { DollarSign, CreditCard, Lock, Unlock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/FormControls';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface MonetizationPanelProps {
  agentId: string;
  currentPrice: number;
  isFree: boolean;
  totalInstalls: number;
  totalRevenue: number;
  onPriceChange?: (priceUsd: number) => Promise<void>;
  className?: string;
}

export function MonetizationPanel({
  agentId: _agentId,
  currentPrice,
  isFree,
  totalInstalls,
  totalRevenue,
  onPriceChange,
  className,
}: MonetizationPanelProps) {
  const [price, setPrice] = useState(currentPrice.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onPriceChange) return;
    setSaving(true);
    try {
      const priceUsd = parseFloat(price) || 0;
      await onPriceChange(priceUsd);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader
        title="Monetization Settings"
        description="Set pricing for your marketplace agent"
      />
      <div className="space-y-4 p-6">
        {/* Current Status */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            {isFree ? (
              <Unlock className="h-5 w-5 text-success" />
            ) : (
              <Lock className="h-5 w-5 text-warning" />
            )}
            <div>
              <p className="font-bold text-foreground">
                {isFree ? 'Free Agent' : `Priced at $${currentPrice}`}
              </p>
              <p className="text-sm text-foreground-muted">
                {totalInstalls} installs · ${totalRevenue.toFixed(2)} revenue
              </p>
            </div>
          </div>
          <Badge tone={isFree ? 'success' : 'warning'}>
            {isFree ? 'Free' : 'Paid'}
          </Badge>
        </div>

        {/* Price Setting */}
        <div>
          <label className="mb-2 block text-sm font-bold text-foreground">
            Set Price (USD)
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00 for free"
                className="pl-10"
              />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Price'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-foreground-muted">
            Set to $0 to make free. Minimum: $0.99 for paid agents.
          </p>
        </div>

        {/* Revenue Projection */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h4 className="mb-3 flex items-center gap-2 font-bold text-foreground">
            <TrendingUp className="h-4 w-4" />
            Revenue Projection
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">
                ${(totalInstalls * (parseFloat(price) || 0) * 0.7).toFixed(0)}
              </p>
              <p className="text-xs text-foreground-muted">If 100 installs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                ${(totalInstalls * (parseFloat(price) || 0) * 0.7 * 10).toFixed(0)}
              </p>
              <p className="text-xs text-foreground-muted">If 1K installs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                ${(totalInstalls * (parseFloat(price) || 0) * 0.7 * 100).toFixed(0)}
              </p>
              <p className="text-xs text-foreground-muted">If 10K installs</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-foreground-muted">
            * Revenue projection assumes 70% revenue share (platform takes 30%).
          </p>
        </div>

        {/* Revenue Share Info */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h4 className="mb-2 font-bold text-foreground">Revenue Share</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Publisher (You)</span>
              <span className="font-bold text-success">70%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Platform</span>
              <span className="font-bold text-foreground-muted">30%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Purchase Button ────────────────────────────────────────────────

interface PurchaseButtonProps {
  agentId: string;
  priceUsd: number;
  isFree: boolean;
  isPurchased: boolean;
  onPurchase?: () => Promise<void>;
  onClone?: () => Promise<void>;
}

export function PurchaseButton({
  agentId: _agentId,
  priceUsd,
  isFree,
  isPurchased,
  onPurchase,
  onClone,
}: PurchaseButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (isFree || isPurchased) {
        await onClone?.();
      } else {
        await onPurchase?.();
      }
    } finally {
      setLoading(false);
    }
  };

  if (isFree || isPurchased) {
    return (
      <Button onClick={handleClick} disabled={loading} size="lg" className="w-full">
        {loading ? 'Installing...' : 'Clone to Workspace'}
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={loading} size="lg" className="w-full">
      <CreditCard className="h-5 w-5" />
      {loading ? 'Processing...' : `Purchase for $${priceUsd}`}
    </Button>
  );
}
