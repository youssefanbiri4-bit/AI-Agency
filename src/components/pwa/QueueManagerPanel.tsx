'use client';

import { useState, useEffect } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  flushQueue,
  getQueuedItems,
  removeQueuedItem,
  retryItem,
  clearQueue,
  subscribeQueueList,
  type QueuedRequest,
} from '@/lib/pwa/offline-queue';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatEndpoint(url: string): string {
  try {
    const u = new URL(url, self.location.origin);
    const parts = u.pathname.split('/').filter(Boolean);
    return `/${parts.slice(-2).join('/')}`;
  } catch {
    return url;
  }
}

interface QueueManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueManagerPanel({ isOpen, onClose }: QueueManagerPanelProps) {
  const [items, setItems] = useState<QueuedRequest[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeQueueList(setItems);
  }, []);

  useEffect(() => {
    if (isOpen) {
      getQueuedItems().then(setItems);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await flushQueue();
    } finally {
      setFlushing(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await retryItem(id);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    await removeQueuedItem(id);
  };

  const handleClearAll = async () => {
    if (items.length === 0) return;
    await clearQueue();
  };

  const failedItems = items.filter((i) => i.retryCount > 0);
  const pendingItems = items.filter((i) => i.retryCount === 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface-elevated shadow-[0_-8px_32px_rgba(0,0,0,0.18)] sm:rounded-2xl max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-foreground-muted" />
            <h2 className="text-sm font-bold text-foreground">
              Offline Queue
            </h2>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
              {items.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close queue panel"
            className="rounded-lg p-1.5 text-foreground-muted/50 transition-colors hover:bg-foreground-muted/10 hover:text-foreground-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                <CloudOff className="h-6 w-6 text-success" />
              </div>
              <p className="mt-3 text-sm font-bold text-foreground">All synced</p>
              <p className="mt-1 text-xs text-foreground-muted">
                No pending offline actions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {failedItems.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-danger">
                    Failed ({failedItems.length})
                  </p>
                  {failedItems.map((item) => (
                    <QueueItem
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      onRetry={() => handleRetry(item.id)}
                      onRemove={() => handleRemove(item.id)}
                      retrying={retryingId === item.id}
                    />
                  ))}
                </div>
              )}

              {pendingItems.length > 0 && (
                <div>
                  {failedItems.length > 0 && (
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                      Pending ({pendingItems.length})
                    </p>
                  )}
                  {pendingItems.map((item) => (
                    <QueueItem
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      onRetry={() => handleRetry(item.id)}
                      onRemove={() => handleRemove(item.id)}
                      retrying={retryingId === item.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
            <button
              type="button"
              onClick={handleFlush}
              disabled={flushing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-70"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', flushing && 'animate-spin')} />
              Sync now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueItem({
  item,
  expanded,
  onToggle,
  onRetry,
  onRemove,
  retrying,
}: {
  item: QueuedRequest;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onRemove: () => void;
  retrying: boolean;
}) {
  const hasFailed = item.retryCount > 0;

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        hasFailed
          ? 'border-danger/30 bg-danger/5'
          : 'border-border bg-surface'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-start"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-foreground-muted/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground-muted">
              {item.method}
            </span>
            <span className="truncate text-xs font-bold text-foreground">
              {item.label || formatEndpoint(item.url)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-foreground-muted">
            <Clock className="h-3 w-3" />
            <span>{formatTimeAgo(item.createdAt)}</span>
            {hasFailed && (
              <>
                <span className="text-danger">·</span>
                <span className="flex items-center gap-0.5 text-danger">
                  <AlertCircle className="h-3 w-3" />
                  {item.retryCount} retry{item.retryCount > 1 ? 'ies' : ''}
                </span>
              </>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-foreground-muted/50" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted/50" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          <div className="space-y-1.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                Endpoint
              </span>
              <p className="mt-0.5 break-all text-xs text-foreground">
                {item.url}
              </p>
            </div>
            {item.body && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  Payload
                </span>
                <pre className="mt-0.5 max-h-20 overflow-auto rounded-lg bg-surface p-2 text-[10px] text-foreground-muted">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(item.body), null, 2);
                    } catch {
                      return item.body;
                    }
                  })()}
                </pre>
              </div>
            )}
            {item.lastError && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger">
                  Last error
                </span>
                <p className="mt-0.5 text-xs text-danger">{item.lastError}</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-70"
            >
              <RefreshCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
              Retry
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
