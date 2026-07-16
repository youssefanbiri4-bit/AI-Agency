'use client';

import { useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { flushQueue } from '@/lib/pwa/offline-queue';
import { usePWA } from './PWAProvider';

export function OfflineSyncBadge() {
  const { queueCount, isOffline, openQueueManager } = usePWA();
  const [syncing, setSyncing] = useState(false);

  if (queueCount <= 0) return null;

  const onFlush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      await flushQueue();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-20 end-4 z-[90] flex justify-end px-4 sm:bottom-6 sm:end-6">
      <button
        type="button"
        onClick={openQueueManager}
        aria-label={`${queueCount} action${queueCount > 1 ? 's' : ''} queued, tap to manage`}
        className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-2 text-sm font-bold text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-200 hover:border-border-strong hover:shadow-[0_16px_36px_rgba(0,0,0,0.2)] active:scale-[0.97]"
      >
        <CloudOff className={isOffline ? 'h-4 w-4 text-warning' : 'h-4 w-4 text-info'} />
        <span>{queueCount} queued</span>
        <button
          type="button"
          onClick={onFlush}
          disabled={syncing}
          aria-label="Sync now"
          className="rounded-full p-1 transition-colors hover:bg-foreground-muted/10"
        >
          <RefreshCw className={syncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        </button>
      </button>
    </div>
  );
}
